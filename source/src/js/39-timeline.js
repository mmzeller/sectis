/* ===================== Timeline =====================
   Deadlines laid out across the coming weeks or months, so you can see what's due when and
   where things pile up. Each project with a deadline is a bar from its start (its When date,
   or the day it was made) to its deadline, filled in as its to-dos get done; each to-do with a
   deadline is a flag on its day (a bar when it also has a start date). Grouped by area, then
   project, soonest first. Overdue ones sit at the left edge in red.
   - 2 Weeks, Month or 3 Months, starting this week; ‹ › page through time, Today comes back.
   - ••• → Scheduled To-Dos Too adds to-dos and projects that only have a When date.
   - Drag a flag (or a bar's right end) to change the deadline, a bar's left end to change
     its start, or the bar itself to move both. Click a flag or bar for its dates; click a name
     to open it. Follows the focus and the tag bar, like every other list.
   Zoom and options are each device's own. */
const TL_ZOOM = {
  '2w': { days: 14, step: 7, min: 30, label: '2 Weeks' },
  month: { days: 35, step: 28, min: 13, label: 'Month' },
  quarter: { days: 91, step: 84, min: 6, label: '3 Months' },
};
(function loadTimeline() {
  let t = null; try { t = JSON.parse(lsGet('sectis.timeline') || 'null'); } catch (e) { t = null; }
  ui.tl = Object.assign({ zoom: 'month', when: false, kids: true }, t || {}, { off: 0 });
  if (!TL_ZOOM[ui.tl.zoom]) ui.tl.zoom = 'month';
})();
function saveTimeline() { lsSet('sectis.timeline', JSON.stringify({ zoom: ui.tl.zoom, when: ui.tl.when, kids: ui.tl.kids })); }
function tlRange() {
  const z = TL_ZOOM[ui.tl.zoom], from = addDays(weekStart(T0()), ui.tl.off * z.step);
  return { from, to: addDays(from, z.days - 1), days: z.days, z };
}
const tlSched = (x) => (x.start === 'anytime' && x.when ? x.when : null);

/* ---- what goes on it ---- */
// one item's place in time: a (start) to b (end); null when it has nothing in this range
function tlEntry(x, r) {
  const dl = x.deadline || null, st = tlSched(x);
  let a, b, implicit = false;
  if (dl) {
    if (st && st <= dl) a = st;
    else if (x.type === 'project') { const made = stampDay(x.createdAt || Date.now()); a = made < dl ? made : dl; implicit = a < dl; }
    else a = dl;
    b = dl;
  } else if (ui.tl.when && st) { a = b = st; } else return null;
  const open = x.status === 'open';
  const overdue = !!dl && dl < r.from && open;
  if (!overdue && !(b >= r.from && a <= r.to)) return null;
  return { x, a, b, dl, st, implicit, overdue, late: !!dl && dl < T0() && open };
}
const tlSort = (e, f) => (e.b < f.b ? -1 : e.b > f.b ? 1 : e.a < f.a ? -1 : e.a > f.a ? 1 : byOrder(e.x, f.x));
function timelineData(r, tagged = true) {
  const keep = (x) => !tagged || matchesTagFilter(x);
  const todos = [];
  for (const t of S.todos) { if (!liveTodo(t) || !inLiveProject(t) || !inFocus(t) || !keep(t)) continue; const e = tlEntry(t, r); if (e) todos.push(e); }
  const groups = [];
  [null, ...S.areas.slice().sort(byOrder)].forEach((a) => {
    const aid = a ? a.id : null;
    const own = todos.filter((e) => !e.x.projectId && (e.x.areaId || null) === aid).sort(tlSort);
    const projs = S.projects.filter((p) => liveProject(p) && (p.areaId || null) === aid && inFocus(p)).map((p) => {
      const kids = todos.filter((e) => e.x.projectId === p.id).sort(tlSort);
      const pe = keep(p) ? tlEntry(p, r) : null;
      if (!pe && !kids.length) return null;
      return { p, pe, kids, key: pe ? pe.b : kids[0].b };
    }).filter(Boolean).sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : byOrder(x.p, y.p)));
    if (own.length || projs.length) groups.push({ a, own, projs });
  });
  return groups;
}
function timelineEntries(r, tagged = true) {
  const out = [];
  timelineData(r, tagged).forEach((g) => { out.push(...g.own); g.projs.forEach((pg) => { if (pg.pe) out.push(pg.pe); out.push(...pg.kids); }); });
  return out;
}

