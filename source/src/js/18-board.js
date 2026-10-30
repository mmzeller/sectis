/* ===================== Board =====================
   Projects and areas side by side, one per column, like a kanban board.
   The columns are remembered per device (a Mac layout, not synced). */
function loadBoard() {
  try { ui.board = JSON.parse(lsGet('sectis.board') || '[]').filter((c) => c && c.id && (c.t === 'p' || c.t === 'a')); } catch (e) { ui.board = []; }
  try { ui.projBoard = new Set(JSON.parse(lsGet('sectis.pboard') || '[]')); } catch (e) { ui.projBoard = new Set(); }
  try { ui.hcolW = JSON.parse(lsGet('sectis.hcolw') || '{}') || {}; } catch (e) { ui.hcolW = {}; }
}
function saveBoard() { lsSet('sectis.board', JSON.stringify(ui.board)); }
function colShown(c) {
  if (c.t === 'a') return !!getA(c.id);
  const p = getP(c.id);
  return !!p && !p.trashed && !p.isTemplate && !(p.status !== 'open' && p.logged);
}
function boardCols() { return (ui.board || []).filter(colShown); }
function onBoard(t, id) { return (ui.board || []).some((c) => c.t === t && c.id === id); }
function colName(t, id) { return t === 'p' ? pTitle(getP(id)) : aTitle(getA(id)); }

function boardAdd(cols, opts = {}) {
  const prev = ui.board || [];
  if (opts.replace) ui.board = [];
  cols.forEach((c) => {
    if (onBoard(c.t, c.id)) return;
    const old = prev.find((x) => x.t === c.t && x.id === c.id); // a column that comes back keeps its width
    ui.board.push(old && old.w ? { t: c.t, id: c.id, w: old.w } : { t: c.t, id: c.id });
  });
  saveBoard();
  if (opts.go) navigate('board');
  else { render(); if (opts.toast) toast(opts.toast, { action: 'Show Board', fn: () => navigate('board') }); }
}
function boardRemove(t, id) { ui.board = ui.board.filter((c) => !(c.t === t && c.id === id)); saveBoard(); render(); }
function boardToggle(t, id) { if (onBoard(t, id)) boardRemove(t, id); else boardAdd([{ t, id }]); }
function boardMove(t, id, dir) {
  const vis = boardCols(), hidden = ui.board.filter((c) => !colShown(c));
  const i = vis.findIndex((c) => c.t === t && c.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= vis.length) return;
  [vis[i], vis[j]] = [vis[j], vis[i]];
  ui.board = vis.concat(hidden); saveBoard(); render();
}
/* an area's projects as columns, plus the area itself first when it has to-dos of its own */
function areaAsBoard(a) {
  const projs = S.projects.filter((p) => p.areaId === a.id && !p.trashed && !p.isTemplate && p.status === 'open' && p.start !== 'someday').sort(byOrder);
  const loose = S.todos.some((t) => t.areaId === a.id && !t.projectId && t.status === 'open' && liveTodo(t));
  const cols = (loose || !projs.length ? [{ t: 'a', id: a.id }] : []).concat(projs.map((p) => ({ t: 'p', id: p.id })));
  boardAdd(cols, { replace: true, go: true });
}
/* ---- column widths: drag a column's right edge; double-click it to go back to automatic ---- */
const COL_MIN = 220, COL_MAX = 1200;
const clampW = (w) => Math.round(Math.max(COL_MIN, Math.min(COL_MAX, w)));
function colEntry(key) { const [t, id] = key.split(':'); return (ui.board || []).find((c) => c.t === t && c.id === id); }
function colStyle(c) { return c.w ? ` style="flex:0 0 ${clampW(c.w)}px;width:${clampW(c.w)}px"` : ''; }
function resizeHandleHTML(c) { return `<div class="bcol-resize" data-colresize="${c.t}:${c.id}" aria-hidden="true" title="Drag to change the width. Double-click to fit automatically."></div>`; }
/* Board columns keep their width in the board list; heading columns (h:headingId, n:projectId) in their own map */
function getColW(key) { const c = colEntry(key); return c ? c.w || 0 : (ui.hcolW || {})[key] || 0; }
function setColWidth(key, w) {
  const c = colEntry(key);
  if (c) { if (w) c.w = clampW(w); else delete c.w; saveBoard(); }
  else { ui.hcolW = ui.hcolW || {}; if (w) ui.hcolW[key] = clampW(w); else delete ui.hcolW[key]; lsSet('sectis.hcolw', JSON.stringify(ui.hcolW)); }
  render();
}
function resetAllWidths() { (ui.board || []).forEach((c) => delete c.w); saveBoard(); render(); }
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest && e.target.closest('#content .bcol-resize');
  if (!h || e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  const col = h.closest('.bcol'), key = h.dataset.colresize;
  const x0 = e.clientX, w0 = col.getBoundingClientRect().width;
  let moved = false;
  try { h.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  document.body.classList.add('col-resizing'); h.classList.add('on');
  const move = (ev) => {
    if (Math.abs(ev.clientX - x0) > 2) moved = true;
    if (!moved) return;
    const w = clampW(w0 + ev.clientX - x0);
    col.style.flex = `0 0 ${w}px`; col.style.width = w + 'px';
  };
  const up = (ev) => {
    h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
    document.body.classList.remove('col-resizing'); h.classList.remove('on');
    if (moved && ev.type === 'pointerup') setColWidth(key, w0 + ev.clientX - x0);
    else if (moved) render();
  };
  h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
}, true);
document.addEventListener('dblclick', (e) => {
  const h = e.target.closest && e.target.closest('#content .bcol-resize');
  if (h) { e.preventDefault(); setColWidth(h.dataset.colresize, 0); }
});
const isColMenu = (extra) => extra.some((x) => x.header === 'Column'); // a column's own menu has its own board items
function boardMenuItems(t, id, fromColumn) {
  if (isMobile() || fromColumn) return [];
  const on = onBoard(t, id);
  return [on
    ? { label: 'Remove from Board', icon: 'columns', fn: () => { boardRemove(t, id); toast(`Removed “${colName(t, id)}” from the Board`); } }
    : { label: 'Add to Board', icon: 'columns', fn: () => boardAdd([{ t, id }], { toast: `Added “${colName(t, id)}” to the Board` }) }];
}

