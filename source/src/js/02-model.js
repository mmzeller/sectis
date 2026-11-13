/* ===================== State, persistence, queries ===================== */
let S = null;
const idx = { todo: new Map(), project: new Map(), heading: new Map(), area: new Map(), tag: new Map() };
const ui = {
  today: todayStr(), view: { type: 'today' }, sel: new Set(), anchor: null, editing: null, newId: null,
  tagFilter: null, tagMatch: lsGet('sectis.tagMatch') === 'all' ? 'all' : 'any', mobile: 'home', selectMode: false, showLogged: {}, hideLogged: {}, laterOpen: {}, tplModal: null,
  lastEditKey: null, logbookLimit: 150, focusAfter: null, scrollToEditor: false, expanded: new Set(), sbCollapsed: new Set(),
};

function defaultSettings() {
  return { theme: 'system', logMode: 'daily', groupToday: false, weekStart: 0, parseEntry: true, notify: false, inheritTags: true, rowTags: 'own', density: 'comfortable', doneSink: 'bottom', prioTop: true, loggedPlace: 'bottom' };
}
function emptyState() {
  return { schema: 1, savedAt: 0, todos: [], projects: [], headings: [], areas: [], tags: [], smart: [], focuses: [], notes: [], settings: defaultSettings(), meta: { fired: {}, sampleLoaded: false } };
}
function normalizeState(s) {
  const base = emptyState();
  const out = Object.assign(base, s || {});
  out.settings = Object.assign(defaultSettings(), (s && s.settings) || {});
  out.meta = Object.assign({ fired: {} }, (s && s.meta) || {});
  for (const k of ['todos', 'projects', 'headings', 'areas', 'tags', 'smart', 'focuses', 'notes']) if (!Array.isArray(out[k])) out[k] = [];
  out.notes = out.notes.filter((x) => x && x.id).map(normalizeNote);
  out.focuses = out.focuses.filter((x) => x && x.id).map(normalizeFocus);
  out.smart = out.smart.filter((x) => x && x.id).map((x) => Object.assign({ type: 'smart', title: '', f: {}, group: 'place', order: 0 }, x));
  out.todos = out.todos.filter((t) => t && t.id && !t.isDraft).map((t) => Object.assign(newTodoShape(), t, { tags: t.tags || [], checklist: t.checklist || [] }));
  out.projects = out.projects.filter((p) => p && p.id).map((p) => Object.assign(newProjectShape(), p, { tags: p.tags || [] }));
  out.areas = out.areas.filter((a) => a && a.id).map((a) => Object.assign({ title: '', tags: [], order: 0 }, a, { tags: a.tags || [] }));
  convertHeadings(out);
  return out;
}

/* Headings were how a project used to be split up; now a project holds sub-projects instead.
   Each heading becomes a sub-project in the same spot, with its to-dos. Its id comes from the
   heading's (subIdFor), so every device that converts the same heading makes the same
   sub-project, and a heading that still arrives from a device on an older version is converted
   the same way. (Not the heading's own id: in sync that's still the heading's, which is
   deleted.) An archived heading becomes a completed sub-project in the Logbook. The new
   sub-projects are stamped as old as can be, so they never win over a change another device
   made to them. True if it changed anything. */
