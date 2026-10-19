/* ===================== State, persistence, queries ===================== */
let S = null;
const idx = { todo: new Map(), project: new Map(), heading: new Map(), area: new Map(), tag: new Map() };
const ui = {
  today: todayStr(), view: { type: 'today' }, sel: new Set(), anchor: null, editing: null, newId: null,
  tagFilter: null, mobile: 'home', selectMode: false, showLogged: {}, laterOpen: {}, tplModal: null,
  lastEditKey: null, logbookLimit: 150, focusAfter: null, scrollToEditor: false,
};

function defaultSettings() {
  return { theme: 'system', logMode: 'daily', groupToday: false, weekStart: 0, parseEntry: true, notify: false };
}
function emptyState() {
  return { schema: 1, savedAt: 0, todos: [], projects: [], headings: [], areas: [], tags: [], settings: defaultSettings(), meta: { fired: {}, sampleLoaded: false } };
}
function normalizeState(s) {
  const base = emptyState();
  const out = Object.assign(base, s || {});
  out.settings = Object.assign(defaultSettings(), (s && s.settings) || {});
  out.meta = Object.assign({ fired: {} }, (s && s.meta) || {});
  for (const k of ['todos', 'projects', 'headings', 'areas', 'tags']) if (!Array.isArray(out[k])) out[k] = [];
  out.todos = out.todos.filter((t) => t && t.id && !t.isDraft).map((t) => Object.assign(newTodoShape(), t, { tags: t.tags || [], checklist: t.checklist || [] }));
  out.projects = out.projects.filter((p) => p && p.id).map((p) => Object.assign(newProjectShape(), p, { tags: p.tags || [] }));
  out.areas = out.areas.filter((a) => a && a.id).map((a) => Object.assign({ title: '', tags: [], order: 0 }, a, { tags: a.tags || [] }));
  return out;
}
function reindex() {
  for (const k in idx) idx[k].clear();
  S.todos.forEach((t) => idx.todo.set(t.id, t));
  S.projects.forEach((p) => idx.project.set(p.id, p));
  S.headings.forEach((h) => idx.heading.set(h.id, h));
  S.areas.forEach((a) => idx.area.set(a.id, a));
  S.tags.forEach((t) => idx.tag.set(t.id, t));
}
const getT = (id) => idx.todo.get(id);
const getP = (id) => idx.project.get(id);
const getH = (id) => idx.heading.get(id);
const getA = (id) => idx.area.get(id);
const getTag = (id) => idx.tag.get(id);
const itemById = (id) => idx.todo.get(id) || idx.project.get(id);

/* ---- persistence ---- */
function loadState() {
  let raw = lsGet(STORE_KEY), parsed = null;
  if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
  if (parsed) S = normalizeState(parsed);
  else { S = emptyState(); seedSample(); }
  reindex();
}
let saveFailedOnce = false;
function saveNow() {
  if (!S) return;
  S.savedAt = Date.now();
  const json = JSON.stringify(S);
  if (!lsSet(STORE_KEY, json) && !saveFailedOnce) { saveFailedOnce = true; toast('Couldn’t save in this browser. Export a backup from Settings.'); }
  ui.lastLocalWrite = S.savedAt;
  if (typeof fileSyncWrite === 'function') fileSyncWrite(json);
  syncLocalSaved();
}
const saveSoon = debounce(saveNow, 250);
window.addEventListener('pagehide', () => saveSoon.flush());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveSoon.flush(); });
window.addEventListener('storage', (e) => {
  if (e.key !== STORE_KEY || !e.newValue || ui.editing) return;
  try { const s = JSON.parse(e.newValue); if (s.savedAt > (S.savedAt || 0)) { S = normalizeState(s); reindex(); render(); } } catch (err) { /* ignore */ }
});

