/* ===================== Timeline =====================
   Deadlines laid out across the coming weeks or months, so you can see what's due when and
   where things pile up. Each project with a deadline is a bar from its start (its When date,
   or the day it was made) to its deadline, filled in as its to-dos get done; each to-do with a
   deadline is a flag on its day (a bar when it also has a start date). Grouped by area, then
   project, soonest first. Overdue ones sit at the left edge in red.
   - 2 Weeks, Month, 3 Months or Custom; ‹ › page through time, Today comes back to this week.
   - ••• → Scheduled To-Dos Too adds to-dos and projects that only have a When date.
   - Drag a flag (or a bar's right end) to change the deadline, a bar's left end to change
     its start, or the bar itself to move both. Click a flag or bar for its dates; click a name
     to open it. Follows the focus and the tag bar (one tag or several), like every other list.
   - Each flag or bar has its name beside it (••• → Names Beside Flags turns that off).
   - The Due row under the dates shows how much is due each day (each week at 3 Months), darker
     as it piles up; click one for what's due then.
   - ▸ beside an area or project folds it to one line: a dot for each deadline and how many
     (⌥-click folds or unfolds them all; ••• → Fold All / Unfold All too).
   - Click an empty day on a row for that day: a new to-do due then (in that project, area or
     list, through Quick Entry), or that to-do's or project's deadline moved there.
   - Whichever span is showing, its start and end are buttons (click for a calendar, or type a
     date), and the slider beside them stretches or shrinks it live. A new start keeps the span
     (and stays when you switch spans); a new length that isn't 2 Weeks, a Month or 3 Months is
     Custom, any span from a week to a year. Long spans (over nine weeks) go by the week.
   Zoom, options and what's folded are each device's own. */
const TL_MIN = 7, TL_MAX = 366; // a custom span: a week to a year
const TL_ZOOM = {
  '2w': { days: 14, step: 7, min: 30, label: '2 Weeks' },
  month: { days: 35, step: 28, min: 13, label: 'Month' },
  quarter: { days: 91, step: 84, min: 6, label: '3 Months' },
};
(function loadTimeline() {
  let t = null; try { t = JSON.parse(lsGet('sectis.timeline') || 'null'); } catch (e) { t = null; }
  ui.tl = Object.assign({ zoom: 'month', when: false, kids: true, names: true }, t || {}, { off: 0 });
  ui.tl.fold = new Set(Array.isArray(ui.tl.fold) ? ui.tl.fold : []);
  ui.tl.cdays = clamp(+ui.tl.cdays || 56, TL_MIN, TL_MAX);
  if (!TL_ZOOM[ui.tl.zoom] && ui.tl.zoom !== 'custom') ui.tl.zoom = 'month';
  // a start you chose that leaves the whole span in the past goes back to this week
  if (ui.tl.cfrom && (!/^\d{4}-\d\d-\d\d$/.test(ui.tl.cfrom) || addDays(ui.tl.cfrom, tlZoom().days - 1) < T0())) ui.tl.cfrom = null;
})();
function saveTimeline() { lsSet('sectis.timeline', JSON.stringify({ zoom: ui.tl.zoom, when: ui.tl.when, kids: ui.tl.kids, names: ui.tl.names, fold: [...ui.tl.fold], cdays: ui.tl.cdays, cfrom: ui.tl.cfrom || null, cused: !!ui.tl.cused })); }
/* the span shown: one of the three, or Custom (any number of days from a week to a year), from
   the day you chose (ui.tl.cfrom, for every span) or this week. A custom one pages by about three
   quarters of itself */
function tlZoom() {
  if (ui.tl.zoom !== 'custom') return TL_ZOOM[ui.tl.zoom];
  const days = clamp(Math.round(ui.tl.cdays) || 56, TL_MIN, TL_MAX);
  return { days, step: Math.max(7, Math.round((days * 0.75) / 7) * 7), min: clamp(Math.round(420 / days), 2, 30), label: 'Custom' };
}
function tlRange() {
  const z = tlZoom(), base = ui.tl.cfrom || weekStart(T0()), from = addDays(base, ui.tl.off * z.step);
  return { from, to: addDays(from, z.days - 1), days: z.days, z };
}
/* long spans go by the week: week columns, a week to each cell of the Due row, no date labels */
const tlWeekly = (r = tlRange()) => r.days > 63;
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
    // each project in date order, with its sub-projects right after it (also in date order)
    const group = (p) => {
      const kids = todos.filter((e) => e.x.projectId === p.id).sort(tlSort);
      const pe = keep(p) ? tlEntry(p, r) : null;
      const subs = childProjects(p).filter(liveProject).map(group).filter(Boolean);
      if (!pe && !kids.length && !subs.length) return null;
      const key = pe ? pe.b : kids.length ? kids[0].b : subs[0].key;
      return { p, pe, kids, key, subs, label: isSub(p) ? projPath(p) : pTitle(p) };
    };
    const order = (list) => list.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : byOrder(x.p, y.p)));
    const flat = (list) => [].concat(...order(list).map((g) => [g, ...flat(g.subs)]));
    const projs = flat(S.projects.filter((p) => liveProject(p) && inArea(p, aid) && inFocus(p)).map(group).filter(Boolean)).filter((g) => g.pe || g.kids.length);
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
  return ''; // a start date: the days above already say which day it is
}
const tlName = (x) => x.title || (x.type === 'project' ? 'New Project' : 'New To-Do');
const tlShort = (s, n = 34) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
let tlCtx = null;
function tlTextW(s) {
  if (!tlCtx) tlCtx = document.createElement('canvas').getContext('2d');
  tlCtx.font = `11.5px ${getComputedStyle(document.body).fontFamily}`;
  return Math.ceil(tlCtx.measureText(s).width);
}
/* where an entry sits on its track, in pixels */
function tlSpan(e, r, L) {
  const dw = L.dw, last = r.days - 1, idx = (d) => diffDays(r.from, d), half = L.stack ? 11 : 9;
  if (e.overdue) return { x1: 2, x2: 2 + tlTextW(fmtDate(e.dl, { weekday: false })) + 26 };
  if (e.a < e.b) return { x1: Math.max(0, idx(e.a)) * dw, x2: (Math.min(last, idx(e.b)) + 1) * dw };
  const c = (idx(e.b) + 0.5) * dw; return { x1: c - half, x2: c + half };
}
/* a label beside something running x1..x2 on a track W wide: after it if there's room, else
   before it, else (a bar long enough to hold it) inside it, else after it cut short. lo..hi is
   the room the two take up */