/* ---- drawing it ---- */
function tlLayout(r) {
  const content = $('#content'), phone = isMobile();
  let avail = 900;
  if (content) {
    content.classList.add('board-view'); // the timeline uses the full width, like the Board
    const cs = getComputedStyle(content);
    avail = content.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (phone) avail -= 16; // a little room at each edge (see .tl-wrap)
  }
  // on a phone each name sits above its own row, so the days get the whole width
  const lw = phone ? 0 : avail < 560 ? 130 : avail < 900 ? 180 : 240;
  const grid = Math.max(100, avail - lw - 2), min = phone ? Math.round(r.z.min * 0.7) : r.z.min;
  const dw = Math.max(min, Math.floor((grid / r.days) * 100) / 100);
  return { lw, dw, fits: dw * r.days <= grid + 0.5, stack: phone, vw: avail };
}
const tlAt = (n) => `calc(var(--dw) * ${n})`;
function tlColor(x) {
  const own = placeColor(x); if (own) return colorVar(own);
  const p = x.type === 'todo' && x.projectId && getP(x.projectId), a = areaOf(x);
  const c = (p && placeColor(p)) || (a && placeColor(a));
  return c ? colorVar(c) : '';
}
function tlDateText(e) {
  if (e.dl) return e.late ? deadlineInfo(e.dl).text : fmtRel(e.dl);
  return 'Starts ' + fmtRel(e.st);
}
function tlTrackHTML(e, r) {
  const idx = (d) => diffDays(r.from, d), last = r.days - 1;
  const x = e.x, col = tlColor(x), style = col ? `;--tlc:${col}` : '';
  const tip = esc(`${x.title || (x.type === 'project' ? 'New Project' : 'New To-Do')}: ${e.dl ? `deadline ${fmtDate(e.dl)}` : ''}${e.st && (!e.dl || e.st < e.dl) ? `${e.dl ? ', ' : ''}starts ${fmtDate(e.st)}` : ''}${e.implicit ? `, made ${fmtDate(e.a)}` : ''}`);
  if (e.overdue) return `<button class="tl-od" data-tl-item style="left:2px" title="${tip}">${ic('chevL')}<span>${esc(fmtDate(e.dl, { weekday: false }))}</span></button>`;
  const label = (n, cls = '') => (ui.tl.zoom === 'quarter' ? '' : n > last - 3 ? `<span class="tl-dt left ${cls}" style="right:calc(100% - ${tlAt(n)} + 2px)">${esc(tlDateText(e))}</span>` : `<span class="tl-dt ${cls}" style="left:${tlAt(n + 1)}">${esc(tlDateText(e))}</span>`);
  const bi = idx(e.b);
  if (e.a < e.b) {
    const ai = idx(e.a), L = Math.max(0, ai), R = Math.min(last, bi), done = x.type === 'project' ? projectProgress(x).frac : x.status !== 'open' ? 1 : 0;
    const handles = (ai >= 0 && !e.implicit ? '<i class="tl-hd s" data-tl-drag="start" title="Drag to change the start date"></i>' : '') + (bi <= last ? '<i class="tl-hd e" data-tl-drag="end" title="Drag to change the deadline"></i>' : '');
    return `<div class="tl-bar${e.implicit ? ' soft' : ''}${ai < 0 ? ' cut-l' : ''}${bi > last ? ' cut-r' : ''}${e.late ? ' late' : ''}" data-tl-item data-tl-drag="${e.implicit ? 'end' : 'move'}" data-l="${L}" data-w="${R - L + 1}" style="left:${tlAt(L)};width:${tlAt(R - L + 1)}${style}" title="${tip}"><i class="tl-fill" style="width:${Math.round(done * 100)}%"></i>${handles}${bi <= last && e.dl ? `<span class="tl-flag">${I.flag}</span>` : ''}</div>${bi <= last ? label(bi, 'b') : ''}`;
  }
  const kind = e.dl ? 'dl' : 'st';
  return `<button class="tl-mk ${kind}${e.late ? ' late' : ''}${x.status !== 'open' ? ' done' : ''}" data-tl-item data-tl-drag="${e.dl ? 'end' : 'start'}" data-l="${bi}" style="left:${tlAt(bi + 0.5)}${style}" title="${tip}">${e.dl ? I.flag : ''}</button>${label(bi)}`;
}
function tlRowHTML(e, kind, depth) {
  const x = e.x, done = x.status !== 'open';
  const name = x.title || (x.type === 'project' ? 'New Project' : 'New To-Do');
  const icon = x.type === 'project' ? projIc(x, 'tl-ic') : `<button class="tl-cb${done ? ' on' : ''}" data-tl-done="${x.id}" aria-label="${done ? 'Mark as not done' : 'Complete'}" title="${done ? 'Mark as not done' : 'Complete'}">${done ? ic('check') : ''}</button>`;
  return `<div class="tl-row ${kind}${done ? ' done' : ''}" data-tlid="${x.id}"><div class="tl-lab" style="padding-left:${6 + depth * 18}px">${icon}<button class="tl-name" data-tl-open="${x.id}" title="${esc(name)}">${esc(name)}</button></div><div class="tl-track">${e.__track}</div></div>`;
}
function viewTimeline() {
  const r = tlRange(), L = tlLayout(r), groups = timelineData(r), allEntries = timelineEntries(r, false);
  const T = T0(), ws = (S && S.settings.weekStart) || 0, days = Array.from({ length: r.days }, (_, i) => addDays(r.from, i));
  const cy = pd(T).getFullYear();
  // the scale: months above, days (or weeks) below
  let months = '', i0 = 0;
  days.forEach((d, i) => {
    if (i < r.days - 1 && days[i + 1].slice(0, 7) === d.slice(0, 7)) return;
    const dd = pd(d), n = i - i0 + 1;
    months += `<div class="tl-mon" style="left:${tlAt(i0)};width:${tlAt(n)}"><span>${n * L.dw >= 70 ? MONTHS[dd.getMonth()] : MON[dd.getMonth()]}${dd.getFullYear() !== cy && n * L.dw >= 90 ? ' ' + dd.getFullYear() : ''}</span></div>`;
    i0 = i + 1;
  });
  let scale = '', bg = '';
  days.forEach((d, i) => {
    const w = dow(d), we = w === 0 || w === 6, today = d === T;
    if (ui.tl.zoom === 'quarter') { if (w === ws) scale += `<div class="tl-wk${d <= T && T < addDays(d, 7) ? ' now' : ''}" style="left:${tlAt(i)};width:${tlAt(7)}"><span>${pd(d).getDate()}</span></div>`; }
    else scale += `<div class="tl-day${we ? ' we' : ''}${today ? ' today' : ''}" style="left:${tlAt(i)}">${L.dw >= 26 ? `<b>${L.dw >= 44 ? WD[w] : WD[w].slice(0, 2)}</b>` : L.dw >= 18 ? `<b>${WD[w][0]}</b>` : ''}${L.dw >= 18 || w === ws || today ? `<span>${pd(d).getDate()}</span>` : ''}</div>`; // narrow days: numbers at each week's start
    if (we && ui.tl.zoom !== 'quarter') bg += `<i class="tl-we" style="left:${tlAt(i)}"></i>`;
    if (i && w === ws) bg += `<i class="tl-wl${d.slice(8) === '01' ? ' m' : ''}" style="left:${tlAt(i)}"></i>`;
    else if (i && d.slice(8) === '01') bg += `<i class="tl-wl m" style="left:${tlAt(i)}"></i>`;
  });
  const ti = diffDays(r.from, T);
  if (ti >= 0 && ti < r.days) bg += `<i class="tl-now" style="left:${tlAt(ti)}"></i>`;
  // the rows
  let rows = '';
  const row = (e, kind, depth) => { e.__track = tlTrackHTML(e, r); return tlRowHTML(e, kind, depth); };
  const areaCount = groups.filter((g) => g.a).length;
  groups.forEach((g) => {
    if (g.a || areaCount) rows += `<div class="tl-row tl-area"><div class="tl-lab">${g.a ? (placeColor(g.a) ? areaIc(g.a, 'tl-ic') : ic('area', 'tl-ic')) : ic('inbox', 'tl-ic')}<button class="tl-name"${g.a ? ` data-nav="area:${g.a.id}"` : ''}>${esc(g.a ? aTitle(g.a) : 'No Area')}</button></div><div class="tl-track"></div></div>`;
    g.own.forEach((e) => { rows += row(e, 'tl-todo', 0); });
    g.projs.forEach((pg) => {
      const pe = pg.pe || { x: pg.p, a: null, b: null };
      pe.__track = pg.pe ? tlTrackHTML(pg.pe, r) : '';
      rows += `<div class="tl-row tl-proj${pg.p.status !== 'open' ? ' done' : ''}" data-tlid="${pg.p.id}"><div class="tl-lab">${projIc(pg.p, 'tl-ic')}<button class="tl-name" data-tl-open="${pg.p.id}" title="${esc(pTitle(pg.p))}">${esc(pTitle(pg.p))}</button></div><div class="tl-track">${pe.__track}</div></div>`;
      if (ui.tl.kids) pg.kids.forEach((e) => { rows += row(e, 'tl-todo kid', 1); });
    });
  });
  // the header
  const shown = timelineEntries(r), dls = shown.filter((e) => e.dl && e.x.status === 'open' && !e.overdue).length, od = shown.filter((e) => e.overdue).length;
  const sub = `${fmtDate(r.from, { weekday: false })} – ${fmtDate(r.to, { weekday: false })}${dls ? ` · ${plural(dls, 'deadline')}` : ''}${od ? ` · <span class="tl-odn">${od} overdue</span>` : ''}`;
  const zoomSeg = `<div class="seg tl-zoom" role="group" aria-label="Time span">${Object.entries(TL_ZOOM).map(([k, z]) => `<button data-tlzoom="${k}" class="${ui.tl.zoom === k ? 'on' : ''}" aria-pressed="${ui.tl.zoom === k}">${z.label}</button>`).join('')}</div>`;
  const nav = `<div class="tl-nav"><button class="ib" data-tlnav="-1" aria-label="Earlier" title="Earlier">${ic('chevL')}</button><button class="btn tl-today${ui.tl.off ? '' : ' at'}" data-tlnav="0">Today</button><button class="ib" data-tlnav="1" aria-label="Later" title="Later">${ic('chevR')}</button></div>`;
  let html = `<div class="lh tl-lh"><span class="ic lh-ic" style="color:var(--c-timeline)">${I.timeline}</span><h1 class="lh-title">Timeline</h1><button class="ib lh-share" data-action="share-view" aria-label="Share or export" title="Share or export this list">${ic('share')}</button><button class="ib" data-action="view-menu" aria-label="Timeline options" title="Timeline options">${ic('more')}</button></div>`
    + `<div class="lh-sub tl-sub"><span>${sub}</span>${zoomSeg}${nav}</div>` + tagBarHTML(allEntries.map((e) => e.x));
  if (!rows) {
    return html + emptyHTML('timeline', ui.tl.off ? 'Nothing due in these weeks' : 'Nothing due yet', `Give a project or to-do a deadline (select it and press D) and it shows up here, on its day.${ui.tl.when ? '' : ' To see When dates too, choose <b>Scheduled To-Dos Too</b> in the ••• menu.'}`);
  }
  html += `<div class="tl-wrap${L.fits ? ' fits' : ''}" data-hscroll="timeline"><div class="tl ${'z-' + ui.tl.zoom}${L.stack ? ' stack' : ''}" style="--dw:${L.dw}px;--lw:${L.lw}px;--days:${r.days};--vw:${Math.round(L.vw)}px">`
    + `<div class="tl-head"><div class="tl-lab tl-corner"></div><div class="tl-scale"><div class="tl-months">${months}</div><div class="tl-days">${scale}</div></div></div>`
    + `<div class="tl-body"><div class="tl-bg" aria-hidden="true">${bg}</div>${rows}</div></div></div>`;
  return html;
}

