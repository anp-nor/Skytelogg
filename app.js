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
    imagesLoaded: row.images !== undefined,
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
async function ensureImages(session) {
  if (session.imagesLoaded) return;
  const { data, error } = await supabase.from('sessions').select('images').eq('id', session.id).single();
  if (error) throw error;
  session.images = (data && data.images) || [];
  session.imagesLoaded = true;
}

async function fetchSessions(uid = currentUser.id, cache = true) {
  // Bildene (store datafiler) hentes ikke i listen, bare når du åpner en økt
  const { data, error } = await supabase.from('sessions')
    .select('id,date,season,category,training_type,notes,shots,total_shots_fired,klasse')
    .eq('user_id', uid).order('date', { ascending: false });
  if (error) throw error;
  const mapped = data.map(rowToSession);
  if (cache) await cacheSessionsLocally(mapped);
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
async function fetchPhysicalSessions(uid = currentUser.id) {
  const { data, error } = await supabase.from('physical_sessions').select('*').eq('user_id', uid).order('date', { ascending: false });
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
async function fetchMentalSessions(uid = currentUser.id) {
  const { data, error } = await supabase.from('mental_sessions').select('*').eq('user_id', uid).order('date', { ascending: false });
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
async function fetchDryfireSessions(uid = currentUser.id) {
  const { data, error } = await supabase.from('dryfire_sessions').select('*').eq('user_id', uid).order('date', { ascending: false });
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
async function fetchGoals(uid = currentUser.id) {
  const { data, error } = await supabase.from('goals').select('*').eq('user_id', uid);
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
let cleanings = [];
let draftShots = [];
let draftImages = [];
let currentDetailId = null;
let editingId = null;
let editingPhysicalId = null;
let editingMentalId = null;
let editingDryfireId = null;
let viewAs = null; // {id, name, email, klasse} når treneren ser en utøvers logg
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
    if (g === 'stå') series = [rep(L, matchN), rep(S, matchN), rep(K, matchN)];
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
const viewPeople = document.getElementById('view-people');
const viewClock = document.getElementById('view-clock');
const viewTools = document.getElementById('view-tools');
const viewClean = document.getElementById('view-clean');
const viewPoints = document.getElementById('view-points');
const viewTorque = document.getElementById('view-torque');
const viewVisual = document.getElementById('view-visual');
const bottomNav = document.getElementById('bottom-nav');
const allViews = [viewList, viewAdd, viewDetail, viewStats, viewPhysicalAdd, viewMentalAdd, viewDryfireAdd, viewCalendar, viewGoals, viewHistory, viewPeople, viewClock, viewTools, viewClean, viewPoints, viewTorque, viewVisual];

function showView(view) {
  allViews.forEach(v => v.hidden = true);
  view.hidden = false;
  if (view !== viewClock) { try { stopClock(); stopListen(); } catch (e) {} }
  if (view !== viewVisual) { try { stopVis(); } catch (e) {} }
  bottomNav.hidden = (view !== viewList);
  document.getElementById('fab-add').hidden = !!viewAs || view !== viewList;
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
  updateCleanUI();
  const statsRow = document.getElementById('stats-row');
  const totalGoalSlots = goalsData.length * 3;
  const achievedGoalSlots = goalsData.reduce((sum, g) =>
    sum + (g.achieved1 ? 1 : 0) + (g.achieved2 ? 1 : 0) + (g.achieved3 ? 1 : 0), 0);
  const totalShotsFired = sessions.reduce((sum, s) => sum + (Number(s.totalShotsFired) || 0), 0);

  const pct = totalGoalSlots ? Math.round(achievedGoalSlots / totalGoalSlots * 100) : 0;
  statsRow.innerHTML = `
    <div class="stat stat-hero"><div class="stat-value">${totalShotsFired.toLocaleString('nb-NO')}</div><div class="stat-label">skudd totalt</div></div>
    <div class="stat stat-goal">
      <div class="stat-value">${achievedGoalSlots}<span class="dim">/${totalGoalSlots}</span></div>
      <div class="stat-label">mål oppnådd</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
  `;
}

function computeTypeStats(sessionsArr) {
  const map = {};
  sessionsArr.forEach(s => {
    const key = s.trainingType || 'Uten øvelse';
    const total = scoreTotal(s);
    if (!map[key]) map[key] = { sum: 0, count: 0, best: -Infinity, totals: [], decimal: s.trainingType === '60 ligg ISSF' };
    map[key].totals.push(total);
    map[key].sum += total;
    map[key].count += 1;
    if (total > map[key].best) map[key].best = total;
  });
  return map;
}

function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

let showAllTypes = false;

function renderTypeStats() {
  const wrap = document.getElementById('type-stats-list');
  const toggle = document.getElementById('type-stats-toggle');
  const map = computeTypeStats(sessions);
  const latest = {};
  sessions.forEach(s => {
    const key = s.trainingType || 'Uten øvelse';
    const t = new Date(s.date).getTime() || 0;
    if (!(key in latest) || t > latest[key]) latest[key] = t;
  });
  const allKeys = Object.keys(map).sort((a, b) => latest[b] - latest[a]);
  if (allKeys.length === 0) {
    wrap.innerHTML = '';
    toggle.hidden = true;
    return;
  }
  const keys = showAllTypes ? allKeys : allKeys.slice(0, 3);
  toggle.hidden = allKeys.length <= 3;
  toggle.textContent = showAllTypes ? 'Vis færre' : 'Vis alle';
  wrap.innerHTML = keys.map(key => {
    const { sum, count, best, totals, decimal } = map[key];
    const avg = sum / count;
    const med = median(totals);
    return `
      <li class="type-stats-item" style="display:flex;align-items:center;gap:12px">
        <div class="type-stats-main">
          <div class="type-stats-name">${key}</div>
          <div class="type-stats-sub">snitt ${avg.toFixed(1).replace('.', ',')} · median ${med.toFixed(1).replace('.', ',')}</div>
        </div>
        <div class="type-stats-best">
          <div class="type-stats-best-value">${formatScore(best, decimal)}</div>
          <div class="type-stats-best-label">BESTE</div>
        </div>
      </li>
    `;
  }).join('');
}

document.getElementById('type-stats-toggle').addEventListener('click', () => {
  showAllTypes = !showAllTypes;
  renderTypeStats();
});

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

  document.getElementById('history-counters').innerHTML = [
    ['Skyting', sessions.length, '#FF6B3D'],
    ['Fysisk', physicalSessions.length, '#8FB573'],
    ['Mentalt', mentalSessions.length, '#7A93B0'],
    ['Tørrtrening', dryfireSessions.length, '#B07BB3']
  ].map(([l, n, c]) => `<div class="counter"><div class="counter-value" style="color:${c}">${n}</div><div class="counter-label">${l}</div></div>`).join('');

  if (items.length === 0) {
    list.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  list.innerHTML = items.map((item, i) => `
    <li class="session-item" data-index="${i}">
      <span class="session-dot" style="background:${{skyting: item.data && item.data.category === 'Konkurranse' ? '#F2C14E' : '#FF6B3D', fysisk: '#8FB573', mentalt: '#7A93B0', 'tørrtrening': '#B07BB3'}[item.kind]}"></span>
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
  // Vis lokal kopi med en gang mens ferske data hentes
  if (!sessions.length) {
    try {
      const cached = await getCachedSessions();
      if (cached.length) { sessions = cached; renderStats(); renderTypeStats(); }
    } catch (err) {}
  }
  const [s, p, d, m, c, g] = await Promise.allSettled([
    fetchSessions(), fetchPhysicalSessions(), fetchDryfireSessions(),
    fetchMentalSessions(), fetchCleanings(), fetchGoals()
  ]);
  if (s.status === 'fulfilled') sessions = s.value;
  else {
    console.error('Henting fra Supabase feilet, bruker lokal cache', s.reason);
    try { sessions = await getCachedSessions(); } catch (err) {}
  }
  if (p.status === 'fulfilled') physicalSessions = p.value; else console.error('Kunne ikke hente fysisk trening', p.reason);
  if (d.status === 'fulfilled') dryfireSessions = d.value; else console.error('Kunne ikke hente tørrtrening', d.reason);
  if (m.status === 'fulfilled') mentalSessions = m.value; else console.error('Kunne ikke hente mental trening', m.reason);
  if (c.status === 'fulfilled') cleanings = c.value; else console.error('Kunne ikke hente pussing', c.reason);
  if (g.status === 'fulfilled') goalsData = g.value; else console.error('Kunne ikke hente målsetninger', g.reason);
  renderStats();
  renderTypeStats();
  updatePeopleBadge();
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
    if (!data) {
      await supabase.from('profiles').upsert({ id: currentUser.id, email: currentUser.email }, { onConflict: 'id' });
    }
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

let scanFilled = false;

function applyScanResult(r) {
  scanFilled = false;
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

  // Flere skudd enn øvelsen skal ha: bare de første leses inn
  const allCount = scores.length;
  const keep = draftFlat ? Math.min(allCount, draftFlat.length) : allCount;
  const truncated = keep < allCount;
  draftShots = scores.slice(0, keep).map((score, i) => {
    const f = draftFlat ? draftFlat[i] : null;
    const shot = {
      position: f ? f.position : document.getElementById('input-stilling').value,
      score: Math.round(score * 10) / 10,
      centerTen: score >= 10.5
    };
    if (f) shot.serie = f.serie;
    return shot;
  });

  scanFilled = true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(r.dato || '')) document.getElementById('input-date').value = r.dato;
  const notesEl = document.getElementById('input-notes');
  if (!notesEl.value.trim() && r.stevne) notesEl.value = r.stevne;

  // Kontroller mot summene som står på lappen
  let seen = 0;
  series.forEach((s, i) => {
    const part = s.skudd || [];
    seen += part.length;
    if (seen > keep) return; // serien er helt eller delvis utenfor det som logges
    const mine = sumShots(part.map(v => ({ score: v })), isDecimalMode);
    if (typeof s.trykt_sum === 'number' && Math.abs(mine - s.trykt_sum) > (isDecimalMode ? 0.05 : 0)) {
      warnings.push(`Serie ${i + 1}: jeg får ${formatScore(mine, isDecimalMode)}, lappen sier ${s.trykt_sum}.`);
    }
    if (typeof s.trykt_sentrum === 'number' && countCenterTens(part.map(v => ({ score: v }))) !== s.trykt_sentrum) {
      warnings.push(`Serie ${i + 1}: sentrumstiere avviker fra lappen (${s.trykt_sentrum}).`);
    }
  });
  if (!truncated && typeof r.trykt_total === 'number') {
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
  if (!totalEl.value) totalEl.value = allCount + proveCount;

  applyLayoutToDraft();
  renderDraftShots();
  const fewer = !!draftFlat && keep < draftFlat.length;
  let fewNote = '';
  if (fewer) {
    const fits = [...document.getElementById('input-type').options]
      .map(o => o.value)
      .filter(t => { const f = programFlat(t, draftKlasse); return f && f.length === keep; });
    fewNote = ` Lappen har færre skudd (${keep}) enn «${typeVal}» skal ha (${draftFlat.length}). De ${keep} skuddene er lagt inn.` +
      (fits.length ? ` Hvis du skjøt ${fits.map(f => '«' + f + '»').join(' eller ')}, bytt øvelse og skann på nytt.` : '');
  }
  const cutNote = truncated ? ` Lappen har ${allCount} skudd. Bare de første ${keep} er lagt inn.` : '';
  const proveNote = proveCount ? ` ${proveCount} prøveskudd ble hoppet over og er regnet med i «Antall skudd totalt».` : '';
  if (warnings.length) {
    setScanStatus(`Utkast fylt ut (${keep} skudd).${cutNote}${fewNote}${proveNote} Sjekk dette:<br>• ${warnings.join('<br>• ')}`, 'warn');
  } else {
    setScanStatus(`Utkast fylt ut: ${keep} skudd.${cutNote}${fewNote}${proveNote} Summer og sentrumstiere stemmer med lappen. Se over og trykk Lagre.`, fewer ? 'warn' : 'ok');
  }
}

const PDFJS_VERSION = '3.11.174';
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    sc.onload = resolve;
    sc.onerror = () => reject(new Error('Kunne ikke laste PDF-visning'));
    document.head.appendChild(sc);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  return window.pdfjsLib;
}

async function pdfFirstPageToJpeg(file, maxDim = 1600, quality = 0.75) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: maxDim / Math.max(base.width, base.height) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', quality);
}

async function archiveScannedFile(file) {
  try {
    const url = file.type === 'application/pdf'
      ? await pdfFirstPageToJpeg(file)
      : await compressImage(file, 1600, 0.75);
    if (draftImages.includes(url)) return 'Lappen lå allerede under Bilder.';
    draftImages.push(url);
    renderDraftImages();
    return 'Lappen er lagt til under Bilder (fjern den med × hvis du ikke vil arkivere den).';
  } catch (e) {
    return 'Lappen kunne ikke legges til under Bilder automatisk.';
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
    if (scanFilled) {
      const note = await archiveScannedFile(file);
      const el = document.getElementById('scan-status');
      el.innerHTML += `<br>${note}`;
    }
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
      const ix = sessions.findIndex(s => s.id === id);
      if (ix >= 0) sessions[ix] = { ...session, id, imagesLoaded: true };
      openDetail(id);
      refreshList();
    } catch (err) {
      alert('Kunne ikke lagre endringen. Sjekk nettforbindelsen og prøv igjen.');
    }
  } else {
    try {
      const before = cleanStep();
      const created = await insertSession(session);
      editingId = null;
      sessions = [created, ...sessions];
      renderStats();
      renderTypeStats();
      showView(viewList);
      if (cleanStep() > before) showCleanAlert();
      refreshList();
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
  if (!session.imagesLoaded) {
    ensureImages(session).then(() => {
      if (currentDetailId === id && !viewDetail.hidden && session.images.length) openDetail(id);
    }).catch(() => {});
  }

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
    <div id="detail-comments" class="comments-box"></div>
  `;
  document.getElementById('edit-session').hidden = !!viewAs;
  document.getElementById('delete-session').hidden = !!viewAs;
  renderComments(document.getElementById('detail-comments'), 'skyting', session.id);

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

document.getElementById('edit-session').addEventListener('click', async () => {
  const session = sessions.find(s => s.id === currentDetailId);
  if (!session) return;
  try { await ensureImages(session); } catch (e) { alert('Kunne ikke hente bildene til økten. Prøv igjen.'); return; }
  openEditForm(session);
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

['filter-category', 'filter-type', 'stats-kategori', 'stats-period'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderStatsPage);
});

function shortDateLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

function inPeriod(item) {
  const p = document.getElementById('stats-period').value;
  if (p === 'alt') return true;
  if (p === 'sesong') return !item.season || item.season === SEASONS[SEASONS.length - 1];
  const d = new Date(item.date);
  if (isNaN(d)) return false;
  const now = new Date();
  if (p === 'denne') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (p === 'forrige') {
    const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() === f.getFullYear() && d.getMonth() === f.getMonth();
  }
  if (p === '30') return (now - d) / 86400000 <= 30 && d <= now;
  return true;
}

function getFilteredSessions() {
  const category = document.getElementById('filter-category').value;
  const type = document.getElementById('filter-type').value;
  return sessions.filter(s =>
    (!category || s.category === category) &&
    (!type || s.trainingType === type) &&
    inPeriod(s)
  );
}

function renderOtherStats(kat) {
  const arr = kat === 'fysisk' ? physicalSessions : kat === 'mentalt' ? mentalSessions : dryfireSessions;
  const rows = arr.filter(inPeriod);
  const map = {};
  rows.forEach(r => {
    const key = r.type || 'Uten type';
    if (!map[key]) map[key] = { n: 0, min: 0, shots: 0 };
    map[key].n += 1;
    map[key].min += Number(r.duration_minutes) || 0;
    map[key].shots += Number(r.shot_count) || 0;
  });
  const isDry = kat === 'tørrtrening';
  const totN = rows.length;
  const totMin = Object.values(map).reduce((a, m) => a + m.min, 0);
  const totShots = Object.values(map).reduce((a, m) => a + m.shots, 0);
  const box = (v, l) => `<div class="stat-box"><div class="stat-box-value">${v}</div><div class="stat-box-label">${l}</div></div>`;
  document.getElementById('stats-other-total').innerHTML =
    box(totN, 'økter') + box(totMin, 'minutter') + (isDry ? box(totShots, 'skudd') : '');
  const keys = Object.keys(map).sort((a, b) => map[b].min - map[a].min);
  document.getElementById('stats-other-empty').hidden = keys.length > 0;
  document.getElementById('stats-other-list').innerHTML = keys.map(k => {
    const m = map[k];
    return `<li class="type-stats-item" style="display:flex;align-items:center;gap:12px">
      <div class="type-stats-main"><div class="type-stats-name">${k}</div>
      <div class="type-stats-sub">${m.n} ${m.n === 1 ? 'økt' : 'økter'}${isDry ? ' · ' + m.shots + ' skudd' : ''}</div></div>
      <div class="type-stats-best"><div class="type-stats-best-value">${m.min}</div><div class="type-stats-best-label">MINUTTER</div></div>
    </li>`;
  }).join('');
}

function renderStatsPage() {
  const kat = document.getElementById('stats-kategori').value;
  const isShoot = kat === 'skyting';
  document.getElementById('stats-shooting').hidden = !isShoot;
  document.getElementById('stats-other').hidden = isShoot;
  if (!isShoot) { renderOtherStats(kat); return; }
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

  ctx.strokeStyle = '#25272B';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, paddingTop + plotHeight);
  ctx.lineTo(paddingLeft + plotWidth, paddingTop + plotHeight);
  ctx.stroke();

  ctx.fillStyle = '#8A8780';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(maxVal.toFixed(0), paddingLeft - 6, paddingTop + 4);
  ctx.fillText(minVal.toFixed(0), paddingLeft - 6, paddingTop + plotHeight);

  ctx.strokeStyle = '#FF6B3D';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = '#FF6B3D';
  points.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.value);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#8A8780';
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
  document.getElementById('physical-comments').innerHTML = '';
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
  setFormReadOnly('view-physical-add', 'save-physical', 'delete-physical', !!viewAs);
  renderComments(document.getElementById('physical-comments'), 'fysisk', entry.id);
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
  document.getElementById('mental-comments').innerHTML = '';
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
  setFormReadOnly('view-mental-add', 'save-mental', 'delete-mental', !!viewAs);
  renderComments(document.getElementById('mental-comments'), 'mentalt', entry.id);
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
  document.getElementById('dryfire-comments').innerHTML = '';
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
  setFormReadOnly('view-dryfire-add', 'save-dryfire', 'delete-dryfire', !!viewAs);
  renderComments(document.getElementById('dryfire-comments'), 'tørrtrening', entry.id);
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
  setGoalsReadOnly(!!viewAs);
  renderGoalComments(season);
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

// ---- Trenermodul ----
function setFormReadOnly(viewId, saveId, delId, ro) {
  document.querySelectorAll(`#${viewId} input, #${viewId} select, #${viewId} textarea`).forEach(el => { el.disabled = ro; });
  document.getElementById(saveId).hidden = ro;
  if (ro) document.getElementById(delId).hidden = true;
}

function setGoalsReadOnly(ro) {
  document.querySelectorAll('#view-goals input, #view-goals select').forEach(el => {
    if (el.id === 'goals-season') return;
    el.disabled = ro;
  });
  document.getElementById('save-goals').hidden = ro;
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function renderComments(el, targetType, targetId) {
  if (!el) return;
  el.innerHTML = '';
  const owner = viewAs ? viewAs.id : currentUser.id;
  let rows = [];
  try {
    const { data, error } = await supabase.from('trainer_comments').select('*')
      .eq('athlete_id', owner).eq('target_type', targetType).eq('target_id', String(targetId))
      .order('created_at', { ascending: true });
    if (error) throw error;
    rows = data || [];
  } catch (e) {
    if (!viewAs) return;
  }
  if (!rows.length && !viewAs) return;

  let html = '<div class="comments-title">Trenerkommentarer</div>';
  html += rows.map(c => `
    <div class="comment">
      <div class="comment-meta">${escapeHtml(c.trainer_label || 'Trener')} · ${formatDateTime(c.created_at)}${viewAs && c.trainer_id === currentUser.id ? `<button class="comment-del" data-id="${c.id}">slett</button>` : ''}</div>
      <div class="comment-body">${escapeHtml(c.body)}</div>
    </div>`).join('');
  if (viewAs) {
    html += `<textarea class="field-input comment-input" placeholder="Skriv en kommentar til utøveren…"></textarea>
             <button class="add-shot-btn comment-send">Send kommentar</button>`;
  }
  el.innerHTML = html;

  el.querySelectorAll('.comment-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase.from('trainer_comments').delete().eq('id', btn.dataset.id);
      if (error) { alert('Kunne ikke slette kommentaren.'); return; }
      renderComments(el, targetType, targetId);
    });
  });
  const send = el.querySelector('.comment-send');
  if (send) {
    send.addEventListener('click', async () => {
      const ta = el.querySelector('.comment-input');
      const body = ta.value.trim();
      if (!body) return;
      send.disabled = true;
      const { error } = await supabase.from('trainer_comments').insert({
        athlete_id: viewAs.id,
        trainer_id: currentUser.id,
        trainer_label: profile.name || currentUser.email,
        target_type: targetType,
        target_id: String(targetId),
        body
      });
      if (error) { alert('Kunne ikke lagre kommentaren.'); send.disabled = false; return; }
      renderComments(el, targetType, targetId);
    });
  }
}

function renderGoalComments(season) {
  GOAL_AREAS.forEach(({ key, prefix }) => {
    renderComments(document.getElementById(`goal-${prefix.replace('goal-', '')}-trainer`), 'mål', `${season}|${key}`);
  });
}

function personLabel(p) {
  return p ? (p.name || p.email || 'Ukjent') : 'Ukjent';
}

let peopleAthletes = [];

async function updatePeopleBadge() {
  const btn = document.getElementById('people-btn');
  try {
    const { data } = await supabase.from('trainer_requests').select('id, trainer_id');
    const n = (data || []).filter(r => r.trainer_id !== currentUser.id).length;
    btn.textContent = n ? `Trener (${n})` : 'Trener';
  } catch (e) { btn.textContent = 'Trener'; }
}

function peopleEmpty(text) { return `<li class="people-empty">${text}</li>`; }

async function loadPeople() {
  const uid = currentUser.id;
  let requests = [], links = [], profiles = [];
  try {
    const r1 = await supabase.from('trainer_requests').select('*').order('created_at', { ascending: false });
    if (r1.error) throw r1.error;
    requests = r1.data || [];
    const r2 = await supabase.from('trainer_athletes').select('*').eq('status', 'accepted');
    if (r2.error) throw r2.error;
    links = r2.data || [];
    const ids = [...new Set(links.map(l => (l.trainer_id === uid ? l.athlete_id : l.trainer_id)))];
    if (ids.length) {
      const r3 = await supabase.from('profiles').select('id, name, email, klasse').in('id', ids);
      profiles = r3.data || [];
    }
  } catch (e) {
    document.getElementById('people-status').textContent = 'Kunne ikke hente data. Har du kjørt schema_v6.sql i Supabase?';
    return;
  }
  const prof = (id) => profiles.find(p => p.id === id);

  const incoming = requests.filter(r => r.trainer_id !== uid);
  const sent = requests.filter(r => r.trainer_id === uid);
  const myTrainers = links.filter(l => l.athlete_id === uid && l.trainer_id !== uid);
  const myAthletes = links.filter(l => l.trainer_id === uid && l.athlete_id !== uid);

  document.getElementById('people-incoming').innerHTML = incoming.length ? incoming.map(r => `
    <li class="people-item">
      <div class="people-item-main">
        <div class="people-item-name">${escapeHtml(r.trainer_name || r.trainer_email || 'Trener')}</div>
        <div class="people-item-sub">${escapeHtml(r.trainer_email || '')} vil følge loggen din</div>
      </div>
      <div class="people-item-actions">
        <button class="text-btn text-btn-primary" data-act="accept" data-id="${r.id}">Godta</button>
        <button class="text-btn" data-act="decline" data-id="${r.id}">Avslå</button>
      </div>
    </li>`).join('') : peopleEmpty('Ingen forespørsler.');

  document.getElementById('people-trainers').innerHTML = myTrainers.length ? myTrainers.map(l => {
    const p = prof(l.trainer_id);
    return `<li class="people-item">
      <div class="people-item-main">
        <div class="people-item-name">${escapeHtml(personLabel(p))}</div>
        <div class="people-item-sub">${escapeHtml(p?.email || '')}</div>
      </div>
      <div class="people-item-actions"><button class="text-btn" data-act="remove-trainer" data-trainer="${l.trainer_id}" data-athlete="${l.athlete_id}">Fjern</button></div>
    </li>`;
  }).join('') : peopleEmpty('Ingen trenere har tilgang.');

  peopleAthletes = myAthletes.map(l => {
    const p = prof(l.athlete_id) || {};
    return { id: l.athlete_id, name: p.name || '', email: p.email || '', klasse: p.klasse || '' };
  });
  document.getElementById('people-athletes').innerHTML = peopleAthletes.length ? peopleAthletes.map((a, i) => `
    <li class="people-item">
      <div class="people-item-main clickable" data-act="open-athlete" data-index="${i}">
        <div class="people-item-name">${escapeHtml(a.name || a.email || 'Utøver')}</div>
        <div class="people-item-sub">${escapeHtml(a.email)}${a.klasse ? ' · klasse ' + escapeHtml(a.klasse) : ''}</div>
      </div>
      <div class="people-item-actions"><button class="text-btn" data-act="unfollow" data-trainer="${uid}" data-athlete="${a.id}">Slutt å følge</button></div>
    </li>`).join('') : peopleEmpty('Du følger ingen utøvere ennå.');

  document.getElementById('people-sent').innerHTML = sent.length ? sent.map(r => `
    <li class="people-item">
      <div class="people-item-main">
        <div class="people-item-name">${escapeHtml(r.athlete_email)}</div>
        <div class="people-item-sub">Venter på svar</div>
      </div>
      <div class="people-item-actions"><button class="text-btn" data-act="decline" data-id="${r.id}">Trekk tilbake</button></div>
    </li>`).join('') : peopleEmpty('Ingen ventende forespørsler.');

  updatePeopleBadge();
}

document.getElementById('view-people').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const status = document.getElementById('people-status');
  try {
    if (act === 'open-athlete') {
      await openAthlete(peopleAthletes[Number(el.dataset.index)]);
      return;
    }
    if (act === 'accept') {
      const { error } = await supabase.rpc('accept_trainer_request', { p_id: el.dataset.id });
      if (error) throw error;
    } else if (act === 'decline') {
      const { error } = await supabase.from('trainer_requests').delete().eq('id', el.dataset.id);
      if (error) throw error;
    } else if (act === 'remove-trainer' || act === 'unfollow') {
      if (!confirm(act === 'unfollow' ? 'Slutte å følge denne utøveren?' : 'Fjerne trenerens tilgang til loggen din?')) return;
      const { error } = await supabase.from('trainer_athletes').delete()
        .eq('trainer_id', el.dataset.trainer).eq('athlete_id', el.dataset.athlete);
      if (error) throw error;
    }
    status.textContent = '';
    await loadPeople();
  } catch (err) {
    status.textContent = 'Noe gikk galt: ' + (err.message || err);
  }
});

document.getElementById('people-send').addEventListener('click', async () => {
  const input = document.getElementById('people-email');
  const status = document.getElementById('people-status');
  const email = input.value.trim();
  if (!email) { status.textContent = 'Skriv inn e-postadressen til utøveren.'; return; }
  status.className = 'scan-status';
  const { error } = await supabase.rpc('send_trainer_request', { p_email: email });
  if (error) { status.className = 'scan-status scan-warn'; status.textContent = error.message; return; }
  input.value = '';
  status.className = 'scan-status scan-ok';
  status.textContent = `Forespørsel sendt til ${email}. Utøveren må godta den under «Trener» i appen.`;
  await loadPeople();
});

document.getElementById('people-btn').addEventListener('click', async () => {
  document.getElementById('people-status').textContent = '';
  showView(viewPeople);
  await loadPeople();
});
document.getElementById('back-people').addEventListener('click', () => showView(viewList));

function updateViewAsUI() {
  const on = !!viewAs;
  document.getElementById('viewas-banner').hidden = !on;
  document.getElementById('people-btn').hidden = on;
  document.getElementById('clean-btn').hidden = on;
  if (on) document.getElementById('clean-banner').hidden = true; else updateCleanUI();
  document.getElementById('fab-add').hidden = on;
  document.querySelector('.profile-card').hidden = on;
  if (on) {
    document.getElementById('viewas-text').textContent =
      `Du ser loggen til ${viewAs.name || viewAs.email} (kun lesing)`;
  }
}

async function openAthlete(a) {
  try {
    const [s, p, m, d, g] = await Promise.all([
      fetchSessions(a.id, false), fetchPhysicalSessions(a.id), fetchMentalSessions(a.id),
      fetchDryfireSessions(a.id), fetchGoals(a.id)
    ]);
    sessions = s; physicalSessions = p; mentalSessions = m; dryfireSessions = d; goalsData = g;
  } catch (e) {
    alert('Kunne ikke hente utøverens logg. Har du kjørt schema_v6.sql i Supabase, og er forespørselen godkjent?');
    return;
  }
  viewAs = a;
  updateViewAsUI();
  renderStats();
  renderTypeStats();
  showView(viewList);
}

async function exitViewAs() {
  viewAs = null;
  updateViewAsUI();
  setFormReadOnly('view-physical-add', 'save-physical', 'delete-physical', false);
  setFormReadOnly('view-mental-add', 'save-mental', 'delete-mental', false);
  setFormReadOnly('view-dryfire-add', 'save-dryfire', 'delete-dryfire', false);
  setGoalsReadOnly(false);
  await refreshList();
  showView(viewPeople);
  await loadPeople();
}
document.getElementById('viewas-exit').addEventListener('click', exitViewAs);

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
  viewAs = null;
  updateViewAsUI();
  await supabase.auth.signOut();
});

