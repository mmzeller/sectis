/* ===================== Events: clicks, typing, keyboard ===================== */
function navigate(key, opts = {}) {
  closeEditor({ noRender: true });
  const [type, id] = key.split(':');
  ui.view = id ? { type, id } : { type };
  ui.sel.clear(); ui.anchor = null; ui.tagFilter = null; ui.selectMode = false; ui.logbookLimit = 150;
  ui.mobile = 'list';
  lsSet('sectis.view', key);
  render();
  if (!opts.keepScroll) $('#main').scrollTop = 0;
}
function selectedIds() { return [...ui.sel].filter((id) => itemById(id)); }
function visibleRowIds() { return $$('#content .row[data-id]').map((r) => r.dataset.id); }
function paintSelection() { $$('#content .row[data-id]').forEach((r) => r.classList.toggle('selected', ui.sel.has(r.dataset.id))); const c = $('#content .sel-count'); if (c) c.textContent = ui.sel.size ? ui.sel.size + ' Selected' : ''; renderBatch(); renderShell(); }

function rowClick(row, e) {
  const id = row.dataset.id, kind = row.dataset.kind;
  if (ui.selectMode) { ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); paintSelection(); return; }
  if (kind === 'project') { if (e.metaKey || e.ctrlKey || e.shiftKey) { ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); paintSelection(); return; } navigate(row.dataset.open); return; }
  if (isMobile() || (isCoarse() && !e.metaKey)) { openEditor(id); return; }
  if (ui.editing && ui.editing !== id) closeEditor({ noRender: true });
  if (e.metaKey || e.ctrlKey) { ui.sel.has(id) ? ui.sel.delete(id) : ui.sel.add(id); ui.anchor = id; }
  else if (e.shiftKey && ui.anchor) {
    const ids = visibleRowIds(); const a = ids.indexOf(ui.anchor), b = ids.indexOf(id);
    if (a >= 0 && b >= 0) { ui.sel = new Set(ids.slice(Math.min(a, b), Math.max(a, b) + 1)); }
  } else { ui.sel = new Set([id]); ui.anchor = id; }
  if (ui.editing === null && $('#content .card')) render(); else paintSelection();
}