function tlLabel(text, x1, x2, W, cls = '', bar = false, ind = 0) {
  if (!text) return { html: '', lo: x1, hi: x2 };
  const w = tlTextW(text), at = (x, extra = '') => `<span class="tl-dt tl-nm${cls ? ' ' + cls : ''}" style="left:${Math.round(x)}px${extra}">${esc(text)}</span>`;
  // indented (a level down on a Board's Timeline): a hairline joins the name to its marker
  if (ind && x2 + 5 + ind + w <= W) return { html: `<i class="tl-ind" style="left:${Math.round(x2 + 1)}px;width:${ind + 2}px"></i>` + at(x2 + 5 + ind), lo: x1, hi: x2 + 5 + ind + w };
  if (x2 + 5 + w <= W) return { html: at(x2 + 5), lo: x1, hi: x2 + 5 + w };
  if (x1 - 5 - w >= 0) return { html: at(x1 - 5 - w), lo: x1 - 5 - w, hi: x2 };
  // a bar running past both edges (a long project, say) is named inside, from its left end
  if (bar && x2 - x1 >= 60) return { html: at(x1 + 6, `;max-width:${Math.floor(x2 - x1 - 12)}px`).replace('tl-nm', 'tl-nm in'), lo: x1, hi: x2 };
  const room = Math.floor(W - x2 - 5);
  return room < 40 ? { html: '', lo: x1, hi: x2 } : { html: at(x2 + 5, `;max-width:${room}px`).replace('tl-nm', 'tl-nm cut'), lo: x1, hi: W };
}
/* an entry with its name (and, but at 3 Months, its date) beside it */
function tlNamedHTML(e, r, L, nameIt = true) {
  const sp = tlSpan(e, r, L), date = tlWeekly() ? '' : tlDateText(e);
  const text = nameIt ? tlShort(tlName(e.x)) + (date ? ` · ${date}` : '') : date;
  const lab = tlLabel(text, sp.x1, sp.x2, L.dw * r.days, `${nameIt ? 'nm' : ''}${e.x.status !== 'open' ? ' done' : ''}${e.late ? ' late' : ''}`, e.a < e.b && !e.overdue);
  return { html: tlTrackHTML(e, r, { nolabel: true }) + lab.html, lo: lab.lo, hi: lab.hi };
}
/* a folded area, project or row: a dot on each deadline, a line from the first to the last, and how many */
function tlTicksHTML(list, r, L, noun) {
  const W = L.dw * r.days, idx = (d) => diffDays(r.from, d);
  const pts = list.map((e) => ({ e, x: e.overdue ? 6 : (Math.max(0, Math.min(r.days - 1, idx(e.b))) + 0.5) * L.dw }));
  if (!pts.length) return '';
  const lo = Math.min(...pts.map((p) => p.x)), hi = Math.max(...pts.map((p) => p.x));
  const dots = pts.map(({ e, x }) => { const col = tlColor(e.x); return `<i class="tl-tick${e.late ? ' late' : ''}${e.x.status !== 'open' ? ' done' : ''}" style="left:${Math.round(x)}px${col ? `;--tlc:${col}` : ''}"></i>`; }).join('');
  const lab = tlLabel(plural(list.length, noun), lo - 4, hi + 4, W, 'cnt');
  return `<i class="tl-tline" style="left:${Math.round(lo)}px;width:${Math.round(hi - lo)}px"></i>${dots}${lab.html}`;
}
/* the ▸ that folds a row (a blank of the same size where there's nothing to fold) */
function tlFoldHTML(key, name, can = true) {
  if (!can) return '<span class="tl-fold-sp"></span>';
  const f = ui.tl.fold.has(key);
  return `<button class="tl-fold${f ? '' : ' open'}" data-tlfold="${esc(key)}" aria-expanded="${!f}" aria-label="${f ? 'Unfold' : 'Fold'} ${esc(name)}" title="${f ? 'Unfold' : 'Fold'} (⌥-click for all)">${ic('chevR')}</button>`;
}
/* the Due row: how much is due each day (each week at 3 Months), darker as it piles up */
let tlBusyIds = new Map();
function tlBusyHTML(entries, r, L) {
  const q = tlWeekly(r), ids = new Map();
  entries.forEach((e) => {
    if (e.x.status !== 'open' || e.overdue) return;
    const d = e.dl || e.st; if (!d || d < r.from || d > r.to) return;
    const k = q ? weekStart(d) : d; if (!ids.has(k)) ids.set(k, []); ids.get(k).push(e.x.id);
  });
  tlBusyIds = ids;
  const steps = q ? [1, 4, 7, 11] : [1, 2, 3, 5];
  let cells = '';
  ids.forEach((list, k) => {
    const n = list.length, lvl = steps.filter((m) => n >= m).length, i = Math.max(0, diffDays(r.from, k)), w = q ? Math.min(7, r.days - i) : 1;
    const what = `${plural(n, 'thing')} due ${q ? `the week of ${fmtDate(k, { weekday: false })}` : fmtDate(k)}`;
    cells += `<button class="tl-bz l${lvl}" data-tlbusy="${k}" style="left:${tlAt(i)};width:${tlAt(w)}" title="${esc(what)}" aria-label="${esc(what)}">${w * L.dw >= 15 ? n : ''}</button>`;
  });
  return `<div class="tl-busy" aria-label="How much is due">${cells}</div>`;
}
const tlHeadHTML = (months, scale, busy) => `<div class="tl-head"><div class="tl-lab tl-corner"><span class="tl-busy-l">Due</span></div><div class="tl-scale bz"><div class="tl-months">${months}</div><div class="tl-days">${scale}</div>${busy}</div></div>`;
function tlTrackHTML(e, r, opts = {}) {
  const idx = (d) => diffDays(r.from, d), last = r.days - 1;
  const x = e.x, col = tlColor(x), style = col ? `;--tlc:${col}` : '';
  const tip = esc(`${x.title || (x.type === 'project' ? 'New Project' : 'New To-Do')}: ${e.dl ? `deadline ${fmtDate(e.dl)}` : ''}${e.st && (!e.dl || e.st < e.dl) ? `${e.dl ? ', ' : ''}starts ${fmtDate(e.st)}` : ''}${e.implicit ? `, made ${fmtDate(e.a)}` : ''}`);
  if (e.overdue) return `<button class="tl-od" data-tl-item data-tlid="${x.id}" style="left:2px" title="${tip}">${ic('chevL')}<span>${esc(fmtDate(e.dl, { weekday: false }))}</span></button>`;
  const label = (n, cls = '') => (tlWeekly(r) || opts.nolabel || !tlDateText(e) ? '' : n > last - 3 ? `<span class="tl-dt left ${cls}" style="right:calc(100% - ${tlAt(n)} + 2px)">${esc(tlDateText(e))}</span>` : `<span class="tl-dt ${cls}" style="left:${tlAt(n + 1)}">${esc(tlDateText(e))}</span>`);
  const bi = idx(e.b);
  if (e.a < e.b) {
    const ai = idx(e.a), L = Math.max(0, ai), R = Math.min(last, bi), done = x.type === 'project' ? projectProgress(x).frac : x.status !== 'open' ? 1 : 0;
    const handles = (ai >= 0 && !e.implicit ? '<i class="tl-hd s" data-tl-drag="start" title="Drag to change the start date"></i>' : '') + (bi <= last ? '<i class="tl-hd e" data-tl-drag="end" title="Drag to change the deadline"></i>' : '');
    return `<div data-tlid="${x.id}" class="tl-bar${e.implicit ? ' soft' : ''}${ai < 0 ? ' cut-l' : ''}${bi > last ? ' cut-r' : ''}${e.late ? ' late' : ''}" data-tl-item data-tl-drag="${e.implicit ? 'end' : 'move'}" data-l="${L}" data-w="${R - L + 1}" style="left:${tlAt(L)};width:${tlAt(R - L + 1)}${style}" title="${tip}"><i class="tl-fill" style="width:${Math.round(done * 100)}%"></i>${handles}${bi <= last && e.dl ? `<span class="tl-flag">${I.flag}</span>` : ''}</div>${bi <= last ? label(bi, 'b') : ''}`;
  }
  const kind = e.dl ? 'dl' : 'st';
  return `<button data-tlid="${x.id}" class="tl-mk ${kind}${e.late ? ' late' : ''}${x.status !== 'open' ? ' done' : ''}" data-tl-item data-tl-drag="${e.dl ? 'end' : 'start'}" data-l="${bi}" style="left:${tlAt(bi + 0.5)}${style}" title="${tip}">${e.dl ? I.flag : ''}</button>${label(bi)}`;
}
function tlRowHTML(e, kind, depth) {
  const x = e.x, done = x.status !== 'open';
  const name = tlName(x);
  const icon = x.type === 'project' ? projIc(x, 'tl-ic') : `<button class="tl-cb${done ? ' on' : ''}" data-tl-done="${x.id}" aria-label="${done ? 'Mark as not done' : 'Complete'}" title="${done ? 'Mark as not done' : 'Complete'}">${done ? ic('check') : ''}</button>`;
  return `<div class="tl-row ${kind}${done ? ' done' : ''}" data-tlid="${x.id}"><div class="tl-lab" style="padding-left:${22 + depth * 18}px">${icon}<button class="tl-name" data-tl-open="${x.id}" title="${esc(name)}">${esc(name)}</button></div><div class="tl-track">${e.__track}</div></div>`;
}
function viewTimeline() {
  const r = tlRange(), L = tlLayout(r), groups = timelineData(r), allEntries = timelineEntries(r, false);
  const T = T0(), ws = (S && S.settings.weekStart) || 0, days = Array.from({ length: r.days }, (_, i) => addDays(r.from, i));
  const cy = pd(T).getFullYear(), weekly = tlWeekly(r), every = Math.max(1, Math.ceil(24 / (7 * L.dw))); // (a week's number on every week that has room for it)
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
    if (weekly) { if (w === ws) { const wi = Math.floor(i / 7); scale += `<div class="tl-wk${d <= T && T < addDays(d, 7) ? ' now' : ''}" style="left:${tlAt(i)};width:${tlAt(7)}">${wi % every === 0 ? `<span>${pd(d).getDate()}</span>` : ''}</div>`; } }
    else scale += `<div class="tl-day${we ? ' we' : ''}${today ? ' today' : ''}" style="left:${tlAt(i)}">${L.dw >= 26 ? `<b>${L.dw >= 44 ? WD[w] : WD[w].slice(0, 2)}</b>` : L.dw >= 18 ? `<b>${WD[w][0]}</b>` : ''}${L.dw >= 18 || w === ws || today ? `<span>${pd(d).getDate()}</span>` : ''}</div>`; // narrow days: numbers at each week's start
    if (we && !weekly) bg += `<i class="tl-we" style="left:${tlAt(i)}"></i>`;
    if (i && w === ws) bg += `<i class="tl-wl${d.slice(8) === '01' ? ' m' : ''}" style="left:${tlAt(i)}"></i>`;
    else if (i && d.slice(8) === '01') bg += `<i class="tl-wl m" style="left:${tlAt(i)}"></i>`;
  });
  const ti = diffDays(r.from, T);
  if (ti >= 0 && ti < r.days) bg += `<i class="tl-now" style="left:${tlAt(ti)}"></i>`;
  // the rows
  let rows = '';
  const track = (e) => (ui.tl.names && !L.stack ? tlNamedHTML(e, r, L).html : tlTrackHTML(e, r)); // on iPhone each name is right above its row
  const row = (e, kind, depth) => { e.__track = track(e); return tlRowHTML(e, kind, depth); };
  const areaCount = groups.filter((g) => g.a).length;
  groups.forEach((g) => {
    const ak = 'a:' + (g.a ? g.a.id : '-'), aName = g.a ? aTitle(g.a) : 'No Area', aFold = !!(g.a || areaCount) && ui.tl.fold.has(ak);
    const inGroup = () => g.own.concat(...g.projs.map((pg) => (pg.pe ? [pg.pe] : []).concat(ui.tl.kids ? pg.kids : [])));
    if (g.a || areaCount) rows += `<div class="tl-row tl-area${aFold ? ' folded' : ''}" data-tlnew="a:${g.a ? g.a.id : ''}"><div class="tl-lab">${tlFoldHTML(ak, aName)}${g.a ? (placeColor(g.a) ? areaIc(g.a, 'tl-ic') : ic('area', 'tl-ic')) : ic('inbox', 'tl-ic')}<button class="tl-name"${g.a ? ` data-nav="area:${g.a.id}"` : ''}>${esc(aName)}</button></div><div class="tl-track">${aFold ? tlTicksHTML(inGroup(), r, L, 'thing') : ''}</div></div>`;
    if (aFold) return;
    g.own.forEach((e) => { rows += row(e, 'tl-todo', 0); });
    g.projs.forEach((pg) => {
      const pk = 'p:' + pg.p.id, canFold = ui.tl.kids && pg.kids.length > 0, pFold = canFold && ui.tl.fold.has(pk);
      const t = (pg.pe ? track(pg.pe) : '') + (pFold ? tlTicksHTML(pg.kids, r, L, 'to-do') : '');
      rows += `<div class="tl-row tl-proj${pg.p.status !== 'open' ? ' done' : ''}${pFold ? ' folded' : ''}" data-tlid="${pg.p.id}"><div class="tl-lab">${tlFoldHTML(pk, pg.label, canFold)}${projIc(pg.p, 'tl-ic')}<button class="tl-name" data-tl-open="${pg.p.id}" title="${esc(pg.label)}">${esc(pg.label)}</button></div><div class="tl-track">${t}</div></div>`;
      if (ui.tl.kids && !pFold) pg.kids.forEach((e) => { rows += row(e, 'tl-todo kid', 1); });
    });
  });
  // the header
  const shown = timelineEntries(r), dls = shown.filter((e) => e.dl && e.x.status === 'open' && !e.overdue).length, od = shown.filter((e) => e.overdue).length;
  const sub = [dls ? plural(dls, 'deadline') : '', od ? `<span class="tl-odn">${od} overdue</span>` : ''].filter(Boolean).join(' · ') || (shown.length ? '' : 'Nothing due'); // (the dates are the buttons beside it)
  const zoomSeg = tlZoomSegHTML(), nav = tlNavHTML();
  let html = `<div class="lh tl-lh"><span class="ic lh-ic" style="color:var(--c-timeline)">${I.timeline}</span><h1 class="lh-title">Timeline</h1><button class="ib lh-share" data-action="share-view" aria-label="Share or export" title="Share or export this list">${ic('share')}</button><button class="ib" data-action="view-menu" aria-label="Timeline options" title="Timeline options">${ic('more')}</button></div>`
    + `<div class="lh-sub tl-sub"><span class="tl-sub-t">${sub}</span>${zoomSeg}${nav}${tlSpanHTML(r)}</div>` + tagBarHTML(allEntries.map((e) => e.x));
  if (!rows) {
    return html + `<div class="tl-live">${emptyHTML('timeline', !tlAtToday() || ui.tl.zoom === 'custom' ? 'Nothing due in these weeks' : 'Nothing due yet', `Give a project or to-do a deadline (select it and press D) and it shows up here, on its day.${ui.tl.when ? '' : ' To see When dates too, choose <b>Scheduled To-Dos Too</b> in the ••• menu.'}`)}</div>`;
  }
  html += `<div class="tl-live"><div class="tl-wrap${L.fits ? ' fits' : ''}" data-hscroll="timeline"><div class="tl ${'z-' + ui.tl.zoom}${weekly ? ' wk' : ''}${L.stack ? ' stack' : ''}" style="--dw:${L.dw}px;--lw:${L.lw}px;--days:${r.days};--vw:${Math.round(L.vw)}px">`
    + tlHeadHTML(months, scale, tlBusyHTML(timelineEntries(r).filter((e) => ui.tl.kids || e.x.type === 'project' || !e.x.projectId), r, L))
    + `<div class="tl-body"><div class="tl-bg" aria-hidden="true">${bg}</div>${rows}</div></div></div></div>`;
  return html;
}

