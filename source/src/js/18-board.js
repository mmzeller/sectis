/* ===================== Board =====================
   Projects and areas as columns, like a kanban board. Columns sit side by side in stacks, and a
   stack can hold several columns one under another, so the space below a short list gets used.
   It's a per-device layout (a Mac layout, not synced). Each column remembers its stack (l) and
   its own height (h); a stack's width (w) is kept on every column in it. */
const COL_TYPES = ['p', 'a', 'l', 't', 's']; // project, area, built-in list, tag, smart list
const BOARD_LISTS = ['inbox', 'today', 'upcoming', 'anytime', 'someday', 'waiting', 'deadlines'];
function cleanCols(cols) {
  cols = (Array.isArray(cols) ? cols : []).filter((c) => c && c.id && COL_TYPES.includes(c.t));
  // a Board from before stacks: every column is a stack of its own, in the same order
  let next = cols.reduce((m, c) => (Number.isInteger(c.l) && c.l >= 0 ? Math.max(m, c.l + 1) : m), 0);
  cols.forEach((c) => { if (!(Number.isInteger(c.l) && c.l >= 0)) c.l = next++; });
  return cols;
}
function loadBoard() {
  loadCkClip();
  let saved = null;
  try { saved = JSON.parse(lsGet('sectis.boards') || 'null'); } catch (e) { saved = null; }
  if (saved && Array.isArray(saved.list) && saved.list.length) ui.boards = saved.list.filter((b) => b && b.id).map((b) => ({ id: b.id, name: b.name || 'Board', area: b.area || null, cols: cleanCols(b.cols) }));
  if (!ui.boards || !ui.boards.length) { // the one Board from before there were several
    let cols = []; try { cols = JSON.parse(lsGet('sectis.board') || '[]'); } catch (e) { cols = []; }
    ui.boards = [{ id: 'main', name: 'Board', area: null, cols: cleanCols(cols) }];
  }
  ui.boardId = saved && ui.boards.some((b) => b.id === saved.cur) ? saved.cur : ui.boards[0].id;
  ui.board = curBoard().cols;
  try { ui.projBoard = new Set(JSON.parse(lsGet('sectis.pboard') || '[]')); } catch (e) { ui.projBoard = new Set(); }
  try { ui.hcolW = JSON.parse(lsGet('sectis.hcolw') || '{}') || {}; } catch (e) { ui.hcolW = {}; }
  try { ui.hcolH = JSON.parse(lsGet('sectis.hcolh') || '{}') || {}; } catch (e) { ui.hcolH = {}; }
  try { ui.hUnder = new Set(JSON.parse(lsGet('sectis.hunder') || '[]')); } catch (e) { ui.hUnder = new Set(); }
}
function curBoard() { return (ui.boards || []).find((b) => b.id === ui.boardId) || ui.boards[0]; }
function saveBoard() {
  curBoard().cols = ui.board;
  lsSet('sectis.boards', JSON.stringify({ cur: ui.boardId, list: ui.boards }));
}
function colShown(c) {
  if (c.t === 'a') return !!getA(c.id);
  if (c.t === 'l') return BOARD_LISTS.includes(c.id);
  if (c.t === 't') return !!getTag(c.id);
  if (c.t === 's') return !!getSmart(c.id);
  const p = getP(c.id);
  return !!p && !p.trashed && !p.isTemplate && !(p.status !== 'open' && p.logged);
}
function boardCols() { return [].concat(...boardStacks()); }
function onBoard(t, id) { return (ui.board || []).some((c) => c.t === t && c.id === id); }
function colName(t, id) { return t === 'p' ? pTitle(getP(id)) : t === 'a' ? aTitle(getA(id)) : t === 'l' ? LISTS[id].title : t === 't' ? tagTitle(id) : smartTitle(getSmart(id)); }
const colKey = (c) => `${c.t}:${c.id}`;

/* ---- stacks: the columns on screen, left to right, each top to bottom ---- */
function boardStacks() {
  const m = new Map();
  (ui.board || []).filter(colShown).forEach((c) => { if (!m.has(c.l)) m.set(c.l, []); m.get(c.l).push(c); });
  return [...m.keys()].sort((a, b) => a - b).map((k) => m.get(k));
}
/* write the layout back from a list of stacks; empty stacks drop out. Columns not on screen
   (a completed project, say) keep their stack number, so they come back near where they were. */
function setBoardStacks(stacks) {
  stacks = stacks.filter((s) => s.length);
  const shown = new Set([].concat(...stacks));
  const hidden = (ui.board || []).filter((c) => !shown.has(c));
  ui.board = [];
  stacks.forEach((s, i) => s.forEach((c) => { c.l = i; ui.board.push(c); }));
  hidden.forEach((c) => { c.l = Math.min(c.l, stacks.length); ui.board.push(c); });
  saveBoard();
}
function stackPos(stacks, key) {
  for (let i = 0; i < stacks.length; i++) { const j = stacks[i].findIndex((c) => colKey(c) === key); if (j >= 0) return [i, j]; }
  return null;
}
const stackW = (s) => { const c = s.find((x) => x.w); return c ? clampW(c.w) : 0; };