/* ---- delegated click handling ---- */
document.addEventListener('click', (e) => {
  if (D.suppressClick) { D.suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
  if (!e.target.isConnected) return; // a layer handled this click and removed itself
  const inLayer = e.target.closest('#layer');
  const a = e.target.closest('[data-action]');
  if (!inLayer && ui.editing && !e.target.closest('.card') && !e.target.closest('#toasts')) {
    const isTool = a && a.dataset.id === ui.editing;
    if (!isTool) closeEditor({ noRender: !!(a || e.target.closest('[data-nav], .row[data-id], [data-tpl], #magic')) });
  }
  if (a) { if (!(inLayer && !a.closest('.tpl-modal'))) handleAction(a.dataset.action, a, e); else if (a.dataset.action === 'close-layer') closeLayer(); return; }
  if (inLayer) return;
  const nav = e.target.closest('[data-nav]'); if (nav) { navigate(nav.dataset.nav); return; }
  if (e.target.closest('#magic')) { newTodo(); return; }
  const ghost = e.target.closest('[data-tpl]'); if (ghost) { openTplModal(ghost.dataset.tpl); return; }
  const row = e.target.closest('#content .row[data-id]');
  if (row && !e.target.closest('.card')) { rowClick(row, e); return; }
  if (e.target.closest('#content') && !e.target.closest('.card, input, textarea, button, .lh, .tagbar')) {
    if (ui.sel.size && !ui.selectMode) { ui.sel.clear(); ui.anchor = null; paintSelection(); }
  }
});
document.addEventListener('dblclick', (e) => {
  if (isMobile()) return;
  const row = e.target.closest('#content .row[data-kind="todo"]');
  if (row && !e.target.closest('.cb, .card, .restore')) { openEditor(row.dataset.id, { focus: 'title' }); }
});

function anchorFor(id) { return document.querySelector(`#content .row[data-id="${CSS.escape(id)}"], #content .card[data-id="${CSS.escape(id)}"]`) || $('#content .lh') || $('#content'); }

function handleAction(act, el, e) {
  const id = el.dataset.id;
  switch (act) {
    case 'toggle': { const x = itemById(id); if (!x) return; if (x.type === 'project') { x.status === 'open' ? completeProjectFlow(x) : reopenProject(x); return; } if (e.altKey) toggleComplete([id], 'canceled'); else toggleComplete([id]); return; }
    case 'restore': restoreItems([id]); return;
    case 'when': openWhen(ui.sel.has(id) && ui.sel.size > 1 ? selectedIds() : [id], el); return;
    case 'deadline': openWhen([id], el, 'deadline'); return;
    case 'clear-when': applyWhen([id], 'clear'); return;
    case 'clear-deadline': applyDeadline([id], null); return;
    case 'tags': openTagPicker([id], el); return;
    case 'area-tags': openTagPicker([id], el, 'area'); return;
    case 'remove-tag': removeTag(id, el.dataset.tag); return;
    case 'repeat': openRepeat(id, el); return;
    case 'open-template': openTplModal(id); return;
    case 'stop-repeat': stopRepeating(id); return;
    case 'close-layer': closeLayer(); return;
    case 'ck-open': ui.ckOpen = id; ui.focusAfter = `[data-fkey="cknew-${id}"]`; render(); return;
    case 'ck-toggle': { const t = getT(id); const c = t && t.checklist.find((x) => x.id === el.dataset.ck); if (c) commit('Checklist', () => { c.done = !c.done; touch(t); }); return; }
    case 'ck-del': ckRemove(id, el.dataset.ck, false); return;
    case 'todo-menu': todoMenu(id, el); return;
    case 'proj-menu': projectMenu(getP(id), el); return;
    case 'area-menu': areaMenu(getA(id), el); return;
    case 'heading-menu': headingMenu(getH(id), el); return;
    case 'view-menu': viewMenu(el); return;
    case 'reopen-project': reopenProject(getP(id)); return;
    case 'toggle-logged': ui.showLogged[id] = !ui.showLogged[id]; render(); return;
    case 'toggle-later': ui.laterOpen[id] = !ui.laterOpen[id]; render(); return;
    case 'logbook-more': ui.logbookLimit += 150; render(); return;
    case 'empty-trash': emptyTrash(); return;
    case 'tag-filter': ui.tagFilter = el.dataset.tag || null; ui.sel.clear(); render(); return;
    case 'find': openFind(); return;
    case 'quick-entry': openQuickEntry(); return;
    case 'settings': openSettings(); return;
    case 'new-list': openMenu(el, [{ label: 'New Project', icon: 'project', fn: () => newProject(ui.view.type === 'area' ? ui.view.id : null) }, { label: 'New Area', icon: 'area', fn: newArea }]); return;
    case 'm-back': closeEditor({ noRender: true }); ui.mobile = 'home'; ui.sel.clear(); ui.selectMode = false; render(); return;
    case 'select-done': ui.selectMode = false; ui.sel.clear(); render(); return;
    case 'select-all': visibleRowIds().forEach((x) => ui.sel.add(x)); paintSelection(); return;
    case 'b-when': endSelectAfter(openWhen(selectedIds(), el)); return;
    case 'b-move': endSelectAfter(openMove(selectedIds().filter((x) => getT(x)), el)); return;
    case 'b-tags': endSelectAfter(openTagPicker(selectedIds(), el)); return;
    case 'b-deadline': endSelectAfter(openWhen(selectedIds(), el, 'deadline')); return;
    case 'b-complete': completeIds(selectedIds()); ui.sel.clear(); ui.selectMode = false; render(); return;
    case 'b-delete': trashItems(selectedIds()); ui.selectMode = false; render(); return;
    default: return;
  }
}

/* leave phone select mode once a batch picker actually changed something */
function endSelectAfter(L) {
  if (!L || !ui.selectMode) return;
  const before = undoStack.length, prev = L.onClose;
  L.onClose = () => { if (prev) prev(); setTimeout(() => { if (undoStack.length !== before && ui.selectMode) { ui.selectMode = false; ui.sel.clear(); render(); } }, 0); };
}

/* ---- context menus ---- */
function todoMenu(id, el) {
  const t = getT(id); if (!t) return;
  const items = [];
  if (t.isTemplate) {
    items.push({ label: 'Change Repeat…', icon: 'repeat', fn: () => openRepeat(id, el) });
    items.push({ label: 'Move…', icon: 'move', fn: () => openMove([id], el) });
    items.push({ sep: 1 }, { label: 'Stop Repeating', icon: 'x', danger: true, fn: () => stopRepeating(id) });
  } else {
    items.push({ label: 'When…', icon: 'calendar', hint: 'S', fn: () => openWhen([id], el) });
    items.push({ label: 'Move…', icon: 'move', hint: 'M', fn: () => openMove([id], el) });
    items.push({ label: t.templateId ? 'Edit Repeat…' : 'Repeat…', icon: 'repeat', hint: 'R', fn: () => (t.templateId && getT(t.templateId) && !getT(t.templateId).trashed ? openTplModal(t.templateId) : openRepeat(id, el)) });
    items.push({ label: 'Duplicate To-Do', icon: 'copy', fn: () => duplicateItems([id]) });
    items.push({ label: 'Convert to Project', icon: 'project', fn: () => convertToProject(id) });
    items.push({ sep: 1 });
    items.push(t.status === 'canceled' ? { label: 'Mark as Open', icon: 'reopen', fn: () => toggleComplete([id], 'canceled') } : { label: 'Mark as Canceled', icon: 'cancel', fn: () => toggleComplete([id], 'canceled') });
    items.push(t.trashed ? { label: 'Put Back', icon: 'reopen', fn: () => restoreItems([id]) } : { label: 'Delete To-Do', icon: 'trash', danger: true, fn: () => trashItems([id]) });
  }
  openMenu(el, items);
}
function projectMenu(p, el) {
  if (!p) return;
  const items = [];
  if (isMobile() && p.status === 'open' && !p.trashed) items.push(selectModeItem(), { sep: 1 });
  if (p.status === 'open') {
    items.push({ label: 'Complete Project', icon: 'check', fn: () => completeProjectFlow(p, 'done') });
    items.push({ label: 'When…', icon: 'calendar', fn: () => openWhen([p.id], el) });
    items.push({ label: 'Deadline…', icon: 'flag', fn: () => openWhen([p.id], el, 'deadline') });
    items.push({ label: 'Tags…', icon: 'tag', fn: () => openTagPicker([p.id], el) });
    items.push({ label: 'Move to Area…', icon: 'move', fn: () => openMove([p.id], el) });
    items.push({ label: 'Add Heading', icon: 'heading', hint: '⇧N', fn: () => newHeading(p.id) });
    items.push({ label: 'Duplicate Project', icon: 'copy', fn: () => duplicateProject(p) });
    items.push({ sep: 1 }, { label: 'Cancel Project', icon: 'cancel', fn: () => completeProjectFlow(p, 'canceled') });
  } else items.push({ label: 'Reopen Project', icon: 'reopen', fn: () => reopenProject(p) });
  items.push(p.trashed ? { label: 'Put Back', icon: 'reopen', fn: () => restoreItems([p.id]) } : { label: 'Delete Project', icon: 'trash', danger: true, fn: () => trashItems([p.id]) });
  openMenu(el, items);
}
function areaMenu(a, el) {
  if (!a) return;
  openMenu(el, [
    ...(isMobile() ? [selectModeItem(), { sep: 1 }] : []),
    { label: 'New Project in Area', icon: 'project', fn: () => newProject(a.id) },
    { label: 'Tags…', icon: 'tag', fn: () => openTagPicker([a.id], el, 'area') },
    { label: 'Rename', icon: 'edit', fn: () => { const i = $('[data-fkey="atitle"]'); if (i) { i.focus(); i.select(); } } },
    { sep: 1 }, { label: 'Delete Area…', icon: 'trash', danger: true, fn: () => deleteArea(a) },
  ]);
}
function headingMenu(h, el) {
  if (!h) return;
  openMenu(el, [
    { label: 'New To-Do Here', icon: 'plus', fn: () => { const sec = `project:${h.projectId}:${h.id}`; const first = S.todos.filter((t) => t.headingId === h.id && !t.trashed).sort(byOrder)[0]; newTodo({ sec, place: { order: first ? first.order - 1 : 0 } }); } },
    { label: 'Move to Project…', icon: 'move', fn: () => openMove([], el, { heading: true, onPick: (t) => { if (t.type === 'project') moveHeading(h, t.id); } }) },
    { label: 'Convert to Project', icon: 'project', fn: () => headingToProject(h) },
    { label: 'Archive', icon: 'archive', fn: () => archiveHeading(h) },
    { sep: 1 }, { label: 'Delete Heading', icon: 'trash', danger: true, fn: () => deleteHeading(h) },
  ]);
}
function selectModeItem() { return { label: 'Select To-Dos', icon: 'select', fn: () => { closeEditor({ noRender: true }); ui.selectMode = true; ui.sel.clear(); render(); } }; }
function viewMenu(el) {
  const v = ui.view.type;
  const items = [];
  if (v === 'project') { projectMenu(getP(ui.view.id), el); return; }
  if (v === 'area') { areaMenu(getA(ui.view.id), el); return; }
  if (isMobile() && !['logbook', 'trash', 'tag'].includes(v)) items.push(selectModeItem());
  if (v === 'today') items.push({ label: S.settings.groupToday ? 'Don’t Group by Project' : 'Group by Project & Area', icon: 'layers', fn: () => { S.settings.groupToday = !S.settings.groupToday; saveSoon(); render(); } });
  const unlogged = S.todos.concat(S.projects).some((x) => x.status !== 'open' && !x.logged);
  items.push({ label: 'Log Completed Now', icon: 'logbook', disabled: !unlogged, fn: logCompletedNow });
  if (v === 'trash') items.push({ label: 'Empty Trash…', icon: 'trash', danger: true, fn: emptyTrash });
  items.push({ sep: 1 }, { label: 'Keyboard Shortcuts', icon: 'key', fn: openShortcuts }, { label: 'Settings', icon: 'gear', fn: openSettings });
  openMenu(el, items);
}

/* ---- typing ---- */
/* titles wrap onto more lines but stay one paragraph: no line breaks, and the box grows to fit */
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el || el.tagName !== 'TEXTAREA' || e.isComposing) return;
  if (el.hasAttribute('data-oneline') && /[\r\n]/.test(el.value)) {
    const pos = el.selectionStart; el.value = el.value.replace(/[\r\n]+/g, ' ');
    try { el.setSelectionRange(pos, pos); } catch (err) { /* ignore */ }
  }
  if (el.hasAttribute('data-autosize')) autosize(el);
}, true);
window.addEventListener('resize', debounce(() => $$('textarea[data-autosize]').forEach(autosize), 120));
document.addEventListener('input', (e) => {
  const el = e.target, f = el.dataset && el.dataset.edit; if (!f) return;
  const id = el.dataset.id;
  if (f === 'title' || f === 'notes') {
    const t = getT(id); if (!t) return;
    editSnap(f + id); t[f === 'title' ? 'title' : 'notes'] = el.value; touch(t);
    if (f === 'notes') autosize(el);
  } else if (f === 'ck') {
    const t = getT(id); const c = t && t.checklist.find((x) => x.id === el.dataset.ck); if (!c) return;
    editSnap('ck' + c.id); c.title = el.value; touch(t);
  } else if (f === 'project-title' || f === 'project-notes') {
    const p = getP(id); if (!p) return;
    editSnap(f + id); p[f === 'project-title' ? 'title' : 'notes'] = el.value; touch(p);
    if (f === 'project-notes') autosize(el); else { renderSidebar(); renderShell(); }
  } else if (f === 'area-title') {
    const a = getA(id); if (!a) return; editSnap(f + id); a.title = el.value; renderSidebar(); renderShell();
  } else if (f === 'heading-title') {
    const h = getH(id); if (!h) return; editSnap(f + id); h.title = el.value;
  } else return;
  saveSoon();
});
document.addEventListener('focusout', (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.edit === 'ck-new' && el.value.trim()) { const t = getT(el.dataset.id); if (t) { ckAdd(t.id, null, el.value.trim()); el.value = ''; if (ui.editing === t.id || ui.tplModal === t.id) setTimeout(render, 0); } }
});
document.addEventListener('paste', (e) => {
  const el = e.target, f = el.dataset && el.dataset.edit;
  if (!['title', 'ck', 'ck-new'].includes(f)) return;
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text || !/\n/.test(text.trim())) return;
  const lines = splitPasted(text); if (lines.length < 2) return;
  e.preventDefault();
  const t = getT(el.dataset.id); if (!t) return;
  if (f === 'title' && !t.isTemplate) { pasteManyTodos(t, lines, el); return; }
  let after = f === 'ck' ? el.dataset.ck : (t.checklist.length ? t.checklist[t.checklist.length - 1].id : null);
  commit('Checklist', () => { lines.forEach((line) => { const item = { id: uid(), title: line, done: false }; const i = after ? t.checklist.findIndex((c) => c.id === after) : -1; t.checklist.splice(i + 1, 0, item); after = item.id; }); touch(t); });
});

