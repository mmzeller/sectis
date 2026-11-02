/* ===================== Moving board columns (Mac) =====================
   Drag a column by its title bar, or by the grip along its top edge.
   Board: drop it in a stack, above, between or below the columns there (the empty space under a
   short stack counts as its bottom), or near a stack's left or right edge for a new stack there.
   A project's heading columns move left or right the same way, which reorders the headings. */
const CD = { st: null };
function colDragFrom(target) {
  if (!target.closest || layers.length || D.st || CD.st || isCoarse() || ui.selectMode) return null;
  const grip = target.closest('#content .bcol-grip');
  const head = !grip && target.closest('#content .bcol-h');
  if (!grip && !head) return null;
  if (head && (target.closest('.ib, input, textarea, select') || head.querySelector('.rename-in'))) return null; // buttons, a heading's name, a rename in progress
  const col = (grip || head).closest('.bcol'); if (!col) return null;
  if (col.dataset.col && col.closest('.bstacks')) return { mode: 'board', key: col.dataset.col };
  if ((col.dataset.hcol || '').startsWith('h:') && col.closest('.hboard')) return { mode: 'heading', key: col.dataset.hcol };
  return null;
}
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.pointerType === 'touch') return;
  const f = colDragFrom(e.target); if (!f) return;
  e.preventDefault(); // no text selection while dragging; a plain click still goes through
  CD.st = Object.assign(f, { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, pid: e.pointerId, active: false });
});
document.addEventListener('pointermove', (e) => {
  const st = CD.st; if (!st || e.pointerId !== st.pid) return;
  st.x = e.clientX; st.y = e.clientY;
  if (!st.active) { if (Math.hypot(st.x - st.x0, st.y - st.y0) <= 5) return; colDragStart(); }
  e.preventDefault();
  colDragTrack();
}, { passive: false });
document.addEventListener('pointerup', (e) => { const st = CD.st; if (!st || e.pointerId !== st.pid) return; if (st.active) colDragEnd(true); else CD.st = null; });
document.addEventListener('pointercancel', () => { const st = CD.st; if (!st) return; if (st.active) colDragEnd(false); else CD.st = null; });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && CD.st && CD.st.active) { e.preventDefault(); e.stopPropagation(); colDragEnd(false); } }, true);