/* ---- view ---- */
function viewBoard() {
  const cols = boardCols();
  let html = `<div class="lh"><span class="ic lh-ic" style="color:var(--c-board)">${I.columns}</span><h1 class="lh-title">Board</h1><button class="btn board-add" data-action="board-add">${ic('plus')}<span>Add Column</span></button><button class="ib" data-action="view-menu" aria-label="Board options" title="Board options">${ic('more')}</button></div>`;
  if (!cols.length) {
    return html + emptyHTML('columns', 'See your lists side by side',
      'Add projects or areas as columns with <b>Add Column</b>, or choose <b>Add to Board</b> from any project or area’s ••• menu. An area’s <b>Open as Board</b> lays out all of its projects at once.');
  }
  return html + `<div class="board" data-hscroll="board" data-cols="${cols.length}">${cols.map(boardColHTML).join('')}</div>`;
}
function boardColHTML(c) {
  const more = `<button class="ib" data-action="bcol-menu" data-col="${c.t}:${c.id}" aria-label="Column options" title="Column options">${ic('more')}</button>`;
  if (c.t === 'p') {
    const p = getP(c.id), pr = projectProgress(p), open = p.status === 'open';
    const area = p.areaId && getA(p.areaId);
    const sec = `project:${p.id}:`;
    return `<section class="bcol${open ? '' : ' closed'}${c.w ? ' sized' : ''}" data-col="p:${p.id}" data-newsec="${open ? sec : ''}" data-colzone="${open ? sec : ''}"${colStyle(c)}>
      <div class="bcol-h" data-col="p:${p.id}">${pieIc(pr.frac, 'bcol-ic')}<div class="bcol-t"><button class="bcol-title" data-nav="project:${p.id}" title="Open ${esc(pTitle(p))}">${esc(pTitle(p))}</button><div class="bcol-sub">${open ? (area ? esc(aTitle(area)) : 'Project') : p.status === 'done' ? 'Completed' : 'Canceled'}</div></div>${pr.open ? `<span class="bcol-count" title="Open to-dos">${pr.open}</span>` : ''}${open ? `<button class="ib" data-action="bcol-add" data-sec="${sec}" aria-label="New to-do in ${esc(pTitle(p))}" title="New to-do">${ic('plus')}</button>` : ''}${more}</div>
      <div class="bcol-body">${boardProjectBody(p)}</div>${resizeHandleHTML(c)}</section>`;
  }
  const a = getA(c.id);
  const todos = S.todos.filter((t) => t.areaId === a.id && !t.projectId && liveTodo(t)).sort(byOrder);
  const projs = S.projects.filter((p) => p.areaId === a.id && liveProject(p) && !onBoard('p', p.id) && (p.status !== 'open' || (p.start === 'anytime' && !(p.when && p.when > T0())))).sort(byOrder);
  const n = todos.filter((t) => t.status === 'open').length + projs.reduce((s, p) => s + projectProgress(p).open, 0);
  const sec = `area:${a.id}`;
  let body = secHTML(sec, todos, { when: true });
  if (projs.length) body += `<div class="sec bcol-projs" data-sec="areaprojects:${a.id}" data-ok="order">${sortedRows(projs).map((p) => projRowHTML(p, { star: true, when: true, expandable: true })).join('')}</div>`;
  if (!todos.length && !projs.length) body += `<div class="bcol-empty">Nothing here yet</div>`;
  return `<section class="bcol${c.w ? ' sized' : ''}" data-col="a:${a.id}" data-newsec="${sec}" data-colzone="${sec}"${colStyle(c)}>
    <div class="bcol-h" data-col="a:${a.id}"><span class="ic bcol-ic" style="color:var(--c-area)">${I.area}</span><div class="bcol-t"><button class="bcol-title" data-nav="area:${a.id}" title="Open ${esc(aTitle(a))}">${esc(aTitle(a))}</button><div class="bcol-sub">Area</div></div>${n ? `<span class="bcol-count" title="Open to-dos">${n}</span>` : ''}<button class="ib" data-action="bcol-add" data-sec="${sec}" aria-label="New to-do in ${esc(aTitle(a))}" title="New to-do">${ic('plus')}</button>${more}</div>
    <div class="bcol-body">${body}</div>${resizeHandleHTML(c)}</section>`;
}
function boardProjectBody(p) {
  const todos = S.todos.filter((t) => t.projectId === p.id && !t.trashed && !t.isTemplate && !t.isDraft && (t.status === 'open' || !t.logged));
  const headings = S.headings.filter((h) => h.projectId === p.id && !h.archived).sort(byOrder);
  const ctx = { when: true };
  let html = secHTML(`project:${p.id}:`, todos.filter((t) => !t.headingId || !getH(t.headingId) || getH(t.headingId).archived).sort(byOrder), ctx);
  headings.forEach((h) => {
    html += `<div class="sub-h" data-zone="project:${p.id}:${h.id}">${esc(h.title || 'Untitled heading')}</div>` + secHTML(`project:${p.id}:${h.id}`, todos.filter((t) => t.headingId === h.id).sort(byOrder), ctx);
  });
  if (!todos.length) html += emptyProjectHTML(p, 'bcol-empty');
  return html;
}
function boardColMenu(key, el) {
  const [t, id] = key.split(':');
  const cols = boardCols(), i = cols.findIndex((c) => c.t === t && c.id === id);
  const extra = [
    { header: 'Column' },
    { label: 'Move Left', icon: 'chevL', disabled: i <= 0, fn: () => boardMove(t, id, -1) },
    { label: 'Move Right', icon: 'chevR', disabled: i < 0 || i >= cols.length - 1, fn: () => boardMove(t, id, 1) },
    { label: 'Fit Width Automatically', icon: 'columns', disabled: !(colEntry(key) || {}).w, fn: () => setColWidth(key, 0) },
    sortMenuItem(el, 'Sort Board By…'),
    { label: 'Remove from Board', icon: 'x', fn: () => boardRemove(t, id) },
    { sep: 1 },
  ];
  if (t === 'p') projectMenu(getP(id), el, extra); else areaMenu(getA(id), el, extra);
}
/* column of the selected row, else the first one that takes new to-dos */
function boardNewSec() {
  const row = ui.anchor && ui.sel.has(ui.anchor) && document.querySelector(`#content .row[data-id="${CSS.escape(ui.anchor)}"]`);
  const col = (row && row.closest('.bcol[data-newsec]:not([data-newsec=""])')) || document.querySelector('#content .bcol[data-newsec]:not([data-newsec=""])');
  return col ? col.dataset.newsec : null;
}

