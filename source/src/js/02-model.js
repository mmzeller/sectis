/* ===================== State, persistence, queries ===================== */
let S = null;
const idx = { todo: new Map(), project: new Map(), heading: new Map(), area: new Map(), tag: new Map() };
const ui = {
  today: todayStr(), view: { type: 'today' }, sel: new Set(), anchor: null, editing: null, newId: null,
  tagFilter: null, mobile: 'home', selectMode: false, showLogged: {}, laterOpen: {}, tplModal: null,
  lastEditKey: null, logbookLimit: 150, focusAfter: null, scrollToEditor: false, expanded: new Set(), sbCollapsed: new Set(),
};

function defaultSettings() {
  return { theme: 'system', logMode: 'daily', groupToday: false, weekStart: 0, parseEntry: true, notify: false, inheritTags: true, rowTags: 'own', density: 'comfortable', doneSink: 'bottom' };
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
let tagRankCache = null; // tag order for inTagOrder; cleared whenever anything changes
function reindex() {
  tagRankCache = null;
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
  propagateLinks();
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
  propagateLinks();
  reindex(); saveSoon();
  if (opts.render !== false) render();
  return r;
}
function touch(x) { x.modifiedAt = Date.now(); }

/* ---- shapes ---- */
function newTodoShape() {
  return { id: '', type: 'todo', title: '', notes: '', status: 'open', start: 'inbox', when: null, evening: false, deadline: null, reminder: null,
    projectId: null, areaId: null, headingId: null, tags: [], checklist: [], order: 0, todayOrder: 0, createdAt: 0, modifiedAt: 0, priority: 0,
    completedAt: null, logged: false, trashed: false, isTemplate: false, repeat: null, next: null, templateId: null, sample: false, linkId: null };
}
function newProjectShape() {
  return { id: '', type: 'project', title: '', notes: '', status: 'open', start: 'anytime', when: null, evening: false, deadline: null, reminder: null,
    areaId: null, tags: [], order: 0, todayOrder: 0, createdAt: 0, modifiedAt: 0, completedAt: null, logged: false, trashed: false, sample: false, priority: 0,
    isTemplate: false, repeat: null, next: null, templateId: null };
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
function liveProject(p) { return p && !p.trashed && !p.isTemplate && (p.status === 'open' || !p.logged); }
function projectOf(t) { return t.projectId ? getP(t.projectId) : null; }
function areaOf(x) {
  if (x.areaId) return getA(x.areaId) || null;
  if (x.type === 'todo' && x.projectId) { const p = getP(x.projectId); if (p && p.areaId) return getA(p.areaId) || null; }
  return null;
}
function inLiveProject(t) { if (!t.projectId) return true; const p = getP(t.projectId); return !!(p && !p.trashed && !p.isTemplate); }
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
  let inbox = 0, today = 0, due = 0, waiting = 0;
  for (const t of S.todos) {
    if (t.trashed || t.isTemplate || t.isDraft || t.status !== 'open') continue;
    if (isInbox(t)) inbox++;
    if (t.waitFor && inLiveProject(t)) waiting++;
    if (inLiveProject(t) && isTodayItem(t)) { today++; if (t.deadline && t.deadline <= T0()) due++; }
  }
  return { inbox, today, due, waiting };
}
function projectProgress(p) {
  let total = 0, done = 0;
  for (const t of S.todos) if (t.projectId === p.id && !t.trashed && !t.isTemplate && !t.isDraft) { total++; if (t.status !== 'open') done++; }
  return { total, done, frac: p.status !== 'open' ? 1 : total ? done / total : 0, open: total - done };
}

/* ---- tags ---- */
/* Tags keep the order set in Manage Tags (drag, or Sort A to Z), and every list of tags follows it. */
const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
const byTagOrder = (a, b) => (a.order || 0) - (b.order || 0) || byTitle(a, b);
/* a tag's parent, or null when it has none or its parent is gone */
function tagParent(t) { return t.parentId && t.parentId !== t.id && getTag(t.parentId) ? t.parentId : null; }
function tagKids(pid) { return S.tags.filter((t) => tagParent(t) === pid).sort(byTagOrder); }
function tagTree() {
  const out = [], seen = new Set();
  const walk = (pid, depth) => {
    tagKids(pid).forEach((t) => { if (seen.has(t.id)) return; seen.add(t.id); out.push({ tag: t, depth }); if (depth < 6) walk(t.id, depth + 1); });
  };
  walk(null, 0);
  // tags caught in a loop of parents
  S.tags.forEach((t) => { if (!seen.has(t.id)) out.push({ tag: t, depth: 0 }); });
  return out;
}
/* Tag colors: a soft tint. Each top-level tag gets the least-used color when it's made (or first seen,
   for tags from before colors or from Sintr) and keeps it; change it in Manage Tags. A nested tag shares its
   parent's color unless you give it its own. Gray means no color. */
const TAG_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink'];
const TAG_COLOR_NAMES = { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', teal: 'Teal', blue: 'Blue', indigo: 'Indigo', purple: 'Purple', pink: 'Pink', gray: 'Gray' };
const TAG_COLOR_TURN = ['blue', 'orange', 'green', 'purple', 'red', 'teal', 'pink', 'yellow', 'indigo']; // neighbors look different
function nextTagColor() {
  const used = new Map(TAG_COLOR_TURN.map((c) => [c, 0]));
  S.tags.forEach((t) => { if (!tagParent(t) && used.has(t.color)) used.set(t.color, used.get(t.color) + 1); });
  return TAG_COLOR_TURN.reduce((best, c) => (used.get(c) < used.get(best) ? c : best), TAG_COLOR_TURN[0]);
}
/* gives every top-level tag without a color one; true when it changed anything */
function ensureTagColors() {
  let changed = false;
  tagTree().forEach(({ tag }) => { if (!tagParent(tag) && !TAG_COLOR_NAMES[tag.color]) { tag.color = nextTagColor(); changed = true; } });
  return changed;
}
function tagColor(t, depth = 0) {
  if (!t) return 'gray';
  if (TAG_COLOR_NAMES[t.color]) return t.color;
  const p = tagParent(t) && getTag(tagParent(t));
  return p && depth < 8 ? tagColor(p, depth + 1) : 'gray';
}
const tcls = (t) => 'tc-' + tagColor(t);
/* tag ids in the Manage Tags order (for the tags shown on a to-do) */
function inTagOrder(ids) {
  if (!tagRankCache) { tagRankCache = new Map(); tagTree().forEach((n, i) => tagRankCache.set(n.tag.id, i)); }
  const r = (id) => (tagRankCache.has(id) ? tagRankCache.get(id) : 1e9);
  return ids.slice().sort((a, b) => r(a) - r(b));
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
/* A to-do placed in a project or area takes on that place's tags (the project's and its
   area's). Moving it on swaps the tags it picked up from the old place for the new one's. */
function placeTagIds(t) {
  const out = new Set();
  const p = t.projectId && getP(t.projectId); if (p) p.tags.forEach((x) => out.add(x));
  const a = t.areaId ? getA(t.areaId) : p && p.areaId ? getA(p.areaId) : null; if (a) a.tags.forEach((x) => out.add(x));
  return out;
}
function retag(t, before) {
  if (!S.settings.inheritTags || !t || t.type !== 'todo' || t.isTemplate) return;
  const now = placeTagIds(t);
  let tags = t.tags.filter((x) => !(before.has(x) && !now.has(x)));
  now.forEach((x) => { if (!tags.includes(x) && getTag(x)) tags.push(x); });
  if (tags.join() !== t.tags.join()) t.tags = tags;
}
function tagTitle(id) { const t = getTag(id); return t ? t.title : ''; }
function findOrCreateTag(title) {
  const name = title.trim(); if (!name) return null;
  let t = S.tags.find((x) => x.title.toLowerCase() === name.toLowerCase());
  if (!t) { t = { id: uid(), title: name, parentId: null, order: endOrder(S.tags), color: nextTagColor() }; S.tags.push(t); idx.tag.set(t.id, t); }
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
