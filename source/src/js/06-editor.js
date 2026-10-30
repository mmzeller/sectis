/* ===================== Editing to-dos ===================== */
function openEditor(id, opts = {}) {
  const t = getT(id); if (!t) return;
  if (t.isTemplate) { openTplModal(id); return; }
  if (ui.editing && ui.editing !== id) closeEditor({ noRender: true });
  ui.editing = id; ui.sel = new Set([id]); ui.anchor = id; ui.lastEditKey = null; ui.scrollToEditor = true;
  if (opts.focus) ui.focusAfter = `[data-fkey="${opts.focus}-${id}"]`;
  render();
}
function closeEditor(opts = {}) {
  const id = ui.editing; if (!id) return;
  ui.editing = null; ui.ckOpen = null; ui.lastEditKey = null; ui.notesEdit = null;
  const t = getT(id);
  if (t && ui.newId === id && !t.title.trim() && !t.notes.trim() && !t.checklist.length) {
    S.todos = S.todos.filter((x) => x !== t); reindex(); ui.sel.delete(id);
    const top = undoStack[undoStack.length - 1]; if (top && top.label === 'New To-Do') undoStack.pop();
    saveSoon();
  }
  ui.newId = null;
  if (!opts.noRender) render();
}
function editSnap(key) { if (ui.lastEditKey !== key) { snapshot('Typing'); ui.lastEditKey = key; } }

/* properties implied by dropping into, or adding to, a list section */
function sectionProps(sec) {
  const p = sec.split(':'), T = T0();
  switch (p[0]) {
    case 'inbox': return { start: 'inbox', projectId: null, areaId: null, headingId: null, when: null, evening: false };
    case 'today': return { start: 'anytime', when: T, evening: false, _today: true };
    case 'evening': return { start: 'anytime', when: T, evening: true, _today: true };
    case 'upcoming': return { start: 'anytime', when: p[1], evening: false };
    case 'anytime': case 'someday': {
      const start = p[0];
      if (p[1] === 'loose') return { start, projectId: null, areaId: null, headingId: null, when: start === 'someday' ? null : undefined };
      if (p[1] === 'project') return { start, projectId: p[2], areaId: null };
      if (p[1] === 'area') return { start, areaId: p[2], projectId: null, headingId: null };
      return null;
    }
    case 'project': return { projectId: p[1], headingId: p[2] || null, areaId: null, _fromInbox: 'anytime' };
    case 'area': return { areaId: p[1], projectId: null, headingId: null, _fromInbox: 'anytime' };
    default: return null;
  }
}
function applySectionProps(x, props) {
  if (!props) return;
  const T = T0(), before = placeTagIds(x);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('_') || v === undefined) continue;
    if (k === 'when' && props._today && x.when && x.when <= T && x.start === 'anytime') continue; // keep overdue start dates
    if (x.type === 'project' && ['projectId', 'headingId'].includes(k)) continue;
    x[k] = v;
  }
  if (props._fromInbox && x.start === 'inbox') x.start = props._fromInbox;
  if (props.start === 'someday') { x.when = null; x.evening = false; x.reminder = null; }
  if (x.headingId && x.projectId && getH(x.headingId) && getH(x.headingId).projectId !== x.projectId) x.headingId = null;
  if (!x.when) x.reminder = null;
  retag(x, before);
  touch(x);
}
function rowItem(row) { return row ? itemById(row.dataset.id) : null; }
function nextRowEl(row) { let n = row.nextElementSibling; while (n && !n.matches('.row[data-id]')) n = n.nextElementSibling; return n; }

