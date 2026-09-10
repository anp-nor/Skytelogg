// ---- Supabase setup ----
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://mhwwtsvjnmvznphyartv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Em-ZMyseOn8LXXKRXf3FQg_JnFIsT-k';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

let currentUser = null;

// ---- Season handling ----
const SEASONS = ['Innendørs 2026/2027'];

function populateSeasonSelect(selectEl) {
  selectEl.innerHTML = SEASONS.map(s => `<option value="${s}">${s}</option>`).join('');
}

// ---- Local cache (IndexedDB) — used only for offline reading ----
const DB_NAME = 'riflelog';
const DB_VERSION = 1;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e);
  });
}

function cacheSessionsLocally(sessionsArr) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    store.clear();
    sessionsArr.forEach(s => store.put(s));
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

function getCachedSessions() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readonly');
    const req = tx.objectStore('sessions').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

// ---- Row <-> session mapping ----
function rowToSession(row) {
  return {
    id: row.id,
    date: row.date,
    season: row.season,
    category: row.category,
    trainingType: row.training_type,
    notes: row.notes,
    shots: row.shots || [],
    images: row.images || []
  };
}

function sessionToRow(session) {
  return {
    date: session.date,
    season: session.season,
    category: session.category,
    training_type: session.trainingType,
    notes: session.notes,
    shots: session.shots,
    images: session.images
  };
}

// ---- Remote CRUD (Supabase) ----
async function fetchSessions() {
  const { data, error } = await supabase.from('sessions').select('*').order('date', { ascending: false });
  if (error) throw error;
  const mapped = data.map(rowToSession);
  await cacheSessionsLocally(mapped);
  return mapped;
}

async function insertSession(session) {
  const row = { ...sessionToRow(session), user_id: currentUser.id };
  const { data, error } = await supabase.from('sessions').insert(row).select().single();
  if (error) throw error;
  return rowToSession(data);
}

async function updateSessionRemote(id, session) {
  const { error } = await supabase.from('sessions').update(sessionToRow(session)).eq('id', id);
  if (error) throw error;
}

async function deleteSessionRemote(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  if (error) throw error;
}

// ---- Physical training CRUD ----
async function fetchPhysicalSessions() {
  const { data, error } = await supabase.from('physical_sessions').select('*').order('date', { ascending: false });
  if (error) throw error;
  return data;
}

async function insertPhysicalSession(entry) {
  const row = { ...entry, user_id: currentUser.id };
  const { error } = await supabase.from('physical_sessions').insert(row);
  if (error) throw error;
}

// ---- Mental training CRUD ----
async function fetchMentalSessions() {
  const { data, error } = await supabase.from('mental_sessions').select('*').order('date', { ascending: false });
  if (error) throw error;
  return data;
}

async function insertMentalSession(entry) {
  const row = { ...entry, user_id: currentUser.id };
  const { error } = await supabase.from('mental_sessions').insert(row);
  if (error) throw error;
}

// ---- Goals CRUD ----
async function fetchGoals() {
  const { data, error } = await supabase.from('goals').select('*');
  if (error) throw error;
  return data;
}

async function upsertGoal(goal) {
  const row = { ...goal, user_id: currentUser.id };
  const { error } = await supabase.from('goals').upsert(row, { onConflict: 'user_id,season,area' });
  if (error) throw error;
}

// ---- App state ----
let sessions = [];
let physicalSessions = [];
let mentalSessions = [];
let goalsData = [];
let draftShots = [];
let draftImages = [];
let currentDetailId = null;
let editingId = null;
let isDecimalMode = false;
let isPlottMode = false;

function formatScore(score, decimal) {
  return decimal ? Number(score).toFixed(1) : String(score);
}

function buildShotGroups(shotsArray) {
  const groups = [];
  shotsArray.forEach((shot, index) => {
    const last = groups[groups.length - 1];
    if (last && last.position === shot.position) {
      last.items.push({ shot, index });
    } else {
      groups.push({ position: shot.position, items: [{ shot, index }] });
    }
  });
  return groups;
}

// ---- View elements ----
const viewList = document.getElementById('view-list');
const viewAdd = document.getElementById('view-add');
const viewDetail = document.getElementById('view-detail');
const viewStats = document.getElementById('view-stats');
const viewPhysicalAdd = document.getElementById('view-physical-add');
const viewMentalAdd = document.getElementById('view-mental-add');
const viewCalendar = document.getElementById('view-calendar');
const viewGoals = document.getElementById('view-goals');
const bottomNav = document.getElementById('bottom-nav');
const allViews = [viewList, viewAdd, viewDetail, viewStats, viewPhysicalAdd, viewMentalAdd, viewCalendar, viewGoals];