const colSel = (st) => (st.mode === 'board' ? `#content .bstacks .bcol[data-col="${CSS.escape(st.key)}"]` : `#content .hboard .bcol[data-hcol="${CSS.escape(st.key)}"]`);
function colDragLabel(st) {
  if (st.mode === 'board') { const [t, id] = st.key.split(':'); return colName(t, id); }
  const h = getH(st.key.slice(2)); return (h && h.title) || 'Untitled heading';
}
function colDragStart() {
  const st = CD.st; st.active = true;
  document.body.classList.add('col-dragging');
  const g = document.createElement('div'); g.className = 'drag-ghost';
  g.innerHTML = `${ic('columns')}<span>${esc(colDragLabel(st))}</span>`;
  document.body.append(g); st.ghost = g;
  const m = document.createElement('div'); m.className = 'col-drop'; m.hidden = true; document.body.append(m); st.mark = m;
  if (window.getSelection) window.getSelection().removeAllRanges();
  const loop = () => { if (CD.st !== st) return; if (colAutoScroll(st)) colDragTrack(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
function colDragTrack() {
  const st = CD.st; if (!st || !st.active) return;
  st.ghost.style.transform = `translate(${st.x + 14}px, ${st.y + 10}px)`;
  const me = $(colSel(st)); if (me && !me.classList.contains('col-lifted')) me.classList.add('col-lifted'); // put back after a redraw (sync)
  st.target = st.mode === 'board' ? boardDropAt(st, me) : headingDropAt(st, me);
  const k = st.target && st.target.mark;
  st.mark.hidden = !k;
  if (!k) return;
  st.mark.className = 'col-drop ' + k.dir;
  Object.assign(st.mark.style, k.dir === 'h'
    ? { left: k.left + 'px', top: k.top - 1.5 + 'px', width: k.size + 'px', height: '' }
    : { left: k.left - 1.5 + 'px', top: k.top + 'px', height: k.size + 'px', width: '' });
}
/* where a dropped board column would go, and the line that shows it */
function boardDropAt(st, me) {
  const board = $('#content .bstacks'); if (!board) return null;
  const br = board.getBoundingClientRect(), { x, y } = st;
  if (x < br.left - 24 || x > br.right + 24 || y < br.top - 40) return null; // off the board: the sidebar, the title
  const stacks = $$(':scope > .bstack', board), rs = stacks.map((s) => s.getBoundingClientRect());
  if (!stacks.length) return null;
  const mine = me ? stacks.indexOf(me.closest('.bstack')) : -1;
  const alone = mine >= 0 && $$(':scope > .bcol', stacks[mine]).length === 1;
  // the board's columns, top to bottom, for the height of a "new stack" line
  const cols = $$('.bstack > .bcol', board).map((c) => c.getBoundingClientRect());
  const top = Math.max(Math.min(...cols.map((r) => r.top)), 0), bottom = Math.min(Math.max(...cols.map((r) => r.bottom)), window.innerHeight);
  const newStack = (i) => {
    if (alone && (i === mine || i === mine + 1)) return null; // that's where it already is
    const gx = i === 0 ? rs[0].left - 7 : i === rs.length ? rs[rs.length - 1].right + 7 : (rs[i - 1].right + rs[i].left) / 2;
    return { to: { newStack: i }, mark: { dir: 'v', left: gx, top, size: Math.max(40, bottom - top) } };
  };
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    if (x < r.left) return newStack(i); // in the gap before it
    if (x > r.right) continue;
    const edge = Math.min(40, r.width * 0.18);
    if (x < r.left + edge) return newStack(i);
    if (x > r.right - edge) return newStack(i + 1);
    // into this stack, above whichever column the pointer is over the top half of
    const others = $$(':scope > .bcol', stacks[i]).filter((c) => c !== me), ors = others.map((c) => c.getBoundingClientRect());
    const index = ors.filter((c) => c.top + c.height / 2 < y).length;
    if (i === mine && index === $$(':scope > .bcol', stacks[i]).indexOf(me)) return null; // same place
    if (!ors.length) return null;
    const ly = index === 0 ? ors[0].top - 7 : index === ors.length ? ors[ors.length - 1].bottom + 7 : (ors[index - 1].bottom + ors[index].top) / 2;
    return { to: { stack: i, index }, mark: { dir: 'h', left: r.left + 4, top: ly, size: Math.max(40, r.width - 8) } };
  }
  return newStack(rs.length);
}
/* heading columns: only left and right, among the headings (No Heading stays first) */
function headingDropAt(st, me) {
  const board = $('#content .hboard'); if (!board || !me) return null;
  const br = board.getBoundingClientRect(), { x, y } = st;
  if (x < br.left - 24 || x > br.right + 24 || y < br.top - 40) return null;
  const heads = $$(':scope > .bcol[data-hcol^="h:"]', board), others = heads.filter((c) => c !== me);
  if (!others.length) return null;
  const ors = others.map((c) => c.getBoundingClientRect());
  const i = ors.filter((r) => r.left + r.width / 2 < x).length;
  if (i === heads.indexOf(me)) return null; // same place
  const all = heads.map((c) => c.getBoundingClientRect()).concat(me.getBoundingClientRect());
  const top = Math.max(Math.min(...all.map((r) => r.top)), 0), bottom = Math.min(Math.max(...all.map((r) => r.bottom)), window.innerHeight);
  const gx = i === 0 ? ors[0].left - 7 : i === ors.length ? ors[ors.length - 1].right + 7 : (ors[i - 1].right + ors[i].left) / 2;
  return {
    prev: i > 0 ? others[i - 1].dataset.hcol.slice(2) : null, next: i < others.length ? others[i].dataset.hcol.slice(2) : null,
    mark: { dir: 'v', left: gx, top, size: Math.max(40, bottom - top) },
  };
}
/* near the top or bottom of the window the page scrolls; near the board's sides, the board does */
function colAutoScroll(st) {
  let moved = false;
  const main = $('#main');
  if (main) {
    const r = main.getBoundingClientRect(), edge = 56, y0 = main.scrollTop;
    if (st.y < r.top + edge) main.scrollTop -= Math.ceil((r.top + edge - st.y) / 4);
    else if (st.y > r.bottom - edge) main.scrollTop += Math.ceil((st.y - (r.bottom - edge)) / 4);
    moved = main.scrollTop !== y0;
  }
  const board = $(st.mode === 'board' ? '#content .bstacks' : '#content .hboard');
  if (board) {
    const r = board.getBoundingClientRect(), edge = 48, x0 = board.scrollLeft;
    if (st.x < r.left + edge && st.x > r.left - 40) board.scrollLeft -= Math.ceil((r.left + edge - st.x) / 4);
    else if (st.x > r.right - edge) board.scrollLeft += Math.ceil((st.x - (r.right - edge)) / 4);
    moved = moved || board.scrollLeft !== x0;
  }
  return moved;
}
function colDragEnd(drop) {
  const st = CD.st; CD.st = null; if (!st) return;
  if (st.ghost) st.ghost.remove(); if (st.mark) st.mark.remove();
  $$('.col-lifted').forEach((c) => c.classList.remove('col-lifted'));
  document.body.classList.remove('col-dragging');
  D.suppressClick = true; setTimeout(() => { D.suppressClick = false; }, 60); // the release isn't a click on the title
  const t = drop && st.target; if (!t) return;
  if (st.mode === 'board') { boardPlace(st.key, t.to); return; }
  const h = getH(st.key.slice(2)); if (!h) return;
  const hs = S.headings.filter((x) => x.projectId === h.projectId && !x.archived && x !== h).sort(byOrder);
  let i = t.prev ? hs.findIndex((x) => x.id === t.prev) + 1 : hs.findIndex((x) => x.id === t.next);
  if (i < 0) i = hs.length;
  commit('Move Heading', () => { h.order = orderBetween(hs[i - 1] ? hs[i - 1].order : null, hs[i] ? hs[i].order : null)[0]; touch(h); });
}