function boardAdd(cols, opts = {}) {
  const prev = ui.board || [];
  if (opts.replace) ui.board = [];
  const stacks = boardStacks();
  const below = opts.below && stackPos(stacks, opts.below); // stack them under this column
  let at = below ? below[1] + 1 : 0;
  cols.forEach((c) => {
    if (onBoard(c.t, c.id)) return;
    const old = prev.find((x) => x.t === c.t && x.id === c.id); // a column that comes back keeps its size
    const e = { t: c.t, id: c.id };
    if (old && old.h) e.h = old.h;
    if (below) { const s = stacks[below[0]], w = stackW(s); if (w) e.w = w; s.splice(at++, 0, e); }
    else { if (old && old.w) e.w = old.w; stacks.push([e]); }
  });
  setBoardStacks(stacks);
  if (opts.go) navigate('board');
  else { render(); if (opts.toast) toast(opts.toast, { action: 'Show Board', fn: () => navigate('board') }); }
}
function boardRemove(t, id) { ui.board = ui.board.filter((c) => !(c.t === t && c.id === id)); saveBoard(); render(); }
function boardToggle(t, id) { if (onBoard(t, id)) boardRemove(t, id); else boardAdd([{ t, id }]); }
/* Move a column. `to` is one of:
     { stack, index }  into a stack, at that place among its other columns
     { newStack: i }   a stack of its own, at position i among the stacks as they are now
     { below: key }    under another column */
function boardPlace(key, to) {
  const stacks = boardStacks(), from = stackPos(stacks, key); if (!from) return;
  const c = stacks[from[0]].splice(from[1], 1)[0]; // the emptied stack stays until the end, so positions still line up
  if (to.below) { const p = stackPos(stacks, to.below); if (!p) return; to = { stack: p[0], index: p[1] + 1 }; }
  if (to.newStack != null) stacks.splice(clamp(to.newStack, 0, stacks.length), 0, [c]);
  else {
    const s = stacks[to.stack]; if (!s) return;
    if (to.stack !== from[0]) { const w = stackW(s); if (w) c.w = w; else delete c.w; } // it takes the width of the stack it joins
    s.splice(clamp(to.index, 0, s.length), 0, c);
  }
  setBoardStacks(stacks); render();
}
/* the column menu's Move Up / Down (within its stack) and Left / Right (a stack of its own on that side) */
function boardNudge(key, dir) {
  const stacks = boardStacks(), p = stackPos(stacks, key); if (!p) return;
  const [i, j] = p, alone = stacks[i].length === 1;
  if (dir === 'up') boardPlace(key, { stack: i, index: j - 1 });
  else if (dir === 'down') boardPlace(key, { stack: i, index: j + 1 });
  else if (dir === 'left') boardPlace(key, { newStack: alone ? i - 1 : i });
  else boardPlace(key, { newStack: alone ? i + 2 : i + 1 });
}
function nudgeable(key) {
  const stacks = boardStacks(), p = stackPos(stacks, key);
  if (!p) return { up: false, down: false, left: false, right: false, stacked: false };
  const [i, j] = p, n = stacks[i].length;
  return { up: j > 0, down: j < n - 1, left: !(n === 1 && i === 0), right: !(n === 1 && i === stacks.length - 1), stacked: n > 1 };
}
/* an area's projects as columns, plus the area itself first when it has to-dos of its own */
function areaAsBoard(a) {
  const projs = S.projects.filter((p) => p.areaId === a.id && !p.trashed && !p.isTemplate && p.status === 'open' && p.start !== 'someday').sort(byOrder);
  const loose = S.todos.some((t) => t.areaId === a.id && !t.projectId && t.status === 'open' && liveTodo(t));
  const cols = (loose || !projs.length ? [{ t: 'a', id: a.id }] : []).concat(projs.map((p) => ({ t: 'p', id: p.id })));
  // its own Board, named after it; opening it again brings that Board up to date
  const b = ui.boards.find((x) => x.area === a.id);
  if (b) { switchBoard(b.id); boardAdd(cols, { replace: true, go: true }); return; }
  newBoard({ name: boardWithName(aTitle(a)), area: a.id, cols: cols.map((c, i) => ({ t: c.t, id: c.id, l: i })) });
}

/* ---- sizes: drag a column's right edge (width), bottom edge (height) or corner (both);
   double-click one to go back to automatic. A stacked column's width is its stack's. ---- */
