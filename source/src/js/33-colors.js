/* ===================== Project and area colors =====================
   Any project or area can have one of the soft tag colors (••• → Color…). It tints its icon in
   the sidebar, lists, headers and pickers, puts a stripe along the top of its Board column, and
   a dot beside its name under to-dos in Today, Upcoming and other mixed lists. Synced. */
const placeColor = (x) => (x && TAG_COLOR_NAMES[x.color] ? x.color : null);
const colorVar = (c) => `var(--t-${c})`;
const colorStyle = (x) => (placeColor(x) ? ` style="color:${colorVar(placeColor(x))}"` : '');
/* a project's progress pie and an area's box, in its color when it has one */
function projIc(p, cls = '', frac = null) {
  return `<span class="ic ${cls}"${colorStyle(p)}>${pieSVG(frac == null ? projectProgress(p).frac : frac)}</span>`;
}
function areaIc(a, cls = '') { return `<span class="ic ${cls}"${placeColor(a) ? colorStyle(a) : ' style="color:var(--c-area)"'}>${I.area}</span>`; }
/* the place a to-do sits in, for a colored dot beside its parent label */
function placeOfColor(x) {
  const p = x.projectId && getP(x.projectId); if (p && placeColor(p)) return placeColor(p);
  const a = areaOf(x); return a && placeColor(a) ? placeColor(a) : null;
}
function colorMenuItem(kind, x, el) {
  return { label: 'Color…', icon: 'palette', hint: placeColor(x) ? TAG_COLOR_NAMES[placeColor(x)] : '', fn: () => openPlaceColor(kind, x, el) };
}
function openPlaceColor(kind, x, anchor) {
  const cur = placeColor(x), name = kind === 'p' ? pTitle(x) : aTitle(x);
  const sw = (c) => `<button class="sw ${'tc-' + c}${cur === c ? ' on' : ''}" data-sw="${c}" aria-label="${TAG_COLOR_NAMES[c]}" aria-pressed="${cur === c}" title="${TAG_COLOR_NAMES[c]}">${cur === c ? ic('check') : ''}</button>`;
  const none = `<div class="pk-sep"></div><button class="menu-i sw-auto-i" data-sw="" aria-pressed="${!cur}"><span class="sw-dot sw-none" aria-hidden="true"></span><span>No Color</span>${cur ? '' : `<span class="hint">${ic('check')}</span>`}</button>`;
  const L = openLayer({ anchor: anchor && anchor.isConnected === false ? null : anchor, cls: 'sw-pop', html: `<div class="pk-h">Color for “${esc(name)}”</div><div class="sw-grid">${TAG_COLORS.concat('gray').map(sw).join('')}</div>${none}`,
    onMount: (el) => {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-sw]'); if (!b) return; closeLayer(L);
        const c = b.dataset.sw || null;
        commit('Color', () => { if (c) x.color = c; else delete x.color; touch(x); });
      });
      if (!isCoarse()) { const f = $('.sw.on', el) || $('.sw', el); if (f) f.focus({ preventScroll: true }); }
    } });
  return L;
}