(async function init() {
  await openDB();
  await initAuth();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
})();


// ---- Klokke (kommandoer for skyting) ----
const CLOCK_SERIES = [
  { name: 'Prøveskudd', sec: 180 },
  { name: '1. serie', sec: 120 },
  { name: '2. serie', sec: 180 },
  { name: '3. serie', sec: 120 },
  { name: 'Grunnlag', sec: 180 },
  { name: 'Omgang (75 s / 2 min / 3 min)', sec: 180, stops: [{ at: 75, say: '75 sekunder – stopp' }, { at: 120, say: '2 minutter – stopp' }] }
];
let clockDelay = 0;
let clockTimer = null;
let clockWake = null;
let clockRun = null;

function fmtClock(s) {
  s = Math.max(0, Math.ceil(s - 1e-9));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function clockSeries() { return CLOCK_SERIES[Number(document.getElementById('clock-series').value) || 0]; }

function clockCustomSeconds() {
  const m = Math.min(59, Math.max(0, parseInt(document.getElementById('clock-custom-min').value, 10) || 0));
  const s = Math.min(59, Math.max(0, parseInt(document.getElementById('clock-custom-sec').value, 10) || 0));
  return m * 60 + s;
}

function currentDelay() {
  try { localStorage.setItem('clockDelay', String(clockDelay)); } catch (e) {}
  return clockDelay === 'custom' ? clockCustomSeconds() : Number(clockDelay) || 0;
}

function renderClockSetup() {
  const sel = document.getElementById('clock-series');
  if (!sel.options.length) {
    sel.innerHTML = CLOCK_SERIES.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
    try {
      const d = localStorage.getItem('clockDelay');
      if (d !== null) clockDelay = d === 'custom' ? 'custom' : Number(d);
      const si = localStorage.getItem('clockSeries');
      if (si !== null && CLOCK_SERIES[Number(si)]) sel.value = si;
    } catch (e) {}
  }
  document.getElementById('clock-idle-time').textContent = fmtClock(clockSeries().sec);
  document.querySelectorAll('#clock-delay-chips .chip').forEach(c => {
    c.classList.toggle('on', String(c.dataset.delay) === String(clockDelay));
  });
  document.getElementById('clock-custom').hidden = clockDelay !== 'custom';
}

function buildClockEvents(delay) {
  const ser = clockSeries();
  const ev = [];
  let t = 0;
  if (delay > 0) { ev.push({ t: 0, label: `Nedtelling ${fmtClock(delay)}`, phase: 'VENTER', end: delay }); t = delay; }
  ev.push({ t, say: 'Klar kommer om 10 sekunder fra nå', label: '«Klar kommer om 10 sekunder fra nå»', phase: 'KLAR OM 10', end: t + 10 });
  ev.push({ t: t + 10, say: 'Klar', firm: true, label: '«Klar»', phase: 'KLAR', end: t + 15 });
  const start = t + 15;
  ev.push({ t: start, say: 'Ild', firm: true, label: '«Ild» · skytetid ' + fmtClock(ser.sec), phase: 'ILD', end: start + ser.sec, shooting: true });
  const total = start + ser.sec;
  (ser.stops || []).forEach(st => ev.push({ t: start + st.at - 2, say: st.say, label: '«' + st.say + '»', mark: true }));
  ev.push({ t: total - 2, say: 'Stans', label: '«Stans»', mark: true });
  ev.sort((a, b) => a.t - b.t);
  return { ev, start, total, secs: ser.sec };
}

let clockVoice = null;
let voiceRate = 0.95;
let voiceName = '';
try {
  voiceName = localStorage.getItem('voiceName') || '';
  const r = parseFloat(localStorage.getItem('voiceRate'));
  if (r >= 0.7 && r <= 1.2) voiceRate = r;
} catch (e) {}

function norwegianVoices() {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices().filter(v => /^(nb|no|nn)/i.test(v.lang));
}

function voiceScore(v) {
  // Foretrekk forbedrede/premium-stemmer, de låter mest naturlige
  const n = (v.name || '').toLowerCase();
  let s = 0;
  if (/premium|enhanced|forbedret|natural|neural/.test(n)) s += 10;
  if (/^nb/i.test(v.lang)) s += 2;
  if (!v.localService) s += 1;
  return s;
}

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = norwegianVoices();
  clockVoice = vs.find(v => v.name === voiceName) || vs.slice().sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
  renderVoiceControls();
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

// Ordet «firm» brukes for korte kommandoer (Klar, Ild, Stans): litt lavere og saktere
function makeUtterance(text, firm) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'nb-NO';
  if (clockVoice) u.voice = clockVoice;
  u.rate = firm ? Math.max(0.7, voiceRate * 0.92) : voiceRate;
  u.pitch = firm ? 0.9 : 1;
  u.volume = 1;
  return u;
}