/* ---- the span: 2 Weeks, Month, 3 Months or Custom; paging; its start, end and slider ---- */
function tlZoomSegHTML() {
  const zs = Object.entries(TL_ZOOM).map(([k, z]) => [k, z.label]).concat([['custom', 'Custom']]);
  return `<div class="seg tl-zoom" role="group" aria-label="Time span">${zs.map(([k, l]) => `<button data-tlzoom="${k}" class="${ui.tl.zoom === k ? 'on' : ''}" aria-pressed="${ui.tl.zoom === k}">${l}</button>`).join('')}</div>`;
}
const tlAtToday = () => !ui.tl.off && !(ui.tl.cfrom && ui.tl.cfrom !== weekStart(T0()));
const tlNavHTML = () => `<div class="tl-nav"><button class="ib" data-tlnav="-1" aria-label="Earlier" title="Earlier">${ic('chevL')}</button><button class="btn tl-today${tlAtToday() ? ' at' : ''}" data-tlnav="0">Today</button><button class="ib" data-tlnav="1" aria-label="Later" title="Later">${ic('chevR')}</button></div>`;
/* the slider goes by ratio (a week to a year), so short spans get as much room as long ones */
const tlSlideFor = (days) => Math.round((1000 * Math.log(days / TL_MIN)) / Math.log(TL_MAX / TL_MIN));
const tlDaysFor = (v) => clamp(Math.round(TL_MIN * Math.pow(TL_MAX / TL_MIN, v / 1000)), TL_MIN, TL_MAX);
const tlSpanText = (days) => (days % 7 === 0 && days <= 84 ? plural(days / 7, 'week') : plural(days, 'day'));
const tlDayText = (d) => fmtDate(d, { weekday: false }); // the year shows when it isn't this one
/* a new length: one of the three if it's exactly theirs, Custom otherwise (which keeps it for
   the next time you choose Custom) */