/* ---- undo ---- */
const undoStack = [];
function snapshot(label) { undoStack.push({ label, data: JSON.stringify(S) }); if (undoStack.length > 80) undoStack.shift(); }
function undo() {
  const u = undoStack.pop();
  if (!u) { toast('Nothing to undo'); return; }
  S = normalizeState(JSON.parse(u.data)); reindex();
  ui.editing = null; ui.lastEditKey = null;
  for (const id of [...ui.sel]) if (!itemById(id)) ui.sel.delete(id);
  saveSoon(); render(); toast(`Undone: ${u.label}`);
}
function commit(label, fn, opts = {}) {
  snapshot(label); ui.lastEditKey = null;
  const r = fn();
  reindex(); saveSoon();
  if (opts.render !== false) render();
  return r;
}
function touch(x) { x.modifiedAt = Date.now(); }

/* ---- shapes ---- */
function newTodoShape() {
  return { id: '', type: 'todo', title: '', notes: '', status: 'open', start: 'inbox', when: null, evening: false, deadline: null, reminder: null,
    projectId: null, areaId: null, headingId: null, tags: [], checklist: [], order: 0, todayOrder: 0, createdAt: 0, modifiedAt: 0,
    completedAt: null, logged: false, trashed: false, isTemplate: false, repeat: null, next: null, templateId: null, sample: false };
}
function newProjectShape() {
  return { id: '', type: 'project', title: '', notes: '', status: 'open', start: 'anytime', when: null, evening: false, deadline: null, reminder: null,
    areaId: null, tags: [], order: 0, todayOrder: 0, createdAt: 0, modifiedAt: 0, completedAt: null, logged: false, trashed: false, sample: false };
}
function makeTodo(props) { const now = Date.now(); return Object.assign(newTodoShape(), { id: uid(), createdAt: now, modifiedAt: now }, props); }
function makeProject(props) { const now = Date.now(); return Object.assign(newProjectShape(), { id: uid(), createdAt: now, modifiedAt: now }, props); }

/* ---- order helpers: fractional ordering within each container ---- */
function orderBetween(a, b, n = 1) {
  if (a == null && b == null) return Array.from({ length: n }, (_, i) => i);
  if (a == null) a = b - n - 1;
  if (b == null) b = a + n + 1;
  const step = (b - a) / (n + 1);
  return Array.from({ length: n }, (_, i) => a + step * (i + 1));
}
function minOf(arr, key) { let m = null; for (const x of arr) if (m == null || x[key] < m) m = x[key]; return m; }
function maxOf(arr, key) { let m = null; for (const x of arr) if (m == null || x[key] > m) m = x[key]; return m; }
const topOrder = (arr, key = 'order') => { const m = minOf(arr, key); return m == null ? 0 : m - 1; };
const endOrder = (arr, key = 'order') => { const m = maxOf(arr, key); return m == null ? 0 : m + 1; };

/* ---- membership ---- */
const T0 = () => ui.today;
const isOpen = (x) => x.status === 'open';
function liveTodo(t) { return !t.trashed && !t.isTemplate && !t.isDraft && (t.status === 'open' || !t.logged); }
function liveProject(p) { return p && !p.trashed && (p.status === 'open' || !p.logged); }
function projectOf(t) { return t.projectId ? getP(t.projectId) : null; }
function areaOf(x) {
  if (x.areaId) return getA(x.areaId) || null;
  if (x.type === 'todo' && x.projectId) { const p = getP(x.projectId); if (p && p.areaId) return getA(p.areaId) || null; }
  return null;
}
function inLiveProject(t) { if (!t.projectId) return true; const p = getP(t.projectId); return !!(p && !p.trashed); }
function isScheduledToday(x) { return x.start === 'anytime' && !!x.when && x.when <= T0(); }
function isTodayItem(x) {
  if (isScheduledToday(x)) return true;
  return !!(x.deadline && x.deadline <= T0());
}
function isEveningItem(x) { return x.evening && x.when === T0() && x.start === 'anytime'; }
function isInbox(t) { return t.start === 'inbox' && !t.projectId && !t.areaId; }
function projectHidesAnytime(p) { return p && (p.start === 'someday' || (p.when && p.when > T0())); }

