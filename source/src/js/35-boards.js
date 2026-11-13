/* ===================== Several Boards, and lists as columns =====================
   Boards have names (click the title to rename) and each keeps its own columns and sizes; the
   sidebar lists them once there's more than one. Besides projects and areas, a column can be a
   built-in list (Today, Upcoming, Deadlines…), a tag or a smart list. Dropping a to-do on one of
   those does what dropping it on that list in the sidebar does: schedule it, tag it… */
function switchBoard(id) {
  if (!ui.boards.some((b) => b.id === id) || id === ui.boardId) return;
  saveBoard(); ui.boardId = id; ui.board = curBoard().cols; saveBoard();
}
function boardWithName(name) { let n = name, i = 2; while (ui.boards.some((b) => b.name === n)) n = `${name} ${i++}`; return n; }
function newBoard(opts = {}) {
  saveBoard();
  const b = { id: uid(), name: opts.name || boardWithName('New Board'), area: opts.area || null, focus: opts.focus || null, cols: cleanCols(opts.cols || []) };
  ui.boards.push(b); ui.boardId = b.id; ui.board = b.cols; saveBoard();
  if (!opts.name) ui.focusAfter = '[data-fkey="board-name"]';
  navigate('board');
  if (!opts.name) { const t = $('[data-fkey="board-name"]'); if (t) { t.focus(); t.select(); } }
  return b;
}
function duplicateBoard() {
  const b = curBoard();
  newBoard({ name: boardWithName(b.name + ' copy'), area: b.area, focus: b.focus ? b.focus.slice() : null, cols: JSON.parse(JSON.stringify(b.cols)) });
  toast(`Made “${curBoard().name}”`);
}
async function deleteBoard() {
  const b = curBoard(); if (ui.boards.length < 2) return;
  const ok = await confirmDialog({ title: `Delete “${esc(b.name)}”?`, body: 'Only the board goes. Its projects, areas and lists stay as they are.', ok: 'Delete Board', danger: true });
  if (!ok) return;
  const at = ui.boards.indexOf(b);
  ui.boards.splice(at, 1); ui.boardId = ui.boards[Math.max(0, at - 1)].id; ui.board = curBoard().cols; saveBoard(); render();
  toast(`Deleted “${b.name}”`, { action: 'Undo', fn: () => { ui.boards.splice(at, 0, b); ui.boardId = b.id; ui.board = b.cols; saveBoard(); navigate('board'); } });
}
function renameBoardTo(name) { curBoard().name = name; saveBoard(); renderSidebar(); }
/* the name field is as wide as the name, so the switcher sits right after it */
function fitBoardName(el) {
  if (!el) return;
  const s = getComputedStyle(el), c = fitBoardName.c || (fitBoardName.c = document.createElement('canvas').getContext('2d'));
  c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
  el.style.width = Math.ceil(c.measureText(el.value || el.placeholder).width + parseFloat(s.paddingLeft || 0) + parseFloat(s.paddingRight || 0) + 6) + 'px';
}
/* the switcher next to a Board's title (and the same items in its ••• menu) */
function boardsMenuItems() {
  const shown = ui.boards.filter((b) => boardInFocus(b)), outside = ui.boards.filter((b) => !boardInFocus(b));
  const go = (b, all) => ({ label: b.name || 'Board', icon: b.id === ui.boardId ? 'check' : 'columns', fn: () => { if (all) showAllAreas(); switchBoard(b.id); navigate('board'); } });
  return [
    ...(ui.boards.length > 1 ? [{ header: 'Boards' }, ...shown.map((b) => go(b, false)),
      ...(outside.length ? [{ header: `Outside ${focusTitle(ui.focusRec)}` }, ...outside.map((b) => go(b, true))] : []), { sep: 1 }] : []),
    { label: 'New Board', icon: 'plus', fn: () => newBoard() },
    { label: 'Rename Board', icon: 'pencil', fn: () => { const t = $('[data-fkey="board-name"]'); if (t) { t.focus(); t.select(); } } },
    { label: 'Duplicate Board', icon: 'copy', fn: duplicateBoard },
    { label: 'Delete Board…', icon: 'trash', danger: true, disabled: ui.boards.length < 2, fn: deleteBoard },
  ];
}
/* add or take a column off a board other than the one on screen */
function onBoardOf(b, t, id) { return b.cols.some((c) => c.t === t && c.id === id); }
function toggleOnBoardOf(b, t, id) {
  if (b.id === ui.boardId) { boardToggle(t, id); return; }
  if (onBoardOf(b, t, id)) b.cols = b.cols.filter((c) => !(c.t === t && c.id === id));
  else b.cols.push({ t, id, l: b.cols.reduce((m, c) => Math.max(m, c.l + 1), 0) });
  saveBoard(); render();
  toast(`${onBoardOf(b, t, id) ? 'Added to' : 'Removed from'} “${b.name}”`, { action: 'Show', fn: () => { switchBoard(b.id); navigate('board'); } });
}
function addToBoardOf(b, cols) {
  if (b.id === ui.boardId) { boardAdd(cols, { toast: `Added to “${b.name}”` }); return; }
  cols.forEach((c) => { if (!onBoardOf(b, c.t, c.id)) b.cols.push({ t: c.t, id: c.id, l: b.cols.reduce((m, x) => Math.max(m, x.l + 1), 0) }); });
  saveBoard(); render();
  toast(`Added to “${b.name}”`, { action: 'Show', fn: () => { switchBoard(b.id); navigate('board'); } });
}

