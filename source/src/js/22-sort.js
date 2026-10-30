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
function currentSort() { return sortableView() ? (ui.sorts || {})[sortKeyFor()] || 'manual' : 'manual'; }
function setSort(mode) {
  ui.sorts = ui.sorts || {};
  const k = sortKeyFor();
  if (mode === 'manual') delete ui.sorts[k]; else ui.sorts[k] = mode;
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
/* placing rows by hand (drag, ⌘↑ / ⌘↓, a new to-do below another): completed ones shown at the
   bottom don't count, so the spot is set among the open ones */
function placeRows(rows) { return sinksDone() ? rows.filter((r) => { const x = rowItem(r); return x && x.status === 'open'; }) : rows; }
function sortMenuItem(anchor) { return { label: 'Sort By…', icon: 'sort', hint: SORT_LABEL[currentSort()], fn: () => openSortMenu(anchor) }; }
function openSortMenu(anchor) {
  const cur = currentSort();
  return openMenu(anchor, [{ header: 'Sort By' }, ...SORTS.map(([v, l]) => ({ label: l, icon: v === cur ? 'check' : 'blank', fn: () => setSort(v) }))]);
}
/* a small "Sorted by …" button in the list header, so a sorted list never looks like it lost your order */
function addSortPill() {
  const mode = currentSort(); if (mode === 'manual') return;
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