/* ---- a project's headings as columns ---- */
function projectBoardOn(p) { return !!(p && ui.projBoard && ui.projBoard.has(p.id) && !isMobile() && !p.trashed); }
function setProjectBoard(id, on) {
  if (on) ui.projBoard.add(id); else ui.projBoard.delete(id);
  lsSet('sectis.pboard', JSON.stringify([...ui.projBoard])); render();
}
function projectBoardHTML(p, items, headings, ctx) {
  const open = p.status === 'open' && !p.trashed;
  const col = (key, sec, titleHTML, list, menuBtn) => {
    const w = getColW(key);
    return `<section class="bcol hcol${w ? ' sized' : ''}" data-hcol="${key}" data-newsec="${open ? sec : ''}" data-colzone="${open ? sec : ''}"${w ? ` style="flex:0 0 ${w}px;width:${w}px"` : ''}>
      <div class="bcol-h" data-hcol="${key}">${titleHTML}${list.filter((t) => t.status === 'open').length ? `<span class="bcol-count" title="Open to-dos">${list.filter((t) => t.status === 'open').length}</span>` : ''}${open ? `<button class="ib" data-action="bcol-add" data-sec="${sec}" title="New to-do" aria-label="New to-do">${ic('plus')}</button>` : ''}${menuBtn}</div>
      <div class="bcol-body">${secHTML(sec, list, ctx)}${list.length ? '' : `<div class="bcol-empty">${open ? 'Drag to-dos here' : 'Nothing here'}</div>`}</div><div class="bcol-resize" data-colresize="${key}" aria-hidden="true" title="Drag to change the width. Double-click to fit automatically."></div></section>`;
  };
  const loose = items.filter((t) => !t.headingId || !getH(t.headingId) || getH(t.headingId).archived).sort(byOrder);
  let html = `<div class="board hboard" data-hscroll="hboard:${p.id}">`;
  if (loose.length || !headings.length) html += col(`n:${p.id}`, `project:${p.id}:`, `<div class="bcol-t"><div class="bcol-title static">No Heading</div></div>`, loose, `<button class="ib" data-action="hcol-menu" data-id="" data-col="n:${p.id}" aria-label="Column options" title="Column options">${ic('more')}</button>`);
  headings.forEach((h) => {
    const list = items.filter((t) => t.headingId === h.id).sort(byOrder);
    html += col(`h:${h.id}`, `project:${p.id}:${h.id}`,
      `<div class="bcol-t"><textarea class="bcol-htitle" data-edit="heading-title" data-id="${h.id}" data-fkey="h-${h.id}" placeholder="New Heading" aria-label="Heading" autocomplete="off" rows="1" data-autosize data-oneline>${esc(h.title)}</textarea></div>`,
      list, `<button class="ib" data-action="hcol-menu" data-id="${h.id}" data-col="h:${h.id}" aria-label="Heading options" title="Heading options">${ic('more')}</button>`);
  });
  if (open) html += `<button class="bcol-new" data-action="hcol-new" data-id="${p.id}">${ic('plus')}<span>Add Heading</span></button>`;
  return html + '</div>';
}
function moveHeadingCol(h, dir) {
  const hs = S.headings.filter((x) => x.projectId === h.projectId && !x.archived).sort(byOrder);
  const i = hs.indexOf(h), j = i + dir; if (i < 0 || j < 0 || j >= hs.length) return;
  commit('Move Heading', () => { const o = hs[i].order; hs[i].order = hs[j].order; hs[j].order = o; if (hs[i].order === hs[j].order) hs[i].order += dir * 0.001; touch(hs[i]); touch(hs[j]); });
}
function hcolMenu(el) {
  const key = el.dataset.col, h = el.dataset.id ? getH(el.dataset.id) : null;
  const fit = { label: 'Fit Width Automatically', icon: 'columns', disabled: !getColW(key), fn: () => setColWidth(key, 0) };
  if (!h) { openMenu(el, [fit]); return; }
  const hs = S.headings.filter((x) => x.projectId === h.projectId && !x.archived).sort(byOrder), i = hs.indexOf(h);
  headingMenu(h, el, [
    { header: 'Column' },
    { label: 'Move Left', icon: 'chevL', disabled: i <= 0, fn: () => moveHeadingCol(h, -1) },
    { label: 'Move Right', icon: 'chevR', disabled: i >= hs.length - 1, fn: () => moveHeadingCol(h, 1) },
    fit, sortMenuItem(el, 'Sort Project By…'), { sep: 1 },
  ]);
}

