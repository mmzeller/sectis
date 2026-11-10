/* ===================== Menus wherever you'd look for one =====================
   Right-click (or Control-click) gives the menu that belongs to what's under the pointer:
   - a list's, project's or area's header → that list's, project's or area's menu
   - a project's sub-project (its row or its column) → that sub-project's menu, like any project's
   - a project or area named anywhere (Anytime's groups, the Timeline, a note's chip) → its menu
   - a repeating to-do's preview in Upcoming → its repeat menu
   - a template on the Templates page → the template's menu (in the Trash: Put Back)
   - a day in Upcoming, or This Evening → New To-Do there, or Paste
   - the sidebar's lists, smart lists and Board → their menus
   - an open to-do (away from its text fields) → the to-do's menu; a checklist item → the item's
   - a note in the Notepad → the note's menu; a tag in the tag bar → the tag's menu
   A text field that's being edited, or has text selected, keeps the system's menu (Copy, Paste,
   Spelling). Also: the circle by a project's name completes it, double-clicking a project, area
   or smart list in the sidebar renames or edits it. */
const LIST_SECS = { inbox: 'inbox', today: 'today', anytime: 'anytime:loose', someday: 'someday:loose' };
/* a built-in list in the sidebar */
function listMenu(key, at) {
  const L = LISTS[key]; if (!L) return;
  const go = () => { if (ui.view.type !== key) navigate(key); };
  const items = [{ header: L.title }];
  if (LIST_SECS[key]) items.push({ label: 'New To-Do', icon: 'plus', fn: () => { go(); newTodo(); } }, ...pasteIntoItems(LIST_SECS[key]));
  if (key === 'upcoming') items.push({ label: 'New To-Do', icon: 'plus', fn: () => { go(); newTodo(); } });
  if (key === 'board') { items.push(...boardsMenuItems()); openMenu(at, items); return; }
  if (key === 'logbook') items.push({ label: 'Log Completed Now', icon: 'logbook', fn: logCompletedNow });
  if (key === 'trash') items.push({ label: 'Empty Trash…', icon: 'trash', danger: true, fn: () => { go(); emptyTrash(); } });
  if (key === 'templates') { items.push(...newTemplateMenuItems(null), { sep: 1 }, { label: 'New from Template…', icon: 'template', hint: '⇧T', fn: () => openTemplatePicker(at) }); openMenu(at, items); return; }
  if (BOARD_LISTS.includes(key)) items.push(...boardMenuItems('l', key, false, at));
  if (key !== 'trash') items.push({ label: 'Share List…', icon: 'share', fn: () => { go(); openShare({ type: 'view' }); } });
  if (!['trash', 'logbook'].includes(key)) items.push({ label: 'Status Report…', icon: 'report', fn: () => { go(); openReport({ type: 'all' }); } });
  openMenu(at, items);
}
/* a tag in the tag bar */
function tagChipMenu(tag, at) {
  const on = ui.tagFilter === tag.id;
  openMenu(at, [
    { header: tag.title },
    on ? { label: 'Show All Tags', icon: 'x', fn: () => { ui.tagFilter = null; render(); } } : { label: 'Show Only This Tag', icon: 'tag', fn: () => { ui.tagFilter = tag.id; ui.sel.clear(); render(); } },
    { label: 'Color…', icon: 'palette', fn: () => openTagColor(tag, at, (c) => { commit('Tag Color', () => { if (c) tag.color = c; else delete tag.color; }); render(); }) },
    ...(!tagParent(tag) ? [{ label: 'Make It a Group', icon: 'layers', fn: () => setTagGroup(tag, true) }] : []),
    { label: 'Manage Tags…', icon: 'edit', fn: openTagManager },
  ]);
}
function dayMenu(sec, label, at) {
  openMenu(at, [{ header: label }, { label: `New To-Do ${sec === 'evening' ? 'This Evening' : 'on ' + label}`, icon: 'plus', fn: () => newTodo({ sec }) }, ...pasteIntoItems(sec)]);
}
// a group in Deadlines (Overdue, Tomorrow, This Week…): move all its deadlines at once, or select them
function deadlineGroupMenu(key, at) {
  const g = deadlineGroups(deadlineItems().filter(matchesTagFilter)).find((x) => x.key === key);
  if (!g) return;
  const ids = g.items.filter((x) => x.status === 'open').map((x) => x.id);
  if (!ids.length) return;
  openMenu(at, [{ header: g.label },
    { label: ids.length === 1 ? 'Change Deadline…' : `Change ${ids.length} Deadlines…`, icon: 'flag', fn: () => openWhen(ids, at, 'deadline') },
    { label: ids.length === 1 ? 'Select It' : `Select All ${ids.length}`, icon: 'check', fn: () => { if (ui.editing) closeEditor({ noRender: true }); ui.sel = new Set(ids); ui.anchor = ids[0]; render(); } }]);
}
/* a text field keeps the system menu while you're working in it */
const editingText = (el) => {
  const f = el && el.closest && el.closest('textarea, input');
  if (!f) return false;
  return document.activeElement === f || f.selectionStart !== f.selectionEnd;
};
// a right-click focuses the field it lands on before the menu event, so note what was true just before
let rcWasEditing = null;
document.addEventListener('pointerdown', (e) => { rcWasEditing = e.button === 2 ? editingText(e.target) : null; }, true);
document.addEventListener('contextmenu', (e) => {
  if (isCoarse() || layers.length || (D.st && D.st.active) || !e.target.closest) return;
  const t = e.target, at = { x: e.clientX, y: e.clientY };
  const wasEditing = rcWasEditing != null ? rcWasEditing : editingText(t); rcWasEditing = null;
  if (wasEditing || t.closest('a, .notes-view, .rename-in')) return;
  const f = t.closest('textarea, input'); if (f && document.activeElement === f) f.blur(); // the menu, not typing
  const take = (fn) => { e.preventDefault(); e.stopImmediatePropagation(); fn(); };
  // the open to-do: a checklist item, or the to-do itself
  const card = t.closest('#content .card[data-id]');
  if (card) {
    const ck = t.closest('.ck-item[data-ck]');
    if (ck && getT(card.dataset.id)) return take(() => checklistMenu(card.dataset.id, ck.dataset.ck, at));
    return take(() => todoMenu(card.dataset.id, at));
  }
  const note = t.closest('#notepad .np-card[data-note]');
  if (note) return take(() => noteMenu(getNote(note.dataset.note), at));
  const tchip = t.closest('#content .tagbar .tchip[data-tag]');
  if (tchip && getTag(tchip.dataset.tag)) return take(() => tagChipMenu(getTag(tchip.dataset.tag), at));
  const hc = t.closest('#content .hcol[data-hcol^="h:"] .bcol-h'); // a sub-project's column on its project's board
  if (hc) { const b = hc.querySelector('[data-action="hcol-menu"]'); if (b) return take(() => hcolMenu(b)); }
  const trow = t.closest('#content .tpl-row[data-tplrow]'); // a template on the Templates page
  if (trow && isBlueprint(itemById(trow.dataset.tplrow))) return take(() => templateMenu(trow.dataset.tplrow, at));
  const binned = t.closest('#content .tpl-row.trashed-row'); // a template in the Trash
  if (binned) { const b = binned.querySelector('[data-action="restore"]'), x = b && itemById(b.dataset.id); if (x) return take(() => openMenu(at, [{ header: tplName(x) }, { label: 'Put Back', icon: 'reopen', fn: () => restoreItems([x.id]) }])); }
  const ghost = t.closest('#content [data-tpl]');
  if (ghost && getT(ghost.dataset.tpl)) return take(() => todoMenu(ghost.dataset.tpl, at));
  const day = t.closest('#content .day-h[data-zone^="upcoming:"]:not(.month)');
  if (day) { const d = day.dataset.zone.slice(9); return take(() => dayMenu('upcoming:' + d, fmtDate(d), at)); }
  const dlg = t.closest('#content .dl-h[data-dlg]');
  if (dlg) return take(() => deadlineGroupMenu(dlg.dataset.dlg, at));
  const eve = t.closest('#content [data-zone="evening"]');
  if (eve && !t.closest('.row')) return take(() => dayMenu('evening', 'This Evening', at));
  const named = t.closest('#content [data-nav^="project:"], #content [data-nav^="area:"], #notepad [data-nav^="project:"], #notepad [data-nav^="area:"]');
  if (named && !t.closest('.row')) {
    const [k, id] = named.dataset.nav.split(':');
    if (k === 'project' && getP(id)) return take(() => projectMenu(getP(id), at));
    if (k === 'area' && getA(id)) return take(() => areaMenu(getA(id), at));
  }
  if (t.closest('#content .lh')) {
    const v = ui.view;
    if (v.type === 'project' && getP(v.id)) return take(() => projectMenu(getP(v.id), at, batchMenuItems(at).length ? batchMenuItems(at) : (() => { const p = listPasteMenuItems(); return p.length ? [...p, { sep: 1 }] : []; })()));
    if (v.type === 'area' && getA(v.id)) return take(() => areaMenu(getA(v.id), at, batchMenuItems(at)));
    if (v.type === 'board') return take(() => openMenu(at, boardsMenuItems()));
    return take(() => viewMenu(at));
  }
  const sb = t.closest('#sidebar .sb-item[data-nav]');
  if (sb && !sb.dataset.kind) {
    const key = sb.dataset.nav.split(':')[0]; // Board items are board:<id>
    if (LISTS[key]) return take(() => listMenu(key, at));
  }
  const sm = t.closest('#sidebar .sb-item[data-kind="smart"]');
  if (sm) { const sl = getSmart(sm.dataset.nav.split(':')[1]); if (sl) return take(() => openMenu(at, smartMenuItems(sl, at))); }
  if (t.closest('#sidebar .fx-bar')) return take(() => openFocusMenu(at));
}, true);