/* ---- built-in lists, tags and smart lists as columns ---- */
const colIcon = (c) => (c.t === 'l' ? `<span class="ic bcol-ic" style="color:${LISTS[c.id].color}">${I[LISTS[c.id].icon]}</span>`
  : c.t === 't' ? `<span class="ic bcol-ic ${tcls(getTag(c.id))}" style="color:var(--tc)">${I.tag}</span>` : `<span class="ic bcol-ic" style="color:var(--c-smart)">${I.funnel}</span>`);
/* what a column holds, for counts, reports and "is this to-do on screen" */
function colHas(c, x) {
  switch (c.t) {
    case 'p': return x.projectId === c.id || x.id === c.id;
    case 'a': return (areaOf(x) || {}).id === c.id;
    case 't': return x.type === 'todo' && effectiveTags(x).has(c.id);
    case 's': { const sl = getSmart(c.id); return !!sl && x.type === 'todo' && smartMatcher(sl)(x); }
    default: switch (c.id) {
      case 'inbox': return x.type === 'todo' && isInbox(x);
      case 'today': return isTodayItem(x);
      case 'upcoming': return x.start === 'anytime' && !!x.when && x.when > T0();
      case 'anytime': return x.type === 'todo' && anytimeTodo(x);
      case 'someday': return x.type === 'todo' ? somedayTodo(x) : x.start === 'someday';
      case 'waiting': return x.type === 'todo' && isWaiting(x);
      case 'deadlines': return !!x.deadline;
      default: return false;
    }
  }
}
/* the column's body and how it takes drops: a real section (Inbox, Today) where to-dos can be
   arranged, or a whole-column drop that works like dropping on the list in the sidebar */