const subIdFor = (headingId) => headingId + '-sub';
function convertHeadings(st = S) {
  const hs = st.headings || [];
  if (!hs.length && !st.todos.some((t) => t.headingId)) return false;
  const projects = new Map(st.projects.map((p) => [p.id, p]));
  for (const h of hs) {
    if (!h || !h.id) continue;
    const parent = projects.get(h.projectId), id = subIdFor(h.id);
    if (!parent || projects.has(id)) continue; // its project is gone, or it's already a sub-project
    const kids = st.todos.filter((t) => t.headingId === h.id && !t.isDraft);
    const done = kids.filter((t) => t.status !== 'open');
    const finished = h.archived ? Math.max(0, ...done.map((t) => t.completedAt || 0)) || parent.modifiedAt || 1 : null;
    const p = Object.assign(newProjectShape(), {
      id, title: h.title || '', parentId: parent.id, order: h.order || 0, start: 'anytime',
      createdAt: h.createdAt || parent.createdAt || 1, modifiedAt: h.modifiedAt || 1, sample: !!parent.sample,
    }, h.archived ? { status: 'done', completedAt: finished, logged: true } : {});
    st.projects.push(p); projects.set(p.id, p);
    if (typeof Y !== 'undefined' && Y.hints) Y.hints[p.id] = 1;
  }
  // every to-do under a heading goes into its sub-project (whichever device converted it)
  for (const t of st.todos) {
    if (!t.headingId) continue;
    const sub = projects.get(subIdFor(t.headingId));
    if (sub && sub.parentId === t.projectId) t.projectId = sub.id;
    t.headingId = null;
  }
  st.headings = [];
  return true;
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
  if (repairProjectTree()) saveSoon();
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
    areaId: null, parentId: null, tags: [], order: 0, todayOrder: 0, createdAt: 0, modifiedAt: 0, completedAt: null, logged: false, trashed: false, sample: false, priority: 0,
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
function liveProject(p) { return !!p && !p.trashed && !p.isTemplate && (p.status === 'open' || !p.logged) && !deadAbove(p); }
function projectOf(t) { return t.projectId ? getP(t.projectId) : null; }

/* ---- projects inside projects ----
   A project can hold sub-projects (parentId), as deep as you like. A sub-project is a project
   like any other; it has no area of its own but belongs to its top project's area, takes on
   the tags of the projects it's in, and goes wherever its parent goes (the Trash, a
   template…). */
function parentOf(p) { const q = p && p.parentId ? getP(p.parentId) : null; return q && q !== p ? q : null; }
const isSub = (p) => !!(p && p.type === 'project' && parentOf(p));
/* the projects it's in, nearest first */
function projAncestors(p) {
  const out = [], seen = new Set([p.id]);
  for (let q = parentOf(p); q && !seen.has(q.id); q = parentOf(q)) { out.push(q); seen.add(q.id); }
  return out;
}
function rootProject(p) { const a = projAncestors(p); return a.length ? a[a.length - 1] : p; }
function childProjects(p) { return S.projects.filter((x) => x.parentId === p.id && x !== p); }
/* every project inside it, at any depth */
function projDescendants(p) {
  const out = [], seen = new Set([p.id]);
  const walk = (q) => childProjects(q).forEach((c) => { if (seen.has(c.id)) return; seen.add(c.id); out.push(c); walk(c); });
  walk(p);
  return out;
}
/* the open projects of an area (null: of none) with their sub-projects under them, as
   [{ p, depth }], for lists you pick a project from */
function projTree(areaId, keep = (p) => !p.trashed && !p.isTemplate && p.status === 'open') {
  const out = [], seen = new Set();
  const walk = (list, depth) => list.filter(keep).sort(byOrder).forEach((p) => { if (seen.has(p.id)) return; seen.add(p.id); out.push({ p, depth }); walk(childProjects(p), depth + 1); });
  walk(S.projects.filter((p) => inArea(p, areaId)), 0);
  return out;
}
/* is to-do t in this project, or in one of its sub-projects? */
function inProjectTree(t, pid) { const p = t.projectId && getP(t.projectId); return !!p && (p.id === pid || projAncestors(p).some((q) => q.id === pid)); }
/* a top-level project in this area (null: in no area) */
const inArea = (p, areaId) => !isSub(p) && (p.areaId || null) === (areaId || null);
/* a project in the Trash or in a template, or inside one, isn't in your lists */
const deadAbove = (p) => projAncestors(p).some((q) => q.trashed || q.isTemplate);
/* "Kitchen › Cabinets": the projects it's in, then itself */
function projPath(p, sep = ' › ') { return [...projAncestors(p).reverse(), p].map(pTitle).join(sep); }
/* A project can't end up inside itself (two devices nesting each in the other at once, say):
   whichever one is caught in a loop moves to the top level. True if anything changed. */
function repairProjectTree() {
  let changed = false;
  for (const p of S.projects) {
    if (!p.parentId) continue;
    const seen = new Set([p.id]); let q = getP(p.parentId), loop = false;
    while (q) { if (seen.has(q.id)) { loop = true; break; } seen.add(q.id); q = q.parentId ? getP(q.parentId) : null; }
    if (loop || p.parentId === p.id) { p.parentId = null; touch(p); changed = true; }
    else if (isSub(p) && p.areaId) { p.areaId = null; touch(p); changed = true; } // a sub-project is in its top project's area
  }
  return changed;
}
function areaOf(x) {
  if (x.type === 'project' && isSub(x)) { const r = rootProject(x); return r.areaId ? getA(r.areaId) || null : null; }
  if (x.areaId) return getA(x.areaId) || null;
  if (x.type === 'todo' && x.projectId) { const p = getP(x.projectId); if (p) return areaOf(p); }
  return null;
}
function inLiveProject(t) { if (!t.projectId) return true; const p = getP(t.projectId); return !!(p && !p.trashed && !p.isTemplate && !deadAbove(p)); }
function isScheduledToday(x) { return x.start === 'anytime' && !!x.when && x.when <= T0(); }
function isTodayItem(x) {
  if (isScheduledToday(x)) return true;
  return !!(x.deadline && x.deadline <= T0());
}
function isEveningItem(x) { return x.evening && x.when === T0() && x.start === 'anytime'; }
function isInbox(t) { return t.start === 'inbox' && !t.projectId && !t.areaId; }
/* a project that's for Someday or starts later (or is inside one) keeps its to-dos out of Anytime */
function projectHidesAnytime(p) { return !!p && [p, ...projAncestors(p)].some((q) => q.start === 'someday' || (q.when && q.when > T0())); }
const somedayAbove = (p) => [p, ...projAncestors(p)].some((q) => q.start === 'someday');

function todayItems() {
  const out = [];
  for (const p of S.projects) if (liveProject(p) && isTodayItem(p) && inFocus(p)) out.push(p);
  for (const t of S.todos) if (liveTodo(t) && inLiveProject(t) && isTodayItem(t) && inFocus(t)) out.push(t);
  return out;
}
function upcomingItems() {
  const out = [];
  for (const p of S.projects) if (liveProject(p) && p.start === 'anytime' && p.when && p.when > T0() && inFocus(p)) out.push(p);
  for (const t of S.todos) if (liveTodo(t) && inLiveProject(t) && t.start === 'anytime' && t.when && t.when > T0() && inFocus(t)) out.push(t);
  return out;
}
function anytimeTodo(t) {
  if (!liveTodo(t) || !inLiveProject(t) || t.start !== 'anytime' || !inFocus(t)) return false;
  if (t.when && t.when > T0()) return false;
  if (isScheduledToday(t)) return true;
  const p = projectOf(t);
  if (p && (projectHidesAnytime(p) || !liveProject(p))) return false;
  return true;
}
function somedayTodo(t) {
  if (!liveTodo(t) || !inLiveProject(t) || t.start !== 'someday' || !inFocus(t)) return false;
  const p = projectOf(t);
  if (p && (somedayAbove(p) || !liveProject(p))) return false;
  return true;
}
function inboxItems() { return S.todos.filter((t) => liveTodo(t) && isInbox(t)); }

function counts() {
  let inbox = 0, today = 0, due = 0, waiting = 0;
  for (const t of S.todos) {
    if (t.trashed || t.isTemplate || t.isDraft || t.status !== 'open') continue;
    if (isInbox(t)) inbox++;
    if (!inFocus(t)) continue;
    if (t.waitFor && inLiveProject(t)) waiting++;
    if (inLiveProject(t) && isTodayItem(t)) { today++; if (t.deadline && t.deadline <= T0()) due++; }
  }
  return { inbox, today, due, waiting };
}
/* a project's to-dos, its sub-projects' included */
function projectProgress(p) {
  let total = 0, done = 0;
  const ids = new Set([p.id]); projDescendants(p).forEach((q) => { if (!q.trashed && !q.isTemplate) ids.add(q.id); });
  for (const t of S.todos) if (ids.has(t.projectId) && !t.trashed && !t.isTemplate && !t.isDraft) { total++; if (t.status !== 'open') done++; }
  return { total, done, frac: p.status !== 'open' ? 1 : total ? done / total : 0, open: total - done };
}

/* ---- tags ---- */
/* Tags keep the order set in Manage Tags (drag, or Sort A to Z), and every list of tags follows it. */
const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
const byTagOrder = (a, b) => (a.order || 0) - (b.order || 0) || byTitle(a, b);
/* Tag groups (tag.group) only organize: "Departments" can hold Parks and Rec, DPW and the rest
   without being a tag itself. A group sits at the top level, can't be put on anything, never
   shows in tag bars, and is ignored if another device or Sintr puts it on something anyway.
   Its tags pick up its color unless they have their own. */
const isTagGroup = (t) => !!(t && t.group);
const notGroupId = (id) => !isTagGroup(getTag(id));
/* a tag's parent, or null when it has none or its parent is gone */
function tagParent(t) { return !t.group && t.parentId && t.parentId !== t.id && getTag(t.parentId) ? t.parentId : null; }
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
  return ids.filter(notGroupId).sort((a, b) => r(a) - r(b));
}
function tagDescendants(id) { const set = new Set([id]); let grew = true; while (grew) { grew = false; for (const t of S.tags) if (t.parentId && set.has(t.parentId) && !set.has(t.id)) { set.add(t.id); grew = true; } } return set; }
function effectiveTags(x) {
  const set = new Set(x.tags || []);
  const p = x.type === 'todo' ? projectOf(x) : x.type === 'project' ? parentOf(x) : null;
  if (p) [p, ...projAncestors(p)].forEach((q) => q.tags.forEach((t) => set.add(t)));
  const a = areaOf(x); if (a) a.tags.forEach((t) => set.add(t));
  for (const id of set) if (!notGroupId(id)) set.delete(id); // a group isn't a tag
  return set;
}
/* The tag bar's filter. ui.tagFilter is null (All), '__none' (No Tag), or a list of one or more
   tag ids. With more than one, ui.tagMatch says whether a to-do needs any of them or all of them.
   A tag deleted meanwhile (here or on another device) just drops out of the filter. */
