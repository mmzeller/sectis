/* ===================== Sorting and compact rows =====================
   Each list can be sorted by priority, deadline, date, title or when it was added, instead of the
   order you arrange by hand. The choice is per list and per device (sectis.sort).
   Compact rows (Settings → Row spacing) fit more on screen. */
const SORTS = [['manual', 'Manual Order'], ['priority', 'Priority'], ['deadline', 'Deadline'], ['when', 'Date'], ['title', 'Title'], ['added', 'Recently Added']];
const SORT_LABEL = { manual: 'Manual', priority: 'Priority', deadline: 'Deadline', when: 'Date', title: 'Title', added: 'Recently Added' };
const SORT_SEC = /^(inbox|today|evening|anytime|someday|project|area|tag|waiting)/; // not Upcoming or the Logbook, which have their own order
function loadSorts() { try { ui.sorts = JSON.parse(lsGet('sectis.sort') || '{}') || {}; } catch (e) { ui.sorts = {}; } }
function sortKeyFor(v = ui.view) { return v.id ? `${v.type}:${v.id}` : v.type; }
function sortableView(v = ui.view) { return ['inbox', 'today', 'anytime', 'someday', 'project', 'area', 'tag', 'waiting', 'board'].includes(v.type); }
/* Lists you haven't sorted another way keep higher priorities on top (Settings → Keep higher
   priorities on top), so a list with no priorities looks just as you arranged it. */
function defaultSort() { return S.settings.prioTop === false ? 'manual' : 'priority'; }
function currentSort() { return sortableView() ? (ui.sorts || {})[sortKeyFor()] || defaultSort() : 'manual'; }
/* sorts you can still arrange by hand: Manual, and Priority within each priority */
const handOrdered = (mode = currentSort()) => mode === 'manual' || mode === 'priority';
function setSort(mode) {
  ui.sorts = ui.sorts || {};
  const k = sortKeyFor();
  if (mode === defaultSort()) delete ui.sorts[k]; else ui.sorts[k] = mode;
  lsSet('sectis.sort', JSON.stringify(ui.sorts)); render();
}
function sortItems(items, mode) {
  const T = T0();
  const name = (x) => (x.type === 'project' ? pTitle(x) : x.title || '');
  // items without the value keep their hand-arranged order, after the rest
  const by = (f) => items.slice().sort((a, b) => { const x = f(a), y = f(b); if (x === y) return 0; if (x == null) return 1; if (y == null) return -1; return x < y ? -1 : 1; });
  if (mode === 'priority') return by((x) => (prio(x) ? 4 - prio(x) : null)); // High first
  if (mode === 'deadline') return by((x) => x.deadline || null);
  if (mode === 'when') return by((x) => (x.start === 'someday' ? '9999-12-31' : x.when ? (x.when < T ? T : x.when) : null));
  if (mode === 'title') return items.slice().sort((a, b) => name(a).localeCompare(name(b), undefined, { numeric: true, sensitivity: 'base' }));
  if (mode === 'added') return items.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return items;
}
/* a list of rows in the current sort (an area's projects, which aren't a to-do section) */
function sortedRows(items) { const m = currentSort(); return sinkDone(m === 'manual' ? items : sortItems(items, m)); }

/* Completed to-dos sink to the bottom of their list, the last one checked at the very bottom
   (Settings → Completed to-dos). Only how they're shown changes: each keeps its place, so
   unchecking one puts it right back. One just checked stays put for a moment first. */
const SINK_SEC = /^(inbox|today|evening|upcoming|anytime|someday|project|area|tag|waiting)/; // not the Logbook or Trash
const sinksDone = () => (S.settings.doneSink || 'bottom') === 'bottom';
function sinkDone(items) {
  if (!sinksDone()) return items;
  const held = ui.justDone || new Set();
  const isDone = (x) => x.status !== 'open' && !held.has(x.id);
  const done = items.filter(isDone);
  if (!done.length) return items;
  return items.filter((x) => !isDone(x)).concat(done.sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0)));
}
function holdDone(id) {
  ui.justDone = ui.justDone || new Set();
  ui.justDone.add(id);
  clearTimeout(ui.justDoneTimer);
  ui.justDoneTimer = setTimeout(() => { ui.justDone.clear(); if (sinksDone()) render(); }, S.settings.logMode === 'immediate' ? 1600 : 800);
}
/* A heading whose to-dos are all done (or canceled) sinks below the other headings, the last
   finished at the very bottom, under the same setting. Only how they're shown: unchecking one
   of its to-dos puts it right back. An empty heading isn't done. Its title dims either way. */
function headingDoneAt(h) {
  const held = ui.justDone || new Set();
  let n = 0, last = 0;
  for (const t of S.todos) {
    if (t.headingId !== h.id || t.trashed || t.isTemplate || t.isDraft) continue;
    if (t.status === 'open' || held.has(t.id)) return 0;
    n++; if ((t.completedAt || 0) > last) last = t.completedAt || 0;
  }
  return n ? last || 1 : 0;
}
const headingDoneCls = (h) => (headingDoneAt(h) ? ' done' : '');
function sinkHeadings(hs) {
  if (!sinksDone()) return hs;
  const at = new Map(hs.map((h) => [h.id, headingDoneAt(h)]));
  const done = hs.filter((h) => at.get(h.id));
  return done.length ? hs.filter((h) => !at.get(h.id)).concat(done.sort((a, b) => at.get(a.id) - at.get(b.id))) : hs;
}
/* placing rows by hand (drag, ⌘↑ / ⌘↓, a new to-do below another): completed ones shown at the
   bottom don't count, so the spot is set among the open ones */
function placeRows(rows, x = null) {
  let out = sinksDone() ? rows.filter((r) => { const y = rowItem(r); return y && y.status === 'open'; }) : rows;
  // sorted by priority: a to-do is arranged among the ones with the same priority
  if (x && currentSort() === 'priority') out = out.filter((r) => { const y = rowItem(r); return y && prio(y) === prio(x); });
  return out;
}
function sortMenuItem(anchor, label = 'Sort By…') { return { label, icon: 'sort', hint: SORT_LABEL[currentSort()], fn: () => openSortMenu(anchor) }; }
function openSortMenu(anchor) {
  const cur = currentSort();
  return openMenu(anchor, [{ header: 'Sort By' }, ...SORTS.map(([v, l]) => ({ label: l, icon: v === cur ? 'check' : 'blank', fn: () => setSort(v) }))]);
}
/* a small "Sorted by …" button in the list header, so a sorted list never looks like it lost your order */
function addSortPill() {
  const mode = currentSort(); if (mode === defaultSort()) return; // the usual order needs no note
  const lh = $('#content .lh'); if (!lh) return;
  const b = document.createElement('button');
  b.className = 'sort-pill'; b.dataset.action = 'sort-menu'; b.title = 'Sorted by ' + SORT_LABEL[mode] + '. Click to change.';
  b.innerHTML = `${ic('sort')}<span>${esc(SORT_LABEL[mode])}</span>`;
  lh.insertBefore(b, lh.querySelector('.lh-board, .lh-share, .board-add, [data-action="view-menu"], [data-action="proj-menu"], [data-action="area-menu"]'));
}
function sortedHint() {
  toast(`This list is sorted by ${SORT_LABEL[currentSort()]}. Switch to Manual Order to arrange it by hand.`, { action: 'Manual Order', fn: () => setSort('manual'), ms: 6000 });
}
function toggleCompact() { S.settings.density = S.settings.density === 'compact' ? 'comfortable' : 'compact'; saveSoon(); render(); }