function fieldKeys(e) {
  const el = e.target, f = el.dataset.edit, id = el.dataset.id;
  if (e.isComposing) return false;
  const mod = e.metaKey || e.ctrlKey;
  if (f === 'title') {
    if (e.key === 'Enter') { e.preventDefault(); if (ui.tplModal === id) { closeTplModal(); return true; } closeEditor(); return true; }
    if (e.key === 'ArrowDown' && !mod && el.selectionStart === el.value.length) { const n = $(`[data-fkey="notes-${id}"]`); if (n) { e.preventDefault(); n.focus(); n.setSelectionRange(0, 0); } return true; }
  }
  if (f === 'notes' && e.key === 'ArrowUp' && el.selectionStart === 0) { const n = $(`[data-fkey="title-${id}"]`); if (n) { e.preventDefault(); n.focus(); } return true; }
  if (f === 'ck') {
    const t = getT(id), ckId = el.dataset.ck, i = t.checklist.findIndex((c) => c.id === ckId);
    if (e.key === 'Enter') { e.preventDefault(); const item = ckAdd(id, ckId, ''); ui.focusAfter = `[data-fkey="ck-${item.id}"]`; render(); return true; }
    if (e.key === 'Backspace' && !el.value) { e.preventDefault(); ckRemove(id, ckId, true); return true; }
    if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); $(`[data-fkey="ck-${t.checklist[i - 1].id}"]`).focus(); return true; }
    if (e.key === 'ArrowDown') { e.preventDefault(); const nx = t.checklist[i + 1]; const target = nx ? $(`[data-fkey="ck-${nx.id}"]`) : $(`[data-fkey="cknew-${id}"]`); if (target) target.focus(); return true; }
  }
  if (f === 'ck-new') {
    if (e.key === 'Enter') { e.preventDefault(); const v = el.value.trim(); if (!v) return true; ckAdd(id, null, v); el.value = ''; ui.focusAfter = `[data-fkey="cknew-${id}"]`; render(); return true; }
    if (e.key === 'ArrowUp') { const t = getT(id); const last = t.checklist[t.checklist.length - 1]; if (last) { e.preventDefault(); $(`[data-fkey="ck-${last.id}"]`).focus(); } return true; }
    if (e.key === 'Backspace' && !el.value) { const t = getT(id); if (!t.checklist.length) { e.preventDefault(); ui.ckOpen = null; ui.focusAfter = `[data-fkey="notes-${id}"]`; render(); } return true; }
  }
  if (f === 'project-title' && e.key === 'Enter') { e.preventDefault(); const n = $('[data-fkey="pnotes"]'); if (n) n.focus(); return true; }
  if ((f === 'area-title' || f === 'heading-title') && e.key === 'Enter') { e.preventDefault(); el.blur(); return true; }
  return false;
}