function listColBody(c) {
  const live = (t) => liveTodo(t) && inLiveProject(t) && inFocus(t);
  const sub = (label) => `<div class="sub-h">${esc(label)}</div>`;
  const view = (list, ctx = { parent: true, when: true }) => secHTML('colview:' + c.t + ':' + c.id, list, ctx);
  if (c.t === 't') {
    const want = tagDescendants(c.id), has = (x) => { for (const t of effectiveTags(x)) if (want.has(t)) return true; return false; };
    const todos = S.todos.filter((t) => live(t) && has(t)), T = T0();
    const groups = [['Today', todos.filter(isTodayItem).sort(byToday)], ['Upcoming', todos.filter((t) => t.start === 'anytime' && t.when && t.when > T).sort((a, b) => (a.when < b.when ? -1 : 1))],
      ['Anytime', todos.filter((t) => t.start === 'anytime' && !t.when && !isTodayItem(t)).sort(byOrder)], ['Inbox', todos.filter((t) => isInbox(t) && !isTodayItem(t)).sort(byOrder)],
      ['Someday', todos.filter((t) => t.start === 'someday' && !isTodayItem(t)).sort(byOrder)]].filter((g) => g[1].length);
    return { open: todos.filter((t) => t.status === 'open').length, drop: 'tag:' + c.id, html: groups.map(([l, list]) => sub(l) + view(list)).join('') };
  }
  if (c.t === 's') {
    const sl = getSmart(c.id), items = smartItems(sl);
    return { open: items.filter((t) => t.status === 'open').length, drop: '', html: smartGroups(sl, items).map((g) => g.head.replace('grp-h', 'grp-h bcol-grp') + view(g.items, g.ctx)).join('') };
  }
  switch (c.id) {
    case 'inbox': { const items = inboxItems().sort(byOrder); return { open: items.filter((t) => t.status === 'open').length, sec: 'inbox', html: secHTML('inbox', items, {}) }; }
    case 'today': {
      const items = todayItems().sort(byToday), main = items.filter((x) => !isEveningItem(x)), eve = items.filter(isEveningItem);
      return { open: items.filter((x) => x.status === 'open').length, sec: 'today', html: secHTML('today', main, { parent: true }, 'todayOrder') + (eve.length ? `<div class="sub-h" data-zone="evening">${ic('moon')} This Evening</div>` + secHTML('evening', eve, { parent: true }, 'todayOrder') : '') };
    }
    case 'upcoming': {
      const items = upcomingItems().sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : byToday(a, b))), days = [...new Set(items.map((x) => x.when))];
      return { open: items.filter((x) => x.status === 'open').length, drop: 'upcoming', html: days.map((d) => `<div class="sub-h" data-zone="upcoming:${d}">${esc(fmtDate(d))}</div>` + secHTML('upcoming:' + d, items.filter((x) => x.when === d), { parent: true }, 'todayOrder')).join('') };
    }
    case 'anytime': case 'someday': {
      const items = S.todos.filter(c.id === 'anytime' ? anytimeTodo : somedayTodo).sort(byOrder);
      return { open: items.filter((t) => t.status === 'open').length, drop: c.id, html: view(items, { parent: true, star: true }) };
    }
    case 'waiting': {
      const items = waitingItems(), g = new Map();
      items.forEach((t) => { const k = t.waitFor.trim(); if (!g.has(k.toLowerCase())) g.set(k.toLowerCase(), { name: k, list: [] }); g.get(k.toLowerCase()).list.push(t); });
      return { open: items.filter((t) => t.status === 'open').length, drop: 'waiting', html: [...g.values()].sort((a, b) => a.name.localeCompare(b.name)).map((x) => sub(x.name) + view(x.list.sort(byOrder), { parent: true, when: true, noWait: true })).join('') };
    }
    default: { // deadlines
      const items = deadlineItems();
      return { open: items.filter((x) => x.status === 'open').length, drop: 'deadlines', html: deadlineGroups(items).map((g) => `<div class="sub-h${g.key === 'overdue' ? ' overdue' : ''}">${esc(g.label)}</div>` + secHTML('deadlines', g.items, { parent: true, when: true })).join('') };
    }
  }
}
function listColHTML(c) {
  const key = colKey(c), body = listColBody(c);
  const nav = c.t === 'l' ? c.id : c.t === 't' ? 'tag:' + c.id : 'smart:' + c.id;
  const sub = c.t === 'l' ? 'List' : c.t === 't' ? 'Tag' : esc(smartSummary(getSmart(c.id)));
  const canAdd = c.t !== 'l' || !['upcoming', 'waiting'].includes(c.id);
  const sized = c.h ? ' sized-h' : '';
  return `<section class="bcol lcol${sized}" data-col="${key}" data-newsec="${body.sec || ''}" data-colzone="${body.sec || ''}"${body.drop ? ` data-coldrop="${body.drop}"` : ''}${colHStyle(c.h)}>${gripHTML}
    <div class="bcol-h" data-col="${key}">${colIcon(c)}<div class="bcol-t"><button class="bcol-title" data-nav="${nav}" title="Open ${esc(colName(c.t, c.id))}">${esc(colName(c.t, c.id))}</button><div class="bcol-sub">${sub}</div></div>${body.open ? `<span class="bcol-count" title="Open to-dos">${body.open}</span>` : ''}${canAdd ? `<button class="ib" data-action="lcol-add" data-col="${key}" aria-label="New to-do" title="New to-do">${ic('plus')}</button>` : ''}<button class="ib" data-action="bcol-menu" data-col="${key}" aria-label="Column options" title="Column options">${ic('more')}</button></div>
    <div class="bcol-body"${c.h ? ` data-vscroll="${key}"` : ''}>${body.html || `<div class="bcol-empty">${c.t === 's' ? 'Nothing matches right now' : 'Nothing here'}</div>`}</div>${resizeHandlesHTML(key)}</section>`;
}
/* the + on a list, tag or smart-list column: a new to-do that belongs there */
function listColAdd(key) {
  const [t, id] = key.split(':');
  if (t === 'l') {
    if (id === 'inbox' || id === 'today') { newTodo({ sec: id }); return; }
    if (id === 'anytime' || id === 'someday') { newTodo({ sec: id + ':loose' }); return; }
    if (id === 'deadlines') { const n = newTodo({ sec: 'inbox' }); if (n) { n.deadline = T0(); focusAdopt(n); saveSoon(); render(); } return; }
    return;
  }
  const n = newTodo({ sec: 'inbox' }); if (!n) return;
  if (t === 't') { if (!n.tags.includes(id)) n.tags = n.tags.concat(id); }
  else Object.assign(n, smartNewProps(getSmart(id)));
  focusAdopt(n);
  touch(n); saveSoon(); render();
}
/* a new to-do made in a smart list (or its column) starts out fitting it, where it can */
function smartNewProps(sl) {
  const f = smartFilter(sl), out = {}, T = T0();
  const tags = f.tags.filter(getTag); if (tags.length) out.tags = f.tagMode === 'all' ? tags : [tags[0]];
  const places = f.places.filter((k) => (k[0] === 'p' ? getP(k.slice(2)) : getA(k.slice(2))));
  if (places.length === 1) { const [k, pid] = [places[0][0], places[0].slice(2)]; if (k === 'p') Object.assign(out, { projectId: pid, areaId: null, start: 'anytime' }); else Object.assign(out, { areaId: pid, projectId: null, start: 'anytime' }); }
  if (f.when === 'today' || f.when === 'week' || f.when === 'dated') Object.assign(out, { start: 'anytime', when: T });
  if (f.when === 'someday') out.start = 'someday';
  if (['has', 'overdue', 'week', 'month'].includes(f.deadline)) out.deadline = T;
  if (+f.priority) out.priority = +f.priority;
  return out;
}

