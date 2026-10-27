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
    images: row.images || [],
    totalShotsFired: row.total_shots_fired,
    klasse: row.klasse || null
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
    images: session.images,
    total_shots_fired: session.totalShotsFired,
    klasse: session.klasse || null
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

async function updatePhysicalSession(id, entry) {
  const { error } = await supabase.from('physical_sessions').update(entry).eq('id', id);
  if (error) throw error;
}

async function deletePhysicalSession(id) {
  const { error } = await supabase.from('physical_sessions').delete().eq('id', id);
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

async function updateMentalSession(id, entry) {
  const { error } = await supabase.from('mental_sessions').update(entry).eq('id', id);
  if (error) throw error;
}

async function deleteMentalSession(id) {
  const { error } = await supabase.from('mental_sessions').delete().eq('id', id);
  if (error) throw error;
}

// ---- Dryfire training CRUD ----
async function fetchDryfireSessions() {
  const { data, error } = await supabase.from('dryfire_sessions').select('*').order('date', { ascending: false });
  if (error) throw error;
  return data;
}

async function insertDryfireSession(entry) {
  const row = { ...entry, user_id: currentUser.id };
  const { error } = await supabase.from('dryfire_sessions').insert(row);
  if (error) throw error;
}

async function updateDryfireSession(id, entry) {
  const { error } = await supabase.from('dryfire_sessions').update(entry).eq('id', id);
  if (error) throw error;
}

async function deleteDryfireSession(id) {
  const { error } = await supabase.from('dryfire_sessions').delete().eq('id', id);
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
let dryfireSessions = [];
let goalsData = [];
let draftShots = [];
let draftImages = [];
let currentDetailId = null;
let editingId = null;
let editingPhysicalId = null;
let editingMentalId = null;
let editingDryfireId = null;
let isDecimalMode = false;
let isPlottMode = false;

// ---- Klasser, programmer og poengregler ----
const KLASSER = ['EJ', '3', '4', '5', 'J', '2', 'V55', 'SK2', 'NU', 'R', 'ER', '1', 'SK1', 'V65', 'V75'];
const KLASSE_GRUPPE = {
  'EJ': 'stå', '3': 'stå', '4': 'stå', '5': 'stå',
  'J': 'kne', '2': 'kne', 'V55': 'kne', 'SK2': 'kne',
  'NU': 'ligg', 'R': 'ligg', 'ER': 'ligg', '1': 'ligg', 'SK1': 'ligg', 'V65': 'ligg', 'V75': 'ligg'
};
const POS_L = 'Liggende', POS_K = 'Knestående', POS_S = 'Stående';
const POS_SHORT = { 'Liggende': 'ligg', 'Knestående': 'kne', 'Stående': 'stå' };
const rep = (p, n) => Array(n).fill(p);

// Returnerer [{position, serie}, ...] for ett skudd per element, eller null (manuell stilling).
function programFlat(type, klasse) {
  const g = KLASSE_GRUPPE[klasse] || null;
  const L = POS_L, K = POS_K, S = POS_S;
  let series = null;
  const matchN = { 'Hel-match': 40, 'Halv-match': 20, 'Kvart-match': 10 }[type];

  if (type === '25 ligg') series = rep(rep(L, 5), 5);
  else if (type === '25 kne') series = rep(rep(K, 5), 5);
  else if (type === '15 stå') series = rep(rep(S, 5), 3);
  else if (type === '60 ligg ISSF') series = rep(rep(L, 10), 6);
  else if (type === 'Omgang') series = [rep(L, 10)];
  else if (!g) series = null;
  else if (type === '35-skuddsprogram') {
    if (g === 'stå') series = [rep(L, 5), rep(S, 5), rep(K, 5), [...rep(S, 3), ...rep(K, 3), ...rep(L, 4)], rep(L, 10)];
    else if (g === 'kne') series = [rep(L, 5), rep(K, 5), rep(L, 5), [...rep(K, 6), ...rep(L, 4)], rep(L, 10)];
    else series = [rep(L, 5), rep(L, 5), rep(L, 5), rep(L, 10), rep(L, 10)];
  } else if (matchN) {
    if (g === 'stå') series = [rep(K, matchN), rep(S, matchN), rep(L, matchN)];
    else if (g === 'kne') series = [rep(L, matchN), rep(K, matchN), rep(L, matchN)];
    else series = [rep(L, matchN), rep(L, matchN), rep(L, matchN)];
  } else if (type === 'Grunnlag') {
    if (g === 'stå') series = [[...rep(S, 3), ...rep(K, 3), ...rep(L, 4)]];
    else if (g === 'kne') series = [[...rep(K, 6), ...rep(L, 4)]];
    else series = [rep(L, 10)];
  }
  if (!series) return null;
  const flat = [];
  series.forEach((positions, i) => positions.forEach(p => flat.push({ position: p, serie: i + 1 })));
  return flat;
}

function formatScore(score, decimal) {
  return decimal ? Number(score).toFixed(1) : String(score);
}

// Enkeltskudd vises med desimal hvis det har det (10.5), ellers som heltall
function formatShotScore(score) {
  const n = Number(score);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Poeng som teller i summer: heltall (nedrundet), unntatt 60 ligg ISSF som har desimaler
function shotPoints(shot, decimal) {
  const n = Number(shot.score) || 0;
  return decimal ? n : Math.floor(n + 1e-9);
}
function sumShots(shots, decimal) {
  const sum = shots.reduce((t, s) => t + shotPoints(s, decimal), 0);
  return decimal ? Math.round(sum * 10) / 10 : sum;
}
function isCenterTen(shot) {
  return shot.centerTen === true || Number(shot.score) >= 10.5;
}
function countCenterTens(shots) {
  return shots.filter(isCenterTen).length;
}
function plottActual(shot) { return Math.floor((Number(shot.actualScore) || 0) + 1e-9); }
function plottExpected(shot) { return Math.floor((Number(shot.expectedScore) || 0) + 1e-9); }

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

// Grupper etter serie (nye økter) eller etter stilling (eldre økter / Annet)
function groupShots(shots) {
  const bySerie = shots.length > 0 && shots.every(s => s.serie != null);
  if (!bySerie) return buildShotGroups(shots);
  const groups = [];
  shots.forEach((shot, index) => {
    const last = groups[groups.length - 1];
    if (last && last.serie === shot.serie) last.items.push({ shot, index });
    else groups.push({ serie: shot.serie, items: [{ shot, index }] });
  });
  return groups;
}

function describePositions(items) {
  const runs = [];
  items.forEach(({ shot }) => {
    const last = runs[runs.length - 1];
    if (last && last.position === shot.position) last.n++;
    else runs.push({ position: shot.position, n: 1 });
  });
  if (runs.length === 1) return String(runs[0].position || '').toLowerCase();
  return runs.map(r => `${r.n} ${POS_SHORT[r.position] || r.position}`).join(', ');
}

function shotListHtml(shots, decimal, editable) {
  const groups = groupShots(shots);
  let html = '';
  groups.forEach(group => {
    const isSerie = group.serie != null;
    if (isSerie) {
      html += `<li class="shot-series-head">Serie ${group.serie} · ${describePositions(group.items)}</li>`;
    }
    html += group.items.map(({ shot, index }) => `
      <li class="shot-item">
        <span>${index + 1}. ${shot.position || ''}</span>
        <span class="shot-item-right">
          <span class="shot-item-score">${decimal ? formatScore(shot.score, true) : formatShotScore(shot.score)}</span>
          ${isCenterTen(shot) ? '<span class="center-ten-badge">S</span>' : ''}
          ${editable ? `
          <button class="shot-move" data-dir="up" data-index="${index}" ${index === 0 ? 'disabled' : ''} aria-label="Flytt opp">↑</button>
          <button class="shot-move" data-dir="down" data-index="${index}" ${index === shots.length - 1 ? 'disabled' : ''} aria-label="Flytt ned">↓</button>
          <button class="shot-remove" data-index="${index}" aria-label="Fjern skudd">×</button>` : ''}
        </span>
      </li>
    `).join('');
    const subtotal = sumShots(group.items.map(i => i.shot), decimal);
    const cx = countCenterTens(group.items.map(i => i.shot));
    const label = isSerie ? `serie ${group.serie}` : String(group.position || '').toLowerCase();
    html += `<li class="shot-subtotal">Sum ${label}: ${formatScore(subtotal, decimal)} · Sentrumstiere: ${cx}</li>`;
  });
  if (shots.length > 0) {
    html += `<li class="shot-total">Totalt: ${formatScore(sumShots(shots, decimal), decimal)} · Sentrumstiere totalt: ${countCenterTens(shots)}</li>`;
  }
  return html;
}

// ---- View elements ----
const viewList = document.getElementById('view-list');
const viewAdd = document.getElementById('view-add');
const viewDetail = document.getElementById('view-detail');
const viewStats = document.getElementById('view-stats');
const viewPhysicalAdd = document.getElementById('view-physical-add');
const viewMentalAdd = document.getElementById('view-mental-add');
const viewDryfireAdd = document.getElementById('view-dryfire-add');
const viewCalendar = document.getElementById('view-calendar');
const viewGoals = document.getElementById('view-goals');
const viewHistory = document.getElementById('view-history');
const bottomNav = document.getElementById('bottom-nav');
const allViews = [viewList, viewAdd, viewDetail, viewStats, viewPhysicalAdd, viewMentalAdd, viewDryfireAdd, viewCalendar, viewGoals, viewHistory];

function showView(view) {
  allViews.forEach(v => v.hidden = true);
  view.hidden = false;
  bottomNav.hidden = (view !== viewList);
}

// ---- Rendering: list view ----
function scoreTotal(session) {
  if (session.trainingType === 'Plott') {
    return session.shots.reduce((sum, s) => sum + plottActual(s), 0);
  }
  return sumShots(session.shots, session.trainingType === '60 ligg ISSF');
}

function sessionTitle(session) {
  return session.trainingType || session.category || 'Økt';
}

function renderStats() {
  const statsRow = document.getElementById('stats-row');
  const totalGoalSlots = goalsData.length * 3;
  const achievedGoalSlots = goalsData.reduce((sum, g) =>
    sum + (g.achieved1 ? 1 : 0) + (g.achieved2 ? 1 : 0) + (g.achieved3 ? 1 : 0), 0);
  const totalShotsFired = sessions.reduce((sum, s) => sum + (Number(s.totalShotsFired) || 0), 0);

  statsRow.innerHTML = `
    <div class="stat"><div class="stat-value">${sessions.length}</div><div class="stat-label">skyting</div></div>
    <div class="stat"><div class="stat-value">${physicalSessions.length}</div><div class="stat-label">fysisk</div></div>
    <div class="stat"><div class="stat-value">${mentalSessions.length}</div><div class="stat-label">mentalt</div></div>
    <div class="stat"><div class="stat-value">${dryfireSessions.length}</div><div class="stat-label">tørrtrening</div></div>
    <div class="stat"><div class="stat-value">${totalShotsFired}</div><div class="stat-label">skudd totalt</div></div>
    <div class="stat"><div class="stat-value">${achievedGoalSlots}/${totalGoalSlots}</div><div class="stat-label">mål oppnådd</div></div>
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

function buildHistoryItems() {
  const items = [];
  sessions.forEach(s => items.push({
    kind: 'skyting', date: s.date, title: sessionTitle(s),
    meta: `${s.category || ''} · ${s.shots.length} skudd`,
    score: scoreTotal(s), data: s
  }));
  physicalSessions.forEach(p => items.push({
    kind: 'fysisk', date: p.date, title: `Fysisk: ${p.type}`,
    meta: `${p.duration_minutes ? p.duration_minutes + ' min' : ''}${p.comment ? ' · ' + p.comment : ''}`,
    score: null, data: p
  }));
  mentalSessions.forEach(m => items.push({
    kind: 'mentalt', date: m.date, title: `Mentalt: ${m.type}`,
    meta: `${m.duration_minutes ? m.duration_minutes + ' min' : ''}${m.comment ? ' · ' + m.comment : ''}`,
    score: null, data: m
  }));
  dryfireSessions.forEach(d => items.push({
    kind: 'tørrtrening', date: d.date, title: `Tørrtrening: ${d.type}`,
    meta: `${d.duration_minutes ? d.duration_minutes + ' min' : ''}${d.shot_count ? ' · ' + d.shot_count + ' skudd' : ''}${d.comment ? ' · ' + d.comment : ''}`,
    score: null, data: d
  }));
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  return items;
}

function renderHistoryList() {
  const list = document.getElementById('history-list');
  const emptyState = document.getElementById('history-empty');
  const items = buildHistoryItems();

  if (items.length === 0) {
    list.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  list.innerHTML = items.map((item, i) => `
    <li class="session-item" data-index="${i}">
      <div class="session-item-main">
        <div class="session-program">${item.title}</div>
        <div class="session-meta">${formatDate(item.date)}${item.meta ? ' · ' + item.meta : ''}</div>
      </div>
      ${item.score !== null ? `<div class="session-score">${item.score}</div>` : ''}
    </li>
  `).join('');

  list.querySelectorAll('.session-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = items[Number(el.dataset.index)];
      if (item.kind === 'skyting') openDetail(item.data.id);
      else if (item.kind === 'fysisk') openPhysicalDetail(item.data);
      else if (item.kind === 'mentalt') openMentalDetail(item.data);
      else if (item.kind === 'tørrtrening') openDryfireDetail(item.data);
    });
  });
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderDetailShotGroups(session) {
  return shotListHtml(session.shots, session.trainingType === '60 ligg ISSF', false);
}

function renderDetailPlott(session) {
  let html = session.shots.map((s, i) => `
    <li class="shot-item">
      <span>${i + 1}. Forv: ${s.expectedScore} ${String(s.expectedDirection).toLowerCase()} · Fakt: ${s.actualScore} ${String(s.actualDirection).toLowerCase()}</span>
    </li>
  `).join('');
  if (session.shots.length > 0) {
    const sumExpected = session.shots.reduce((sum, s) => sum + plottExpected(s), 0);
    const sumActual = session.shots.reduce((sum, s) => sum + plottActual(s), 0);
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
    dryfireSessions = await fetchDryfireSessions();
  } catch (err) {
    console.error('Kunne ikke hente tørrtrening', err);
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
}

// ---- Profil (navn og klasse) ----
let profile = { name: '', klasse: '' };
let draftKlasse = '';
let draftFlat = null;
let draftLegacy = false;

function profileKey() {
  return 'skytelogg_profile_' + (currentUser ? currentUser.id : 'anon');
}

async function loadProfile() {
  try {
    const local = JSON.parse(localStorage.getItem(profileKey()) || 'null');
    if (local) profile = { name: local.name || '', klasse: local.klasse || '' };
  } catch (e) { /* ignorer */ }
  try {
    const { data } = await supabase.from('profiles').select('name, klasse').eq('id', currentUser.id).maybeSingle();
    if (data && (data.name || data.klasse)) {
      profile = { name: data.name || '', klasse: data.klasse || '' };
      try { localStorage.setItem(profileKey(), JSON.stringify(profile)); } catch (e) { /* ignorer */ }
    }
  } catch (e) { /* kolonnene finnes kanskje ikke ennå */ }
  renderProfile();
}

function renderProfile() {
  const sel = document.getElementById('profile-klasse');
  if (!sel.options.length) {
    sel.innerHTML = '<option value="">Velg klasse</option>' +
      KLASSER.map(k => `<option value="${k}">${k}</option>`).join('');
  }
  sel.value = profile.klasse || '';
  document.getElementById('profile-name').value = profile.name || '';
}

async function saveProfile() {
  profile = {
    name: document.getElementById('profile-name').value.trim(),
    klasse: document.getElementById('profile-klasse').value
  };
  try { localStorage.setItem(profileKey(), JSON.stringify(profile)); } catch (e) { /* ignorer */ }
  try {
    await supabase.from('profiles').upsert(
      { id: currentUser.id, email: currentUser.email, name: profile.name || null, klasse: profile.klasse || null },
      { onConflict: 'id' }
    );
  } catch (e) { /* lokal kopi holder */ }
}

document.getElementById('profile-name').addEventListener('change', saveProfile);
document.getElementById('profile-klasse').addEventListener('change', saveProfile);

// ---- Add session flow ----
function resetAddForm() {
  editingId = null;
  draftLegacy = false;
  draftKlasse = profile.klasse || '';
  document.getElementById('add-title').textContent = 'Ny økt';
  populateSeasonSelect(document.getElementById('input-season'));
  document.getElementById('input-date').valueAsDate = new Date();
  document.getElementById('input-category').selectedIndex = 0;
  document.getElementById('input-type').selectedIndex = 0;
  document.getElementById('input-stilling').selectedIndex = 0;
  document.getElementById('input-total-shots').value = '';
  document.getElementById('input-notes').value = '';
  document.getElementById('shot-score').value = '';
  setScanStatus('', '');
  draftShots = [];
  draftImages = [];
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
  document.getElementById('input-total-shots').value = session.totalShotsFired || '';
  document.getElementById('input-notes').value = session.notes || '';
  document.getElementById('shot-score').value = '';
  setScanStatus('', '');
  draftKlasse = session.klasse || '';
  draftShots = session.shots.map(s => ({ ...s }));
  draftLegacy = session.trainingType !== 'Plott' && draftShots.length > 0 && !draftShots.every(s => s.serie != null);
  const lastPos = draftShots.length ? draftShots[draftShots.length - 1].position : null;
  document.getElementById('input-stilling').value = lastPos || POS_L;
  draftImages = (session.images || []).slice();
  renderDraftImages();
  updateFormModeUI();
  showView(viewAdd);
}

function applyLayoutToDraft() {
  if (!draftFlat) return;
  draftShots.forEach((s, i) => {
    const f = draftFlat[Math.min(i, draftFlat.length - 1)];
    s.position = f.position;
    s.serie = f.serie;
  });
}

function updateFormModeUI() {
  const typeVal = document.getElementById('input-type').value;
  isPlottMode = typeVal === 'Plott';
  isDecimalMode = typeVal === '60 ligg ISSF';
  draftFlat = (isPlottMode || typeVal === 'Annet' || draftLegacy) ? null : programFlat(typeVal, draftKlasse);
  const manual = !isPlottMode && !draftFlat;

  document.getElementById('shot-entry-normal').hidden = isPlottMode;
  document.getElementById('shot-entry-plott').hidden = !isPlottMode;
  document.getElementById('stilling-block').hidden = !(isPlottMode || manual);

  const info = document.getElementById('klasse-info');
  let note = '';
  if (draftFlat && draftKlasse) note = `Klasse ${draftKlasse} – serier og stillinger settes automatisk.`;
  else if (draftFlat) note = 'Serier og stillinger settes automatisk.';
  else if (!isPlottMode && typeVal !== 'Annet' && !draftLegacy && !draftKlasse) note = 'Velg klasse på forsiden for å få riktige serier og stillinger. Inntil da velger du stilling selv.';
  else if (draftLegacy) note = 'Eldre økt – stilling velges manuelt for nye skudd.';
  info.hidden = !note;
  info.innerHTML = note ? `<span class="klasse-note">${note}</span>` : '';

  applyLayoutToDraft();
  renderDraftShots();
}

function renderShotSummary() {
  const el = document.getElementById('shot-summary');
  const n = draftShots.length;
  if (n === 0) { el.textContent = ''; return; }
  if (isPlottMode) {
    el.textContent = `Faktisk ${draftShots.reduce((t, s) => t + plottActual(s), 0)} · ${n} skudd`;
    return;
  }
  el.textContent = `Totalt ${formatScore(sumShots(draftShots, isDecimalMode), isDecimalMode)} · ${countCenterTens(draftShots)}x · ${n} skudd`;
}

function renderNextHint() {
  const el = document.getElementById('shot-next');
  const addBtn = document.getElementById('add-shot');
  addBtn.disabled = false;
  if (isPlottMode) { el.textContent = ''; return; }
  const n = draftShots.length;
  if (draftFlat) {
    if (n >= draftFlat.length) {
      el.textContent = `Alle ${draftFlat.length} skudd i programmet er lagt inn.`;
      addBtn.disabled = true;
    } else {
      const f = draftFlat[n];
      el.textContent = `Neste: skudd ${n + 1} av ${draftFlat.length} · serie ${f.serie} · ${f.position.toLowerCase()}`;
    }
  } else {
    el.textContent = '';
  }
}

function bindDraftListButtons(list) {
  list.querySelectorAll('.shot-move').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.index);
      const j = btn.dataset.dir === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= draftShots.length) return;
      [draftShots[i], draftShots[j]] = [draftShots[j], draftShots[i]];
      applyLayoutToDraft();
      renderDraftShots();
    });
  });
  list.querySelectorAll('.shot-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      draftShots.splice(Number(btn.dataset.index), 1);
      applyLayoutToDraft();
      renderDraftShots();
    });
  });
}

function renderDraftShots() {
  const list = document.getElementById('shot-list');
  document.getElementById('shots-label').textContent = `Skudd (${draftShots.length})`;
  renderShotSummary();
  renderNextHint();

  if (isPlottMode) {
    renderDraftPlottList(list);
    return;
  }
  list.innerHTML = shotListHtml(draftShots, isDecimalMode, true);
  bindDraftListButtons(list);
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
    const sumExpected = draftShots.reduce((sum, s) => sum + plottExpected(s), 0);
    const sumActual = draftShots.reduce((sum, s) => sum + plottActual(s), 0);
    html += `<li class="shot-subtotal">Sum forventet: ${sumExpected}</li>`;
    html += `<li class="shot-total">Sum faktisk: ${sumActual}</li>`;
  }
  list.innerHTML = html;
  bindDraftListButtons(list);
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

document.getElementById('add-menu-dryfire').addEventListener('click', () => {
  document.getElementById('add-menu').hidden = true;
  resetDryfireForm();
  showView(viewDryfireAdd);
});

document.getElementById('cancel-add').addEventListener('click', () => {
  editingId = null;
  showView(viewList);
});

document.getElementById('input-type').addEventListener('change', updateFormModeUI);

function addNormalShot() {
  const input = document.getElementById('shot-score');
  const raw = input.value.trim().replace(',', '.');
  const score = parseFloat(raw);
  if (raw === '' || isNaN(score) || score < 0 || score > 10.9) {
    alert('Skriv inn poeng mellom 0 og 10,9 (f.eks. 10,5).');
    input.focus();
    return;
  }
  const n = draftShots.length;
  let position, serie;
  if (draftFlat) {
    if (n >= draftFlat.length) return;
    position = draftFlat[n].position;
    serie = draftFlat[n].serie;
  } else {
    position = document.getElementById('input-stilling').value;
  }
  const shot = { position, score: Math.round(score * 10) / 10, centerTen: score >= 10.5 };
  if (serie != null) shot.serie = serie;
  draftShots.push(shot);
  input.value = '';
  renderDraftShots();
  input.focus();
}

document.getElementById('add-shot').addEventListener('click', addNormalShot);
document.getElementById('shot-score').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addNormalShot(); }
});

document.getElementById('add-plott-shot').addEventListener('click', () => {
  const expectedScore = parseFloat(document.getElementById('plott-expected-score').value) || 0;
  const expectedDirection = document.getElementById('plott-expected-direction').value;
  const actualScore = parseFloat(document.getElementById('plott-actual-score').value) || 0;
  const actualDirection = document.getElementById('plott-actual-direction').value;
  const position = document.getElementById('input-stilling').value;
  draftShots.push({ position, expectedScore, expectedDirection, actualScore, actualDirection });
  renderDraftShots();
});

// ---- Skann skytelapp ----
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function setScanStatus(html, kind) {
  const el = document.getElementById('scan-status');
  el.className = 'scan-status' + (kind ? ' scan-' + kind : '');
  el.innerHTML = html;
}

function nameTokens(n) {
  return String(n || '').toLowerCase().split(/[\s-]+/).filter(t => t.length > 1);
}

async function scanSlip(file) {
  let mediaType, data;
  if (file.type === 'application/pdf') {
    if (file.size > 6 * 1024 * 1024) throw new Error('PDF-en er for stor (maks 6 MB).');
    mediaType = 'application/pdf';
    data = (await readFileAsDataURL(file)).split(',')[1];
  } else {
    const url = await compressImage(file, 2200, 0.85);
    mediaType = 'image/jpeg';
    data = url.split(',')[1];
  }
  const { data: res, error } = await supabase.functions.invoke('scan-skytelapp', { body: { mediaType, data } });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* ignorer */ }
    throw new Error(msg);
  }
  if (!res || res.error || !res.result) throw new Error((res && res.error) || 'Ingen svar fra skanningen.');
  return res.result;
}

function applyScanResult(r) {
  const typeVal = document.getElementById('input-type').value;
  const allSeries = Array.isArray(r.serier) ? r.serier : [];
  const series = allSeries.filter(s => !s.prove);
  const proveCount = allSeries.filter(s => s.prove).reduce((t, s) => t + (s.skudd || []).length, 0);
  const scores = series.flatMap(s => (s.skudd || []));
  const warnings = [];

  if (isPlottMode) {
    setScanStatus('Skanning støttes ikke for Plott.', 'warn');
    return;
  }
  if (scores.length === 0) {
    setScanStatus('Fant ingen skudd på lappen.', 'warn');
    return;
  }
  if (scores.some(v => typeof v !== 'number' || isNaN(v))) {
    const n = scores.filter(v => typeof v !== 'number' || isNaN(v)).length;
    setScanStatus(`${n} skudd var uleselige. Prøv et skarpere bilde eller PDF.`, 'warn');
    return;
  }

  // Antall skudd må passe med programmet
  if (draftFlat && scores.length !== draftFlat.length) {
    const fits = [...document.getElementById('input-type').options]
      .map(o => o.value)
      .filter(t => { const f = programFlat(t, draftKlasse); return f && f.length === scores.length; });
    setScanStatus(
      `Lappen har ${scores.length} skudd, men «${typeVal}» har ${draftFlat.length}. ` +
      (fits.length ? `Velg ${fits.map(f => '«' + f + '»').join(' eller ')} og skann på nytt.` : 'Velg riktig øvelse og skann på nytt.'),
      'warn'
    );
    return;
  }

  draftShots = scores.map((score, i) => {
    const f = draftFlat ? draftFlat[i] : null;
    const shot = {
      position: f ? f.position : document.getElementById('input-stilling').value,
      score: Math.round(score * 10) / 10,
      centerTen: score >= 10.5
    };
    if (f) shot.serie = f.serie;
    return shot;
  });

  if (/^\d{4}-\d{2}-\d{2}$/.test(r.dato || '')) document.getElementById('input-date').value = r.dato;
  const notesEl = document.getElementById('input-notes');
  if (!notesEl.value.trim() && r.stevne) notesEl.value = r.stevne;

  // Kontroller mot summene som står på lappen
  series.forEach((s, i) => {
    const part = s.skudd || [];
    const mine = sumShots(part.map(v => ({ score: v })), isDecimalMode);
    if (typeof s.trykt_sum === 'number' && Math.abs(mine - s.trykt_sum) > (isDecimalMode ? 0.05 : 0)) {
      warnings.push(`Serie ${i + 1}: jeg får ${formatScore(mine, isDecimalMode)}, lappen sier ${s.trykt_sum}.`);
    }
    if (typeof s.trykt_sentrum === 'number' && countCenterTens(part.map(v => ({ score: v }))) !== s.trykt_sentrum) {
      warnings.push(`Serie ${i + 1}: sentrumstiere avviker fra lappen (${s.trykt_sentrum}).`);
    }
  });
  if (typeof r.trykt_total === 'number') {
    const mine = sumShots(scores.map(v => ({ score: v })), isDecimalMode);
    if (Math.abs(mine - r.trykt_total) > (isDecimalMode ? 0.05 : 0)) {
      warnings.push(`Totalsum: jeg får ${formatScore(mine, isDecimalMode)}, lappen sier ${r.trykt_total}.`);
    }
  }
  if (profile.name && r.navn) {
    const mineT = nameTokens(profile.name);
    const slipT = nameTokens(r.navn);
    if (!mineT.some(t => slipT.includes(t))) warnings.push(`Navnet på lappen (${escapeHtml(r.navn)}) ser ikke ut til å være ditt.`);
  }
  if (draftKlasse && r.klasse && String(r.klasse).trim().toLowerCase() !== draftKlasse.toLowerCase()) {
    warnings.push(`Klassen på lappen (${escapeHtml(r.klasse)}) er ikke den samme som din (${draftKlasse}).`);
  }
  if (r.merknader) warnings.push(escapeHtml(r.merknader));
  const totalEl = document.getElementById('input-total-shots');
  if (!totalEl.value) totalEl.value = scores.length + proveCount;

  applyLayoutToDraft();
  renderDraftShots();
  const proveNote = proveCount ? ` ${proveCount} prøveskudd ble hoppet over og er regnet med i «Antall skudd totalt».` : '';
  if (warnings.length) {
    setScanStatus(`Utkast fylt ut (${scores.length} skudd).${proveNote} Sjekk dette:<br>• ${warnings.join('<br>• ')}`, 'warn');
  } else {
    setScanStatus(`Utkast fylt ut: ${scores.length} skudd.${proveNote} Summer og sentrumstiere stemmer med lappen. Se over og trykk Lagre.`, 'ok');
  }
}

document.getElementById('scan-btn').addEventListener('click', () => {
  document.getElementById('scan-file').click();
});

document.getElementById('scan-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (draftShots.length > 0 && !confirm('Skanningen erstatter skuddene du allerede har lagt inn. Fortsette?')) return;
  const btn = document.getElementById('scan-btn');
  btn.disabled = true;
  setScanStatus('Leser skytelappen… det kan ta opptil et halvt minutt.', '');
  try {
    const result = await scanSlip(file);
    applyScanResult(result);
  } catch (err) {
    setScanStatus('Skanningen feilet: ' + escapeHtml(err.message || String(err)), 'warn');
  } finally {
    btn.disabled = false;
  }
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
  const totalShotsVal = document.getElementById('input-total-shots').value;
  const totalShotsFired = totalShotsVal ? Number(totalShotsVal) : null;
  const notes = document.getElementById('input-notes').value;

  const session = {
    date,
    season,
    category,
    trainingType,
    totalShotsFired,
    notes,
    klasse: draftKlasse || null,
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
    ${session.klasse ? `<div class="detail-row"><span class="detail-row-label">Klasse</span><span class="detail-row-value">${session.klasse}</span></div>` : ''}
    ${session.trainingType ? `<div class="detail-row"><span class="detail-row-label">Øvelse</span><span class="detail-row-value">${session.trainingType}</span></div>` : ''}
    ${session.trainingType !== 'Plott' ? `<div class="detail-row"><span class="detail-row-label">Totalt poeng</span><span class="detail-row-value">${formatScore(scoreTotal(session), session.trainingType === '60 ligg ISSF')}</span></div>` : ''}
    ${session.totalShotsFired ? `<div class="detail-row"><span class="detail-row-label">Antall skudd totalt</span><span class="detail-row-value">${session.totalShotsFired}</span></div>` : ''}
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
  editingPhysicalId = null;
  document.getElementById('physical-title').textContent = 'Fysisk trening';
  document.getElementById('delete-physical').hidden = true;
  populateSeasonSelect(document.getElementById('physical-season'));
  document.getElementById('physical-date').valueAsDate = new Date();
  document.getElementById('physical-type').selectedIndex = 0;
  document.getElementById('physical-duration').value = '';
  document.getElementById('physical-comment').value = '';
}

function openPhysicalDetail(entry) {
  editingPhysicalId = entry.id;
  document.getElementById('physical-title').textContent = 'Rediger fysisk trening';
  document.getElementById('delete-physical').hidden = false;
  populateSeasonSelect(document.getElementById('physical-season'));
  if (entry.season) document.getElementById('physical-season').value = entry.season;
  document.getElementById('physical-date').value = entry.date;
  document.getElementById('physical-type').value = entry.type;
  document.getElementById('physical-duration').value = entry.duration_minutes || '';
  document.getElementById('physical-comment').value = entry.comment || '';
  showView(viewPhysicalAdd);
}

document.getElementById('cancel-physical').addEventListener('click', () => {
  showView(editingPhysicalId != null ? viewHistory : viewList);
});

document.getElementById('save-physical').addEventListener('click', async () => {
  const date = document.getElementById('physical-date').value || new Date().toISOString().slice(0, 10);
  const season = document.getElementById('physical-season').value;
  const type = document.getElementById('physical-type').value;
  const durationVal = document.getElementById('physical-duration').value;
  const duration_minutes = durationVal ? Number(durationVal) : null;
  const comment = document.getElementById('physical-comment').value;
  try {
    if (editingPhysicalId != null) {
      await updatePhysicalSession(editingPhysicalId, { date, season, type, duration_minutes, comment });
      editingPhysicalId = null;
      await refreshList();
      renderHistoryList();
      showView(viewHistory);
    } else {
      await insertPhysicalSession({ date, season, type, duration_minutes, comment });
      await refreshList();
      showView(viewList);
    }
  } catch (err) {
    alert('Kunne ikke lagre. Sjekk nettforbindelsen og prøv igjen.');
  }
});

document.getElementById('delete-physical').addEventListener('click', async () => {
  if (editingPhysicalId == null) return;
  try {
    await deletePhysicalSession(editingPhysicalId);
    editingPhysicalId = null;
    await refreshList();
    renderHistoryList();
    showView(viewHistory);
  } catch (err) {
    alert('Kunne ikke slette. Sjekk nettforbindelsen og prøv igjen.');
  }
});

// ---- Mental training form ----
function resetMentalForm() {
  editingMentalId = null;
  document.getElementById('mental-title').textContent = 'Mental trening';
  document.getElementById('delete-mental').hidden = true;
  populateSeasonSelect(document.getElementById('mental-season'));
  document.getElementById('mental-date').valueAsDate = new Date();
  document.getElementById('mental-type').selectedIndex = 0;
  document.getElementById('mental-duration').value = '';
  document.getElementById('mental-comment').value = '';
}

function openMentalDetail(entry) {
  editingMentalId = entry.id;
  document.getElementById('mental-title').textContent = 'Rediger mental trening';
  document.getElementById('delete-mental').hidden = false;
  populateSeasonSelect(document.getElementById('mental-season'));
  if (entry.season) document.getElementById('mental-season').value = entry.season;
  document.getElementById('mental-date').value = entry.date;
  document.getElementById('mental-type').value = entry.type;
  document.getElementById('mental-duration').value = entry.duration_minutes || '';
  document.getElementById('mental-comment').value = entry.comment || '';
  showView(viewMentalAdd);
}

document.getElementById('cancel-mental').addEventListener('click', () => {
  showView(editingMentalId != null ? viewHistory : viewList);
});

document.getElementById('save-mental').addEventListener('click', async () => {
  const date = document.getElementById('mental-date').value || new Date().toISOString().slice(0, 10);
  const season = document.getElementById('mental-season').value;
  const type = document.getElementById('mental-type').value;
  const durationVal = document.getElementById('mental-duration').value;
  const duration_minutes = durationVal ? Number(durationVal) : null;
  const comment = document.getElementById('mental-comment').value;
  try {
    if (editingMentalId != null) {
      await updateMentalSession(editingMentalId, { date, season, type, duration_minutes, comment });
      editingMentalId = null;
      await refreshList();
      renderHistoryList();
      showView(viewHistory);
    } else {
      await insertMentalSession({ date, season, type, duration_minutes, comment });
      await refreshList();
      showView(viewList);
    }
  } catch (err) {
    alert('Kunne ikke lagre. Sjekk nettforbindelsen og prøv igjen.');
  }
});

document.getElementById('delete-mental').addEventListener('click', async () => {
  if (editingMentalId == null) return;
  try {
    await deleteMentalSession(editingMentalId);
    editingMentalId = null;
    await refreshList();
    renderHistoryList();
    showView(viewHistory);
  } catch (err) {
    alert('Kunne ikke slette. Sjekk nettforbindelsen og prøv igjen.');
  }
});

// ---- Dryfire training form ----
function resetDryfireForm() {
  editingDryfireId = null;
  document.getElementById('dryfire-title').textContent = 'Tørrtrening';
  document.getElementById('delete-dryfire').hidden = true;
  populateSeasonSelect(document.getElementById('dryfire-season'));
  document.getElementById('dryfire-date').valueAsDate = new Date();
  document.getElementById('dryfire-type').selectedIndex = 0;
  document.getElementById('dryfire-duration').value = '';
  document.getElementById('dryfire-shots').value = '';
  document.getElementById('dryfire-comment').value = '';
}

function openDryfireDetail(entry) {
  editingDryfireId = entry.id;
  document.getElementById('dryfire-title').textContent = 'Rediger tørrtrening';
  document.getElementById('delete-dryfire').hidden = false;
  populateSeasonSelect(document.getElementById('dryfire-season'));
  if (entry.season) document.getElementById('dryfire-season').value = entry.season;
  document.getElementById('dryfire-date').value = entry.date;
  document.getElementById('dryfire-type').value = entry.type;
  document.getElementById('dryfire-duration').value = entry.duration_minutes || '';
  document.getElementById('dryfire-shots').value = entry.shot_count || '';
  document.getElementById('dryfire-comment').value = entry.comment || '';
  showView(viewDryfireAdd);
}

document.getElementById('cancel-dryfire').addEventListener('click', () => {
  showView(editingDryfireId != null ? viewHistory : viewList);
});

document.getElementById('save-dryfire').addEventListener('click', async () => {
  const date = document.getElementById('dryfire-date').value || new Date().toISOString().slice(0, 10);
  const season = document.getElementById('dryfire-season').value;
  const type = document.getElementById('dryfire-type').value;
  const durationVal = document.getElementById('dryfire-duration').value;
  const duration_minutes = durationVal ? Number(durationVal) : null;
  const shotsVal = document.getElementById('dryfire-shots').value;
  const shot_count = shotsVal ? Number(shotsVal) : null;
  const comment = document.getElementById('dryfire-comment').value;
  try {
    if (editingDryfireId != null) {
      await updateDryfireSession(editingDryfireId, { date, season, type, duration_minutes, shot_count, comment });
      editingDryfireId = null;
      await refreshList();
      renderHistoryList();
      showView(viewHistory);
    } else {
      await insertDryfireSession({ date, season, type, duration_minutes, shot_count, comment });
      await refreshList();
      showView(viewList);
    }
  } catch (err) {
    alert('Kunne ikke lagre. Sjekk nettforbindelsen og prøv igjen.');
  }
});

document.getElementById('delete-dryfire').addEventListener('click', async () => {
  if (editingDryfireId == null) return;
  try {
    await deleteDryfireSession(editingDryfireId);
    editingDryfireId = null;
    await refreshList();
    renderHistoryList();
    showView(viewHistory);
  } catch (err) {
    alert('Kunne ikke slette. Sjekk nettforbindelsen og prøv igjen.');
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
    const hasDryfire = dryfireSessions.some(d => d.date === key);
    const dots = [
      hasShooting ? '<span class="dot-shooting"></span>' : '',
      hasCompetition ? '<span class="dot-competition"></span>' : '',
      hasPhysical ? '<span class="dot-physical"></span>' : '',
      hasMental ? '<span class="dot-mental"></span>' : '',
      hasDryfire ? '<span class="dot-dryfire"></span>' : ''
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
  const dayDryfire = dryfireSessions.filter(d => d.date === dateKey);

  if (daySessions.length === 0 && dayPhysical.length === 0 && dayMental.length === 0 && dayDryfire.length === 0) {
    dayList.innerHTML = '<li class="type-stats-item">Ingen aktiviteter denne dagen.</li>';
    return;
  }

  let html = '';
  daySessions.forEach(s => {
    html += `
      <li class="session-item" data-kind="skyting" data-id="${s.id}">
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
      <li class="session-item" data-kind="fysisk" data-id="${p.id}">
        <div class="session-item-main">
          <div class="session-program">Fysisk: ${p.type}</div>
          <div class="session-meta">${p.duration_minutes ? p.duration_minutes + ' min' : ''}${p.comment ? ' · ' + p.comment : ''}</div>
        </div>
      </li>
    `;
  });
  dayMental.forEach(m => {
    html += `
      <li class="session-item" data-kind="mentalt" data-id="${m.id}">
        <div class="session-item-main">
          <div class="session-program">Mentalt: ${m.type}</div>
          <div class="session-meta">${m.duration_minutes ? m.duration_minutes + ' min' : ''}${m.comment ? ' · ' + m.comment : ''}</div>
        </div>
      </li>
    `;
  });
  dayDryfire.forEach(d => {
    html += `
      <li class="session-item" data-kind="tørrtrening" data-id="${d.id}">
        <div class="session-item-main">
          <div class="session-program">Tørrtrening: ${d.type}</div>
          <div class="session-meta">${d.duration_minutes ? d.duration_minutes + ' min' : ''}${d.shot_count ? ' · ' + d.shot_count + ' skudd' : ''}${d.comment ? ' · ' + d.comment : ''}</div>
        </div>
      </li>
    `;
  });

  dayList.innerHTML = html;
  dayList.querySelectorAll('.session-item').forEach(item => {
    item.addEventListener('click', () => {
      const kind = item.dataset.kind;
      const id = item.dataset.id;
      if (kind === 'skyting') openDetail(id);
      else if (kind === 'fysisk') openPhysicalDetail(dayPhysical.find(p => p.id === id));
      else if (kind === 'mentalt') openMentalDetail(dayMental.find(m => m.id === id));
      else if (kind === 'tørrtrening') openDryfireDetail(dayDryfire.find(d => d.id === id));
    });
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
    document.getElementById(`${prefix}-achieved1`).checked = !!existing?.achieved1;
    document.getElementById(`${prefix}-achieved2`).checked = !!existing?.achieved2;
    document.getElementById(`${prefix}-achieved3`).checked = !!existing?.achieved3;
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
        achieved1: document.getElementById(`${prefix}-achieved1`).checked,
        achieved2: document.getElementById(`${prefix}-achieved2`).checked,
        achieved3: document.getElementById(`${prefix}-achieved3`).checked
      });
    }
    await refreshList();
    showView(viewList);
  } catch (err) {
    alert('Kunne ikke lagre målsetninger. Sjekk nettforbindelsen og prøv igjen.');
  }
});

// ---- History (Tidligere økter) ----
document.getElementById('nav-history').addEventListener('click', () => {
  renderHistoryList();
  showView(viewHistory);
});
document.getElementById('back-history').addEventListener('click', () => showView(viewList));

// ---- Init ----
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;
  applyAuthUI();
  if (currentUser) { await loadProfile(); await refreshList(); }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    applyAuthUI();
    if (currentUser) {
      if (window.location.hash.includes('access_token')) {
        history.replaceState(null, '', window.location.pathname);
      }
      await loadProfile();
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
