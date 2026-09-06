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
  setScoreValue(10);
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
  setScoreValue(10);
  showView(viewAdd);
}

let currentScore = 10;
function setScoreValue(v) {
  currentScore = Math.max(0, Math.min(10, v));
  document.getElementById('score-value').textContent = currentScore;
}

function renderDraftShots() {
  const list = document.getElementById('shot-list');
  document.getElementById('shots-label').textContent = `Skudd (${draftShots.length})`;
  list.innerHTML = draftShots.map((s, i) => `
    <li class="shot-item">
      <span>${i + 1}. ${s.position}</span>
      <span class="shot-item-right">
        <span class="shot-item-score">${s.score}</span>
        <button class="shot-move" data-dir="up" data-index="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Flytt opp">↑</button>
        <button class="shot-move" data-dir="down" data-index="${i}" ${i === draftShots.length - 1 ? 'disabled' : ''} aria-label="Flytt ned">↓</button>
        <button class="shot-remove" data-index="${i}" aria-label="Fjern skudd">×</button>
      </span>
    </li>
  `).join('');
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

document.getElementById('score-up').addEventListener('click', () => setScoreValue(currentScore + 1));
document.getElementById('score-down').addEventListener('click', () => setScoreValue(currentScore - 1));

document.getElementById('add-shot').addEventListener('click', () => {
  const position = document.getElementById('shot-position').value;
  draftShots.push({ position, score: currentScore });
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
    <div class="detail-row"><span class="detail-row-label">Program</span><span class="detail-row-value">${session.programType}</span></div>
    ${session.trainingType ? `<div class="detail-row"><span class="detail-row-label">Type</span><span class="detail-row-value">${session.trainingType}</span></div>` : ''}
    <div class="detail-row"><span class="detail-row-label">Totalt poeng</span><span class="detail-row-value">${scoreTotal(session)}</span></div>
    ${session.notes ? `<div class="detail-row"><span class="detail-row-label">Notater</span><span class="detail-row-value">${escapeHtml(session.notes)}</span></div>` : ''}
    <div class="detail-shots-title">Skudd (${session.shots.length})</div>
    <ul class="shot-list">
      ${session.shots.map((s, i) => `
        <li class="shot-item">
          <span>${i + 1}. ${s.position}</span>
          <span class="shot-item-score">${s.score}</span>
        </li>
      `).join('')}
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