const COL_MIN = 220, COL_MAX = 1200, COLH_MIN = 120, COLH_MAX = 4000;
const clampW = (w) => Math.round(Math.max(COL_MIN, Math.min(COL_MAX, w)));
const clampH = (h) => Math.round(Math.max(COLH_MIN, Math.min(COLH_MAX, h)));
function colEntry(key) { const [t, id] = key.split(':'); return (ui.board || []).find((c) => c.t === t && c.id === id); }
function colHStyle(h, color = null) { const s = [h ? `height:${clampH(h)}px` : '', color ? `--colc:${colorVar(color)}` : ''].filter(Boolean).join(';'); return s ? ` style="${s}"` : ''; }
function resizeHandlesHTML(key) {
  return `<div class="bcol-resize" data-colresize="${key}" data-axis="x" aria-hidden="true" title="Drag to change the width. Double-click to fit automatically."></div>`
    + `<div class="bcol-resize-b" data-colresize="${key}" data-axis="y" aria-hidden="true" title="Drag to change the height. Double-click to fit automatically."></div>`
    + `<div class="bcol-resize-c" data-colresize="${key}" data-axis="xy" aria-hidden="true" title="Drag to resize. Double-click to fit automatically."></div>`;
}
const gripHTML = '<div class="bcol-grip" aria-hidden="true" title="Drag to move"></div>';
/* Board columns keep their size in the board list; heading columns (h:headingId, n:projectId) in their own maps */
function getColW(key) { const c = colEntry(key); return c ? c.w || 0 : (ui.hcolW || {})[key] || 0; }
function getColH(key) { const c = colEntry(key); return c ? c.h || 0 : (ui.hcolH || {})[key] || 0; }
function setColSize(key, size) {
  const c = colEntry(key);
  if (c) {
    if ('w' in size) { const s = boardStacks().find((x) => x.includes(c)) || [c]; s.forEach((x) => { if (size.w) x.w = clampW(size.w); else delete x.w; }); }
    if ('h' in size) { if (size.h) c.h = clampH(size.h); else delete c.h; }
    saveBoard();
  } else {
    ui.hcolW = ui.hcolW || {}; ui.hcolH = ui.hcolH || {};
    if ('w' in size) { (hStackOf(key) || [key]).forEach((k) => { if (size.w) ui.hcolW[k] = clampW(size.w); else delete ui.hcolW[k]; }); lsSet('sectis.hcolw', JSON.stringify(ui.hcolW)); }
    if ('h' in size) { if (size.h) ui.hcolH[key] = clampH(size.h); else delete ui.hcolH[key]; lsSet('sectis.hcolh', JSON.stringify(ui.hcolH)); }
  }
  render();
}
function setColWidth(key, w) { setColSize(key, { w }); }
function resetAllSizes() { (ui.board || []).forEach((c) => { delete c.w; delete c.h; }); saveBoard(); render(); }
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest && e.target.closest('#content [data-colresize]');
  if (!h || e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  const col = h.closest('.bcol'), key = h.dataset.colresize, axis = h.dataset.axis || 'x';
  const box = col.closest('.bstack') || col; // what gets wider: the whole stack, or a heading column
  const doW = axis.includes('x'), doH = axis.includes('y');
  const x0 = e.clientX, y0 = e.clientY, w0 = box.getBoundingClientRect().width, h0 = col.getBoundingClientRect().height;
  let moved = false;
  try { h.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  document.body.classList.add('col-resizing', 'rs-' + axis); h.classList.add('on');
  const move = (ev) => {
    if (Math.abs(ev.clientX - x0) > 2 || Math.abs(ev.clientY - y0) > 2) moved = true;
    if (!moved) return;
    if (doW) { const w = clampW(w0 + ev.clientX - x0); box.style.flex = `0 0 ${w}px`; box.style.width = w + 'px'; box.classList.add('sized'); }
    if (doH) { col.style.height = clampH(h0 + ev.clientY - y0) + 'px'; col.classList.add('sized-h'); }
  };
  const up = (ev) => {
    h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
    document.body.classList.remove('col-resizing', 'rs-' + axis); h.classList.remove('on');
    if (moved && ev.type === 'pointerup') {
      const size = {};
      if (doW) size.w = w0 + ev.clientX - x0;
      if (doH) size.h = h0 + ev.clientY - y0;
      setColSize(key, size);
    } else if (moved) render();
  };
  h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
}, true);
document.addEventListener('dblclick', (e) => {
  const h = e.target.closest && e.target.closest('#content [data-colresize]');
  if (!h) return;
  e.preventDefault();
  const axis = h.dataset.axis || 'x';
  setColSize(h.dataset.colresize, axis === 'x' ? { w: 0 } : axis === 'y' ? { h: 0 } : { w: 0, h: 0 });
});
const isColMenu = (extra) => extra.some((x) => x.header === 'Column'); // a column's own menu has its own board items
function boardMenuItems(t, id, fromColumn, el) {
  if (isMobile() || fromColumn) return [];
  if (ui.boards.length > 1) { // which Boards it's on, ticked; choosing one adds or removes it there
    const n = ui.boards.filter((b) => onBoardOf(b, t, id)).length;
    return [{ label: n ? `On ${plural(n, 'Board')}…` : 'Add to Board…', icon: 'columns', fn: () => openMenu(el || { x: innerWidth / 2, y: 120 }, [{ header: colName(t, id) }, ...ui.boards.map((b) => ({ label: b.name || 'Board', icon: onBoardOf(b, t, id) ? 'check' : 'blank', fn: () => toggleOnBoardOf(b, t, id) }))]) }];
  }
  const on = onBoard(t, id);
  return [on
    ? { label: 'Remove from Board', icon: 'columns', fn: () => { boardRemove(t, id); toast(`Removed “${colName(t, id)}” from the Board`); } }
    : { label: 'Add to Board', icon: 'columns', fn: () => boardAdd([{ t, id }], { toast: `Added “${colName(t, id)}” to the Board` }) }];
}