function tlSetDays(days) {
  days = clamp(Math.round(days), TL_MIN, TL_MAX);
  const k = Object.keys(TL_ZOOM).find((x) => TL_ZOOM[x].days === days);
  ui.tl.zoom = k || 'custom';
  if (!k) { ui.tl.cdays = days; ui.tl.cused = true; }
}
/* start the span on the day showing now (after paging), so a change to its length stretches from there */
function tlHoldStart() { const r = tlRange(); if (ui.tl.off) { ui.tl.cfrom = r.from === weekStart(T0()) ? null : r.from; ui.tl.off = 0; } return r; }
/* the span's start and end, and the slider, for every span */
function tlSpanHTML(r, band = false) {
  return `<div class="tl-custom${band ? ' in-band' : ''}" role="group" aria-label="Time span">`
    + `<button class="tl-date" data-tlpick="from" title="Start on…" aria-label="Starts ${esc(tlDayText(r.from))}">${esc(tlDayText(r.from))}</button><span class="tl-dash">–</span>`
    + `<button class="tl-date" data-tlpick="to" title="End on…" aria-label="Ends ${esc(tlDayText(r.to))}">${esc(tlDayText(r.to))}</button>`
    + `<input type="range" class="tl-slider" data-tlslide min="0" max="1000" step="1" value="${tlSlideFor(r.days)}" aria-label="How many days to show" aria-valuetext="${esc(tlSpanText(r.days))}">`
    + `<span class="tl-span-n">${esc(tlSpanText(r.days))}</span></div>`;
}
/* redraw just the grid (and the dates and counts above it) while the slider moves, so the slider
   being dragged isn't redrawn out from under the pointer */