function showView(view) {
  allViews.forEach(v => v.hidden = true);
  view.hidden = false;
  bottomNav.hidden = (view !== viewList);
}

// ---- Rendering: list view ----
function scoreTotal(session) {
  if (session.trainingType === 'Plott') {
    return session.shots.reduce((sum, s) => sum + Number(s.actualScore || 0), 0);
  }
  return session.shots.reduce((sum, s) => sum + Number(s.score || 0), 0);
}

function sessionTitle(session) {
  return session.trainingType || session.category || 'Økt';
}

function renderStats() {
  const statsRow = document.getElementById('stats-row');
  const totalSessions = sessions.length;
  const totalShots = sessions.reduce((sum, s) => sum + s.shots.length, 0);
  const totalGoals = goalsData.length;
  const achievedGoals = goalsData.filter(g => g.achieved).length;

  statsRow.innerHTML = `
    <div class="stat"><div class="stat-value">${totalSessions}</div><div class="stat-label">økter</div></div>
    <div class="stat"><div class="stat-value">${totalShots}</div><div class="stat-label">skudd registrert</div></div>
    <div class="stat"><div class="stat-value">${achievedGoals}/${totalGoals}</div><div class="stat-label">mål oppnådd</div></div>
  `;
}

function computeTypeStats(sessionsArr) {
  const map = {};
  sessionsArr.forEach(s => {
    const key = s.trainingType || 'Uten øvelse';
    const total = scoreTotal(s);
    if (!map[key]) map[key] = { sum: 0, count: 0, best: -Infinity, decimal: s.trainingType === '60 ligg ISSF' };
    map[key].sum += total;
    map[key].count += 1;
    if (total > map[key].best) map[key].best = total;
  });
  return map;
}

function renderTypeStats() {
  const wrap = document.getElementById('type-stats-list');
  const map = computeTypeStats(sessions);
  const keys = Object.keys(map);
  if (keys.length === 0) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = keys.map(key => {
    const { sum, count, best, decimal } = map[key];
    const avg = sum / count;
    return `
      <li class="type-stats-item">
        <div class="type-stats-name">${key}</div>
        <div class="type-stats-values">
          <span>Beste: ${formatScore(best, decimal)}</span>
          <span>Snitt: ${avg.toFixed(1)}</span>
        </div>
      </li>
    `;
  }).join('');
}