/* the project whose row is selected in the list, if one is */
function selectedProjectRow() {
  const id = ui.anchor && ui.sel.has(ui.anchor) ? ui.anchor : null;
  const p = id && getP(id);
  const row = p && document.querySelector(`#content .row[data-kind="project"][data-id="${CSS.escape(id)}"]`);
  return row ? { p, row } : null;
}
function newTodo(opts = {}) {
  if (ui.view.type === 'templates') { newTodoTemplate(); return; }
  if (['logbook', 'trash', 'waiting'].includes(ui.view.type) || (isMobile() && ui.mobile === 'home')) { openQuickEntry(); return; }
  if (ui.view.type === 'project') { const p = getP(ui.view.id); if (p && (p.trashed || p.status !== 'open')) { toast('Reopen the project to add to-dos'); return; } }
  // A selected project row (an area's projects, an area's column on the Board, Today…) takes the new
  // to-do, wherever the row is. An expandable row opens so the new to-do shows under it.
  const selP = !opts.sec && !opts.place && selectedProjectRow();
  if (selP) {
    const { p, row } = selP;
    if (p.trashed || p.status !== 'open') { toast('Reopen the project to add to-dos'); return; }
    if (row.dataset.expandable && !ui.expanded.has(p.id)) { ui.expanded.add(p.id); lsSet('sectis.expanded', JSON.stringify([...ui.expanded])); }
    opts = Object.assign({}, opts, { sec: `project:${p.id}:` });
  }
  if (ui.view.type === 'board' && !opts.sec && !opts.place) {
    // a selected to-do decides the spot below; otherwise its column (or the first column) does
    const row = ui.anchor && ui.sel.has(ui.anchor) && document.querySelector(`#content .row[data-id="${CSS.escape(ui.anchor)}"]`);
    if (!(row && row.dataset.kind === 'todo' && row.closest('[data-sec]'))) {
      const sec = boardNewSec();
      if (!sec) { openQuickEntry(); return; }
      opts = Object.assign({}, opts, { sec });
    }
  }
  closeEditor({ noRender: true });
  let props = defaultsForView(opts.extra || {});
  const place = Object.assign({}, opts.place || {});
  if (opts.sec) Object.assign(props, sectionProps(opts.sec) || {});
  else if (!opts.place) {
    const selId = ui.anchor && ui.sel.has(ui.anchor) ? ui.anchor : null;
    const row = selId && document.querySelector(`#content .row[data-id="${CSS.escape(selId)}"]`);
    const ref = row && rowItem(row);
    if (ref && ref.type === 'todo') {
      const sec = row.closest('[data-sec]');
      const sp = sec && sectionProps(sec.dataset.sec);
      if (sp) {
        Object.assign(props, sp);
        const ok = sec.dataset.ok || 'order';
        const nxt = rowItem(nextRowEl(row));
        place[ok] = orderBetween(ref[ok], nxt && nxt.type === 'todo' ? nxt[ok] : null)[0];
        if (ok === 'order') place.todayOrder = orderBetween(ref.todayOrder, null)[0];
        if (ok === 'todayOrder') place.order = orderBetween(ref.order, null)[0];
      }
    }
  }
  if (props._fromInbox && props.start === 'inbox') props.start = props._fromInbox; // filed in a project or area, so not the Inbox
  for (const k of Object.keys(props)) if (k.startsWith('_') || props[k] === undefined) delete props[k];
  let t;
  commit('New To-Do', () => { t = createTodoIn(props, place); }, { render: false });
  ui.newId = t.id; ui.editing = t.id; ui.sel = new Set([t.id]); ui.anchor = t.id; ui.scrollToEditor = true;
  ui.focusAfter = `[data-fkey="title-${t.id}"]`;
  render();
  return t;
}