/* clicks */
document.addEventListener('click', (e) => {
  if (!e.target.closest) return;
  // the circle by a project's name: complete it (or reopen it), like a to-do's checkbox
  const pie = e.target.closest('#content .lh .pie-lg');
  if (pie && ui.view.type === 'project') {
    const p = getP(ui.view.id);
    if (p && !p.trashed && !p.isTemplate && !p.blueprint) { e.preventDefault(); if (p.status === 'open') completeProjectFlow(p, 'done'); else reopenProject(p); }
    return;
  }
  // the faint box by "New checklist item" puts the cursor there
  const nb = e.target.closest('#content .card .ck-item > span.ck-box');
  if (nb) { const ta = nb.parentElement.querySelector('textarea'); if (ta) ta.focus(); }
});
// Double-click a sidebar project or area to rename it, a smart list to edit it. The first click
// re-draws the sidebar, so the browser never sends a dblclick: two quick clicks on the same item count.
let sbLastClick = null;
function sbDouble(sb) {
  const k = sb.dataset.kind, id = (sb.dataset.id || (sb.dataset.nav || '').split(':')[1]);
  if (k === 'project' && getP(id)) { startRename('p', id); return true; }
  if (k === 'area' && getA(id)) { startRename('a', id); return true; }
  if (k === 'smart' && getSmart(id)) { openSmartEditor(getSmart(id)); return true; }
  return false;
}
document.addEventListener('click', (e) => {
  if (isCoarse() || !e.target.closest || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) { sbLastClick = null; return; }
  const sb = e.target.closest('#sidebar .sb-item[data-kind]');
  if (!sb) { sbLastClick = null; return; }
  const key = sb.dataset.kind + ':' + (sb.dataset.id || sb.dataset.nav || ''), now = Date.now();
  if (sbLastClick && sbLastClick.key === key && now - sbLastClick.t < 450) {
    sbLastClick = null;
    if (sbDouble(sb)) { e.preventDefault(); e.stopPropagation(); }
    return;
  }
  sbLastClick = { key, t: now };
}, true);