function speak(text, firm) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.speak(makeUtterance(text, firm));
}

function renderVoiceControls() {
  document.querySelectorAll('.voice-controls').forEach(box => {
    const vs = norwegianVoices();
    const sel = box.querySelector('.voice-select');
    const rate = box.querySelector('.voice-rate');
    sel.innerHTML = vs.length
      ? vs.map(v => `<option value="${escAttr(v.name)}">${v.name}${/premium|enhanced|forbedret/i.test(v.name) ? ' ★' : ''}</option>`).join('')
      : '<option value="">Ingen norsk stemme funnet</option>';
    if (clockVoice) sel.value = clockVoice.name;
    rate.value = String(voiceRate);
    box.querySelector('.voice-rate-val').textContent = voiceRate.toFixed(2).replace('.', ',') + '×';
  });
}

document.querySelectorAll('.voice-controls').forEach(box => {
  box.querySelector('.voice-select').addEventListener('change', e => {
    voiceName = e.target.value;
    try { localStorage.setItem('voiceName', voiceName); } catch (er) {}
    pickVoice();
  });
  box.querySelector('.voice-rate').addEventListener('input', e => {
    voiceRate = parseFloat(e.target.value) || 0.95;
    try { localStorage.setItem('voiceRate', String(voiceRate)); } catch (er) {}
    box.querySelector('.voice-rate-val').textContent = voiceRate.toFixed(2).replace('.', ',') + '×';
  });
  box.querySelector('.voice-test').addEventListener('click', () => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    speak('Skytterne får to minutter til lading og klargjøring fra nå.');
    speak('Klar!', true);
  });
});