/* ---- clicks: zoom, paging, names, checkboxes ---- */
document.addEventListener('click', (e) => {
  if (ui.view.type !== 'timeline' || !e.target.closest) return;
  const z = e.target.closest('#content [data-tlzoom]');
  if (z) { ui.tl.zoom = z.dataset.tlzoom; ui.tl.off = 0; saveTimeline(); render(); return; }
  const n = e.target.closest('#content [data-tlnav]');
  if (n) { const d = +n.dataset.tlnav; ui.tl.off = d ? ui.tl.off + d : 0; render(); return; }
  const o = e.target.closest('#content [data-tl-open]');
  if (o) { const id = o.dataset.tlOpen; if (getP(id)) navigate('project:' + id); else revealTodo(id); return; }
  const c = e.target.closest('#content [data-tl-done]');
  if (c) { toggleComplete([c.dataset.tlDone]); return; }
  // a flag or bar clicked without dragging: its dates. (On the click, not the pointer coming up,
  // so a phone's tap doesn't land on the menu that just opened under the finger.)
  const it = e.target.closest('#content [data-tl-item]');
  if (it && !tlNoClick) tlItemMenu(it.closest('[data-tlid]').dataset.tlid, it);
});
document.addEventListener('contextmenu', (e) => {
  const row = ui.view.type === 'timeline' && e.target.closest && e.target.closest('#content .tl-row[data-tlid]');
  if (!row || layers.length) return;
  e.preventDefault(); tlItemMenu(row.dataset.tlid, { x: e.clientX, y: e.clientY });
});
function tlItemMenu(id, anchor) {
  const x = itemById(id); if (!x) return;
  const isP = x.type === 'project', items = [{ header: x.title || (isP ? 'New Project' : 'New To-Do') }];
  items.push({ label: isP ? 'Open Project' : 'Open To-Do', icon: isP ? 'project' : 'move', fn: () => (isP ? navigate('project:' + id) : revealTodo(id)) });
  items.push({ label: x.deadline ? `Deadline: ${fmtDate(x.deadline)}…` : 'Deadline…', icon: 'flag', hint: 'D', fn: () => openWhen([id], anchor, 'deadline') });
  items.push({ label: tlSched(x) ? `Starts ${fmtDate(tlSched(x))}…` : 'When…', icon: 'calendar', hint: 'S', fn: () => openWhen([id], anchor) });
  if (!isP) items.push({ label: x.status === 'open' ? 'Complete' : 'Mark as Not Done', icon: 'check', fn: () => toggleComplete([id]) });
  if (x.deadline) items.push({ sep: 1 }, { label: 'Remove Deadline', icon: 'x', fn: () => { commit('Remove Deadline', () => { x.deadline = null; touch(x); }); toast('Deadline removed', { undo: true }); } });
  openMenu(anchor, items);
}