let tlLiveRaf = 0;
function tlLiveRedraw() {
  tlLiveRaf = 0;
  const band = $('#content .tl-band'), tmp = document.createElement('div');
  tmp.innerHTML = band ? boardTimelineHTML() : viewTimeline();
  const root = band || $('#content'), fresh = band ? tmp.firstElementChild : tmp;
  const live = $('.tl-live', root), nlive = $('.tl-live', fresh);
  if (live && nlive) live.replaceWith(nlive);
  ['.tl-sub-t', '[data-tlpick="from"]', '[data-tlpick="to"]', '.tl-span-n', '.tl-today', '.tl-zoom'].forEach((sel) => { const a = $(sel, root), b = $(sel, fresh); if (a && b) a.replaceWith(b); });
  const sl = $('[data-tlslide]', root); if (sl) sl.setAttribute('aria-valuetext', tlSpanText(tlRange().days));
}
document.addEventListener('input', (e) => {
  const sl = e.target.closest && e.target.closest('#content [data-tlslide]'); if (!sl || !tlHere()) return;
  tlHoldStart(); // stretch from what's showing
  tlSetDays(tlDaysFor(+sl.value));
  if (!tlLiveRaf) tlLiveRaf = requestAnimationFrame(tlLiveRedraw);
});
document.addEventListener('change', (e) => { if (e.target.closest && e.target.closest('#content [data-tlslide]')) saveTimeline(); });
/* the span's start (it keeps its length) or end (a new length): a calendar, or type a date */
function tlPickDay(which, anchor) {
  const r = tlRange(), cur = which === 'from' ? r.from : r.to;
  let shown = cur, cy = pd(cur).getFullYear(), cm = pd(cur).getMonth();
  const cal = () => calHTML(cy, cm, shown, true);
  const set = (d) => {
    if (which === 'from') { ui.tl.cfrom = d === weekStart(T0()) ? null : d; ui.tl.off = 0; }
    else { ui.tl.cfrom = r.from === weekStart(T0()) ? null : r.from; ui.tl.off = 0; tlSetDays(diffDays(r.from, d) + 1); }
    saveTimeline(); render();
    if (which === 'to' && diffDays(r.from, d) + 1 < TL_MIN) toast(`The Timeline shows at least ${TL_MIN} days`);
    else if (which === 'to' && diffDays(r.from, d) + 1 > TL_MAX) toast('The Timeline shows up to a year');
  };
  const L = openLayer({ anchor, cls: 'picker done-picker', html: `<div class="pk-h">${which === 'from' ? 'Start On' : 'End On'}</div>
    <input class="pk-in" placeholder="${which === 'from' ? 'jan 1, next mon, 2 weeks ago…' : 'mar 31, end of month, in 6 weeks…'}" autocomplete="off" aria-label="Type a date">
    <div class="pk-hint"></div>
    <button class="pk-opt today" data-tlq="0">${ic('star')}${which === 'from' ? 'This Week' : 'Today'}</button>
    <div class="cal">${cal()}</div>`,
    onMount: (el) => {
      const inp = $('.pk-in', el), hint = $('.pk-hint', el);
      const read = (v) => { const p = parseDateText(v); return (p && (p.date || (p.special === 'today' ? T0() : null))) || parsePastDate(v); };
      const apply = (d) => { closeLayer(L); set(d); };
      inp.addEventListener('input', () => {
        const d = read(inp.value);
        hint.textContent = inp.value.trim() ? (d ? '→ ' + fmtDate(d) : 'Try “jan 1”, “next mon” or “in 6 weeks”') : '';
        hint.classList.toggle('bad', !d);
        if (d) { shown = d; cy = pd(d).getFullYear(); cm = pd(d).getMonth(); $('.cal', el).innerHTML = cal(); }
      });
      inp.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const d = read(inp.value); if (d) apply(d); });
      el.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cal]');
        if (c) { cm += +c.dataset.cal; if (cm < 0) { cm = 11; cy--; } if (cm > 11) { cm = 0; cy++; } $('.cal', el).innerHTML = cal(); return; }
        const d = e.target.closest('[data-date]'); if (d && !d.disabled) { apply(d.dataset.date); return; }
        if (e.target.closest('[data-tlq]')) apply(which === 'from' ? weekStart(T0()) : T0());
      });
      if (!isCoarse()) inp.focus({ preventScroll: true });
    } });
  return L;
}