/* ---- view ---- */
function viewBoard() {
  const stacks = boardStacks();
  let html = `<div class="lh"><span class="ic lh-ic" style="color:var(--c-board)">${I.columns}</span><textarea class="lh-title board-name" data-edit="board-name" data-fkey="board-name" placeholder="Board" aria-label="Board name" autocomplete="off" rows="1" data-autosize data-oneline>${esc(curBoard().name)}</textarea><button class="ib board-switch" data-action="board-switch" aria-label="Boards" title="Switch, add or rename Boards">${ic('chevD')}</button><button class="btn board-add" data-action="board-add">${ic('plus')}<span>Add Column</span></button><button class="ib" data-action="view-menu" aria-label="Board options" title="Board options">${ic('more')}</button></div>`;
  if (!stacks.length) {
    return html + emptyHTML('columns', 'See your lists side by side',
      'Add projects or areas as columns with <b>Add Column</b>, or choose <b>Add to Board</b> from any project or area’s ••• menu. An area’s <b>Open as Board</b> lays out all of its projects at once.');
  }
  return html + `<div class="board bstacks" data-kind="board" data-hscroll="board" data-cols="${[].concat(...stacks).length}">${stacks.map((s, i) => {
    const w = stackW(s), last = s[s.length - 1];
    return `<div class="bstack${w ? ' sized' : ''}" data-stack="${i}"${w ? ` style="flex:0 0 ${w}px;width:${w}px"` : ''}>${s.map(boardColHTML).join('')}`
      + `<button class="bstack-add" data-action="board-add-below" data-col="${colKey(last)}" title="Put another project or area below this one">${ic('plus')}<span>Add Below</span></button></div>`;
  }).join('')}</div>`;
}
function boardColHTML(c) {
  if (c.t === 'l' || c.t === 't' || c.t === 's') return listColHTML(c);
  const key = colKey(c), more = `<button class="ib" data-action="bcol-menu" data-col="${key}" aria-label="Column options" title="Column options">${ic('more')}</button>`;
  const sizedH = c.h ? ' sized-h' : '', bodyAttr = c.h ? ` data-vscroll="${key}"` : '';
  if (c.t === 'p') {
    const p = getP(c.id), pr = projectProgress(p), open = p.status === 'open';
    const area = p.areaId && getA(p.areaId);
    const sec = `project:${p.id}:`;
    return `<section class="bcol${open ? '' : ' closed'}${sizedH}${placeColor(p) ? ' colored' : ''}" data-col="p:${p.id}" data-newsec="${open ? sec : ''}" data-colzone="${open ? sec : ''}"${colHStyle(c.h, placeColor(p))}>${gripHTML}
      <div class="bcol-h" data-col="p:${p.id}">${projIc(p, 'bcol-ic', pr.frac)}<div class="bcol-t">${renamingNow('p', p.id) ? renameInputHTML('p', p) : `<button class="bcol-title" data-nav="project:${p.id}" title="Open ${esc(pTitle(p))}">${esc(pTitle(p))}</button>`}<div class="bcol-sub">${open ? (area ? esc(aTitle(area)) : 'Project') : p.status === 'done' ? 'Completed' : 'Canceled'}</div></div>${pr.open ? `<span class="bcol-count" title="Open to-dos">${pr.open}</span>` : ''}${open ? `<button class="ib" data-action="bcol-add" data-sec="${sec}" aria-label="New to-do in ${esc(pTitle(p))}" title="New to-do">${ic('plus')}</button>` : ''}${more}</div>
      <div class="bcol-body"${bodyAttr}>${boardProjectBody(p)}</div>${resizeHandlesHTML(key)}</section>`;
  }
  const a = getA(c.id);
  const todos = S.todos.filter((t) => t.areaId === a.id && !t.projectId && liveTodo(t)).sort(byOrder);
  const projs = S.projects.filter((p) => p.areaId === a.id && liveProject(p) && !onBoard('p', p.id) && (p.status !== 'open' || (p.start === 'anytime' && !(p.when && p.when > T0())))).sort(byOrder);
  const n = todos.filter((t) => t.status === 'open').length + projs.reduce((s, p) => s + projectProgress(p).open, 0);
  const sec = `area:${a.id}`;
  let body = secHTML(sec, todos, { when: true }) + (loggedShownIn(a.id) ? loggedInHTML(sec, loggedOfArea(a)) : '');
  if (projs.length) body += `<div class="sec bcol-projs" data-sec="areaprojects:${a.id}" data-ok="order">${sortedRows(projs).map((p) => projRowHTML(p, { star: true, when: true, expandable: true })).join('')}</div>`;
  if (!todos.length && !projs.length) body += `<div class="bcol-empty">Nothing here yet</div>`;
  return `<section class="bcol${sizedH}${placeColor(a) ? ' colored' : ''}" data-col="a:${a.id}" data-newsec="${sec}" data-colzone="${sec}"${colHStyle(c.h, placeColor(a))}>${gripHTML}
    <div class="bcol-h" data-col="a:${a.id}">${areaIc(a, 'bcol-ic')}<div class="bcol-t">${renamingNow('a', a.id) ? renameInputHTML('a', a) : `<button class="bcol-title" data-nav="area:${a.id}" title="Open ${esc(aTitle(a))}">${esc(aTitle(a))}</button>`}<div class="bcol-sub">Area</div></div>${n ? `<span class="bcol-count" title="Open to-dos">${n}</span>` : ''}<button class="ib" data-action="bcol-add" data-sec="${sec}" aria-label="New to-do in ${esc(aTitle(a))}" title="New to-do">${ic('plus')}</button>${more}</div>
    <div class="bcol-body"${bodyAttr}>${body}</div>${resizeHandlesHTML(key)}</section>`;
}
function boardProjectBody(p) {
  const todos = S.todos.filter((t) => t.projectId === p.id && !t.trashed && !t.isTemplate && !t.isDraft && (t.status === 'open' || !t.logged));
  const headings = sinkHeadings(S.headings.filter((h) => h.projectId === p.id && !h.archived).sort(byOrder));
  const ctx = { when: true };
  const lbs = loggedBySec(p), lin = (k) => loggedInHTML(k, lbs.get(k) || []);
  let html = secHTML(`project:${p.id}:`, todos.filter((t) => !t.headingId || !getH(t.headingId) || getH(t.headingId).archived).sort(byOrder), ctx) + lin(`project:${p.id}:`);
  headings.forEach((h) => {
    html += `<div class="sub-h${headingDoneCls(h)}" data-zone="project:${p.id}:${h.id}">${esc(h.title || 'Untitled heading')}</div>` + secHTML(`project:${p.id}:${h.id}`, todos.filter((t) => t.headingId === h.id).sort(byOrder), ctx) + lin(`project:${p.id}:${h.id}`);
  });
  if (!todos.length) html += emptyProjectHTML(p, 'bcol-empty');
  return html;
}
function boardColMenu(key, el) {
  const [t, id] = key.split(':');
  const can = nudgeable(key), c = colEntry(key) || {};
  const extra = [
    { header: 'Column' },
    { label: 'Add Below…', icon: 'plus', fn: () => openBoardPicker(el, { below: key }) },
    ...(can.stacked ? [
      { label: 'Move Up', icon: 'chevU', disabled: !can.up, fn: () => boardNudge(key, 'up') },
      { label: 'Move Down', icon: 'chevD', disabled: !can.down, fn: () => boardNudge(key, 'down') },
    ] : []),
    { label: 'Move Left', icon: 'chevL', disabled: !can.left, fn: () => boardNudge(key, 'left') },
    { label: 'Move Right', icon: 'chevR', disabled: !can.right, fn: () => boardNudge(key, 'right') },
    { label: 'Fit Size Automatically', icon: 'columns', disabled: !(c.w || c.h), fn: () => setColSize(key, { w: 0, h: 0 }) },
    sortMenuItem(el, 'Sort Board By…'),
    { label: 'Remove from Board', icon: 'x', fn: () => boardRemove(t, id) },
    { sep: 1 },
  ];
  if (t === 'p') projectMenu(getP(id), el, extra);
  else if (t === 'a') areaMenu(getA(id), el, extra);
  else openMenu(el, [...extra.filter((x) => !x.sep && x.label !== 'Sort Board By…'), { sep: 1 },
    { label: `Open ${colName(t, id)}`, icon: 'move', fn: () => navigate(t === 'l' ? id : t === 't' ? 'tag:' + id : 'smart:' + id) },
    ...(t === 's' ? [{ label: 'Edit Smart List…', icon: 'sliders', fn: () => openSmartEditor(getSmart(id)) }] : [])]);
}
/* column of the selected row, else the first one that takes new to-dos */
function boardNewSec() {
  const row = ui.anchor && ui.sel.has(ui.anchor) && document.querySelector(`#content .row[data-id="${CSS.escape(ui.anchor)}"]`);
  const col = (row && row.closest('.bcol[data-newsec]:not([data-newsec=""])')) || document.querySelector('#content .bcol[data-newsec]:not([data-newsec=""])');
  return col ? col.dataset.newsec : null;
}