/* ---- picking columns ---- */
function openBoardPicker(anchor) {
  const build = (q = '') => {
    const ql = q.trim().toLowerCase(); const m = (s) => !ql || (s || '').toLowerCase().includes(ql);
    const chk = (t, id) => (onBoard(t, id) ? `<span class="check">${ic('check')}</span>` : '');
    const projs = (areaId) => S.projects.filter((p) => !p.trashed && !p.isTemplate && p.status === 'open' && (p.areaId || null) === areaId).sort(byOrder);
    const prow = (p, inArea) => `<button class="pick-i p${inArea ? ' in-area' : ''}" data-col="p:${p.id}">${pieIc(projectProgress(p).frac)}<span>${esc(pTitle(p))}</span>${chk('p', p.id)}</button>`;
    let out = '';
    projs(null).forEach((p) => { if (m(pTitle(p))) out += prow(p, false); });
    S.areas.slice().sort(byOrder).forEach((a) => {
      const am = m(aTitle(a)), pr = projs(a.id).filter((p) => am || m(pTitle(p)));
      if (am || pr.length) out += `<button class="pick-i a" data-col="a:${a.id}">${ic('area')}<span>${esc(aTitle(a))}</span>${chk('a', a.id)}</button>`;
      pr.forEach((p) => { out += prow(p, true); });
    });
    return out || '<p class="note" style="padding:6px 10px">No matching projects or areas.</p>';
  };
  const L = openLayer({ anchor, cls: 'move-pop board-pop', html: `<div class="pk-h">Board Columns</div><input class="pk-in" id="bp-in" placeholder="Find a project or area" autocomplete="off" aria-label="Find a project or area"><div class="pick-list" id="bp-list">${build()}</div><div class="pk-foot note">Click to add or remove. Move columns from each column’s ••• menu, and drag a column’s right edge to change its width.</div>`,
    onMount: (el) => {
      const inp = $('#bp-in', el), list = $('#bp-list', el);
      const nav = listKeys(el, '.pick-i', inp);
      inp.addEventListener('input', () => { list.innerHTML = build(inp.value); nav.first(); });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-col]'); if (!b) return;
        const [t, id] = b.dataset.col.split(':');
        if (ui.view.type !== 'board') { closeLayer(L); boardAdd([{ t, id }], { go: true }); return; }
        boardToggle(t, id);
        list.innerHTML = build(inp.value);
        if (!isCoarse()) inp.focus({ preventScroll: true });
      });
      if (!isCoarse()) inp.focus({ preventScroll: true });
    } });
  return L;
}
