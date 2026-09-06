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
let currentDetailId = null;

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
  return session.shots.reduce((sum, s) => sum + s.score, 0);
}

function renderStats() {
  const statsRow = document.getElementById('stats-row');
  const totalSessions = sessions.length;
  const totalShots = sessions.reduce((sum, s) => sum + s.shots.length, 0);
  const avgScore = totalShots > 0
    ? (sessions.reduce((sum, s) => sum + scoreTotal(s), 0) / totalShots).toFixed(1)
    : '–';

  statsRow.innerHTML = `
    <div class="stat"><div class="stat-value">${totalSessions}</div><div class="stat-label">sessions</div></div>
    <div class="stat"><div class="stat-value">${totalShots}</div><div class="stat-label">shots logged</div></div>
    <div class="stat"><div class="stat-value">${avgScore}</div><div class="stat-label">avg / shot</div></div>
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
        <div class="session-meta">${formatDate(s.date)} · ${s.shots.length} shots</div>
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
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

async function refreshList() {
  sessions = await getAllSessions();
  renderStats();
  renderSessionList();
}

// ---- Add session flow ----
function resetAddForm() {
  document.getElementById('input-date').valueAsDate = new Date();
  document.getElementById('input-program').selectedIndex = 0;
  document.getElementById('input-notes').value = '';
  document.getElementById('shot-position').selectedIndex = 0;
  draftShots = [];
  renderDraftShots();
  setScoreValue(10);
}

let currentScore = 10;
function setScoreValue(v) {
  currentScore = Math.max(0, Math.min(10, v));
  document.getElementById('score-value').textContent = currentScore;
}

function renderDraftShots() {
  const list = document.getElementById('shot-list');
  document.getElementById('shots-label').textContent = `Shots (${draftShots.length})`;
  list.innerHTML = draftShots.map((s, i) => `
    <li class="shot-item">
      <span>${i + 1}. ${s.position}</span>
      <span class="shot-item-score">${s.score}</span>
    </li>
  `).join('');
}

document.getElementById('fab-add').addEventListener('click', () => {
  resetAddForm();
  showView(viewAdd);
});

document.getElementById('cancel-add').addEventListener('click', () => showView(viewList));

document.getElementById('score-up').addEventListener('click', () => setScoreValue(currentScore + 1));
document.getElementById('score-down').addEventListener('click', () => setScoreValue(currentScore - 1));

document.getElementById('add-shot').addEventListener('click', () => {
  const position = document.getElementById('shot-position').value;
  draftShots.push({ position, score: currentScore });
  renderDraftShots();
});

document.getElementById('save-session').addEventListener('click', async () => {
  const date = document.getElementById('input-date').value || new Date().toISOString().slice(0, 10);
  const programType = document.getElementById('input-program').value;
  const notes = document.getElementById('input-notes').value;

  const session = {
    date,
    programType,
    notes,
    shots: draftShots
  };

  await addSession(session);
  await refreshList();
  showView(viewList);
});

// ---- Detail view ----
async function openDetail(id) {
  currentDetailId = id;
  const session = sessions.find(s => s.id === id);
  if (!session) return;

  document.getElementById('detail-title').textContent = session.programType;

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="detail-row"><span class="detail-row-label">Date</span><span class="detail-row-value">${formatDate(session.date)}</span></div>
    <div class="detail-row"><span class="detail-row-label">Program</span><span class="detail-row-value">${session.programType}</span></div>
    <div class="detail-row"><span class="detail-row-label">Total score</span><span class="detail-row-value">${scoreTotal(session)}</span></div>
    ${session.notes ? `<div class="detail-row"><span class="detail-row-label">Notes</span><span class="detail-row-value">${escapeHtml(session.notes)}</span></div>` : ''}
    <div class="detail-shots-title">Shots (${session.shots.length})</div>
    <ul class="shot-list">
      ${session.shots.map((s, i) => `
        <li class="shot-item">
          <span>${i + 1}. ${s.position}</span>
          <span class="shot-item-score">${s.score}</span>
        </li>
      `).join('')}
    </ul>
  `;

  showView(viewDetail);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('back-detail').addEventListener('click', () => showView(viewList));

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