/* ---- Boards and the focus ----
   A Board shows under a focus when what's on it belongs there: the areas of its area and project
   columns (a project outside any area counts as No Area, shown when the focus shows to-dos
   outside any area), and an area's own Board (Open as Board) goes with its area. So a Work Board
   shows in the Work focus and not in Home; one with both shows in both. A Board of only lists,
   tags and smart lists belongs to no area, so it shows under every focus. ••• → Show in Focus
   picks the focuses by hand instead (Automatically goes back). Like the Boards themselves, that
   choice is this device's own. Switching to a focus that hides the Board on screen switches to
   one it shows; the switcher lists the hidden ones under Outside …, and opening one of those goes
   back to All Areas. */
function boardAreaKeys(b) { // the areas its columns come from ('' = No Area); null when none do
  const keys = new Set();
  if (b.area && getA(b.area)) keys.add(b.area);
  for (const c of b.cols || []) {
    if (c.t === 'a') { if (getA(c.id)) keys.add(c.id); }
    else if (c.t === 'p') {
      const p = getP(c.id);
      if (p && !p.trashed && !p.isTemplate && !(p.status !== 'open' && p.logged)) { const a = areaOf(p); keys.add(a ? a.id : ''); }
    }
  }
  return keys.size ? keys : null;
}
function boardFocusAuto(b, f) {
  const keys = boardAreaKeys(b);
  if (!keys) return true;
  for (const k of keys) if (k ? f.areas.includes(k) : f.loose !== false) return true;
  return false;
}
function boardInFocus(b, f = ui.focusRec) {
  if (!f || !b) return true;
  return Array.isArray(b.focus) ? b.focus.includes(f.id) : boardFocusAuto(b, f);
}
/* the Board on screen isn't one this focus shows: switch to one it does (if there is one) */
function keepBoardInFocus() {
  if (!ui.boards || !ui.boards.length || !ui.focusRec || boardInFocus(curBoard())) return;
  const b = ui.boards.find((x) => boardInFocus(x));
  if (b) switchBoard(b.id);
}
/* ••• → Show in Focus: Automatically, or the focuses ticked by hand */
function boardFocusMenu(at) {
  const b = curBoard(), fs = (S.focuses || []).slice().sort(byOrder);
  if (!fs.length) return;
  const auto = !Array.isArray(b.focus);
  const set = (list) => { b.focus = list; saveBoard(); render(); const names = fs.filter((f) => boardInFocus(b, f)).map(focusTitle); toast(list === null ? `“${b.name}” follows its columns: ${names.length ? names.join(', ') : 'no focus'}` : names.length ? `“${b.name}” shows in ${names.join(', ')}` : `“${b.name}” shows only in All Areas`); };
  openMenu(at, [
    { header: `Show “${b.name || 'Board'}” in` },
    { label: 'Automatically', hint: 'by its columns', icon: auto ? 'check' : 'blank', fn: () => set(null) },
    { sep: 1 },
    ...fs.map((f) => {
      const on = boardInFocus(b, f);
      return { label: focusTitle(f), icon: on ? 'check' : 'blank', fn: () => {
        const cur = auto ? fs.filter((x) => boardInFocus(b, x)).map((x) => x.id) : b.focus.slice();
        set(on ? cur.filter((id) => id !== f.id) : cur.concat(f.id));
      } };
    }),
  ]);
}
