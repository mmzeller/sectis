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
/* the color it shows: its own, else the nearest one above it */
function effColor(x, depth = 0) {
  if (!x) return null;
  const own = placeColor(x);
  if (own) return own === 'gray' ? null : own; // Gray: no color, and none from above either
  return depth < 16 ? effColor(placeParent(x), depth + 1) : null;
}
const colorVar = (c) => `var(--t-${c})`;
const colorStyle = (x) => (effColor(x) ? ` style="color:${colorVar(effColor(x))}"` : '');
/* a project's progress pie and an area's box, in its color when it has one */
function projIc(p, cls = '', frac = null) {
  return `<span class="ic ${cls}"${colorStyle(p)}>${pieSVG(frac == null ? projectProgress(p).frac : frac)}</span>`;
}
function areaIc(a, cls = '') { return `<span class="ic ${cls}"${placeColor(a) ? colorStyle(a) : ' style="color:var(--c-area)"'}>${I.area}</span>`; }
/* the place a to-do sits in, for a colored dot beside its parent label */
function placeOfColor(x) { return effColor(placeParent(x)); }
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
  const L = openLayer({ anchor: anchor && anchor.isConnected === false ? null : anchor, cls: 'sw-pop', html: `<div class="pk-h">Color for “${esc(name)}”</div>${swatchGridHTML(cur, inh, parName, inh ? `Gray: no color, not even ${parName}’s` : 'Gray: no color')}${auto}`,
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
