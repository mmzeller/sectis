/* ===================== Checklist: reorder and spin off ===================== */
function ckMove(todoId, ckId, dir) {
  const t = getT(todoId); if (!t) return;
  const i = t.checklist.findIndex((c) => c.id === ckId), j = i + dir;
  if (i < 0 || j < 0 || j >= t.checklist.length) return;
  commit('Reorder Checklist', () => { const [c] = t.checklist.splice(i, 1); t.checklist.splice(j, 0, c); touch(t); }, { render: false });
  ui.focusAfter = `[data-fkey="ck-${ckId}"]`; render();
  const el = $(`[data-fkey="ck-${CSS.escape(ckId)}"]`); if (el) { const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) { /* ignore */ } }
}
function ckToTodo(todoId, ckId) {
  const t = getT(todoId); if (!t) return;
  const i = t.checklist.findIndex((c) => c.id === ckId); if (i < 0) return;
  const c = t.checklist[i];
  if (!c.title.trim()) { ckRemove(todoId, ckId, false); return; }
  commit('Make To-Do', () => {
    t.checklist.splice(i, 1); touch(t);
    const nt = makeTodo({
      title: c.title.trim(), start: t.start, when: t.when, evening: t.evening,
      projectId: t.projectId, areaId: t.areaId, headingId: t.headingId, tags: t.tags.slice(),
      status: c.done ? 'done' : 'open', completedAt: c.done ? Date.now() : null,
    });
    const after = S.todos.filter((x) => x !== t && !x.trashed && containerKey(x) === containerKey(t) && x.order > t.order);
    nt.order = orderBetween(t.order, minOf(after, 'order'))[0];
    const afterToday = S.todos.filter((x) => x !== t && x.todayOrder > t.todayOrder);
    nt.todayOrder = orderBetween(t.todayOrder, minOf(afterToday, 'todayOrder'))[0];
    S.todos.push(nt);
  });
  toast(`Made “${c.title.trim()}” a separate to-do`, { undo: true });
}
function checklistMenu(todoId, ckId, el) {
  const t = getT(todoId); if (!t) return;
  const items = [];
  if (!t.isTemplate) items.push({ label: 'Make Separate To-Do', icon: 'move', fn: () => ckToTodo(todoId, ckId) });
  const i = t.checklist.findIndex((c) => c.id === ckId);
  if (i > 0) items.push({ label: 'Move Up', icon: 'chevL', hint: MODK + '↑', fn: () => ckMove(todoId, ckId, -1) });
  if (i >= 0 && i < t.checklist.length - 1) items.push({ label: 'Move Down', icon: 'chevD', hint: MODK + '↓', fn: () => ckMove(todoId, ckId, 1) });
  items.push({ sep: 1 }, { label: 'Delete Item', icon: 'trash', danger: true, fn: () => ckRemove(todoId, ckId, false) });
  openMenu(el, items);
}

/* drag the grip to reorder (mouse and touch) */
document.addEventListener('pointerdown', (e) => {
  const grip = e.target.closest('[data-ckgrip]'); if (!grip) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const item = grip.closest('.ck-item'), list = item && item.parentElement, card = grip.closest('.card');
  if (!item || !list || !card) return;
  e.preventDefault();
  const todoId = card.dataset.id;
  const startOrder = $$(':scope > .ck-item[data-ck]', list).map((x) => x.dataset.ck).join();
  item.classList.add('ck-dragging');
  document.body.classList.add('dragging-active');
  const move = (ev) => {
    if (ev.cancelable) ev.preventDefault();
    const items = $$(':scope > .ck-item[data-ck]', list).filter((x) => x !== item);
    let before = null;
    for (const it of items) { const r = it.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { before = it; break; } }
    const target = before || list.querySelector(':scope > .ck-item:not([data-ck])');
    if (item.nextElementSibling !== target) list.insertBefore(item, target);
  };
  const up = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    item.classList.remove('ck-dragging');
    document.body.classList.remove('dragging-active');
    const order = $$(':scope > .ck-item[data-ck]', list).map((x) => x.dataset.ck);
    const t = getT(todoId); if (!t || order.join() === startOrder) return;
    commit('Reorder Checklist', () => { const byId = new Map(t.checklist.map((c) => [c.id, c])); t.checklist = order.map((id) => byId.get(id)).filter(Boolean); touch(t); });
  };
  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
});