/* ---- clicks: zoom, paging, names, checkboxes ---- */
const tlHere = () => ui.view.type === 'timeline' || (ui.view.type === 'board' && !!(curBoard() || {}).tl);
document.addEventListener('click', (e) => {
  if (!tlHere() || !e.target.closest) return;
  const z = e.target.closest('#content [data-tlzoom]');
  if (z) {
    // a different span starts on the day showing now; Custom takes up the length you set it to before
    const r = tlHoldStart();
    if (z.dataset.tlzoom === 'custom' && ui.tl.zoom !== 'custom' && !ui.tl.cused) { ui.tl.cdays = r.days; ui.tl.cused = true; }
    ui.tl.zoom = z.dataset.tlzoom; saveTimeline(); render(); return;
  }
  const n = e.target.closest('#content [data-tlnav]');
  if (n) { const d = +n.dataset.tlnav; ui.tl.off = d ? ui.tl.off + d : 0; if (!d && ui.tl.cfrom) { ui.tl.cfrom = null; saveTimeline(); } render(); return; }
  const pk = e.target.closest('#content [data-tlpick]');
  if (pk) { tlPickDay(pk.dataset.tlpick, pk); return; }
  const o = e.target.closest('#content [data-tl-open]');
  if (o) { const id = o.dataset.tlOpen; if (getP(id)) navigate('project:' + id); else revealTodo(id); return; }
  const c = e.target.closest('#content [data-tl-done]');
  if (c) { toggleComplete([c.dataset.tlDone]); return; }
  // a flag or bar clicked without dragging: its dates. (On the click, not the pointer coming up,
  // so a phone's tap doesn't land on the menu that just opened under the finger.)
  const fb = e.target.closest('#content [data-tlfold]');
  if (fb) { tlFoldClick(fb, e.altKey); return; }
  const bz = e.target.closest('#content [data-tlbusy]');
  if (bz) { tlBusyMenu(bz); return; }
  const it = e.target.closest('#content [data-tl-item]');
  if (it) { if (!tlNoClick) tlItemMenu(it.dataset.tlid || it.closest('[data-tlid]').dataset.tlid, it); return; }
  // an empty day on a row: a to-do due then, or this one's deadline moved there
  const tr = e.target.closest('#content .tl-body .tl-track');
  if (tr && !e.target.closest('button, a')) tlDayMenu(tr, e);
});
function tlFoldClick(b, all) {
  const fold = !ui.tl.fold.has(b.dataset.tlfold), band = b.closest('.tl-band');
  if (!all) { if (fold) ui.tl.fold.add(b.dataset.tlfold); else ui.tl.fold.delete(b.dataset.tlfold); }
  else if (fold) (band || document).querySelectorAll('[data-tlfold]').forEach((x) => ui.tl.fold.add(x.dataset.tlfold));
  else [...ui.tl.fold].filter((k) => (band ? /^(p|ba|bc):/ : /^[ap]:/).test(k)).forEach((k) => ui.tl.fold.delete(k)); // those inside folded ones too
  saveTimeline(); render();
}
function tlFoldAll(fold) {
  if (fold) document.querySelectorAll('#content [data-tlfold]').forEach((b) => ui.tl.fold.add(b.dataset.tlfold));
  else [...ui.tl.fold].filter((k) => /^[ap]:/.test(k)).forEach((k) => ui.tl.fold.delete(k));
  saveTimeline(); render();
}
/* what's due on a day (or in a week) of the Due row */
function tlBusyMenu(b) {
  const k = b.dataset.tlbusy, q = tlWeekly(), xs = (tlBusyIds.get(k) || []).map(itemById).filter(Boolean);
  if (!xs.length) return;
  const where = (x) => (x.type === 'todo' && x.projectId && getP(x.projectId) ? tlShort(pTitle(getP(x.projectId)), 20) : x.type === 'todo' && x.areaId && getA(x.areaId) ? tlShort(aTitle(getA(x.areaId)), 20) : '');
  openMenu(b, [{ header: q ? `Due the week of ${fmtDate(k, { weekday: false })}` : `Due ${fmtDate(k)}` },
    ...xs.map((x) => ({ label: tlShort(tlName(x), 40), icon: x.type === 'project' ? 'project' : 'flag', hint: q ? fmtDate(x.deadline || tlSched(x), { weekday: false }) : where(x), fn: () => (x.type === 'project' ? navigate('project:' + x.id) : revealTodo(x.id)) }))]);
}
/* the day under the pointer on a track */
function tlDayAt(tr, clientX) {
  const tl = tr.closest('.tl'), dw = parseFloat(tl.style.getPropertyValue('--dw')) || 20, r = tlRange();
  return clamp(Math.floor((clientX - tr.getBoundingClientRect().left) / dw), 0, r.days - 1);
}
function tlDayMenu(tr, e) {
  const row = tr.closest('.tl-row'); if (!row) return;
  const x = row.dataset.tlid ? itemById(row.dataset.tlid) : null, add = row.dataset.tlnew;
  if (!x && !add) return;
  const day = addDays(tlRange().from, tlDayAt(tr, e.clientX)), d = fmtDate(day, { weekday: false });
  const newDue = (preset) => ({ label: `New To-Do Due ${d}`, icon: 'plus', fn: () => openQuickEntry('', Object.assign({ deadline: day }, preset)) });
  const items = [];
  if (x && x.type === 'project') {
    items.push({ header: pTitle(x) });
    if (x.status === 'open' && !x.trashed) items.push(newDue({ projectId: x.id, start: 'anytime' }));
    if (x.status === 'open' && x.deadline !== day) items.push({ label: x.deadline ? `Move Its Deadline to ${d}` : `Deadline ${d}`, icon: 'flag', fn: () => tlSetDeadline(x, day) });
  } else if (x) {
    items.push({ header: tlShort(tlName(x), 40) });
    if (x.status === 'open' && x.deadline !== day) items.push({ label: x.deadline ? `Move Its Deadline to ${d}` : `Deadline ${d}`, icon: 'flag', fn: () => tlSetDeadline(x, day) });
    items.push(newDue(x.projectId ? { projectId: x.projectId, start: 'anytime' } : x.areaId ? { areaId: x.areaId, start: 'anytime' } : { start: 'inbox' })); // beside it, in the same place
  } else {
    const [t, a, b] = add.split(':');
    if (t === 'a') { const ar = a && getA(a); items.push({ header: ar ? aTitle(ar) : 'No Area' }, newDue(ar ? { areaId: a, start: 'anytime' } : { start: 'inbox' })); }
    else if (t === 'c') items.push({ header: colName(a, b) }, newDue(a === 't' && getTag(b) ? { tags: [b], start: 'inbox' } : a === 's' && getSmart(b) ? Object.assign({ start: 'inbox' }, smartNewProps(getSmart(b))) : { start: 'inbox' }));
  }
  if (items.length < 2) return;
  openMenu({ x: e.clientX, y: e.clientY }, items);
}
function tlSetDeadline(x, day) {
  commit('Change Deadline', () => { x.deadline = day; const st = tlSched(x); if (st && st > day) scheduleItems(x, { date: day }); touch(x); });
  toast(`Deadline ${fmtDate(day)}`, { undo: true });
}
/* a + under the pointer on an empty day of a row, where a click adds something */
document.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || tlDrag) return;
  const tr = tlHere() && e.target.closest && e.target.closest('#content .tl-body .tl-track');
  const ok = tr && !e.target.closest('[data-tl-item], button, a') && tr.closest('.tl-row[data-tlid], .tl-row[data-tlnew]');
  let g = document.querySelector('#content .tl-ghost');
  if (!ok) { if (g) g.remove(); return; }
  if (!g || g.parentNode !== tr) { if (g) g.remove(); g = document.createElement('i'); g.className = 'tl-ghost'; g.setAttribute('aria-hidden', 'true'); g.innerHTML = ic('plus'); tr.appendChild(g); }
  g.style.left = tlAt(tlDayAt(tr, e.clientX) + 0.5);
}, { passive: true });
document.addEventListener('contextmenu', (e) => {
  const row = tlHere() && e.target.closest && (e.target.closest('#content .tl [data-tl-item][data-tlid]') || e.target.closest('#content .tl-row[data-tlid]'));
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
  if (!tlHere() || (e.pointerType === 'mouse' && e.button !== 0) || layers.length) return;
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
      if (tlHere() && Math.abs(w - tlW) > 2 && !tlDrag && !layers.length) { tlW = w; render(); } else tlW = w;
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

/* ---- the Board's Timeline: a band across the top of a Board, for what's on that Board ----
   One row per project on it (a project column, or a project in an area column), with its
   deadline bar and its to-dos' deadlines and start dates, each named; an area's own to-dos; and
   a list, tag or smart-list column's to-dos with deadlines. Things on the same days get lines
   of their own in the row, so none hides another; ▸ folds a row to one line. Same span,
   paging, Due row, dragging, menus and adding as the Timeline. Each Board remembers whether
   it shows one (the Timeline button). */
function toggleBoardTimeline() { const b = curBoard(); b.tl = !b.tl; saveBoard(); render(); }
function boardTimelineRows(r) {
  const rows = [], seen = new Set();
  const live = (t) => liveTodo(t) && inLiveProject(t) && inFocus(t) && matchesTagFilter(t);
  const entries = (list) => list.map((t) => tlEntry(t, r)).filter(Boolean).sort(tlSort);
  const addProject = (p) => {
    if (!p || seen.has(p.id) || !liveProject(p)) return; seen.add(p.id);
    // a Board column holds the project and everything in it, its sub-projects' to-dos and dates too
    const subs = projDescendants(p).filter(liveProject), inside = new Set([p.id, ...subs.map((q) => q.id)]);
    const pe = tlEntry(p, r), kids = entries(S.todos.filter((t) => inside.has(t.projectId) && live(t)).concat(subs));
    if (pe || kids.length) rows.push({ x: p, k: 'p:' + p.id, label: pTitle(p), icon: projIc(p, 'tl-ic'), open: `data-tl-open="${p.id}"`, main: pe, kids: tlTree(p, kids), key: pe ? pe.b : kids[0].b });
  };
  boardCols().forEach((c) => {
    if (c.t === 'p') addProject(getP(c.id));
    else if (c.t === 'a') {
      const a = getA(c.id); if (!a) return;
      const own = entries(S.todos.filter((t) => t.areaId === a.id && !t.projectId && live(t)));
      if (own.length) rows.push({ x: null, k: 'ba:' + a.id, add: 'a:' + a.id, label: aTitle(a), icon: placeColor(a) ? areaIc(a, 'tl-ic') : ic('area', 'tl-ic'), open: `data-nav="area:${a.id}"`, main: null, kids: own, key: own[0].b });
      S.projects.filter((p) => inArea(p, a.id) && liveProject(p)).sort(byOrder).forEach(addProject);
    } else {
      const items = entries(S.todos.filter((t) => live(t) && t.deadline && colHas(c, t)));
      if (items.length) rows.push({ x: null, k: `bc:${c.t}:${c.id}`, add: `c:${c.t}:${c.id}`, label: colName(c.t, c.id), icon: c.t === 'l' ? `<span class="ic tl-ic" style="color:${LISTS[c.id].color}">${I[LISTS[c.id].icon]}</span>` : c.t === 't' ? ic('tag', 'tl-ic tc-ic ' + tcls(getTag(c.id))) : `<span class="ic tl-ic" style="color:var(--c-smart)">${I.funnel}</span>`, open: `data-nav="${c.t === 'l' ? c.id : (c.t === 't' ? 'tag:' : 'smart:') + c.id}"`, main: null, kids: items, key: items[0].b });
    }
  });
  return rows;
}
/* What's inside project p, as a tree: each sub-project's to-dos and sub-projects right after it,
   a level deeper (tlDepth 1 = straight inside p). One whose own project isn't on the row (nothing
   of its in these weeks) goes under the nearest one that is, named with its project: "Hamilton ›
   Install…". Siblings stay in date order. */
function tlTree(p, list) {
  const on = new Map(list.map((e) => [e.x.id, e])), up = (x) => (x.type === 'todo' ? x.projectId : x.parentId), info = new Map();
  const place = (x) => {
    if (info.has(x.id)) return info.get(x.id);
    info.set(x.id, { parent: null, depth: 1, via: '' }); // (a loop in the tree stops here)
    let pid = up(x), hops = 0, guard = 0;
    while (pid && pid !== p.id && !on.has(pid) && guard++ < 50) { const q = getP(pid); pid = q ? q.parentId : null; hops++; }
    const parent = pid && pid !== p.id && on.has(pid) ? pid : null, direct = getP(up(x));
    const it = { parent, depth: parent ? place(on.get(parent).x).depth + 1 : 1, via: hops && direct ? pTitle(direct) : '' };
    info.set(x.id, it); return it;
  };
  const under = new Map();
  list.forEach((e) => { const it = place(e.x); Object.assign(e, { tlDepth: it.depth, tlVia: it.via, tlParent: it.parent }); const k = it.parent || ''; if (!under.has(k)) under.set(k, []); under.get(k).push(e); });
  const out = [], seen = new Set();
  const walk = (k) => (under.get(k) || []).forEach((e) => { if (seen.has(e.x.id)) return; seen.add(e.x.id); out.push(e); walk(e.x.id); });
  walk('');
  list.forEach((e) => { if (!seen.has(e.x.id)) out.push(e); }); // anything a loop left out
  return out;
}
/* a Board row holds a project and all its to-dos, so things on the same days would sit on top of
   each other: each goes on the first line of the row where it (and its name) has room, and the
   row grows a line for each one that doesn't fit */
const TL_IND = 16; // a level's indent on a Board's Timeline
function tlLanes(list, r, L, ownId = null) {
  const W = L.dw * r.days;
  const items = list.map((e, k) => {
    const own = !!ownId && e.x.id === ownId; // the row's own project, named in bold so it reads as the row's
    const sp = tlSpan(e, r, L), ind = own ? 0 : Math.max(0, (e.tlDepth || 1) - 1) * TL_IND;
    const name = (e.tlVia && !own ? e.tlVia + ' › ' : '') + tlName(e.x);
    const lab = tlLabel(tlShort(name, e.tlVia ? 48 : 34), sp.x1, sp.x2, W, `nm${own ? ' own' : ''}${e.x.status !== 'open' ? ' done' : ''}${e.late ? ' late' : ''}`, e.a < e.b && !e.overdue, ind);
    return { e, own, lab, lo: lab.lo, hi: lab.hi };
  });
  // the row's project first, then the tree in order; each goes on the first line with room for it,
  // below the line of the one it's inside
  const ends = [], laneOf = new Map();
  items.slice().sort((p, q) => q.own - p.own).forEach((it) => {
    const min = it.e.tlParent && laneOf.has(it.e.tlParent) ? laneOf.get(it.e.tlParent) + 1 : 0;
    let l = ends.findIndex((end, i) => i >= min && end + 8 <= it.lo);
    if (l < 0) { while (ends.length < min) ends.push(-1e9); l = ends.length; ends.push(0); }
    ends[l] = it.hi; it.lane = l; laneOf.set(it.e.x.id, l);
  });
  const html = items.map((it) => `<div class="tl-lane" style="--i:${it.lane}">${tlTrackHTML(it.e, r, { nolabel: true })}${it.lab.html}</div>`).join('');
  return { html, n: Math.max(1, ends.length) };
}
function boardTimelineHTML() {
  const r = tlRange(), L = tlLayout(r), rows = boardTimelineRows(r);
  const T = T0(), ws = (S && S.settings.weekStart) || 0, days = Array.from({ length: r.days }, (_, i) => addDays(r.from, i)), cy = pd(T).getFullYear();
  const weekly = tlWeekly(r), every = Math.max(1, Math.ceil(24 / (7 * L.dw)));
  let months = '', i0 = 0, scale = '', bg = '';
  days.forEach((d, i) => {
    if (i === r.days - 1 || days[i + 1].slice(0, 7) !== d.slice(0, 7)) { const dd = pd(d), n = i - i0 + 1; months += `<div class="tl-mon" style="left:${tlAt(i0)};width:${tlAt(n)}"><span>${n * L.dw >= 70 ? MONTHS[dd.getMonth()] : MON[dd.getMonth()]}${dd.getFullYear() !== cy && n * L.dw >= 90 ? ' ' + dd.getFullYear() : ''}</span></div>`; i0 = i + 1; }
    const w = dow(d), we = w === 0 || w === 6, today = d === T;
    if (weekly) { if (w === ws) { const wi = Math.floor(i / 7); scale += `<div class="tl-wk${d <= T && T < addDays(d, 7) ? ' now' : ''}" style="left:${tlAt(i)};width:${tlAt(7)}">${wi % every === 0 ? `<span>${pd(d).getDate()}</span>` : ''}</div>`; } }
    else scale += `<div class="tl-day${we ? ' we' : ''}${today ? ' today' : ''}" style="left:${tlAt(i)}">${L.dw >= 26 ? `<b>${L.dw >= 44 ? WD[w] : WD[w].slice(0, 2)}</b>` : L.dw >= 18 ? `<b>${WD[w][0]}</b>` : ''}${L.dw >= 18 || w === ws || today ? `<span>${pd(d).getDate()}</span>` : ''}</div>`;
    if (we && !weekly) bg += `<i class="tl-we" style="left:${tlAt(i)}"></i>`;
    if (i && (w === ws || d.slice(8) === '01')) bg += `<i class="tl-wl${d.slice(8) === '01' ? ' m' : ''}" style="left:${tlAt(i)}"></i>`;
  });
  const ti = diffDays(r.from, T); if (ti >= 0 && ti < r.days) bg += `<i class="tl-now" style="left:${tlAt(ti)}"></i>`;
  const body = rows.map((row) => {
    const f = row.kids.length > 0 && ui.tl.fold.has(row.k), head = `<div class="tl-lab">${tlFoldHTML(row.k, row.label, row.kids.length > 0)}${row.icon}<button class="tl-name" ${row.open} title="${esc(row.label)}">${esc(row.label)}</button></div>`;
    const attrs = `${row.x ? ` data-tlid="${row.x.id}"` : ''}${row.add ? ` data-tlnew="${esc(row.add)}"` : ''}`;
    if (f) return `<div class="tl-row tl-proj folded"${attrs}>${head}<div class="tl-track">${row.main ? tlTrackHTML(row.main, r) : ''}${tlTicksHTML(row.kids, r, L, 'to-do')}</div></div>`;
    const lanes = tlLanes((row.main ? [row.main] : []).concat(row.kids), r, L, row.main && row.x ? row.x.id : null);
    return `<div class="tl-row tl-proj tl-laned"${attrs}>${head}<div class="tl-track tl-lanes" style="--lanes:${lanes.n}">${lanes.html}</div></div>`;
  }).join('');
  const zoomSeg = tlZoomSegHTML(), nav = tlNavHTML();
  return `<section class="tl-band" aria-label="Timeline for this Board"><div class="tl-band-h"><span class="ic" style="color:var(--c-timeline)">${I.timeline}</span><b>Timeline</b><span class="spacer"></span><div class="tl-band-ctl">${zoomSeg}${nav}</div><button class="ib tl-band-x" data-action="board-tl" aria-label="Hide the Timeline" title="Hide the Timeline">${ic('chevU')}</button></div>`
    + `${tlSpanHTML(r, true)}<div class="tl-live">`
    + (body ? `<div class="tl-wrap" data-hscroll="board-tl" data-vscroll="board-tl"><div class="tl z-${ui.tl.zoom}${L.stack ? ' stack' : ''}" style="--dw:${L.dw}px;--lw:${L.lw}px;--days:${r.days};--vw:${Math.round(L.vw)}px">${tlHeadHTML(months, scale, tlBusyHTML(rows.flatMap((row) => (row.main ? [row.main] : []).concat(row.kids)), r, L))}<div class="tl-body"><div class="tl-bg" aria-hidden="true">${bg}</div>${body}</div></div></div>`
      : `<p class="tl-band-empty">Nothing on this Board has a deadline between ${esc(fmtDate(r.from, { weekday: false }))} and ${esc(fmtDate(r.to, { weekday: false }))}.</p>`)
    + `</div></section>`;
}