function renderClockSteps(now) {
  const r = clockRun;
  if (!r) { document.getElementById('clock-steps').innerHTML = ''; return; }
  const items = r.plan.ev.filter(e => !e.phase || e.label);
  const steps = [];
  r.plan.ev.forEach(e => steps.push(e));
  const doneIdx = steps.reduce((acc, e, i) => (e.t <= now ? i : acc), -1);
  document.getElementById('clock-steps').innerHTML = steps.map((e, i) =>
    `<li class="${i < doneIdx ? 'done' : (i === doneIdx ? 'now' : '')}">${e.label}</li>`).join('');
}

function clockTick() {
  const r = clockRun;
  if (!r) return;
  const now = (Date.now() - r.t0) / 1000;
  // Si kommandoer som er forfalt
  while (r.next < r.plan.ev.length && r.plan.ev[r.next].t <= now) {
    const e = r.plan.ev[r.next++];
    if (e.say) speak(e.say, !!e.firm || /stans|stopp/i.test(e.say));
    renderClockSteps(now);
  }
  const { start, total, secs } = r.plan;
  const phaseEv = r.plan.ev.filter(e => e.phase && e.t <= now && now < e.end).pop();
  const run = document.getElementById('clock-run');
  const ph = document.getElementById('clock-phase');
  if (now >= total) { finishClock(); return; }
  if (now < start) {
    run.classList.remove('shooting');
    ph.classList.remove('go');
    ph.textContent = phaseEv ? phaseEv.phase : 'VENT';
    document.getElementById('clock-time').textContent = fmtClock(phaseEv ? phaseEv.end - now : start - now);
    document.getElementById('clock-caption').textContent = '';
    document.getElementById('clock-progress').style.width = '0%';
  } else {
    run.classList.add('shooting');
    ph.classList.add('go');
    ph.textContent = 'ILD';
    document.getElementById('clock-time').textContent = fmtClock(total - now);
    document.getElementById('clock-caption').textContent = 'igjen av skytetiden';
    document.getElementById('clock-progress').style.width = Math.min(100, (now - start) / secs * 100) + '%';
  }
}

