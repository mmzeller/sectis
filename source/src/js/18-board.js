/* ===================== Board =====================
   Projects and areas side by side, one per column, like a kanban board.
   The columns are remembered per device (a Mac layout, not synced). */
function loadBoard() {
  try { ui.board = JSON.parse(lsGet('sectis.board') || '[]').filter((c) => c && c.id && (c.t === 'p' || c.t === 'a')); } catch (e) { ui.board = []; }
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
  if (opts.replace) ui.board = [];
  cols.forEach((c) => { if (!onBoard(c.t, c.id)) ui.board.push({ t: c.t, id: c.id }); });
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
  return html + `<div class="board" data-cols="${cols.length}">${cols.map(boardColHTML).join('')}</div>`;
}
function boardColHTML(c) {
  const more = `<button class="ib" data-action="bcol-menu" data-col="${c.t}:${c.id}" aria-label="Column options" title="Column options">${ic('more')}</button>`;
  if (c.t === 'p') {
    const p = getP(c.id), pr = projectProgress(p), open = p.status === 'open';
    const area = p.areaId && getA(p.areaId);
    const sec = `project:${p.id}:`;
    return `<section class="bcol${open ? '' : ' closed'}" data-col="p:${p.id}" data-newsec="${open ? sec : ''}" data-colzone="${open ? sec : ''}">
      <div class="bcol-h" data-col="p:${p.id}">${pieIc(pr.frac, 'bcol-ic')}<div class="bcol-t"><button class="bcol-title" data-nav="project:${p.id}" title="Open ${esc(pTitle(p))}">${esc(pTitle(p))}</button><div class="bcol-sub">${open ? (area ? esc(aTitle(area)) : 'Project') : p.status === 'done' ? 'Completed' : 'Canceled'}</div></div>${pr.open ? `<span class="bcol-count" title="Open to-dos">${pr.open}</span>` : ''}${open ? `<button class="ib" data-action="bcol-add" data-sec="${sec}" aria-label="New to-do in ${esc(pTitle(p))}" title="New to-do">${ic('plus')}</button>` : ''}${more}</div>
      <div class="bcol-body">${boardProjectBody(p)}</div></section>`;
  }
  const a = getA(c.id);
  const todos = S.todos.filter((t) => t.areaId === a.id && !t.projectId && liveTodo(t)).sort(byOrder);
  const projs = S.projects.filter((p) => p.areaId === a.id && liveProject(p) && !onBoard('p', p.id) && (p.status !== 'open' || (p.start === 'anytime' && !(p.when && p.when > T0())))).sort(byOrder);
  const n = todos.filter((t) => t.status === 'open').length + projs.reduce((s, p) => s + projectProgress(p).open, 0);
  const sec = `area:${a.id}`;
  let body = secHTML(sec, todos, { when: true });
  if (projs.length) body += `<div class="sec bcol-projs" data-sec="areaprojects:${a.id}" data-ok="order">${projs.map((p) => projRowHTML(p, { star: true, when: true, expandable: true })).join('')}</div>`;
  if (!todos.length && !projs.length) body += `<div class="bcol-empty">Nothing here yet</div>`;
  return `<section class="bcol" data-col="a:${a.id}" data-newsec="${sec}" data-colzone="${sec}">
    <div class="bcol-h" data-col="a:${a.id}"><span class="ic bcol-ic" style="color:var(--c-area)">${I.area}</span><div class="bcol-t"><button class="bcol-title" data-nav="area:${a.id}" title="Open ${esc(aTitle(a))}">${esc(aTitle(a))}</button><div class="bcol-sub">Area</div></div>${n ? `<span class="bcol-count" title="Open to-dos">${n}</span>` : ''}<button class="ib" data-action="bcol-add" data-sec="${sec}" aria-label="New to-do in ${esc(aTitle(a))}" title="New to-do">${ic('plus')}</button>${more}</div>
    <div class="bcol-body">${body}</div></section>`;
}
function boardProjectBody(p) {
  const todos = S.todos.filter((t) => t.projectId === p.id && !t.trashed && !t.isTemplate && !t.isDraft && (t.status === 'open' || !t.logged));
  const headings = S.headings.filter((h) => h.projectId === p.id && !h.archived).sort(byOrder);
  const ctx = { when: true };
  let html = secHTML(`project:${p.id}:`, todos.filter((t) => !t.headingId || !getH(t.headingId) || getH(t.headingId).archived).sort(byOrder), ctx);
  headings.forEach((h) => {
    html += `<div class="sub-h" data-zone="project:${p.id}:${h.id}">${esc(h.title || 'Untitled heading')}</div>` + secHTML(`project:${p.id}:${h.id}`, todos.filter((t) => t.headingId === h.id).sort(byOrder), ctx);
  });
  if (!todos.length) html += `<div class="bcol-empty">No to-dos yet</div>`;
  return html;
}
function boardColMenu(key, el) {
  const [t, id] = key.split(':');
  const cols = boardCols(), i = cols.findIndex((c) => c.t === t && c.id === id);
  const extra = [
    { header: 'Column' },
    { label: 'Move Left', icon: 'chevL', disabled: i <= 0, fn: () => boardMove(t, id, -1) },
    { label: 'Move Right', icon: 'chevR', disabled: i < 0 || i >= cols.length - 1, fn: () => boardMove(t, id, 1) },
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
  const L = openLayer({ anchor, cls: 'move-pop board-pop', html: `<div class="pk-h">Board Columns</div><input class="pk-in" id="bp-in" placeholder="Find a project or area" autocomplete="off" aria-label="Find a project or area"><div class="pick-list" id="bp-list">${build()}</div><div class="pk-foot note">Click to add or remove. Columns stay in this order; move them from each column’s ••• menu.</div>`,
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