/* ---- keyboard shortcuts ---- */
const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey, k = e.key, typing = isTyping(e.target);
  if (layers.length) {
    if (k === 'Escape') { e.preventDefault(); closeLayer(); return; }
    if (typing && e.target.dataset.edit && fieldKeys(e)) return;
    if (mod && k.toLowerCase() === 'enter' && ui.tplModal) { e.preventDefault(); closeTplModal(); }
    return;
  }
  if (mod && k.toLowerCase() === 'f') { e.preventDefault(); openFind(); return; }
  if (mod && !e.shiftKey && k.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); return; }
  if (typing) {
    if (e.target.dataset.edit && fieldKeys(e)) return;
    const eid = ui.editing;
    if (k === 'Escape' || (mod && k === 'Enter')) { e.preventDefault(); if (eid) closeEditor(); else e.target.blur(); return; }
    if (eid && mod && k.toLowerCase() === 'k') { e.preventDefault(); toggleComplete([eid], e.altKey ? 'canceled' : 'done'); return; }
    if (eid && mod && k.toLowerCase() === 's') { e.preventDefault(); openWhen([eid], anchorFor(eid)); return; }
    if (eid && mod && e.shiftKey && k.toLowerCase() === 'd') { e.preventDefault(); openWhen([eid], anchorFor(eid), 'deadline'); return; }
    if (eid && mod && e.shiftKey && k.toLowerCase() === 'c') { e.preventDefault(); ui.ckOpen = eid; ui.focusAfter = `[data-fkey="cknew-${eid}"]`; render(); return; }
    return;
  }
  const sel = selectedIds();
  const one = sel.length ? sel : (ui.editing ? [ui.editing] : []);
  const todosSel = one.filter((id) => getT(id));
  const key = k.length === 1 ? k.toLowerCase() : k;
  if (mod && e.code === 'KeyK') { e.preventDefault(); if (one.length) completeOrToggle(one, e.altKey); return; }
  if (mod && e.code === 'KeyS') { e.preventDefault(); if (one.length) openWhen(one, anchorFor(one[0])); return; }
  if (mod && e.code === 'KeyD') { e.preventDefault(); if (todosSel.length) duplicateItems(todosSel); return; }
  if ((mod || e.altKey) && (k === 'ArrowUp' || k === 'ArrowDown')) { e.preventDefault(); nudge(todosSel, k === 'ArrowUp' ? -1 : 1); return; }
  if (e.altKey && !mod && /^Digit[1-7]$/.test(e.code)) { e.preventDefault(); navigate(['inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook', 'trash'][+e.code.slice(5) - 1]); return; }
  if (e.altKey && !mod && e.code === 'KeyK') { e.preventDefault(); if (one.length) completeOrToggle(one, true); return; }
  if (mod || e.altKey) return;
  switch (key) {
    case 'Escape': if (ui.editing) closeEditor(); else if (ui.selectMode) { ui.selectMode = false; ui.sel.clear(); render(); } else if (ui.sel.size) { ui.sel.clear(); paintSelection(); } else if (ui.tagFilter) { ui.tagFilter = null; render(); } return;
    case '/': e.preventDefault(); openFind(); return;
    case 'q': e.preventDefault(); openQuickEntry(); return;
    case '?': e.preventDefault(); openShortcuts(); return;
    case ' ': case 'n':
      e.preventDefault();
      if (e.shiftKey && ui.view.type === 'project') { newHeading(ui.view.id); return; }
      newTodo(); return;
    case 'Enter': if (sel.length === 1 && getT(sel[0])) { e.preventDefault(); openEditor(sel[0], { focus: 'title' }); } else if (sel.length === 1 && getP(sel[0])) navigate('project:' + sel[0]); return;
    case 'ArrowDown': case 'ArrowUp': e.preventDefault(); moveSelection(k === 'ArrowDown' ? 1 : -1, e.shiftKey); return;
    case 'Backspace': case 'Delete': if (one.length) { e.preventDefault(); trashItems(one); } return;
  }
  if (!one.length) {
    if (/^[1-7]$/.test(key) && !e.shiftKey) { navigate(['inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook', 'trash'][+key - 1]); }
    return;
  }
  switch (key) {
    case 'k': case 'x': e.preventDefault(); completeOrToggle(one, false); return;
    case 't': e.preventDefault(); applyWhen(one, 'today'); return;
    case 'e': e.preventDefault(); applyWhen(one, 'evening'); return;
    case 'a': e.preventDefault(); applyWhen(one, 'anytime'); return;
    case 'o': e.preventDefault(); applyWhen(one, 'someday'); return;
    case 's': e.preventDefault(); openWhen(one, anchorFor(one[0])); return;
    case 'd': e.preventDefault(); openWhen(one, anchorFor(one[0]), 'deadline'); return;
    case '#': e.preventDefault(); openTagPicker(one, anchorFor(one[0])); return;
    case 'm': e.preventDefault(); openMove(todosSel.length ? todosSel : one, anchorFor(one[0])); return;
    case 'r': e.preventDefault(); if (todosSel.length === 1) { const t = getT(todosSel[0]); if (t.templateId && getT(t.templateId) && !getT(t.templateId).trashed) openTplModal(t.templateId); else openRepeat(t.id, anchorFor(t.id)); } return;
    default: if (/^[1-7]$/.test(key) && !e.shiftKey) navigate(['inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook', 'trash'][+key - 1]);
  }
});
function completeOrToggle(ids, cancel) { toggleComplete(ids, cancel ? 'canceled' : 'done'); }
function moveSelection(dir, extend) {
  const ids = visibleRowIds(); if (!ids.length) return;
  const cur = ui.anchor && ids.includes(ui.anchor) ? ids.indexOf(ui.anchor) : (dir > 0 ? -1 : ids.length);
  const ni = clamp(cur + dir, 0, ids.length - 1); const nid = ids[ni];
  if (ui.editing) closeEditor({ noRender: true });
  if (extend) ui.sel.add(nid); else ui.sel = new Set([nid]);
  ui.anchor = nid;
  render();
  const r = $(`#content .row[data-id="${CSS.escape(nid)}"]`); if (r) r.scrollIntoView({ block: 'nearest' });
}
function nudge(ids, dir) {
  if (ids.length !== 1) return;
  const row = $(`#content .row[data-id="${CSS.escape(ids[0])}"]`); if (!row) return;
  const sec = row.closest('[data-sec]'); if (!sec || !sectionAccepts(sec.dataset.sec, 'todo')) return;
  const ok = sec.dataset.ok || 'order';
  const rows = $$(':scope > .row[data-id]', sec); const i = rows.indexOf(row); const j = i + dir;
  if (j < 0 || j >= rows.length) return;
  const others = rows.filter((r) => r !== row);
  const prev = rowItem(others[dir < 0 ? j - 1 : j]), next = rowItem(others[dir < 0 ? j : j + 1]);
  const x = getT(ids[0]);
  commit('Reorder', () => { x[ok] = orderBetween(prev ? prev[ok] : null, next ? next[ok] : null)[0]; });
}