async function requestWake() {
  try { if ('wakeLock' in navigator) clockWake = await navigator.wakeLock.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if ((clockRun || listenState) && document.visibilityState === 'visible') requestWake();
});

function startClock() {
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.cancel(); speak(' '); }
  try { localStorage.setItem('clockSeries', document.getElementById('clock-series').value); } catch (e) {}
  const plan = buildClockEvents(currentDelay());
  clockRun = { t0: Date.now(), plan, next: 0 };
  document.getElementById('clock-setup').hidden = true;
  document.getElementById('clock-run').hidden = false;
  document.getElementById('clock-status').textContent = 'speechSynthesis' in window ? '' : 'Telefonen støtter ikke stemme. Klokken går uten lyd.';
  const btn = document.getElementById('clock-start');
  btn.textContent = 'Avbryt';
  btn.classList.add('stop');
  requestWake();
  renderClockSteps(0);
  clockTick();
  clockTimer = setInterval(clockTick, 100);
}

function endClockUI() {
  clearInterval(clockTimer);
  clockTimer = null;
  clockRun = null;
  if (!listenState) { try { if (clockWake) clockWake.release(); } catch (e) {} clockWake = null; }
  const btn = document.getElementById('clock-start');
  btn.textContent = 'Start';
  btn.classList.remove('stop');
  document.getElementById('clock-run').hidden = true;
  document.getElementById('clock-run').classList.remove('shooting');
  document.getElementById('clock-setup').hidden = false;
  document.getElementById('clock-steps').innerHTML = '';
}

function finishClock() {
  endClockUI();
  document.getElementById('clock-status').textContent = 'Ferdig.';
}

function stopClock() {
  if (!clockRun) return;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  endClockUI();
  document.getElementById('clock-status').textContent = '';
}

document.getElementById('nav-tools').addEventListener('click', () => {
  document.querySelectorAll('#view-tools [data-own]').forEach(el => { el.hidden = !!viewAs; });
  showView(viewTools);
});
document.getElementById('back-tools').addEventListener('click', () => showView(viewList));
document.getElementById('tool-clock').addEventListener('click', () => {
  renderClockSetup();
  document.getElementById('clock-status').textContent = '';
  showView(viewClock);
});
document.getElementById('back-clock').addEventListener('click', () => showView(viewTools));
document.getElementById('clock-start').addEventListener('click', () => { clockRun ? stopClock() : startClock(); });
document.getElementById('clock-series').addEventListener('change', renderClockSetup);
document.querySelectorAll('#clock-delay-chips .chip').forEach(c => c.addEventListener('click', () => {
  clockDelay = c.dataset.delay === 'custom' ? 'custom' : Number(c.dataset.delay);
  currentDelay();
  renderClockSetup();
}));


// ---- Skuddregistrering via mikrofon (test) ----
let listenState = null;   // { ctx, stream, analyser, buf, timer, t0, last, shots: [] }
let listenShots = [];

function listenThreshold() {
  const s = Number(document.getElementById('listen-sens').value) || 5;
  return 0.92 - (s - 1) * 0.07;   // 1 = lite følsom (0.92), 10 = veldig følsom (0.29)
}

function updateListenMark() {
  document.getElementById('listen-mark').style.left = Math.min(100, listenThreshold() * 100) + '%';
}

function fmtTenths(sec) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return m + ':' + (s - m * 60).toFixed(1).padStart(4, '0');
}

function renderListenList() {
  const list = document.getElementById('listen-list');
  const sum = document.getElementById('listen-summary');
  if (!listenShots.length) { list.innerHTML = ''; sum.textContent = ''; return; }
  list.innerHTML = listenShots.map((s, i) => {
    const prev = i > 0 ? listenShots[i - 1].t : null;
    return `<li class="listen-item"><span class="n">${i + 1}</span><span class="t">${fmtTenths(s.t)}</span><span class="d">${prev === null ? '' : '+' + (s.t - prev).toFixed(1) + ' s'}</span><button class="x" data-i="${i}" aria-label="Fjern">✕</button></li>`;
  }).join('');
  const gaps = listenShots.slice(1).map((s, i) => s.t - listenShots[i].t);
  const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
  sum.textContent = `${listenShots.length} skudd` + (avg !== null ? ` · snitt ${avg.toFixed(1)} s mellom skuddene · totalt ${fmtTenths(listenShots[listenShots.length - 1].t - listenShots[0].t)}` : '');
  list.querySelectorAll('.x').forEach(b => b.addEventListener('click', () => {
    listenShots.splice(Number(b.dataset.i), 1);
    renderListenList();
  }));
}

function listenTick() {
  const L = listenState;
  if (!L) return;
  L.analyser.getFloatTimeDomainData(L.buf);
  let peak = 0, sq = 0;
  for (let i = 0; i < L.buf.length; i++) { const v = L.buf[i]; const a = Math.abs(v); if (a > peak) peak = a; sq += v * v; }
  const rms = Math.sqrt(sq / L.buf.length);
  const now = performance.now();
  const fill = document.getElementById('listen-level');
  const thr = listenThreshold();
  fill.style.width = Math.min(100, peak * 100) + '%';
  // Skudd: høyt topp-nivå OG nok energi over ca. 46 ms (klikk fra ladegrep o.l. har lite energi)
  const rmsThr = thr * 0.22;
  const loud = peak >= thr && rms >= rmsThr && rms >= L.noise * 6;
  if (!loud) L.noise = L.noise * 0.98 + rms * 0.02;
  if (!loud && peak >= thr && now - (L.rej || 0) > 500) {
    L.rej = now;
    document.getElementById('listen-status').textContent = `Ignorert: kort/svakt lyd (topp ${peak.toFixed(2)}, kraft ${rms.toFixed(3)}, krever kraft ${rmsThr.toFixed(3)})`;
  }
  if (loud && now - L.last > 800) {
    L.last = now;
    document.getElementById('listen-status').textContent =
      `Siste smell: topp ${peak.toFixed(2)}, kraft ${rms.toFixed(3)} (krever topp ${thr.toFixed(2)}, kraft ${rmsThr.toFixed(3)})`;
    // tid: fra «Ild» hvis klokken skyter, ellers fra første skudd i listen
    let t;
    if (clockRun && (Date.now() - clockRun.t0) / 1000 >= clockRun.plan.start) {
      t = (Date.now() - clockRun.t0) / 1000 - clockRun.plan.start;
    } else {
      if (L.first === null) L.first = now;
      t = (now - L.first) / 1000;
    }
    listenShots.push({ t });
    renderListenList();
    fill.classList.add('hit');
    setTimeout(() => fill.classList.remove('hit'), 200);
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
  }
}

async function startListen() {
  const status = document.getElementById('listen-status');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status.textContent = 'Telefonen støtter ikke mikrofon i denne nettleseren.';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0;
    src.connect(analyser);
    listenState = { ctx, stream, analyser, buf: new Float32Array(analyser.fftSize), last: -1e9, first: null, timer: null, noise: 0.002 };
    listenState.timer = setInterval(listenTick, 10);
    document.getElementById('listen-toggle').textContent = 'Stopp lytting';
    status.textContent = 'Lytter … Skyt et prøveskudd. Etter hvert smell vises topp og kraft, så du kan justere.';
    updateListenMark();
    requestWake();
  } catch (e) {
    status.textContent = 'Fikk ikke tilgang til mikrofonen. Tillat den i innstillingene for nettleseren og prøv igjen.';
  }
}