/* ---- a project's headings as columns ----
   Like the Board: side by side or stacked, dragged and resized. Columns run in heading order,
   left to right and top to bottom, so the list and the board always agree; which headings sit
   under the one before them is this device's layout (ui.hUnder). No Heading stays first. */
function projectBoardOn(p) { return !!(p && ui.projBoard && ui.projBoard.has(p.id) && !isMobile() && !p.trashed); }
function setProjectBoard(id, on) {
  if (on) ui.projBoard.add(id); else ui.projBoard.delete(id);
  lsSet('sectis.pboard', JSON.stringify([...ui.projBoard])); render();
}
function saveHUnder() { lsSet('sectis.hunder', JSON.stringify([...ui.hUnder])); }
const hStackW = (keys) => { const w = keys.map(getColW).find(Boolean); return w ? clampW(w) : 0; };
function projectBoardHTML(p, items, headings, ctx) {
  const open = p.status === 'open' && !p.trashed;
  const lbs = loggedBySec(p, matchesTagFilter);
  const col = (key, sec, titleHTML, list, menuBtn) => {
    const h = getColH(key);
    const hd = key.startsWith('h:') && getH(key.slice(2)) ? headingDoneCls(getH(key.slice(2))) : '';
    return `<section class="bcol hcol${h ? ' sized-h' : ''}${hd}" data-hcol="${key}" data-newsec="${open ? sec : ''}" data-colzone="${open ? sec : ''}"${colHStyle(h)}>${key.startsWith('h:') ? gripHTML : ''}
      <div class="bcol-h" data-hcol="${key}">${titleHTML}${list.filter((t) => t.status === 'open').length ? `<span class="bcol-count" title="Open to-dos">${list.filter((t) => t.status === 'open').length}</span>` : ''}${open ? `<button class="ib" data-action="bcol-add" data-sec="${sec}" title="New to-do" aria-label="New to-do">${ic('plus')}</button>` : ''}${menuBtn}</div>
      <div class="bcol-body"${h ? ` data-vscroll="${key}"` : ''}>${secHTML(sec, list, ctx)}${list.length ? '' : `<div class="bcol-empty">${open ? 'Drag to-dos here' : 'Nothing here'}</div>`}${loggedInHTML(sec, lbs.get(sec) || [])}</div>${resizeHandlesHTML(key)}</section>`;
  };
  const loose = items.filter((t) => !t.headingId || !getH(t.headingId) || getH(t.headingId).archived).sort(byOrder);
  const cols = [];
  if (loose.length || !headings.length || (lbs.get(`project:${p.id}:`) || []).length) cols.push([`n:${p.id}`, () => col(`n:${p.id}`, `project:${p.id}:`, `<div class="bcol-t"><div class="bcol-title static">No Heading</div></div>`, loose, `<button class="ib" data-action="hcol-menu" data-id="" data-col="n:${p.id}" aria-label="Column options" title="Column options">${ic('more')}</button>`)]);
  headings.forEach((h) => cols.push([`h:${h.id}`, () => col(`h:${h.id}`, `project:${p.id}:${h.id}`,
    `<div class="bcol-t"><textarea class="bcol-htitle" data-edit="heading-title" data-id="${h.id}" data-fkey="h-${h.id}" placeholder="New Heading" aria-label="Heading" title="Click to rename, drag to move" autocomplete="off" rows="1" data-autosize data-oneline>${esc(h.title)}</textarea></div>`,
    items.filter((t) => t.headingId === h.id).sort(byOrder), `<button class="ib" data-action="hcol-menu" data-id="${h.id}" data-col="h:${h.id}" aria-label="Heading options" title="Heading options">${ic('more')}</button>`)]));
  const stacks = [];
  cols.forEach((c, i) => { if (i && c[0].startsWith('h:') && ui.hUnder.has(c[0].slice(2))) stacks[stacks.length - 1].push(c); else stacks.push([c]); });
  let html = `<div class="board hboard bstacks" data-kind="headings" data-pid="${p.id}" data-hscroll="hboard:${p.id}">`;
  stacks.forEach((st, i) => {
    const w = hStackW(st.map((c) => c[0]));
    html += `<div class="bstack${w ? ' sized' : ''}" data-stack="${i}"${w ? ` style="flex:0 0 ${w}px;width:${w}px"` : ''}>${st.map((c) => c[1]()).join('')}`
      + (open ? `<button class="bstack-add" data-action="hcol-new-below" data-pid="${p.id}" data-col="${st[st.length - 1][0]}" title="Add a heading below this one">${ic('plus')}<span>Add Heading Below</span></button>` : '') + '</div>';
  });
  if (open) html += `<button class="bcol-new" data-action="hcol-new" data-id="${p.id}">${ic('plus')}<span>Add Heading</span></button>`;
  return html + '</div>';
}
/* the heading board's stacks as drawn: lists of column keys */
function hStacks() {
  const b = $('#content .bstacks[data-kind="headings"]');
  return b ? $$(':scope > .bstack', b).map((s) => $$(':scope > .bcol', s).map((c) => c.dataset.hcol)) : [];
}
function hStackOf(key) { return hStacks().find((s) => s.includes(key)) || null; }
/* where a heading column ends up after a move (same `to` as boardPlace); null if it can't go there */
function hPlaced(stacks, key, to) {
  stacks = stacks.map((s) => s.slice());
  const i = stacks.findIndex((s) => s.includes(key)); if (i < 0) return null;
  const j = stacks[i].indexOf(key); stacks[i].splice(j, 1);
  if (to.newStack != null) stacks.splice(clamp(to.newStack, 0, stacks.length), 0, [key]);
  else { const s = stacks[to.stack]; if (!s) return null; s.splice(clamp(to.index, 0, s.length), 0, key); }
  const out = stacks.filter((s) => s.length), flat = [].concat(...out);
  if (flat.some((k, n) => n > 0 && k.startsWith('n:'))) return null; // nothing goes before No Heading
  return { stacks: out, flat, from: i, joined: to.newStack == null && to.stack !== i ? to.stack : null, before: stacks };
}
function headingPlace(key, to) {
  const h = getH(key.slice(2)); if (!h) return;
  const r = hPlaced(hStacks(), key, to); if (!r) return;
  if (r.joined != null) { const w = hStackW(r.before[r.joined].filter((k) => k !== key)); if (w) ui.hcolW[key] = w; else delete ui.hcolW[key]; lsSet('sectis.hcolw', JSON.stringify(ui.hcolW)); }
  r.stacks.forEach((s) => s.forEach((k, j) => { if (!k.startsWith('h:')) return; if (j) ui.hUnder.add(k.slice(2)); else ui.hUnder.delete(k.slice(2)); }));
  saveHUnder();
  // its place among the project's headings: right after the heading now before it
  const n = r.flat.indexOf(key);
  const prevK = r.flat.slice(0, n).reverse().find((k) => k.startsWith('h:')), nextK = r.flat.slice(n + 1).find((k) => k.startsWith('h:'));
  const all = S.headings.filter((x) => x.projectId === h.projectId && !x.archived).sort(byOrder), hs = all.filter((x) => x !== h);
  let at = prevK ? hs.findIndex((x) => x.id === prevK.slice(2)) + 1 : nextK ? hs.findIndex((x) => x.id === nextK.slice(2)) : hs.length;
  if (at < 0) at = hs.length;
  if (all.indexOf(h) === at) { render(); return; } // only the layout changed
  commit('Move Heading', () => { h.order = orderBetween(hs[at - 1] ? hs[at - 1].order : null, hs[at] ? hs[at].order : null)[0]; touch(h); });
}
function headingNudgeTo(key, dir) {
  const stacks = hStacks(), i = stacks.findIndex((s) => s.includes(key)); if (i < 0) return null;
  const j = stacks[i].indexOf(key), alone = stacks[i].length === 1;
  const to = dir === 'up' ? { stack: i, index: j - 1 } : dir === 'down' ? { stack: i, index: j + 1 }
    : dir === 'left' ? { newStack: alone ? i - 1 : i } : { newStack: alone ? i + 2 : i + 1 };
  if ((dir === 'up' && j === 0) || (dir === 'down' && j === stacks[i].length - 1) || (dir === 'left' && alone && i === 0) || (dir === 'right' && alone && i === stacks.length - 1)) return null;
  return hPlaced(stacks, key, to) ? to : null;
}
function moveHeadingCol(h, dir) {
  const hs = S.headings.filter((x) => x.projectId === h.projectId && !x.archived).sort(byOrder);
  const i = hs.indexOf(h), j = i + dir; if (i < 0 || j < 0 || j >= hs.length) return;
  commit('Move Heading', () => { const o = hs[i].order; hs[i].order = hs[j].order; hs[j].order = o; if (hs[i].order === hs[j].order) hs[i].order += dir * 0.001; touch(hs[i]); touch(hs[j]); });
}
function hcolMenu(el) {
  const key = el.dataset.col, h = el.dataset.id ? getH(el.dataset.id) : null;
  const p = getP(h ? h.projectId : key.slice(2)), open = p && p.status === 'open' && !p.trashed;
  const below = open ? [{ label: 'Add Heading Below', icon: 'plus', fn: () => newHeading(p.id, { after: key }) }] : [];
  const fit = { label: 'Fit Size Automatically', icon: 'columns', disabled: !(getColW(key) || getColH(key)), fn: () => setColSize(key, { w: 0, h: 0 }) };
  if (!h) { openMenu(el, [...below, fit]); return; }
  const to = (d) => headingNudgeTo(key, d), mv = (d) => () => headingPlace(key, to(d));
  const stacked = (hStackOf(key) || []).length > 1;
  headingMenu(h, el, [
    { header: 'Column' }, ...below,
    ...(stacked ? [
      { label: 'Move Up', icon: 'chevU', disabled: !to('up'), fn: mv('up') },
      { label: 'Move Down', icon: 'chevD', disabled: !to('down'), fn: mv('down') },
    ] : []),
    { label: 'Move Left', icon: 'chevL', disabled: !to('left'), fn: mv('left') },
    { label: 'Move Right', icon: 'chevR', disabled: !to('right'), fn: mv('right') },
    fit, sortMenuItem(el, 'Sort Project By…'), { sep: 1 },
  ]);
}