function renderSessionList() {
  const list = document.getElementById('session-list');
  const emptyState = document.getElementById('empty-state');
  const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sorted.length === 0) {
    list.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  list.innerHTML = sorted.map(s => `
    <li class="session-item" data-id="${s.id}">
      <div class="session-item-main">
        <div class="session-program">${sessionTitle(s)}</div>
        <div class="session-meta">${formatDate(s.date)}${s.category ? ' · ' + s.category : ''} · ${s.shots.length} skudd</div>
      </div>
      <div class="session-score">${scoreTotal(s)}</div>
    </li>
  `).join('');

  list.querySelectorAll('.session-item').forEach(item => {
    item.addEventListener('click', () => openDetail(item.dataset.id));
  });
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderDetailShotGroups(session) {
  const decimal = session.trainingType === '60 ligg ISSF';
  const groups = buildShotGroups(session.shots);
  let html = '';
  groups.forEach(group => {
    html += group.items.map(({ shot, index }) => `
      <li class="shot-item">
        <span>${index + 1}. ${shot.position}</span>
        <span class="shot-item-right">
          <span class="shot-item-score">${formatScore(shot.score, decimal)}</span>
          ${shot.centerTen ? '<span class="center-ten-badge">S</span>' : ''}
        </span>
      </li>
    `).join('');
    const subtotal = group.items.reduce((sum, { shot }) => sum + Number(shot.score), 0);
    const centerTenCount = group.items.filter(({ shot }) => shot.centerTen).length;
    html += `<li class="shot-subtotal">Sum ${group.position.toLowerCase()}: ${formatScore(subtotal, decimal)} · Sentrumstiere: ${centerTenCount}</li>`;
  });
  if (session.shots.length > 0) {
    const total = session.shots.reduce((sum, s) => sum + Number(s.score), 0);
    const totalCenterTen = session.shots.filter(s => s.centerTen).length;
    html += `<li class="shot-total">Totalt: ${formatScore(total, decimal)} · Sentrumstiere totalt: ${totalCenterTen}</li>`;
  }
  return html;
}

function renderDetailPlott(session) {
  let html = session.shots.map((s, i) => `
    <li class="shot-item">
      <span>${i + 1}. Forv: ${s.expectedScore} ${String(s.expectedDirection).toLowerCase()} · Fakt: ${s.actualScore} ${String(s.actualDirection).toLowerCase()}</span>
    </li>
  `).join('');
  if (session.shots.length > 0) {
    const sumExpected = session.shots.reduce((sum, s) => sum + Number(s.expectedScore), 0);
    const sumActual = session.shots.reduce((sum, s) => sum + Number(s.actualScore), 0);
    html += `<li class="shot-subtotal">Sum forventet: ${sumExpected}</li>`;
    html += `<li class="shot-total">Sum faktisk: ${sumActual}</li>`;
  }
  return html;
}

async function refreshList() {
  try {
    sessions = await fetchSessions();
  } catch (err) {
    console.error('Henting fra Supabase feilet, bruker lokal cache', err);
    sessions = await getCachedSessions();
  }
  try {
    physicalSessions = await fetchPhysicalSessions();
  } catch (err) {
    console.error('Kunne ikke hente fysisk trening', err);
  }
  try {
    mentalSessions = await fetchMentalSessions();
  } catch (err) {
    console.error('Kunne ikke hente mental trening', err);
  }
  try {
    goalsData = await fetchGoals();
  } catch (err) {
    console.error('Kunne ikke hente målsetninger', err);
  }
  renderStats();
  renderTypeStats();
  renderSessionList();
}

// ---- Add session flow ----
function resetAddForm() {
  editingId = null;
  document.getElementById('add-title').textContent = 'Ny økt';
  populateSeasonSelect(document.getElementById('input-season'));
  document.getElementById('input-date').valueAsDate = new Date();
  document.getElementById('input-category').selectedIndex = 0;
  document.getElementById('input-type').selectedIndex = 0;
  document.getElementById('input-notes').value = '';
  document.getElementById('shot-position').selectedIndex = 0;
  draftShots = [];
  draftImages = [];
  renderDraftShots();
  renderDraftImages();
  updateFormModeUI();
}

function openEditForm(session) {
  editingId = session.id;
  document.getElementById('add-title').textContent = 'Rediger økt';
  populateSeasonSelect(document.getElementById('input-season'));
  if (session.season) document.getElementById('input-season').value = session.season;
  document.getElementById('input-date').value = session.date;
  document.getElementById('input-category').value = session.category || 'Trening';
  if (session.trainingType) document.getElementById('input-type').value = session.trainingType;
  document.getElementById('input-notes').value = session.notes || '';
  draftShots = session.shots.map(s => ({ ...s }));
  draftImages = (session.images || []).slice();
  renderDraftShots();
  renderDraftImages();
  updateFormModeUI();
  showView(viewAdd);
}

let currentScore = 10;
function setScoreValue(v) {
  const max = isDecimalMode ? 10.9 : 10;
  let val = Math.max(0, Math.min(max, v));
  if (isDecimalMode) val = parseFloat(val.toFixed(1));
  currentScore = val;
  document.getElementById('score-value').textContent = isDecimalMode ? currentScore.toFixed(1) : String(currentScore);
}

function updateFormModeUI() {
  const typeVal = document.getElementById('input-type').value;
  isPlottMode = typeVal === 'Plott';
  isDecimalMode = typeVal === '60 ligg ISSF';
  document.getElementById('shot-entry-normal').hidden = isPlottMode;
  document.getElementById('shot-entry-plott').hidden = !isPlottMode;
  if (!isPlottMode) {
    setScoreValue(isDecimalMode ? 10.0 : 10);
  }
  renderDraftShots();
}

function renderDraftShots() {
  const list = document.getElementById('shot-list');
  document.getElementById('shots-label').textContent = `Skudd (${draftShots.length})`;

  if (isPlottMode) {
    renderDraftPlottList(list);
    return;
  }

  const groups = buildShotGroups(draftShots);
  let html = '';
  groups.forEach(group => {
    html += group.items.map(({ shot, index }) => `
      <li class="shot-item">
        <span>${index + 1}. ${shot.position}</span>
        <span class="shot-item-right">
          <span class="shot-item-score">${formatScore(shot.score, isDecimalMode)}</span>
          ${shot.centerTen ? '<span class="center-ten-badge">S</span>' : ''}
          <button class="shot-move" data-dir="up" data-index="${index}" ${index === 0 ? 'disabled' : ''} aria-label="Flytt opp">↑</button>
          <button class="shot-move" data-dir="down" data-index="${index}" ${index === draftShots.length - 1 ? 'disabled' : ''} aria-label="Flytt ned">↓</button>
          <button class="shot-remove" data-index="${index}" aria-label="Fjern skudd">×</button>
        </span>
      </li>
    `).join('');
    const subtotal = group.items.reduce((sum, { shot }) => sum + Number(shot.score), 0);
    const centerTenCount = group.items.filter(({ shot }) => shot.centerTen).length;
    html += `<li class="shot-subtotal">Sum ${group.position.toLowerCase()}: ${formatScore(subtotal, isDecimalMode)} · Sentrumstiere: ${centerTenCount}</li>`;
  });
  if (draftShots.length > 0) {
    const total = draftShots.reduce((sum, s) => sum + Number(s.score), 0);
    const totalCenterTen = draftShots.filter(s => s.centerTen).length;
    html += `<li class="shot-total">Totalt: ${formatScore(total, isDecimalMode)} · Sentrumstiere totalt: ${totalCenterTen}</li>`;
  }
  list.innerHTML = html;

  list.querySelectorAll('.shot-move').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.index);
      const j = btn.dataset.dir === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= draftShots.length) return;
      [draftShots[i], draftShots[j]] = [draftShots[j], draftShots[i]];
      renderDraftShots();
    });
  });
  list.querySelectorAll('.shot-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      draftShots.splice(Number(btn.dataset.index), 1);
      renderDraftShots();
    });
  });
}

