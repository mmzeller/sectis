/* ===================== Project and area colors =====================
   Any area, project or sub-project can have a color from the palette (••• → Color…): twelve hues
   in Light, plain and Deep, and Gray. It tints its icon in the sidebar, lists, headers and pickers,
   puts a stripe along the top of its Board column, colors its bars on the Timeline, and a dot
   beside its name under to-dos in Today, Upcoming and other mixed lists. Synced.
   Colors flow down: one without a color of its own shows the color of what it's in, sub-project
   ← project ← area, and the to-dos inside go with it. Color the Work area blue and its projects
   and their sub-projects are blue too; give one of them its own (a Light or Deep blue keeps it in
   the family) and everything inside that one follows it instead. The picker says where an
   inherited color comes from (Same as …), and Gray stops the flow (no color). */
const placeColor = (x) => (x && TAG_COLOR_NAMES[x.color] ? x.color : null); // its own
/* what it sits in, for its color: a sub-project's project, a project's area, a to-do's project or area */
function placeParent(x) {
  if (!x) return null;
  if (x.type === 'project') { const q = x.parentId && x.parentId !== x.id ? getP(x.parentId) : null; return q || (x.areaId ? getA(x.areaId) || null : null); }
  if (x.type === 'todo') return (x.projectId && getP(x.projectId)) || (x.areaId ? getA(x.areaId) || null : null);
  return null;
}
/* its color by area and project: its own, else what it gets from above */
function effColor(x, depth = 0) {
  if (!x) return null;
  const own = placeColor(x);
  if (own) return own === 'gray' ? null : own; // Gray: no color, and none from above either
  return depth < 16 ? flowColor(x, depth) : null;
}
/* what it gets from above: the color of what it's in, except that with Shade Sub-Projects on
   (Settings → Appearance) a sub-project takes another shade of its project's hue, the sub-projects
   of one project taking turns between the two shades its project isn't (plain blue's go Light
   Blue, Deep Blue, Light Blue…), so they're one family and still tell apart */
function flowColor(x, depth = 0) {
  const par = placeParent(x), c = effColor(par, depth + 1);
  if (!c || !S.settings.shadeSubs || x.type !== 'project' || !par || par.type !== 'project') return c;
  const shade = c.endsWith('-l') ? '-l' : c.endsWith('-d') ? '-d' : '', others = ['-l', '', '-d'].filter((s) => s !== shade);
  const sibs = childProjects(par).filter((q) => !q.trashed && !q.isTemplate).sort(byOrder);
  return colorHue(c) + others[Math.max(0, sibs.indexOf(x)) % 2];
}
const colorVar = (c) => `var(--t-${c})`;

/* ---- Color By (Settings → Appearance, or ••• on the Board and the Timeline) ----
   What the colors of projects (their icons, Board column stripes, Timeline bars) and the to-dos
   in them say:
   - Area & Project: the colors picked for them, flowing down (above).
   - Progress: how much of a project is done, on a gradient from red (none) through orange,
     yellow and lime to green (all). A project with nothing in it yet is gray. Its to-dos go
     with it.
   - Priority: High, Medium and Low in the colors of their ! marks; no priority, gray. A to-do
     on the Timeline shows its own priority.
   Areas keep their own colors either way. */