/* ---- dragging dates ---- */
let tlDrag = null, tlNoClick = false;
document.addEventListener('pointerdown', (e) => {
  if (ui.view.type !== 'timeline' || (e.pointerType === 'mouse' && e.button !== 0) || layers.length) return;
  const h = e.target.closest && e.target.closest('#content [data-tl-drag]'); if (!h) return;
  const row = h.closest('[data-tlid]'), x = row && itemById(row.dataset.tlid); if (!x) return;
  const el = h.closest('[data-tl-item]') || h, tl = h.closest('.tl');
  e.preventDefault(); e.stopPropagation();
  tlDrag = { mode: h.dataset.tlDrag, x, el, x0: e.clientX, dw: parseFloat(tl.style.getPropertyValue('--dw')) || 20, l: +el.dataset.l || 0, w: +el.dataset.w || 1, dd: 0, moved: false, pid: e.pointerId, tip: null, anchor: el };
  try { h.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const move = (ev) => {
    const d = tlDrag; if (!d || ev.pointerId !== d.pid) return;
    if (!d.moved && Math.abs(ev.clientX - d.x0) < 4) return;
    if (!d.moved) { d.moved = true; document.body.classList.add('tl-dragging'); d.el.classList.add('tl-moving'); d.tip = document.createElement('div'); d.tip.className = 'tl-tip'; document.body.append(d.tip); }
    ev.preventDefault();
    d.dd = Math.round((ev.clientX - d.x0) / d.dw);
    const isBar = d.el.classList.contains('tl-bar');
    if (isBar && d.mode === 'end') d.el.style.width = tlAt(Math.max(1, d.w + d.dd));
    else if (isBar && d.mode === 'start') { const dd = Math.min(d.dd, d.w - 1); d.el.style.left = tlAt(d.l + dd); d.el.style.width = tlAt(d.w - dd); }
    else d.el.style.transform = `translateX(${d.dd * d.dw}px)${isBar ? '' : ' translateX(-50%)'}`;
    const t = tlNewDates(d.x, d.mode, d.dd);
    d.tip.textContent = [t.st && t.st !== tlSched(d.x) ? `Starts ${fmtDate(t.st)}` : '', t.dl && t.dl !== d.x.deadline ? `Deadline ${fmtDate(t.dl)}` : ''].filter(Boolean).join(' · ') || 'No change';
    Object.assign(d.tip.style, { left: ev.clientX + 14 + 'px', top: ev.clientY - 34 + 'px' });
  };
  const up = (ev) => {
    const d = tlDrag; if (!d || ev.pointerId !== d.pid) return;
    h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
    document.body.classList.remove('tl-dragging'); if (d.tip) d.tip.remove();
    tlDrag = null;
    if (ev.type === 'pointercancel') { render(); return; }
    if (!d.moved) return; // a click: the click handler opens its menu
    tlNoClick = true; setTimeout(() => { tlNoClick = false; }, 0);
    if (d.dd) tlApply(d.x, d.mode, d.dd); else render();
  };
  h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
}, true);
function tlNewDates(x, mode, dd) {
  let st = tlSched(x), dl = x.deadline || null;
  if (mode === 'end' && dl) { dl = addDays(dl, dd); if (st && dl < st) dl = st; }
  else if (mode === 'start' && st) { st = addDays(st, dd); if (dl && st > dl) st = dl; }
  else if (mode === 'move') { if (st) st = addDays(st, dd); if (dl) dl = addDays(dl, dd); }
  return { st, dl };
}
function tlApply(x, mode, dd) {
  const n = tlNewDates(x, mode, dd), oldSt = tlSched(x);
  commit(mode === 'end' ? 'Change Deadline' : mode === 'start' ? 'Change Start' : 'Move Dates', () => {
    if (n.dl !== (x.deadline || null)) x.deadline = n.dl;
    if (n.st && n.st !== oldSt) scheduleItems(x, { date: n.st });
    touch(x);
  });
  const what = mode === 'start' ? `Starts ${fmtDate(tlSched(x) || n.st)}` : x.deadline ? `Deadline ${fmtDate(x.deadline)}` : 'Moved';
  toast(mode === 'move' && x.deadline && tlSched(x) ? `${fmtDate(tlSched(x), { weekday: false })} – ${fmtDate(x.deadline, { weekday: false })}` : what, { undo: true });
}

/* keep the days filling the width as the window changes */
let tlW = 0;
if (window.ResizeObserver) {
  try {
    new ResizeObserver(debounce(() => {
      const w = $('#main').clientWidth;
      if (ui.view.type === 'timeline' && Math.abs(w - tlW) > 2 && !tlDrag && !layers.length) { tlW = w; render(); } else tlW = w;
    }, 80)).observe($('#main'));
  } catch (e) { /* the window's resize event still redraws */ }
}

/* Share List… for the Timeline: soonest first, by week */
function timelineExport(B, f) {
  const r = tlRange(); let cur = null;
  timelineEntries(r).filter((e) => f(e.x)).sort(tlSort).forEach((e) => {
    const wk = e.overdue ? 'Overdue' : 'Week of ' + fmtDate(weekStart(e.b < r.from ? r.from : e.b), { weekday: false });
    if (wk !== cur) { cur = wk; B.push({ h: 2, text: wk }); }
    B.push({ item: e.x });
  });
}