const tagFilterIds = () => (Array.isArray(ui.tagFilter) ? ui.tagFilter.filter(getTag) : []);
const tagFilterHas = (id) => tagFilterIds().includes(id);
const tagFilterAll = () => ui.tagFilter !== '__none' && !tagFilterIds().length;
function setTagFilter(ids) { ids = (ids || []).filter(getTag); ui.tagFilter = ids.length ? ids : null; }
function toggleTagFilter(id) { const cur = tagFilterIds(); setTagFilter(cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat(id)); }
function dropFromTagFilter(id) { if (Array.isArray(ui.tagFilter) && ui.tagFilter.includes(id)) { setTagFilter(ui.tagFilter.filter((x) => x !== id)); return true; } return false; }
function setTagMatch(m) { ui.tagMatch = m === 'all' ? 'all' : 'any'; lsSet('sectis.tagMatch', ui.tagMatch); }
function matchesTagFilter(x) {
  if (!ui.tagFilter) return true;
  if (ui.tagFilter === '__none') return effectiveTags(x).size === 0;
  const ids = tagFilterIds();
  if (!ids.length) return true;
  const eff = effectiveTags(x);
  const hit = (id) => { for (const t of tagDescendants(id)) if (eff.has(t)) return true; return false; };
  return ui.tagMatch === 'all' && ids.length > 1 ? ids.every(hit) : ids.some(hit);
}
/* the tags a new to-do takes so it shows under the tag bar's filter: all of them for All,
   the first one picked for Any (as a smart list does) */
function tagFilterNewTags() {
  const ids = tagFilterIds();
  return ui.tagMatch === 'all' ? ids : ids.slice(0, 1);
}
/* A to-do placed in a project or area takes on that place's tags (the project's and its
   area's). Moving it on swaps the tags it picked up from the old place for the new one's. */
function placeTagIds(t) {
  const out = new Set();
  const p = t.projectId && getP(t.projectId); if (p) [p, ...projAncestors(p)].forEach((q) => q.tags.forEach((x) => out.add(x)));
  const a = t.areaId ? getA(t.areaId) : p ? areaOf(p) : null; if (a) a.tags.forEach((x) => out.add(x));
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
  let t = S.tags.find((x) => !x.group && x.title.toLowerCase() === name.toLowerCase());
  if (!t && S.tags.some((x) => x.group && x.title.toLowerCase() === name.toLowerCase())) return null; // that's a group's name, not a tag's
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