function stopListen() {
  const L = listenState;
  if (!L) return;
  clearInterval(L.timer);
  try { L.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { L.ctx.close(); } catch (e) {}
  listenState = null;
  document.getElementById('listen-toggle').textContent = 'Start lytting';
  document.getElementById('listen-level').style.width = '0%';
  document.getElementById('listen-status').textContent = '';
  if (!clockRun) { try { if (clockWake) clockWake.release(); } catch (e) {} clockWake = null; }
}

document.getElementById('listen-toggle').addEventListener('click', () => { listenState ? stopListen() : startListen(); });
document.getElementById('listen-reset').addEventListener('click', () => {
  listenShots = [];
  if (listenState) listenState.first = null;
  renderListenList();
});
document.getElementById('listen-sens').addEventListener('input', updateListenMark);
updateListenMark();


// ---- Pussing: teller per sesong ----
const CLEAN_THRESHOLD = 250;

async function fetchCleanings() {
  const { data, error } = await supabase.from('cleaning_log').select('*').eq('user_id', currentUser.id)
    .order('cleaned_on', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function insertCleaning(c) {
  const { error } = await supabase.from('cleaning_log').insert({ ...c, user_id: currentUser.id });
  if (error) throw error;
}

async function deleteCleaningRow(id) {
  const { error } = await supabase.from('cleaning_log').delete().eq('id', id).eq('user_id', currentUser.id);
  if (error) throw error;
}

function currentCleaning() {
  return cleanings.find(c => c.season === SEASONS[SEASONS.length - 1]) || null;
}

function sessionShotCount(s) {
  return Number(s.totalShotsFired) || (s.shots ? s.shots.length : 0) || 0;
}

// antall skudd siden pussing i gjeldende sesong, eller null hvis ingen dato er satt
function cleanCount() {
  const c = currentCleaning();
  if (!c) return null;
  const season = SEASONS[SEASONS.length - 1];
  const day = String(c.cleaned_on).slice(0, 10);
  return sessions.reduce((sum, s) => {
    if (s.season && s.season !== season) return sum;
    const d = String(s.date).slice(0, 10);
    if (d > day || (d === day && c.same_day_counts)) return sum + sessionShotCount(s);
    return sum;
  }, 0);
}

function cleanStep() {
  const n = cleanCount();
  return n === null ? 0 : Math.floor(n / CLEAN_THRESHOLD);
}

function fmtLongDate(iso) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function updateCleanUI() {
  const n = cleanCount();
  const c = currentCleaning();
  const btn = document.getElementById('clean-btn');
  const over = n !== null && n >= CLEAN_THRESHOLD;
  document.getElementById('clean-count').textContent = n === null ? '–' : String(n);
  btn.classList.toggle('alert', over);
  document.getElementById('clean-dot').hidden = !over;
  const banner = document.getElementById('clean-banner');
  banner.hidden = !over || !!viewAs;
  if (over) {
    document.getElementById('clean-banner-sub').textContent =
      `${n} skudd siden ${fmtLongDate(c.cleaned_on)}, terskel ${CLEAN_THRESHOLD}`;
  }
}

function openCleanSheet() {
  const c = currentCleaning();
  const n = cleanCount();
  document.getElementById('clean-date').value = c ? String(c.cleaned_on).slice(0, 10) : new Date().toISOString().slice(0, 10);
  document.getElementById('clean-same-day').value = c && !c.same_day_counts ? '0' : '1';
  document.getElementById('clean-sheet-sub').textContent = c
    ? `${n} skudd siden ${fmtLongDate(c.cleaned_on)} (${SEASONS[SEASONS.length - 1]})`
    : `Legg inn datoen du sist pusset våpenet, så telles skuddene etter den (${SEASONS[SEASONS.length - 1]}).`;
  document.getElementById('clean-sheet').hidden = false;
}

async function saveCleaning(dateIso, sameDay) {
  try {
    await insertCleaning({ season: SEASONS[SEASONS.length - 1], cleaned_on: dateIso, same_day_counts: sameDay });
    cleanings = await fetchCleanings();
    updateCleanUI();
    if (!viewClean.hidden) renderCleanPage();
  } catch (err) {
    alert('Kunne ikke lagre pussingen. Har du kjørt schema_v8.sql i Supabase, og er du på nett?');
  }
}

function showCleanAlert() {
  const n = cleanCount();
  const c = currentCleaning();
  if (n === null || !c) return;
  document.getElementById('clean-alert-title').textContent = `${Math.floor(n / CLEAN_THRESHOLD) * CLEAN_THRESHOLD} skudd siden pussing`;
  document.getElementById('clean-alert-text').textContent =
    `Du har skutt ${n} skudd siden ${fmtLongDate(c.cleaned_on)}. Våpenet bør pusses.`;
  document.getElementById('clean-alert').hidden = false;
}

async function markCleanedNow() {
  // «Pusset nå» etter skyting: dagens skudd ble skutt før pussing og telles ikke
  await saveCleaning(new Date().toISOString().slice(0, 10), false);
}

document.getElementById('clean-btn').addEventListener('click', openCleanSheet);
document.getElementById('clean-cancel').addEventListener('click', () => { document.getElementById('clean-sheet').hidden = true; });
document.getElementById('clean-save').addEventListener('click', async () => {
  const d = document.getElementById('clean-date').value;
  if (!d) return;
  await saveCleaning(d, document.getElementById('clean-same-day').value === '1');
  document.getElementById('clean-sheet').hidden = true;
});
document.getElementById('clean-banner-done').addEventListener('click', markCleanedNow);
document.getElementById('clean-alert-later').addEventListener('click', () => { document.getElementById('clean-alert').hidden = true; });
document.getElementById('clean-alert-done').addEventListener('click', async () => {
  document.getElementById('clean-alert').hidden = true;
  await markCleanedNow();
});


// ---- Hjelpemidler: Puss av våpen ----
function renderCleanPage() {
  const n = cleanCount();
  const c = currentCleaning();
  const numEl = document.getElementById('clean-hero-num');
  numEl.textContent = n === null ? '–' : String(n);
  numEl.classList.toggle('over', n !== null && n >= CLEAN_THRESHOLD);
  const into = n === null ? 0 : (n % CLEAN_THRESHOLD);
  const pct = n === null ? 0 : (n >= CLEAN_THRESHOLD && into === 0 ? 100 : into / CLEAN_THRESHOLD * 100);
  document.getElementById('clean-progress').style.width = Math.min(100, pct) + '%';
  document.getElementById('clean-hero-sub').textContent = c
    ? (n >= CLEAN_THRESHOLD
        ? `Over terskelen på ${CLEAN_THRESHOLD}. Våpenet bør pusses. Sist pusset ${fmtLongDate(c.cleaned_on)}.`
        : `${CLEAN_THRESHOLD - n} skudd igjen til ${CLEAN_THRESHOLD}. Sist pusset ${fmtLongDate(c.cleaned_on)}.`)
    : 'Ingen pussing registrert i denne sesongen.';
  const hist = document.getElementById('clean-history');
  hist.innerHTML = cleanings.length ? cleanings.map(r => `
    <li class="log-item"><div class="main"><div class="t">${fmtLongDate(r.cleaned_on)}</div>
    <div class="s">${r.season} · skudd samme dag ${r.same_day_counts ? 'telles med' : 'telles ikke'}</div></div>
    <button class="x" data-id="${r.id}" aria-label="Slett">✕</button></li>`).join('') : '<li class="people-empty">Ingen puss registrert.</li>';
  hist.querySelectorAll('.x').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Slette dette pusset?')) return;
    try {
      await deleteCleaningRow(b.dataset.id);
      cleanings = await fetchCleanings();
      updateCleanUI();
      renderCleanPage();
    } catch (e) { alert('Kunne ikke slette.'); }
  }));
}
document.getElementById('tool-clean').addEventListener('click', () => { renderCleanPage(); showView(viewClean); });
document.getElementById('back-clean').addEventListener('click', () => showView(viewTools));
document.getElementById('clean-add').addEventListener('click', openCleanSheet);

// ---- Hjelpemidler: Kontrollpunkter ----
let controlPoints = [];
async function loadControlPoints() {
  const { data, error } = await supabase.from('control_points').select('*').eq('user_id', currentUser.id)
    .order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (error) throw error;
  controlPoints = data || [];
}
function positionsForKlasse() {
  const g = KLASSE_GRUPPE[profile.klasse];
  if (g === 'stå') return ['stå', 'kne', 'ligg'];
  if (g === 'kne') return ['kne', 'ligg'];
  if (g === 'ligg') return ['ligg'];
  return null;
}
function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function renderPoints() {
  const pos = positionsForKlasse();
  document.getElementById('points-note').textContent = pos ? `Klasse ${profile.klasse}` : 'Velg klasse på forsiden for å få riktige stillinger. Viser alle til da.';
  const list = pos || ['stå', 'kne', 'ligg'];
  const body = document.getElementById('points-body');
  body.innerHTML = list.map(p => {
    const items = controlPoints.filter(c => c.position === p);
    return `<div class="point-section" data-pos="${p}">
      <div class="point-title">${p}</div>
      ${items.map(c => `<div class="point-item"><input type="text" value="${escAttr(c.text)}" data-id="${c.id}" aria-label="Kontrollpunkt"><button class="x" data-id="${c.id}" aria-label="Slett">✕</button></div>`).join('')}
      <div class="point-add"><input type="text" class="field-input" placeholder="Nytt kontrollpunkt"><button class="add-shot-btn">Legg til</button></div>
    </div>`;
  }).join('');
  body.querySelectorAll('.point-item input').forEach(inp => inp.addEventListener('change', async () => {
    const text = inp.value.trim();
    if (!text) { inp.value = (controlPoints.find(c => c.id === inp.dataset.id) || {}).text || ''; return; }
    try {
      const { error } = await supabase.from('control_points').update({ text }).eq('id', inp.dataset.id).eq('user_id', currentUser.id);
      if (error) throw error;
      const c = controlPoints.find(x => x.id === inp.dataset.id); if (c) c.text = text;
    } catch (e) { alert('Kunne ikke lagre endringen.'); }
  }));
  body.querySelectorAll('.point-item .x').forEach(b => b.addEventListener('click', async () => {
    try {
      const { error } = await supabase.from('control_points').delete().eq('id', b.dataset.id).eq('user_id', currentUser.id);
      if (error) throw error;
      controlPoints = controlPoints.filter(c => c.id !== b.dataset.id);
      renderPoints();
    } catch (e) { alert('Kunne ikke slette.'); }
  }));
  body.querySelectorAll('.point-add').forEach(row => {
    const add = async () => {
      const inp = row.querySelector('input');
      const text = inp.value.trim();
      if (!text) return;
      const position = row.closest('.point-section').dataset.pos;
      const sort_order = controlPoints.filter(c => c.position === position).length;
      try {
        const { data, error } = await supabase.from('control_points').insert({ user_id: currentUser.id, position, text, sort_order }).select().single();
        if (error) throw error;
        controlPoints.push(data);
        renderPoints();
      } catch (e) { alert('Kunne ikke lagre. Har du kjørt schema_v8.sql i Supabase?'); }
    };
    row.querySelector('button').addEventListener('click', add);
    row.querySelector('input').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  });
}
document.getElementById('tool-points').addEventListener('click', async () => {
  try { await loadControlPoints(); } catch (e) { controlPoints = []; }
  renderPoints();
  showView(viewPoints);
});
document.getElementById('back-points').addEventListener('click', () => showView(viewTools));