/* checklist */
function ckAdd(todoId, afterId, title = '') {
  const t = getT(todoId); if (!t) return null;
  const item = { id: uid(), title, done: false };
  commit('Checklist', () => {
    const i = afterId ? t.checklist.findIndex((c) => c.id === afterId) : t.checklist.length - 1;
    t.checklist.splice(i + 1, 0, item); touch(t);
  }, { render: false });
  return item;
}
function ckRemove(todoId, ckId, focusPrev) {
  const t = getT(todoId); if (!t) return;
  const i = t.checklist.findIndex((c) => c.id === ckId);
  commit('Checklist', () => { t.checklist.splice(i, 1); touch(t); }, { render: false });
  const prev = t.checklist[i - 1];
  ui.focusAfter = focusPrev && prev ? `[data-fkey="ck-${prev.id}"]` : `[data-fkey="${t.checklist.length ? 'cknew' : 'title'}-${t.id}"]`;
  render();
}
function splitPasted(text) {
  return text.split(/\r?\n/).map((s) => s.replace(/^\s*(?:[-*•+]|\d+[.)]|\[[ xX]?\])\s+/, '').trim()).filter(Boolean);
}
function pasteManyTodos(t, lines, el) {
  const before = el.value.slice(0, el.selectionStart), after = el.value.slice(el.selectionEnd);
  let prev = t;
  commit('Paste To-Dos', () => {
    t.title = (before + lines[0] + after).trim(); touch(t);
    lines.slice(1).forEach((line) => {
      const c = makeTodo({ title: line, start: t.start, when: t.when, evening: t.evening, projectId: t.projectId, areaId: t.areaId, headingId: t.headingId, tags: t.tags.slice(), deadline: t.deadline });
      c.order = orderBetween(prev.order, prev.order + 1)[0]; c.todayOrder = orderBetween(prev.todayOrder, prev.todayOrder + 1)[0];
      S.todos.push(c); prev = c;
    });
  }, { render: false });
  ui.newId = null; closeEditor({ noRender: true }); render();
  toast(`Created ${plural(lines.length, 'to-do')}`, { undo: true });
}

/* template (repeating) modal */
function openTplModal(id) {
  if (ui.editing) closeEditor({ noRender: true });
  ui.tplModal = id; render();
}
function renderTplModal() {
  const t = getT(ui.tplModal);
  if (!t || t.trashed || !t.isTemplate) { closeTplModal(); return; }
  let L = ui.tplLayer;
  if (!L || !L.el.isConnected) {
    L = ui.tplLayer = openLayer({ modal: true, cls: 'tpl-modal', html: '', onClose: () => { ui.tplModal = null; ui.tplLayer = null; render(); } });
  }
  if (t.blueprint) {
    L.el.innerHTML = `<div class="modal-h"><h2>To-Do Template</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div>
      <div class="modal-b">${cardHTML(t)}<p class="note">Use it from any list’s ••• menu (<b>New To-Do from Template</b>), or with <b>Add To…</b> below.</p></div>
      <div class="modal-f"><button class="btn" data-action="delete-template" data-id="${t.id}">Delete Template</button><button class="btn" data-action="use-ttemplate" data-id="${t.id}">Add To…</button><button class="btn primary" data-action="close-layer">Done</button></div>`;
    return;
  }
  const upcoming = []; let nd = t.next;
  for (let i = 0; i < 3 && nd; i++) { upcoming.push(nd); nd = t.repeat.mode === 'schedule' ? nextOccurrence(t.repeat, nd) : null; }
  const copies = S.todos.filter((x) => x.templateId === t.id && !x.trashed);
  L.el.innerHTML = `<div class="modal-h"><h2>Repeating To-Do</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div>
    <div class="modal-b">${cardHTML(t)}
    <p class="note">${t.next ? `Next copy: <b>${esc(fmtDate(t.next))}</b>${upcoming.length > 1 && t.repeat.mode === 'schedule' ? `, then ${upcoming.slice(1).map((d) => esc(fmtDate(d, { weekday: false }))).join(', ')}` : ''}.` : t.repeat.mode === 'after' ? 'The next copy is scheduled when you complete the current one.' : 'This repeat has ended.'} ${copies.length ? plural(copies.length, 'copy', 'copies') + ' made so far.' : ''}</p></div>
    <div class="modal-f"><button class="btn" data-action="stop-repeat" data-id="${t.id}">Stop Repeating</button><button class="btn" data-action="repeat" data-id="${t.id}">Change Repeat…</button><button class="btn primary" data-action="close-layer">Done</button></div>`;
}
function closeTplModal() { if (ui.tplLayer) { const L = ui.tplLayer; ui.tplLayer = null; ui.tplModal = null; closeLayer(L); } else ui.tplModal = null; }