function todayItems() {
  const out = [];
  for (const p of S.projects) if (liveProject(p) && isTodayItem(p)) out.push(p);
  for (const t of S.todos) if (liveTodo(t) && inLiveProject(t) && isTodayItem(t)) out.push(t);
  return out;
}
function upcomingItems() {
  const out = [];
  for (const p of S.projects) if (liveProject(p) && p.start === 'anytime' && p.when && p.when > T0()) out.push(p);
  for (const t of S.todos) if (liveTodo(t) && inLiveProject(t) && t.start === 'anytime' && t.when && t.when > T0()) out.push(t);
  return out;
}
function anytimeTodo(t) {
  if (!liveTodo(t) || !inLiveProject(t) || t.start !== 'anytime') return false;
  if (t.when && t.when > T0()) return false;
  if (isScheduledToday(t)) return true;
  const p = projectOf(t);
  if (p && (projectHidesAnytime(p) || !liveProject(p))) return false;
  return true;
}
function somedayTodo(t) {
  if (!liveTodo(t) || !inLiveProject(t) || t.start !== 'someday') return false;
  const p = projectOf(t);
  if (p && (p.start === 'someday' || !liveProject(p))) return false;
  return true;
}
function inboxItems() { return S.todos.filter((t) => liveTodo(t) && isInbox(t)); }

function counts() {
  let inbox = 0, today = 0, due = 0;
  for (const t of S.todos) {
    if (t.trashed || t.isTemplate || t.isDraft || t.status !== 'open') continue;
    if (isInbox(t)) inbox++;
    if (inLiveProject(t) && isTodayItem(t)) { today++; if (t.deadline && t.deadline <= T0()) due++; }
  }
  return { inbox, today, due };
}
function projectProgress(p) {
  let total = 0, done = 0;
  for (const t of S.todos) if (t.projectId === p.id && !t.trashed && !t.isTemplate && !t.isDraft) { total++; if (t.status !== 'open') done++; }
  return { total, done, frac: p.status !== 'open' ? 1 : total ? done / total : 0, open: total - done };
}

/* ---- tags ---- */
function tagTree() {
  const out = [];
  const walk = (pid, depth) => {
    S.tags.filter((t) => (t.parentId || null) === pid).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .forEach((t) => { out.push({ tag: t, depth }); if (depth < 6) walk(t.id, depth + 1); });
  };
  walk(null, 0);
  // orphans whose parent vanished
  S.tags.forEach((t) => { if (!out.find((o) => o.tag === t)) out.push({ tag: t, depth: 0 }); });
  return out;
}
function tagDescendants(id) { const set = new Set([id]); let grew = true; while (grew) { grew = false; for (const t of S.tags) if (t.parentId && set.has(t.parentId) && !set.has(t.id)) { set.add(t.id); grew = true; } } return set; }
function effectiveTags(x) {
  const set = new Set(x.tags || []);
  if (x.type === 'todo') { const p = projectOf(x); if (p) p.tags.forEach((t) => set.add(t)); }
  const a = areaOf(x); if (a) a.tags.forEach((t) => set.add(t));
  return set;
}
function matchesTagFilter(x) {
  if (!ui.tagFilter) return true;
  if (ui.tagFilter === '__none') return effectiveTags(x).size === 0;
  const want = tagDescendants(ui.tagFilter);
  for (const t of effectiveTags(x)) if (want.has(t)) return true;
  return false;
}
function tagTitle(id) { const t = getTag(id); return t ? t.title : ''; }
function findOrCreateTag(title) {
  const name = title.trim(); if (!name) return null;
  let t = S.tags.find((x) => x.title.toLowerCase() === name.toLowerCase());
  if (!t) { t = { id: uid(), title: name, parentId: null, order: endOrder(S.tags) }; S.tags.push(t); idx.tag.set(t.id, t); }
  return t;
}

/* ---- logbook automation ---- */
function autoLog() {
  const mode = S.settings.logMode; if (mode === 'manual') return false;
  const now = Date.now(); let changed = false;
  for (const x of S.todos.concat(S.projects)) {
    if (x.status === 'open' || x.logged || !x.completedAt) continue;
    if (mode === 'immediate' ? now - x.completedAt > 1200 : stampDay(x.completedAt) < T0()) { x.logged = true; changed = true; }
  }
  if (changed) saveSoon();
  return changed;
}
function logCompletedNow() {
  commit('Log Completed', () => { for (const x of S.todos.concat(S.projects)) if (x.status !== 'open') x.logged = true; });
  toast('Moved completed items to the Logbook');
}