// ---- Hjelpemidler: Moment våpen ----
let torqueRows = [];
async function loadTorque() {
  const { data, error } = await supabase.from('torque_log').select('*').eq('user_id', currentUser.id)
    .order('tested_on', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  torqueRows = data || [];
}
function fmtNm(v) { return v === null || v === undefined || v === '' ? '–' : Number(v).toFixed(1).replace('.', ','); }
function renderTorque() {
  const list = document.getElementById('torque-list');
  list.innerHTML = torqueRows.length ? torqueRows.map(r => `
    <li class="log-item"><div class="main"><div class="t">${fmtLongDate(r.tested_on)}</div><div class="s">${r.season}</div></div>
    <div class="v">fremre ${fmtNm(r.front)} · bakre ${fmtNm(r.rear)} Nm</div>
    <button class="x" data-id="${r.id}" aria-label="Slett">✕</button></li>`).join('') : '<li class="people-empty">Ingen målinger ennå.</li>';
  list.querySelectorAll('.x').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Slette denne målingen?')) return;
    try {
      const { error } = await supabase.from('torque_log').delete().eq('id', b.dataset.id).eq('user_id', currentUser.id);
      if (error) throw error;
      torqueRows = torqueRows.filter(r => r.id !== b.dataset.id);
      renderTorque();
    } catch (e) { alert('Kunne ikke slette.'); }
  }));
}
document.getElementById('tool-torque').addEventListener('click', async () => {
  populateSeasonSelect(document.getElementById('torque-season'));
  document.getElementById('torque-season').value = SEASONS[SEASONS.length - 1];
  document.getElementById('torque-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('torque-front').value = '';
  document.getElementById('torque-rear').value = '';
  try { await loadTorque(); } catch (e) { torqueRows = []; }
  renderTorque();
  showView(viewTorque);
});
document.getElementById('back-torque').addEventListener('click', () => showView(viewTools));
document.getElementById('torque-save').addEventListener('click', async () => {
  const fr = document.getElementById('torque-front').value;
  const re = document.getElementById('torque-rear').value;
  const tested_on = document.getElementById('torque-date').value;
  if (!tested_on || (fr === '' && re === '')) { alert('Fyll inn dato og minst ett moment.'); return; }
  const round1 = v => v === '' ? null : Math.round(parseFloat(String(v).replace(',', '.')) * 10) / 10;
  try {
    const { error } = await supabase.from('torque_log').insert({
      user_id: currentUser.id, season: document.getElementById('torque-season').value,
      front: round1(fr), rear: round1(re), tested_on
    });
    if (error) throw error;
    await loadTorque();
    document.getElementById('torque-front').value = '';
    document.getElementById('torque-rear').value = '';
    renderTorque();
  } catch (e) { alert('Kunne ikke lagre. Har du kjørt schema_v8.sql i Supabase?'); }
});

// ---- Visualisering: «falsk» standplassleder ----
let visRun = null;   // { abort, ctx, start }

const VIS_KLAR = [{ s: 'Er det noen som ikke er klar?' }, { w: 5 }, { ki: true }];
const visAfter = (sec) => [{ shoot: sec }, { w: 20 }, { s: 'Anvisning kommer.' }, { w: 4 }, { s: 'Er anvisningen i orden?' }, { w: 5 }];
const visSerie = (text, sec, pre = 5) => [{ s: text }, { w: pre }, ...VIS_KLAR, ...visAfter(sec)];
const visProve3 = () => [{ s: 'Gjør klar til fritt antall prøveskudd i 3 minutter.' }, { w: 5 }, { ki: true }, { shoot: 180 }, { s: 'Er anvisningen i orden?' }, { w: 5 }];
const VIS_OMG_STOPS = [[75, '75 sekunder – stopp.'], [120, '2 minutter – stopp.']];
const VIS_UTGANG = 'Utgangsstilling er ferdigstilling – våpenet skal være ladd og sikret, kolben skal være i bakken og det skal være fullt grep om kolbehalsen til kommando ild.';
const VIS_TAKK = [{ s: 'Takk for oppmøtet. Vennligst trekk ut av standplass og gjør klar for neste lag.' }];
const VIS_VISIT = 'Skyttere som ikke skal skyte omgang gjør våpen klar til visitasjon.';
const VIS_JEGER = ' Jegerklassen skyter 3 skudd.';

function visProve(withDetGaatt, flagg) {
  return [
    { s: 'Velkommen til standplassen.' }, { w: 3 },
    { s: 'Skytterne får 2 minutter til lading og klargjøring fra nå.' }, { t0: true },
    { s: flagg }, { until: 120 },
    ...(withDetGaatt ? [{ s: 'Det har gått 2 minutter.' }] : []),
    ...visProve3()
  ];
}

function visOmgangEnd(sec, stops) {
  return [{ shoot: sec, stops }, { s: 'Gjør våpen klar for visitasjon.' }, { w: 30 }, { s: 'Anvisning kommer.' }, { w: 4 }, { s: 'Er anvisningen i orden?' }, { w: 5 }];
}

function visScript(alt) {
  const K1 = 'Skytterne kan nå ta ut kammerflagg og sette inn sluttstykket.';
  const S = {};
  if (alt === 'a1' || alt === 'a2') {
    S.prove = visProve(true, K1);
    S.s1 = visSerie(alt === 'a1'
      ? 'Gjør klar til første serie. Det skal skytes 5 skudd liggende.' + VIS_JEGER + ' Skytetid er 2 minutter.'
      : 'Gjør klar til første serie. Klasse eldre junior, 3, 4 og 5 skal skyte 5 skudd knestående. Øvrige klasser skal skyte 5 skudd liggende.' + VIS_JEGER + ' Skytetid er 2 minutter.', 120);
    S.s2 = visSerie('Gjør klar til andre serie. Klasse eldre junior, 3, 4 og 5 skal skyte 5 skudd stående. Klasse 2, junior, skytterklasse 2 og V55 skal skyte 5 skudd knestående. Øvrige klasser skal skyte 5 skudd liggende.' + VIS_JEGER + ' Skytetid er 3 minutter.', 180, 15);
    S.s3 = visSerie('Gjør klar til tredje serie. Klasse eldre junior, 3, 4 og 5 skal skyte 5 skudd knestående. Øvrige klasser skal skyte 5 skudd liggende.' + VIS_JEGER + ' Skytetid er 2 minutter.', 120);
    if (alt === 'a1') {
      S.t10 = [...visSerie('Gjør klar til ti-skudd serie. Klasse eldre junior, 3, 4 og 5 skal skyte 3 skudd stående, 3 skudd knestående og 4 skudd liggende. Klasse 2, junior, skytterklasse 2 og V55 skal skyte 6 skudd knestående og 4 skudd liggende. Øvrige klasser skal skyte 10 skudd liggende. Jegerklassen skyter 6 skudd. Skytetid er 3 minutter.', 180),
        { s: 'Skyttere i klasse nybegynner ung og andre skyttere som ikke skal skyte omgang gjør våpen klar til visitasjon.' }, { w: 30 }];
    } else {
      S.t10 = [
        { s: 'Gjør klar til ti-skudd. Serien er delt i to 5-skudds serier, og det blir egen kommando for hver av seriene. Klasse eldre junior, 3, 4 og 5 skal skyte 5 skudd stående. Klasse 2, junior, skytterklasse 2 og V55 skal skyte 5 skudd knestående. Øvrige klasser skal skyte 5 skudd liggende.' + VIS_JEGER + ' Skytetid er 3 minutter.' }, { w: 5 }, ...VIS_KLAR, { shoot: 180 },
        { s: 'Gjør klar til ny 5-skudds serie. Klasse eldre junior, 3, 4 og 5 skal skyte 5 skudd knestående. Øvrige klasser skal skyte 5 skudd liggende.' + VIS_JEGER + ' Skytetid er 2 minutter.' }, { w: 5 }, ...VIS_KLAR, ...visAfter(120),
        { s: VIS_VISIT }, { w: 30 }];
    }
    S.omg = [
      { s: 'Gjør klar for omgang – også kikkertklassen og klasse 1 har mesterskap og kan skyte omgang. Det skal skytes 10 skudd liggende. Klasse 1 til 5, V55, kikkertklassen og eldre junior har skytetid 75 sekunder. V75 har skytetid 3 minutter. Øvrige klasser har skytetid 2 minutter. Det ropes stopp etter 75 sekunder og 2 minutter ved behov. ' + VIS_UTGANG },
      { s: 'Skyttere, innta ferdigstilling!' }, { w: 5 }, ...VIS_KLAR, ...visOmgangEnd(180, VIS_OMG_STOPS), ...VIS_TAKK];
  } else if (alt === 'm100') {
    S.prove = visProve(false, K1);
    S.s1 = visSerie('Gjør klar til første serie. Det skal skytes 5 skudd liggende.' + VIS_JEGER + ' Skytetid er 2 minutter.', 120);
    S.s2 = visSerie('Gjør klar til andre serie. Klasse eldre junior skal skyte 5 skudd stående. Klasse junior og skytterklasse 2 skal skyte 5 skudd knestående. Øvrige klasser skal skyte 5 skudd liggende.' + VIS_JEGER + ' Skytetid er 3 minutter.', 180, 15);
    S.s3 = visSerie('Gjør klar til tredje serie. Klasse eldre junior skal skyte 5 skudd knestående. Øvrige klasser skal skyte 5 skudd liggende.' + VIS_JEGER + ' Skytetid er 2 minutter.', 120);
    S.t10 = [...visProve3(), ...visSerie('Gjør klar til ti-skudd serie. Klasse eldre junior skal skyte 3 skudd stående, 3 skudd knestående og 4 skudd liggende. Klasse junior og skytterklasse 2 skal skyte 6 skudd knestående og 4 skudd liggende. Øvrige klasser skal skyte 10 skudd liggende. Jegerklassen skyter 6 skudd. Skytetid er 3 minutter.', 180), { s: VIS_VISIT }, { w: 30 }];
    S.omg = [...visProve3(),
      { s: 'Gjør klar for omgang. Det skal skytes 10 skudd liggende. Skytetid er 75 sekunder for klasse eldre junior og 3 minutter for klasse V75. Øvrige klasser har skytetid 2 minutter. Det vil bli sagt stopp etter 75 sekunder og 2 minutter ved behov. ' + VIS_UTGANG },
      { s: 'Lading, innta ferdigstilling!' }, { w: 5 }, ...VIS_KLAR, ...visOmgangEnd(180, VIS_OMG_STOPS), ...VIS_TAKK];
  } else {
    S.prove = visProve(false, 'Skytterne kan nå sette inn sluttstykket og ta ut kammerflagg.');
    S.s1 = visSerie('Gjør klar til første serie. Det skal skytes 5 skudd liggende. Skytetid er 2 minutter.', 120);
    S.s2 = visSerie('Gjør klar til andre serie. Klasse 3, 4 og 5 skal skyte 5 skudd stående. Klasse 2 og V55 skal skyte 5 skudd knestående. Øvrige klasser skal skyte 5 skudd liggende. Skytetid er 3 minutter.', 180, 15);
    S.s3 = visSerie('Gjør klar til tredje serie. Klasse 3, 4 og 5 skal skyte 5 skudd knestående. Øvrige klasser skal skyte 5 skudd liggende. Skytetid er 2 minutter.', 120);
    S.t10 = [...visProve3(), ...visSerie('Gjør klar til ti-skudd serie. Klasse 3, 4 og 5 skal skyte 3 skudd stående, 3 skudd knestående og 4 skudd liggende. Klasse 2 og V55 skal skyte 6 skudd knestående og 4 skudd liggende. Øvrige klasser skal skyte 10 skudd liggende. Skytetid er 3 minutter.', 180), { s: VIS_VISIT }, { w: 30 }];
    S.omg = [...visProve3(),
      { s: 'Gjør klar for omgang – også kikkertklassen og klasse 1 har mesterskap og kan skyte omgang. Det skal skytes 10 skudd liggende. Skytetid er 75 sekunder. ' + VIS_UTGANG },
      { s: 'Skyttere, innta ferdigstilling!' }, { w: 5 }, ...VIS_KLAR,
      { shoot: 75 }, { s: 'Gjør våpen klar for visitasjon.' }, { w: 30 }, { s: 'Anvisning kommer.' }, { w: 4 }, { s: 'Er anvisningen i orden?' }, { w: 5 }, ...VIS_TAKK];
  }
  return S;
}

function visSleepUntil(ms) {
  return new Promise((res, rej) => {
    const tick = () => {
      if (!visRun || visRun.abort) return rej('abort');
      const left = ms - performance.now();
      if (left <= 0) return res();
      setTimeout(tick, Math.min(left, 100));
    };
    tick();
  });
}
const visSleep = (sec) => visSleepUntil(performance.now() + sec * 1000);

function visBeep() {
  const ctx = visRun && visRun.ctx;
  if (!ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; g.gain.value = 0.25;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.12);
  } catch (e) {}
}