/* ---- picking columns ----
   From Add Column: click to add (as a new column at the right) or remove.
   From Add Below: each click puts that project or area under the column, then under the one
   just added, so several go in, in the order picked. One already on the Board moves there. */
function openBoardPicker(anchor, opts = {}) {
  let below = opts.below && colEntry(opts.below) ? opts.below : null;
  const build = (q = '') => {
    const ql = q.trim().toLowerCase(); const m = (s) => !ql || (s || '').toLowerCase().includes(ql);
    const chk = (t, id) => (onBoard(t, id) ? `<span class="check">${ic('check')}</span>` : '');
    const projs = (areaId) => S.projects.filter((p) => !p.trashed && !p.isTemplate && p.status === 'open' && (p.areaId || null) === areaId).sort(byOrder);
    const prow = (p, inArea) => `<button class="pick-i p${inArea ? ' in-area' : ''}" data-col="p:${p.id}">${projIc(p)}<span>${esc(pTitle(p))}</span>${chk('p', p.id)}</button>`;
    let out = '';
    const grp = (label) => `<div class="pk-grp">${label}</div>`;
    const lists = BOARD_LISTS.filter((k) => m(LISTS[k].title));
    if (lists.length) out += grp('Lists') + lists.map((k) => `<button class="pick-i l" data-col="l:${k}"><span class="ic" style="color:${LISTS[k].color}">${I[LISTS[k].icon]}</span><span>${LISTS[k].title}</span>${chk('l', k)}</button>`).join('');
    const smarts = (S.smart || []).slice().sort(byOrder).filter((sl) => m(smartTitle(sl)));
    if (smarts.length) out += grp('Smart Lists') + smarts.map((sl) => `<button class="pick-i s" data-col="s:${sl.id}"><span class="ic" style="color:var(--c-smart)">${I.funnel}</span><span>${esc(smartTitle(sl))}</span>${chk('s', sl.id)}</button>`).join('');
    const tags = tagTree().filter(({ tag }) => m(tag.title));
    if (tags.length) out += grp('Tags') + tags.map(({ tag, depth }) => `<button class="pick-i t${depth ? ' in-area' : ''}" data-col="t:${tag.id}"><span class="ic ${tcls(tag)}" style="color:var(--tc)">${I.tag}</span><span>${esc(tag.title)}</span>${chk('t', tag.id)}</button>`).join('');
    const pa = S.projects.some((p) => !p.trashed && !p.isTemplate && p.status === 'open' && m(pTitle(p))) || S.areas.some((a) => m(aTitle(a)));
    if (pa) out += grp('Projects & Areas');
    projs(null).forEach((p) => { if (m(pTitle(p))) out += prow(p, false); });
    S.areas.slice().sort(byOrder).forEach((a) => {
      const am = m(aTitle(a)), pr = projs(a.id).filter((p) => am || m(pTitle(p)));
      if (am || pr.length) out += `<button class="pick-i a" data-col="a:${a.id}">${ic('area')}<span>${esc(aTitle(a))}</span>${chk('a', a.id)}</button>`;
      pr.forEach((p) => { out += prow(p, true); });
    });
    return out || '<p class="note" style="padding:6px 10px">No matching projects or areas.</p>';
  };
  const head = () => (below ? `Add Below “${esc(colName(...below.split(':')))}”` : 'Board Columns');
  const foot = below
    ? 'Click to put a project or area here. One that’s already on the Board moves here.'
    : 'Click to add or remove. Drag a column by its title to move it, or to stack it under another, and drag its edges to resize it.';
  const L = openLayer({ anchor, cls: 'move-pop board-pop', html: `<div class="pk-h" id="bp-h">${head()}</div><input class="pk-in" id="bp-in" placeholder="Find a project or area" autocomplete="off" aria-label="Find a project or area"><div class="pick-list" id="bp-list">${build()}</div><div class="pk-foot note">${foot}</div>`,
    onMount: (el) => {
      const inp = $('#bp-in', el), list = $('#bp-list', el);
      const nav = listKeys(el, '.pick-i', inp);
      inp.addEventListener('input', () => { list.innerHTML = build(inp.value); nav.first(); });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-col]'); if (!b) return;
        const [t, id] = b.dataset.col.split(':');
        if (ui.view.type !== 'board') { closeLayer(L); boardAdd([{ t, id }], { go: true }); return; }
        if (below) {
          const key = `${t}:${id}`;
          if (key !== below) {
            if (onBoard(t, id)) boardPlace(key, { below }); else boardAdd([{ t, id }], { below });
            if (stackPos(boardStacks(), key)) below = key; // the next one goes under this one
          }
          $('#bp-h', el).innerHTML = head();
        } else boardToggle(t, id);
        list.innerHTML = build(inp.value);
        if (!isCoarse()) inp.focus({ preventScroll: true });
      });
      if (!isCoarse()) inp.focus({ preventScroll: true });
    } });
  return L;
}