function renderDraftPlottList(list) {
  let html = draftShots.map((s, i) => `
    <li class="shot-item">
      <span>${i + 1}. Forv: ${s.expectedScore} ${String(s.expectedDirection).toLowerCase()} · Fakt: ${s.actualScore} ${String(s.actualDirection).toLowerCase()}</span>
      <span class="shot-item-right">
        <button class="shot-move" data-dir="up" data-index="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Flytt opp">↑</button>
        <button class="shot-move" data-dir="down" data-index="${i}" ${i === draftShots.length - 1 ? 'disabled' : ''} aria-label="Flytt ned">↓</button>
        <button class="shot-remove" data-index="${i}" aria-label="Fjern skudd">×</button>
      </span>
    </li>
  `).join('');
  if (draftShots.length > 0) {
    const sumExpected = draftShots.reduce((sum, s) => sum + Number(s.expectedScore), 0);
    const sumActual = draftShots.reduce((sum, s) => sum + Number(s.actualScore), 0);
    html += `<li class="shot-subtotal">Sum forventet: ${sumExpected}</li>`;
    html += `<li class="shot-total">Sum faktisk: ${sumActual}</li>`;
  }
  list.innerHTML = html;

  list.querySelectorAll('.shot-move').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.index);
      const j = btn.dataset.dir === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= draftShots.length) return;
      [draftShots[i], draftShots[j]] = [draftShots[j], draftShots[i]];
      renderDraftShots();
    });
  });
  list.querySelectorAll('.shot-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      draftShots.splice(Number(btn.dataset.index), 1);
      renderDraftShots();
    });
  });
}

document.getElementById('fab-add').addEventListener('click', () => {
  document.getElementById('add-menu').hidden = false;
});

document.getElementById('add-menu-cancel').addEventListener('click', () => {
  document.getElementById('add-menu').hidden = true;
});

document.getElementById('add-menu-shooting').addEventListener('click', () => {
  document.getElementById('add-menu').hidden = true;
  resetAddForm();
  showView(viewAdd);
});

document.getElementById('add-menu-physical').addEventListener('click', () => {
  document.getElementById('add-menu').hidden = true;
  resetPhysicalForm();
  showView(viewPhysicalAdd);
});

document.getElementById('add-menu-mental').addEventListener('click', () => {
  document.getElementById('add-menu').hidden = true;
  resetMentalForm();
  showView(viewMentalAdd);
});

document.getElementById('cancel-add').addEventListener('click', () => {
  editingId = null;
  showView(viewList);
});

document.getElementById('score-up').addEventListener('click', () => setScoreValue(currentScore + (isDecimalMode ? 0.1 : 1)));
document.getElementById('score-down').addEventListener('click', () => setScoreValue(currentScore - (isDecimalMode ? 0.1 : 1)));

document.getElementById('input-type').addEventListener('change', updateFormModeUI);

document.getElementById('add-shot').addEventListener('click', () => {
  const position = document.getElementById('shot-position').value;
  const centerTen = document.getElementById('shot-center-ten').checked;
  draftShots.push({ position, score: currentScore, centerTen });
  document.getElementById('shot-center-ten').checked = false;
  renderDraftShots();
});