function visSpeakWait(text, firm) {
  return new Promise((res) => {
    if (!('speechSynthesis' in window)) { setTimeout(res, Math.min(8000, text.length * 70)); return; }
    const u = makeUtterance(text, firm);
    let done = false;
    const fin = () => { if (!done) { done = true; clearTimeout(fb); res(); } };
    const fb = setTimeout(fin, 3000 + text.length * 110);
    u.onend = fin; u.onerror = fin;
    speechSynthesis.speak(u);
  });
}

async function visSay(text, firm) {
  if (visRun.tone) { visBeep(); await visSleep(0.17); }
  if (visRun.abort) throw 'abort';
  await visSpeakWait(text, firm);
}

async function visSayAt(text, tMs, firm) {
  await visSleepUntil(tMs - (visRun.tone ? 170 : 0));
  if (visRun.tone) { visBeep(); await visSleep(0.17); }
  if ('speechSynthesis' in window) speechSynthesis.speak(makeUtterance(text, firm));
}

async function visExec(steps) {
  const R = visRun;
  for (const st of steps) {
    if (R.abort) throw 'abort';
    if (st.s) await visSay(st.s);
    else if (st.w) await visSleep(st.w);
    else if (st.t0) R.t0 = performance.now();
    else if (st.until) await visSleepUntil(R.t0 + st.until * 1000);
    else if (st.ki) {
      await visSay('Jeg sier klar om 10 sekunder fra nå.');
      const t0 = performance.now();
      await visSayAt('Klar.', t0 + 10000, true);
      await visSayAt('Ild!', t0 + 15000, true);
      R.tIld = t0 + 15000;
    } else if (st.shoot) {
      const tEnd = R.tIld + st.shoot * 1000;
      for (const [at, text] of (st.stops || [])) await visSayAt(text, R.tIld + at * 1000 - 2000, true);
      await visSayAt('Stans!', tEnd - 2000, true);
      await visSleepUntil(tEnd);
    }
  }
}

async function startVisual() {
  const alt = document.getElementById('vis-alt').value;
  const part = document.getElementById('vis-part').value;
  const tone = document.getElementById('vis-tone').checked;
  let ctx = null;
  try { const C = window.AudioContext || window.webkitAudioContext; if (C) { ctx = new C(); if (ctx.state === 'suspended') await ctx.resume(); } } catch (e) {}
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.cancel(); speak(' '); }
  const S = visScript(alt);
  const order = part === 'all' ? ['prove', 's1', 's2', 's3', 't10', 'omg'] : [part];
  const steps = order.flatMap(k => S[k]);
  visRun = { abort: false, ctx, tone, tIld: 0, t0: 0, started: Date.now() };
  document.getElementById('vis-setup').hidden = true;
  document.getElementById('vis-run').hidden = false;
  document.getElementById('vis-status').textContent = '';
  const btn = document.getElementById('vis-start');
  btn.textContent = 'Avbryt'; btn.classList.add('stop');
  requestWake();
  const partLabel = document.getElementById('vis-part').selectedOptions[0].textContent;
  const altLabel = document.getElementById('vis-alt').selectedOptions[0].textContent;
  try {
    await visExec(steps);
    const minutes = Math.max(1, Math.round((Date.now() - visRun.started) / 60000));
    endVisualUI();
    try {
      await insertMentalSession({
        date: new Date().toISOString().slice(0, 10),
        season: SEASONS[SEASONS.length - 1],
        type: 'Visualisering',
        duration_minutes: minutes,
        comment: `${altLabel} · ${partLabel}`
      });
      mentalSessions = await fetchMentalSessions();
      renderStats();
      document.getElementById('vis-status').textContent = `Ferdig. Lagret som mental økt: Visualisering, ${minutes} min.`;
    } catch (e) {
      document.getElementById('vis-status').textContent = `Ferdig (${minutes} min), men økten ble ikke lagret. Sjekk nettforbindelsen.`;
    }
  } catch (e) {
    if (e !== 'abort') console.error(e);
    endVisualUI();
  }
}

function endVisualUI() {
  if (visRun) { try { if (visRun.ctx) visRun.ctx.close(); } catch (e) {} }
  visRun = null;
  if (!clockRun && !listenState) { try { if (clockWake) clockWake.release(); } catch (e) {} clockWake = null; }
  const btn = document.getElementById('vis-start');
  btn.textContent = 'Start'; btn.classList.remove('stop');
  document.getElementById('vis-run').hidden = true;
  document.getElementById('vis-setup').hidden = false;
}

function stopVis() {
  if (!visRun) return;
  visRun.abort = true;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

document.getElementById('tool-visual').addEventListener('click', () => {
  document.getElementById('vis-status').textContent = '';
  renderVoiceControls();
  showView(viewVisual);
});
document.getElementById('back-visual').addEventListener('click', () => showView(viewTools));
document.getElementById('vis-start').addEventListener('click', () => { visRun ? stopVis() : startVisual(); });
