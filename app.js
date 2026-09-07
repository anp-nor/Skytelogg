// ---- IndexedDB setup ----
const DB_NAME = 'riflelog';
const DB_VERSION = 1;
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('sessions')) {
        const store = database.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date');
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e);
  });
}

function addSession(session) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const req = tx.objectStore('sessions').add(session);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

function getAllSessions() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readonly');
    const req = tx.objectStore('sessions').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  });
}

function updateSession(id, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const req = tx.objectStore('sessions').put({ ...data, id });
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
}

function deleteSessionById(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const req = tx.objectStore('sessions').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
}

// ---- App state ----
let sessions = [];
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

function showView(view) {
  [viewList, viewAdd, viewDetail].forEach(v => v.hidden = true);
  view.hidden = false;
}

// ---- Rendering: list view ----
function scoreTotal(session) {
  if (session.trainingType === 'Plott') {
    return session.shots.reduce((sum, s) => sum + Number(s.actualScore || 0), 0);
  }
  return session.shots.reduce((sum, s) => sum + Number(s.score || 0), 0);
}

function renderStats() {
  const statsRow = document.getElementById('stats-row');
  const totalSessions = sessions.length;
  const totalShots = sessions.reduce((sum, s) => sum + s.shots.length, 0);
  const avgScore = totalShots > 0
    ? (sessions.reduce((sum, s) => sum + scoreTotal(s), 0) / totalShots).toFixed(1)
    : '–';

  statsRow.innerHTML = `
    <div class="stat"><div class="stat-value">${totalSessions}</div><div class="stat-label">økter</div></div>
    <div class="stat"><div class="stat-value">${totalShots}</div><div class="stat-label">skudd registrert</div></div>
    <div class="stat"><div class="stat-value">${avgScore}</div><div class="stat-label">snitt / skudd</div></div>
  `;
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
        <div class="session-program">${s.programType}</div>
        <div class="session-meta">${formatDate(s.date)}${s.trainingType ? ' · ' + s.trainingType : ''} · ${s.shots.length} skudd</div>
      </div>
      <div class="session-score">${scoreTotal(s)}</div>
    </li>
  `).join('');

  list.querySelectorAll('.session-item').forEach(item => {
    item.addEventListener('click', () => openDetail(Number(item.dataset.id)));
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
  sessions = await getAllSessions();
  renderStats();
  renderSessionList();
}

// ---- Add session flow ----
function resetAddForm() {
  editingId = null;
  document.getElementById('add-title').textContent = 'Ny økt';
  document.getElementById('input-date').valueAsDate = new Date();
  document.getElementById('input-program').selectedIndex = 0;
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
  document.getElementById('input-date').value = session.date;
  document.getElementById('input-program').value = session.programType;
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
  resetAddForm();
  showView(viewAdd);
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
  const programType = document.getElementById('input-program').value;
  const trainingType = document.getElementById('input-type').value;
  const notes = document.getElementById('input-notes').value;

  const session = {
    date,
    programType,
    trainingType,
    notes,
    shots: draftShots,
    images: draftImages
  };

  if (editingId != null) {
    const id = editingId;
    await updateSession(id, session);
    editingId = null;
    await refreshList();
    openDetail(id);
  } else {
    await addSession(session);
    await refreshList();
    showView(viewList);
  }
});

// ---- Detail view ----
async function openDetail(id) {
  currentDetailId = id;
  const session = sessions.find(s => s.id === id);
  if (!session) return;

  document.getElementById('detail-title').textContent = session.programType;

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="detail-row"><span class="detail-row-label">Dato</span><span class="detail-row-value">${formatDate(session.date)}</span></div>
    <div class="detail-row"><span class="detail-row-label">Bane</span><span class="detail-row-value">${session.programType}</span></div>
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
  await deleteSessionById(currentDetailId);
  await refreshList();
  showView(viewList);
});

// ---- Init ----
(async function init() {
  await openDB();
  await refreshList();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
})();