document.getElementById('add-plott-shot').addEventListener('click', () => {
  const expectedScore = parseFloat(document.getElementById('plott-expected-score').value) || 0;
  const expectedDirection = document.getElementById('plott-expected-direction').value;
  const actualScore = parseFloat(document.getElementById('plott-actual-score').value) || 0;
  const actualDirection = document.getElementById('plott-actual-direction').value;
  draftShots.push({ expectedScore, expectedDirection, actualScore, actualDirection });
  renderDraftShots();
});

// ---- Images ----
function compressImage(file, maxDim = 1600, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderDraftImages() {
  const wrap = document.getElementById('image-thumbs');
  wrap.innerHTML = draftImages.map((src, i) => `
    <div class="image-thumb">
      <img src="${src}" alt="">
      <button class="image-thumb-remove" data-index="${i}" aria-label="Fjern bilde">×</button>
    </div>
  `).join('');
  wrap.querySelectorAll('.image-thumb-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      draftImages.splice(Number(btn.dataset.index), 1);
      renderDraftImages();
    });
  });
}

document.getElementById('pick-images-btn').addEventListener('click', () => {
  document.getElementById('input-images').click();
});

document.getElementById('input-images').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  for (const file of files) {
    try {
      const dataUrl = await compressImage(file);
      draftImages.push(dataUrl);
    } catch (err) {
      console.error('Kunne ikke laste bilde', err);
    }
  }
  renderDraftImages();
  e.target.value = '';
});

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').hidden = false;
}

document.getElementById('lightbox').addEventListener('click', () => {
  document.getElementById('lightbox').hidden = true;
});

document.getElementById('save-session').addEventListener('click', async () => {
  const date = document.getElementById('input-date').value || new Date().toISOString().slice(0, 10);
  const season = document.getElementById('input-season').value;
  const category = document.getElementById('input-category').value;
  const trainingType = document.getElementById('input-type').value;
  const notes = document.getElementById('input-notes').value;

  const session = {
    date,
    season,
    category,
    trainingType,
    notes,
    shots: draftShots,
    images: draftImages
  };

  if (editingId != null) {
    const id = editingId;
    try {
      await updateSessionRemote(id, session);
      editingId = null;
      await refreshList();
      openDetail(id);
    } catch (err) {
      alert('Kunne ikke lagre endringen. Sjekk nettforbindelsen og prøv igjen.');
    }
  } else {
    try {
      await insertSession(session);
      editingId = null;
      await refreshList();
      showView(viewList);
    } catch (err) {
      alert('Kunne ikke lagre økten. Sjekk nettforbindelsen og prøv igjen.');
    }
  }
});