const COLOR_BY = [['place', 'Area & Project'], ['progress', 'Progress'], ['priority', 'Priority']];
const PROGRESS_STOPS = ['red', 'orange', 'yellow', 'lime', 'green'];
const PRIORITY_COLORS = { 3: 'var(--red)', 2: 'var(--c-waiting)', 1: 'var(--c-inbox)' };
function progressCSS(frac) {
  const n = PROGRESS_STOPS.length - 1, f = Math.min(1, Math.max(0, frac)), i = Math.min(n - 1, Math.floor(f * n)), t = f * n - i;
  return `color-mix(in oklab, var(--t-${PROGRESS_STOPS[i]}) ${Math.round((1 - t) * 100)}%, var(--t-${PROGRESS_STOPS[i + 1]}))`;
}
/* the color a project or to-do shows, as CSS (null: none) */
function shownColor(x) {
  if (!x) return null;
  const by = S.settings.colorBy;
  if (by === 'priority') return PRIORITY_COLORS[prio(x)] || 'var(--t-gray)'; // none: gray, so the ones that have one stand out
  if (by === 'progress') {
    const p = x.type === 'project' ? x : x.type === 'todo' && x.projectId ? getP(x.projectId) : null;
    if (!p) return null;
    const pr = projectProgress(p);
    return pr.total || p.status !== 'open' ? progressCSS(pr.frac) : 'var(--t-gray)'; // nothing in it yet: gray
  }
  const c = effColor(x); return c ? colorVar(c) : null;
}
function colorByMenu(at) {
  openMenu(at, [{ header: 'Color By' }, ...COLOR_BY.map(([v, l]) => ({ label: l, icon: S.settings.colorBy === v ? 'check' : 'blank', fn: () => setColorBy(v) })),
    { sep: 1 }, { label: 'Shade Sub-Projects', icon: S.settings.shadeSubs ? 'check' : 'blank', disabled: S.settings.colorBy !== 'place', fn: () => { S.settings.shadeSubs = !S.settings.shadeSubs; saveSoon(); render(); } }]);
}
function colorByMenuItem(at) { return { label: 'Color By…', icon: 'palette', hint: COLOR_BY.find(([v]) => v === S.settings.colorBy)[1], fn: () => colorByMenu(at) }; }
function setColorBy(v) {
  S.settings.colorBy = v; saveSoon(); render();
  toast(v === 'progress' ? 'Colored by progress: red with nothing done, through yellow, to green when it’s all done' : v === 'priority' ? 'Colored by priority: High red, Medium orange, Low blue' : 'Colored by area and project');
}
const colorStyle = (x) => { const c = shownColor(x); return c ? ` style="color:${c}"` : ''; };
/* a project's progress pie and an area's box, in its color when it has one */
function projIc(p, cls = '', frac = null) {
  return `<span class="ic ${cls}"${colorStyle(p)}>${pieSVG(frac == null ? projectProgress(p).frac : frac)}</span>`;
}
function areaIc(a, cls = '') { const c = placeColor(a); return `<span class="ic ${cls}" style="color:${c && c !== 'gray' ? colorVar(c) : 'var(--c-area)'}">${I.area}</span>`; }
/* the place a to-do sits in, for a colored dot beside its parent label (CSS) */
function placeOfColor(x) { const par = placeParent(x); return par && par.type !== 'project' ? (effColor(par) ? colorVar(effColor(par)) : null) : shownColor(par); }
const placeName = (x) => (!x ? '' : x.type === 'project' ? pTitle(x) : aTitle(x));
function colorMenuItem(kind, x, el) {
  const own = placeColor(x), from = !own && effColor(x) ? placeParent(x) : null;
  return { label: 'Color…', icon: 'palette', hint: own ? TAG_COLOR_NAMES[own] : from ? `Same as ${tlShort(placeName(from), 18)}` : '', fn: () => openPlaceColor(kind, x, el) };
}
/* the palette as a grid: a column per hue, Light above and Deep below, and Gray. cur is ticked;
   inh (the color it would get from what it's in) is ringed */
function swatchGridHTML(cur, inh = null, inhFrom = '', grayTitle = 'Gray') {
  const sw = (c) => {
    const on = cur === c, ih = !cur && inh === c, name = c === 'gray' ? grayTitle : TAG_COLOR_NAMES[c];
    return `<button class="sw tc-${c}${on ? ' on' : ''}${ih ? ' inh' : ''}" data-sw="${c}" aria-label="${esc(name)}" aria-pressed="${on}" title="${esc(name)}${inhFrom && inh === c ? ` (${esc(inhFrom)}’s color)` : ''}">${on ? ic('check') : ''}</button>`;
  };
  return `<div class="sw-grid">${COLOR_SHADES.map(([s], i) => COLOR_HUES.map((h) => sw(h + s)).join('') + (i === 1 ? sw('gray') : '<span></span>')).join('')}</div>`;
}
function openPlaceColor(kind, x, anchor) {
  const cur = placeColor(x), name = kind === 'p' ? pTitle(x) : aTitle(x);
  const par = kind === 'p' ? placeParent(x) : null, inh = par ? effColor(par) : null, parName = placeName(par);
  // nothing of its own: it shows what it's in (Same as …), or no color
  const auto = inh
    ? `<div class="pk-sep"></div><button class="menu-i sw-auto-i" data-sw="" aria-pressed="${!cur}"><span class="sw-dot tc-${inh}" aria-hidden="true"></span><span>Same as ${esc(tlShort(parName, 28))}</span><span class="hint">${cur ? '' : ic('check')}</span></button>`
    : `<div class="pk-sep"></div><button class="menu-i sw-auto-i" data-sw="" aria-pressed="${!cur}"><span class="sw-dot sw-none" aria-hidden="true"></span><span>No Color</span><span class="hint">${cur ? '' : ic('check')}</span></button>`;
  const by = kind === 'p' && S.settings.colorBy !== 'place' ? COLOR_BY.find(([v]) => v === S.settings.colorBy)[1] : '';
  const note = by ? `<p class="sw-note">Projects are colored by ${by} now. This color shows when Color By is Area & Project (••• on the Board or Timeline, or Settings).</p>` : '';
  const L = openLayer({ anchor: anchor && anchor.isConnected === false ? null : anchor, cls: 'sw-pop', html: `<div class="pk-h">Color for “${esc(name)}”</div>${note}${swatchGridHTML(cur, inh, parName, inh ? `Gray: no color, not even ${parName}’s` : 'Gray: no color')}${auto}`,
    onMount: (el) => {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-sw]'); if (!b) return; closeLayer(L);
        const c = b.dataset.sw || null;
        commit('Color', () => { if (c) x.color = c; else delete x.color; touch(x); });
      });
      if (!isCoarse()) { const f = $('.sw.on', el) || $('.sw.inh', el) || $('.sw', el); if (f) f.focus({ preventScroll: true }); }
    } });
  return L;
}
