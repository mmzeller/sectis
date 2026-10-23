/* ===================== Drag and drop =====================
   Mouse: press and move. Touch: press and hold, then move.
   Sources: to-do rows, project rows, headings, sidebar projects/areas, and the + button. */
const D = { st: null, suppressClick: false };

function dragInit() {
  document.addEventListener('pointerdown', dragDown);
  document.addEventListener('pointermove', dragMove, { passive: false });
  document.addEventListener('pointerup', dragUp);
  document.addEventListener('pointercancel', (e) => { if (D.st && D.st.pt !== 'touch') finishDrag(false); });
  // Touch uses touch events so a drag can stop the page from scrolling once it starts.
  document.addEventListener('touchstart', touchStart, { passive: true });
  document.addEventListener('touchmove', touchMove, { passive: false });
  document.addEventListener('touchend', touchEnd, { passive: false });
  document.addEventListener('touchcancel', () => { if (D.st && D.st.pt === 'touch') { clearTimeout(D.st.timer); if (D.st.active) finishDrag(false); else D.st = null; } });
  document.addEventListener('contextmenu', (e) => { if (D.st && (D.st.active || D.st.timer)) e.preventDefault(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && D.st && D.st.active) { e.stopPropagation(); finishDrag(false); } }, true);
}
function dragSource(target) {
  if (layers.length || D.st) return null;
  const magic = target.closest('#magic');
  if (magic) return { magic: true, src: null };
  const src = target.closest('[data-drag]');
  if (!src || target.closest('input, textarea, select, .cb, .restore, .card, .ib, .sel-ring') || ui.selectMode) return null;
  return { magic: false, src };
}
function beginTracking(found, x, y, pt, pid) {
  const { magic, src } = found;
  D.st = { src, magic, kind: magic ? 'magic' : src.dataset.kind, id: src ? src.dataset.id : null, x0: x, y0: y, x, y, pt, active: false, timer: null, pid };
  if (!magic && pt === 'touch') D.st.timer = setTimeout(() => { if (D.st && !D.st.active) startDrag(); }, 380);
}
function dragDown(e) {
  if (e.pointerType === 'touch') return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const found = dragSource(e.target); if (!found) return;
  beginTracking(found, e.clientX, e.clientY, e.pointerType, e.pointerId);
}
function dragMove(e) {
  const st = D.st; if (!st || st.pt === 'touch' || e.pointerId !== st.pid) return;
  st.x = e.clientX; st.y = e.clientY;
  if (!st.active) { if (Math.hypot(st.x - st.x0, st.y - st.y0) > 5) startDrag(); return; }
  e.preventDefault();
  dragTrack();
}
function dragUp(e) {
  const st = D.st; if (!st || st.pt === 'touch' || e.pointerId !== st.pid) return;
  if (!st.active) { D.st = null; return; }
  finishDrag(true);
}
function touchStart(e) {
  if (e.touches.length !== 1) { if (D.st && D.st.pt === 'touch' && !D.st.active) { clearTimeout(D.st.timer); D.st = null; } return; }
  const found = dragSource(e.target); if (!found) return;
  const t = e.touches[0];
  beginTracking(found, t.clientX, t.clientY, 'touch', null);
}
function touchMove(e) {
  const st = D.st; if (!st || st.pt !== 'touch') return;
  const t = e.touches[0]; if (!t) return;
  st.x = t.clientX; st.y = t.clientY;
  if (!st.active) {
    const dist = Math.hypot(st.x - st.x0, st.y - st.y0);
    if (st.magic) { if (dist > 6) { e.preventDefault(); startDrag(); } return; }
    if (dist > 10) { clearTimeout(st.timer); D.st = null; }
    return;
  }
  if (e.cancelable) e.preventDefault();
  dragTrack();
}
function touchEnd(e) {
  const st = D.st; if (!st || st.pt !== 'touch') return;
  clearTimeout(st.timer);
  if (!st.active) { D.st = null; return; }
  if (e.cancelable) e.preventDefault();
  finishDrag(true);
}
function startDrag() {
  const st = D.st; st.active = true; clearTimeout(st.timer); st.timer = null;
  if (st.kind === 'todo' || st.kind === 'project') {
    const sameKind = [...ui.sel].filter((id) => (st.kind === 'todo' ? getT(id) : getP(id)));
    st.ids = ui.sel.has(st.id) && sameKind.length > 1 ? sameKind : [st.id];
  } else st.ids = st.id ? [st.id] : [];
  if (ui.editing && st.ids.includes(ui.editing)) { D.st = null; return; }
  const label = st.kind === 'magic' ? 'New To-Do' : st.kind === 'heading' ? (getH(st.id) || {}).title || 'Heading' : st.kind === 'area' ? aTitle(getA(st.id)) : st.kind === 'project' ? pTitle(getP(st.id)) : (getT(st.id) || {}).title || 'New To-Do';
  const g = document.createElement('div'); g.className = 'drag-ghost';
  g.innerHTML = `${st.kind === 'magic' ? ic('plus') : ''}<span>${esc(label)}</span>${st.ids.length > 1 ? `<span class="n">${st.ids.length}</span>` : ''}`;
  document.body.append(g); st.ghost = g;
  const line = document.createElement('div'); line.className = 'drop-line'; line.hidden = true; document.body.append(line); st.line = line;
  st.ids.forEach((id) => $$(`[data-id="${CSS.escape(id)}"]`).forEach((r) => { if (r.matches('.row, .hrow, .sb-item')) r.classList.add('dragging'); }));
  document.body.classList.add('dragging-active');
  if (navigator.vibrate) try { navigator.vibrate(8); } catch (err) { /* ignore */ }
  window.getSelection && window.getSelection().removeAllRanges();
  dragTrack();
  const loop = () => { if (!D.st || !D.st.active) return; if (D.st.scroll) { D.st.scroll.el.scrollTop += D.st.scroll.dy; dragTrack(true); } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
function clearDropMarks(st) { $$('.drop-hover').forEach((x) => x.classList.remove('drop-hover')); if (st.line) st.line.hidden = true; }
function showLine(st, el, after, sec) {
  const r = (el || sec).getBoundingClientRect();
  const y = el ? (after ? r.bottom : r.top) : r.top + 2;
  Object.assign(st.line.style, { left: r.left + 8 + 'px', width: Math.max(40, r.width - 16) + 'px', top: y - 1 + 'px' });
  st.line.hidden = false;
}
function sectionAccepts(sec, kind) {
  if (!sec || /^(logbook|trash|repeating|tag)/.test(sec)) return false;
  const projectSec = sec.startsWith('areaprojects:') || sec.includes(':projects:');
  if (kind === 'project') return projectSec || /^(today|evening|upcoming)/.test(sec);
  return !projectSec;
}
function dragTrack(fromLoop) {
  const st = D.st; if (!st) return;
  st.ghost.style.transform = `translate(${st.x + 14}px, ${st.y + 10}px)`;
  clearDropMarks(st); st.target = null;
  // auto-scroll whichever pane is under the pointer
  const pane = document.elementFromPoint(st.x, st.y);
  const scroller = pane && (pane.closest('#sb-scroll') || pane.closest('#main'));
  st.scroll = null;
  if (scroller) { const r = scroller.getBoundingClientRect(); const edge = 48; if (st.y < r.top + edge) st.scroll = { el: scroller, dy: -Math.ceil((r.top + edge - st.y) / 4) }; else if (st.y > r.bottom - edge) st.scroll = { el: scroller, dy: Math.ceil((st.y - (r.bottom - edge)) / 4) }; }
  st.ghost.style.display = 'none';
  const el = document.elementFromPoint(st.x, st.y);
  st.ghost.style.display = '';
  if (!el) return;
  const k = st.kind;
  // --- sidebar
  const sb = el.closest('#sidebar [data-drop-list]');
  if (sb) {
    const key = sb.dataset.dropList;
    if (k === 'project' && sb.dataset.kind === 'project' && sb.dataset.sb) {
      if (st.ids.includes(sb.dataset.id)) return;
      const r = sb.getBoundingClientRect(); const after = st.y > r.top + r.height / 2;
      showLine(st, sb, after); st.target = { type: 'sbproj', ref: sb.dataset.id, after }; return;
    }
    if (k === 'area' && sb.dataset.kind === 'area') {
      if (sb.dataset.id === st.id) return;
      const r = sb.getBoundingClientRect(); const after = st.y > r.top + r.height / 2;
      showLine(st, sb, after); st.target = { type: 'sbarea', ref: sb.dataset.id, after }; return;
    }
    if (k === 'area' || k === 'heading' || k === 'magic') return;
    if (k === 'project' && key.startsWith('project:')) return;
    if (k === 'project' && key === 'inbox') return;
    sb.classList.add('drop-hover'); st.target = { type: 'list', key, el: sb }; return;
  }
  if (!el.closest('#content')) return;
  // --- headings reorder
  if (k === 'heading') {
    const h = el.closest('.hrow'); if (!h || h.dataset.id === st.id) return;
    const r = h.getBoundingClientRect(); const after = st.y > r.top + r.height / 2;
    showLine(st, h, after); st.target = { type: 'heading', ref: h.dataset.id, after }; return;
  }
  // --- rows within sections
  let sec = null, index = 0, refEl = null, after = false;
  const row = el.closest('.row[data-id]');
  const zone = el.closest('[data-zone]');
  if (row && row.closest('[data-sec]') && !st.ids.includes(row.dataset.id)) {
    sec = row.closest('[data-sec]');
    const rows = $$(':scope > .row[data-id]', sec).filter((r) => !st.ids.includes(r.dataset.id));
    const r = row.getBoundingClientRect(); after = st.y > r.top + r.height / 2;
    index = rows.indexOf(row) + (after ? 1 : 0); refEl = row;
  } else if (zone) {
    sec = $(`#content [data-sec="${CSS.escape(zone.dataset.zone)}"]`); index = 0;
    refEl = sec && $$(':scope > .row[data-id]', sec).filter((r) => !st.ids.includes(r.dataset.id))[0];
    after = false;
    if (!refEl) { if (sec && sectionAccepts(sec.dataset.sec, k)) { zone.classList.add('drop-hover'); st.target = { type: 'sec', sec: sec.dataset.sec, secEl: sec, index: 0 }; } return; }
  } else {
    sec = el.closest('[data-sec]');
    if (sec) { const rows = $$(':scope > .row[data-id]', sec).filter((r) => !st.ids.includes(r.dataset.id)); index = rows.length; refEl = rows[rows.length - 1]; after = true; }
  }
  if (!sec || !sectionAccepts(sec.dataset.sec, k)) return;
  if (k === 'project' && !(sec.dataset.sec.startsWith('areaprojects:') || sec.dataset.sec.includes(':projects:'))) {
    // projects can only be re-ordered in Today/Upcoming among other rows
  }
  showLine(st, refEl, after, sec);
  st.target = { type: 'sec', sec: sec.dataset.sec, secEl: sec, index };
}
function finishDrag(drop) {
  const st = D.st; if (!st) return;
  clearDropMarks(st);
  if (st.ghost) st.ghost.remove(); if (st.line) st.line.remove();
  $$('.dragging').forEach((r) => r.classList.remove('dragging'));
  document.body.classList.remove('dragging-active');
  D.st = null;
  D.suppressClick = true; setTimeout(() => { D.suppressClick = false; }, 60);
  if (drop && st.target) performDrop(st, st.target);
}
function performDrop(st, t) {
  const ids = st.ids;
  if (t.type === 'list') return dropOnList(ids, t.key, st.kind, t.el);
  if (t.type === 'sec') {
    const secEl = t.secEl, ok = secEl.dataset.ok || 'order';
    const rows = $$(':scope > .row[data-id]', secEl).filter((r) => !ids.includes(r.dataset.id));
    const prev = rowItem(rows[t.index - 1]), next = rowItem(rows[t.index]);
    const n = st.kind === 'magic' ? 1 : ids.length;
    const vals = orderBetween(prev ? prev[ok] : null, next ? next[ok] : null, n);
    if (st.kind === 'magic') { newTodo({ sec: t.sec, place: { [ok]: vals[0] } }); return; }
    const sec = t.sec, props = sectionProps(sec);
    commit('Move', () => ids.forEach((id, i) => {
      const x = itemById(id); if (!x) return;
      if (sec.startsWith('areaprojects:')) { if (x.type === 'project') { x.areaId = sec.split(':')[1]; x.order = vals[i]; } return; }
      if (sec.includes(':projects:')) { if (x.type === 'project') { x.areaId = sec.split(':')[2] || null; x.order = vals[i]; } return; }
      const before = containerKey(x);
      applySectionProps(x, props);
      if (props && props._today && x.type === 'todo' && !isTodayItem(x)) x.when = T0();
      x[ok] = vals[i];
      if (ok !== 'order' && before !== containerKey(x)) x.order = endOrder(S.todos.filter((y) => y !== x && containerKey(y) === containerKey(x)));
      touch(x);
    }));
    return;
  }
  if (t.type === 'heading') {
    const h = getH(st.id), ref = getH(t.ref); if (!h || !ref) return;
    const hs = S.headings.filter((x) => x.projectId === ref.projectId && !x.archived && x !== h).sort(byOrder);
    const i = hs.indexOf(ref) + (t.after ? 1 : 0);
    commit('Move Heading', () => { h.order = orderBetween(hs[i - 1] ? hs[i - 1].order : null, hs[i] ? hs[i].order : null)[0]; });
    return;
  }
  if (t.type === 'sbproj') {
    const ref = getP(t.ref); if (!ref) return;
    const group = S.projects.filter((p) => !p.trashed && p.status === 'open' && p.start !== 'someday' && (p.areaId || null) === (ref.areaId || null) && !ids.includes(p.id)).sort(byOrder);
    const i = group.indexOf(ref) + (t.after ? 1 : 0);
    const vals = orderBetween(group[i - 1] ? group[i - 1].order : null, group[i] ? group[i].order : null, ids.length);
    commit('Move Project', () => ids.forEach((id, k) => { const p = getP(id); if (p) { p.areaId = ref.areaId || null; p.order = vals[k]; } }));
    return;
  }
  if (t.type === 'sbarea') {
    const a = getA(st.id), ref = getA(t.ref); if (!a || !ref) return;
    const as = S.areas.filter((x) => x !== a).sort(byOrder); const i = as.indexOf(ref) + (t.after ? 1 : 0);
    commit('Move Area', () => { a.order = orderBetween(as[i - 1] ? as[i - 1].order : null, as[i] ? as[i].order : null)[0]; });
  }
}
function dropOnList(ids, key, kind, anchorEl) {
  const [type, id] = key.split(':');
  switch (type) {
    case 'inbox': if (kind === 'todo') moveItems(ids, { type: 'inbox' }); break;
    case 'today': applyWhen(ids, 'today'); break;
    case 'upcoming': openWhen(ids, anchorEl); break;
    case 'anytime': applyWhen(ids, 'anytime'); break;
    case 'someday': applyWhen(ids, 'someday'); break;
    case 'logbook': completeIds(ids); break;
    case 'trash': trashItems(ids); break;
    case 'project': if (kind === 'todo') moveItems(ids, { type: 'project', id }); break;
    case 'area': moveItems(ids, { type: 'area', id }); break;
    default: break;
  }
}
function completeIds(ids) {
  const items = itemsFor(ids).filter((x) => x.status === 'open' && !x.isTemplate && !isTplChild(x));
  const projects = items.filter((x) => x.type === 'project');
  if (projects.length) { completeProjectFlow(projects[0]); return; }
  if (!items.length) return;
  commit('Complete', () => items.forEach((x) => setStatus(x, 'done')));
  toast(items.length > 1 ? `Completed ${items.length} to-dos` : 'Completed', { undo: true });
  if (S.settings.logMode === 'immediate') setTimeout(() => { if (autoLog()) render(); }, 1300);
}