// ---- Detail view ----
async function openDetail(id) {
  currentDetailId = id;
  const session = sessions.find(s => s.id === id);
  if (!session) return;

  document.getElementById('detail-title').textContent = sessionTitle(session);

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="detail-row"><span class="detail-row-label">Dato</span><span class="detail-row-value">${formatDate(session.date)}</span></div>
    ${session.season ? `<div class="detail-row"><span class="detail-row-label">Sesong</span><span class="detail-row-value">${session.season}</span></div>` : ''}
    ${session.category ? `<div class="detail-row"><span class="detail-row-label">Type</span><span class="detail-row-value">${session.category}</span></div>` : ''}
    ${session.trainingType ? `<div class="detail-row"><span class="detail-row-label">Øvelse</span><span class="detail-row-value">${session.trainingType}</span></div>` : ''}
    ${session.trainingType !== 'Plott' ? `<div class="detail-row"><span class="detail-row-label">Totalt poeng</span><span class="detail-row-value">${formatScore(scoreTotal(session), session.trainingType === '60 ligg ISSF')}</span></div>` : ''}
    ${session.notes ? `<div class="detail-row"><span class="detail-row-label">Notater</span><span class="detail-row-value">${escapeHtml(session.notes)}</span></div>` : ''}
    <div class="detail-shots-title">Skudd (${session.shots.length})</div>
    <ul class="shot-list">
      ${session.trainingType === 'Plott' ? renderDetailPlott(session) : renderDetailShotGroups(session)}
    </ul>
    ${session.images && session.images.length ? `
      <div class="detail-shots-title">Bilder (${session.images.length})</div>
      <div class="image-thumbs" id="detail-image-thumbs">
        ${session.images.map((src, i) => `<div class="image-thumb" data-index="${i}"><img src="${src}" alt=""></div>`).join('')}
      </div>
    ` : ''}
  `;

  const detailThumbs = document.getElementById('detail-image-thumbs');
  if (detailThumbs) {
    detailThumbs.querySelectorAll('.image-thumb').forEach(el => {
      el.addEventListener('click', () => openLightbox(session.images[Number(el.dataset.index)]));
    });
  }

  showView(viewDetail);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('back-detail').addEventListener('click', () => showView(viewList));

document.getElementById('edit-session').addEventListener('click', () => {
  const session = sessions.find(s => s.id === currentDetailId);
  if (session) openEditForm(session);
});

document.getElementById('delete-session').addEventListener('click', async () => {
  if (currentDetailId == null) return;
  try {
    await deleteSessionRemote(currentDetailId);
    await refreshList();
    showView(viewList);
  } catch (err) {
    alert('Kunne ikke slette. Sjekk nettforbindelsen og prøv igjen.');
  }
});

// ---- Statistics view ----
document.getElementById('nav-stats').addEventListener('click', () => {
  renderStatsPage();
  showView(viewStats);
});

document.getElementById('back-stats').addEventListener('click', () => showView(viewList));

['filter-category', 'filter-type'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderStatsPage);
});

function shortDateLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

function getFilteredSessions() {
  const category = document.getElementById('filter-category').value;
  const type = document.getElementById('filter-type').value;
  return sessions.filter(s =>
    (!category || s.category === category) &&
    (!type || s.trainingType === type)
  );
}

function renderStatsPage() {
  const filtered = getFilteredSessions().slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const emptyEl = document.getElementById('stats-empty');
  const canvas = document.getElementById('stats-chart');
  const tbody = document.getElementById('stats-table-body');

  if (filtered.length === 0) {
    emptyEl.hidden = false;
    canvas.hidden = true;
    tbody.innerHTML = '';
    return;
  }
  emptyEl.hidden = true;
  canvas.hidden = false;

  const points = filtered.map(s => ({
    value: scoreTotal(s),
    label: shortDateLabel(s.date)
  }));
  drawLineChart(canvas, points);

  tbody.innerHTML = filtered.slice().reverse().map(s => `
    <tr>
      <td>${formatDate(s.date)}</td>
      <td>${s.category || '–'}</td>
      <td>${s.trainingType || '–'}</td>
      <td class="stats-score">${formatScore(scoreTotal(s), s.trainingType === '60 ligg ISSF')}</td>
    </tr>
  `).join('');
}

function drawLineChart(canvas, points) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 300;
  const cssHeight = canvas.clientHeight || 220;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const paddingLeft = 40;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 24;
  const plotWidth = cssWidth - paddingLeft - paddingRight;
  const plotHeight = cssHeight - paddingTop - paddingBottom;

  const values = points.map(p => p.value);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);
  if (minVal === maxVal) { minVal -= 1; maxVal += 1; }
  const pad = (maxVal - minVal) * 0.1;
  minVal -= pad;
  maxVal += pad;

  const xFor = (i) => paddingLeft + (points.length === 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const yFor = (v) => paddingTop + plotHeight - ((v - minVal) / (maxVal - minVal)) * plotHeight;

  ctx.strokeStyle = '#2C2E33';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, paddingTop + plotHeight);
  ctx.lineTo(paddingLeft + plotWidth, paddingTop + plotHeight);
  ctx.stroke();

  ctx.fillStyle = '#8B8D92';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(maxVal.toFixed(0), paddingLeft - 6, paddingTop + 4);
  ctx.fillText(minVal.toFixed(0), paddingLeft - 6, paddingTop + plotHeight);

  ctx.strokeStyle = '#B08D57';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = '#B08D57';
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#8B8D92';
  ctx.textAlign = 'center';
  const labelIndices = points.length <= 5
    ? points.map((_, i) => i)
    : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  labelIndices.forEach(i => {
    ctx.fillText(points[i].label, xFor(i), paddingTop + plotHeight + 16);
  });
}

// ---- Physical training form ----
function resetPhysicalForm() {
  populateSeasonSelect(document.getElementById('physical-season'));
  document.getElementById('physical-date').valueAsDate = new Date();
  document.getElementById('physical-type').selectedIndex = 0;
  document.getElementById('physical-duration').value = '';
  document.getElementById('physical-comment').value = '';
}

document.getElementById('cancel-physical').addEventListener('click', () => showView(viewList));

document.getElementById('save-physical').addEventListener('click', async () => {
  const date = document.getElementById('physical-date').value || new Date().toISOString().slice(0, 10);
  const season = document.getElementById('physical-season').value;
  const type = document.getElementById('physical-type').value;
  const durationVal = document.getElementById('physical-duration').value;
  const duration_minutes = durationVal ? Number(durationVal) : null;
  const comment = document.getElementById('physical-comment').value;
  try {
    await insertPhysicalSession({ date, season, type, duration_minutes, comment });
    await refreshList();
    showView(viewList);
  } catch (err) {
    alert('Kunne ikke lagre. Sjekk nettforbindelsen og prøv igjen.');
  }
});

// ---- Mental training form ----
function resetMentalForm() {
  populateSeasonSelect(document.getElementById('mental-season'));
  document.getElementById('mental-date').valueAsDate = new Date();
  document.getElementById('mental-type').selectedIndex = 0;
  document.getElementById('mental-duration').value = '';
  document.getElementById('mental-comment').value = '';
}

document.getElementById('cancel-mental').addEventListener('click', () => showView(viewList));

document.getElementById('save-mental').addEventListener('click', async () => {
  const date = document.getElementById('mental-date').value || new Date().toISOString().slice(0, 10);
  const season = document.getElementById('mental-season').value;
  const type = document.getElementById('mental-type').value;
  const durationVal = document.getElementById('mental-duration').value;
  const duration_minutes = durationVal ? Number(durationVal) : null;
  const comment = document.getElementById('mental-comment').value;
  try {
    await insertMentalSession({ date, season, type, duration_minutes, comment });
    await refreshList();
    showView(viewList);
  } catch (err) {
    alert('Kunne ikke lagre. Sjekk nettforbindelsen og prøv igjen.');
  }
});

// ---- Calendar ----
let calCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function renderCalendar() {
  const year = calCurrentMonth.getFullYear();
  const month = calCurrentMonth.getMonth();
  document.getElementById('cal-month-label').textContent =
    calCurrentMonth.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Man=0 ... Søn=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid = document.getElementById('calendar-grid');
  let html = '';
  for (let i = 0; i < startWeekday; i++) {
    html += '<div class="calendar-day empty"></div>';
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const key = toDateKey(new Date(year, month, day));
    const hasShooting = sessions.some(s => s.date === key && s.category !== 'Konkurranse');
    const hasCompetition = sessions.some(s => s.date === key && s.category === 'Konkurranse');
    const hasPhysical = physicalSessions.some(p => p.date === key);
    const hasMental = mentalSessions.some(m => m.date === key);
    const dots = [
      hasShooting ? '<span class="dot-shooting"></span>' : '',
      hasCompetition ? '<span class="dot-competition"></span>' : '',
      hasPhysical ? '<span class="dot-physical"></span>' : '',
      hasMental ? '<span class="dot-mental"></span>' : ''
    ].join('');
    html += `
      <div class="calendar-day" data-date="${key}">
        <div>${day}</div>
        <div class="calendar-day-dots">${dots}</div>
      </div>
    `;
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.calendar-day[data-date]').forEach(el => {
    el.addEventListener('click', () => selectCalendarDay(el.dataset.date, el));
  });
}

function selectCalendarDay(dateKey, el) {
  grid_clearSelection();
  el.classList.add('selected');

  const dayLabel = document.getElementById('cal-day-label');
  const dayList = document.getElementById('cal-day-list');
  const dateObj = new Date(dateKey + 'T00:00:00');
  dayLabel.hidden = false;
  dayLabel.textContent = dateObj.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });

  const daySessions = sessions.filter(s => s.date === dateKey);
  const dayPhysical = physicalSessions.filter(p => p.date === dateKey);
  const dayMental = mentalSessions.filter(m => m.date === dateKey);

  if (daySessions.length === 0 && dayPhysical.length === 0 && dayMental.length === 0) {
    dayList.innerHTML = '<li class="type-stats-item">Ingen aktiviteter denne dagen.</li>';
    return;
  }

  let html = '';
  daySessions.forEach(s => {
    html += `
      <li class="session-item" data-id="${s.id}">
        <div class="session-item-main">
          <div class="session-program">${sessionTitle(s)}</div>
          <div class="session-meta">${s.category || ''} · ${s.shots.length} skudd</div>
        </div>
        <div class="session-score">${scoreTotal(s)}</div>
      </li>
    `;
  });
  dayPhysical.forEach(p => {
    html += `
      <li class="session-item">
        <div class="session-item-main">
          <div class="session-program">Fysisk: ${p.type}</div>
          <div class="session-meta">${p.duration_minutes ? p.duration_minutes + ' min' : ''}${p.comment ? ' · ' + p.comment : ''}</div>
        </div>
      </li>
    `;
  });
  dayMental.forEach(m => {
    html += `
      <li class="session-item">
        <div class="session-item-main">
          <div class="session-program">Mentalt: ${m.type}</div>
          <div class="session-meta">${m.duration_minutes ? m.duration_minutes + ' min' : ''}${m.comment ? ' · ' + m.comment : ''}</div>
        </div>
      </li>
    `;
  });

  dayList.innerHTML = html;
  dayList.querySelectorAll('.session-item[data-id]').forEach(item => {
    item.addEventListener('click', () => openDetail(item.dataset.id));
  });
}

function grid_clearSelection() {
  document.querySelectorAll('.calendar-day.selected').forEach(d => d.classList.remove('selected'));
}

function resetCalendarDayView() {
  document.getElementById('cal-day-label').hidden = true;
  document.getElementById('cal-day-list').innerHTML = '';
}

document.getElementById('nav-calendar').addEventListener('click', () => {
  calCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  resetCalendarDayView();
  renderCalendar();
  showView(viewCalendar);
});
document.getElementById('back-calendar').addEventListener('click', () => showView(viewList));
document.getElementById('cal-prev').addEventListener('click', () => {
  calCurrentMonth.setMonth(calCurrentMonth.getMonth() - 1);
  resetCalendarDayView();
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calCurrentMonth.setMonth(calCurrentMonth.getMonth() + 1);
  resetCalendarDayView();
  renderCalendar();
});

// ---- Goals (Målsetninger) ----
const GOAL_AREAS = [
  { key: 'prestasjonsmål', prefix: 'goal-prestasjon' },
  { key: 'teknisk mål', prefix: 'goal-teknisk' },
  { key: 'mentalt mål', prefix: 'goal-mental' }
];

function loadGoalsIntoForm(season) {
  GOAL_AREAS.forEach(({ key, prefix }) => {
    const existing = goalsData.find(g => g.season === season && g.area === key);
    document.getElementById(`${prefix}-line1`).value = existing?.line1 || '';
    document.getElementById(`${prefix}-line2`).value = existing?.line2 || '';
    document.getElementById(`${prefix}-line3`).value = existing?.line3 || '';
    document.getElementById(`${prefix}-comment`).value = existing?.comment || '';
    document.getElementById(`${prefix}-achieved`).checked = !!existing?.achieved;
  });
}

document.getElementById('nav-goals').addEventListener('click', () => {
  populateSeasonSelect(document.getElementById('goals-season'));
  loadGoalsIntoForm(document.getElementById('goals-season').value);
  showView(viewGoals);
});
document.getElementById('back-goals').addEventListener('click', () => showView(viewList));
document.getElementById('goals-season').addEventListener('change', (e) => {
  loadGoalsIntoForm(e.target.value);
});

document.getElementById('save-goals').addEventListener('click', async () => {
  const season = document.getElementById('goals-season').value;
  try {
    for (const { key, prefix } of GOAL_AREAS) {
      await upsertGoal({
        season,
        area: key,
        line1: document.getElementById(`${prefix}-line1`).value,
        line2: document.getElementById(`${prefix}-line2`).value,
        line3: document.getElementById(`${prefix}-line3`).value,
        comment: document.getElementById(`${prefix}-comment`).value,
        achieved: document.getElementById(`${prefix}-achieved`).checked
      });
    }
    await refreshList();
    showView(viewList);
  } catch (err) {
    alert('Kunne ikke lagre målsetninger. Sjekk nettforbindelsen og prøv igjen.');
  }
});

// ---- Init ----
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  applyAuthUI();
  if (currentUser) await refreshList();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    applyAuthUI();
    if (currentUser) {
      if (window.location.hash.includes('access_token')) {
        history.replaceState(null, '', window.location.pathname);
      }
      await refreshList();
    }
  });
}

function applyAuthUI() {
  const loggedIn = !!currentUser;
  document.getElementById('view-login').hidden = loggedIn;
  document.getElementById('app-shell').hidden = !loggedIn;
}

document.getElementById('send-magic-link').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const statusEl = document.getElementById('login-status');
  if (!email) {
    statusEl.textContent = 'Skriv inn e-postadressen din.';
    return;
  }
  statusEl.textContent = 'Sender kode...';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split('#')[0] }
  });
  statusEl.textContent = error
    ? `Feil: ${error.message}`
    : 'Sjekk e-posten din — tast inn koden under.';
});

document.getElementById('verify-otp').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const token = document.getElementById('login-otp').value.trim();
  const statusEl = document.getElementById('login-status');
  if (!email || !token) {
    statusEl.textContent = 'Fyll inn både e-post og kode.';
    return;
  }
  statusEl.textContent = 'Bekrefter...';
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  statusEl.textContent = error ? `Feil: ${error.message}` : 'Innlogget!';
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
});

(async function init() {
  await openDB();
  await initAuth();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
})();
