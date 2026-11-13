/* ===================== Manage Colors =====================
   Every area, project and sub-project in one window (Settings → Appearance, the Color By menu, or
   Manage Colors… at the bottom of any color picker), as a tree: each with its color, and where an
   inherited one comes from ("Light Blue, from Parks & Rec"). Tick several, or:
   - ⇧-click: everything between the last one ticked and this one;
   - ⌥-click: this one and everything inside it;
   then Color… gives them all one color and Remove Colors takes their own away (each shows what
   it's in again). A row's color on the right opens the picker for just that one. The ticks stay
   while the window is open, so you can color a set, look, and change it again. To-dos aren't
   listed (there are too many): select them in a list and use Color… there. */
function openColorManager() {
  const picked = new Set();
  let last = null;
  const live = (p) => !p.trashed && !p.isTemplate && !p.blueprint && !(p.status !== 'open' && p.logged);
  // [item, depth] in tree order: areas with their projects and sub-projects, then projects in no area
  const rows = () => {
    const out = [], seen = new Set();
    const proj = (p, d) => { if (seen.has(p.id) || d > 8) return; seen.add(p.id); out.push([p, d]); childProjects(p).filter(live).sort(byOrder).forEach((q) => proj(q, d + 1)); };
    S.areas.slice().sort(byOrder).forEach((a) => { out.push([a, 0]); S.projects.filter((p) => live(p) && !isSub(p) && p.areaId === a.id).sort(byOrder).forEach((p) => proj(p, 1)); });
    const loose = S.projects.filter((p) => live(p) && !isSub(p) && !(p.areaId && getA(p.areaId))).sort(byOrder);
    if (loose.length) { out.push([null, 0]); loose.forEach((p) => proj(p, 1)); }
    return out;
  };
  const inside = (x) => { // x and everything inside it, in this list
    const list = rows().map(([y]) => y).filter(Boolean), keep = new Set([x.id]);
    let grew = true;
    while (grew) { grew = false; for (const y of list) if (!keep.has(y.id) && placeParent(y) && keep.has(placeParent(y).id)) { keep.add(y.id); grew = true; } }
    return list.filter((y) => keep.has(y.id));
  };
  const colorText = (x) => {
    const own = placeColor(x), eff = effColor(x);
    if (own === 'gray') return '<span class="cm-c muted">Gray (no color)</span>';
    if (own) return `<span class="cm-c">${TAG_COLOR_NAMES[own]}</span>`;
    if (eff) return `<span class="cm-c muted">${TAG_COLOR_NAMES[eff]}, from ${esc(tlShort(placeName(placeParent(x)), 22))}</span>`;
    return '<span class="cm-c muted">No color</span>';
  };
  const build = () => {
    const list = rows(), n = [...picked].filter((id) => list.some(([x]) => x && x.id === id)).length, total = list.filter(([x]) => x).length;
    const body = list.map(([x, d]) => {
      if (!x) return `<div class="cm-row cm-none"><span class="cm-ind" style="width:${0}px"></span><span class="ic cm-ic">${I.area}</span><span class="cm-t muted">No Area</span></div>`;
      const on = picked.has(x.id), eff = effColor(x), isArea = !x.type;
      const icon = isArea ? `<span class="ic cm-ic" style="color:${eff ? colorVar(eff) : 'var(--c-area)'}">${I.area}</span>` : `<span class="ic cm-ic" style="${eff ? `color:${colorVar(eff)}` : ''}">${pieSVG(projectProgress(x).frac)}</span>`;
      return `<div class="cm-row${on ? ' on' : ''}${isArea ? ' cm-area' : ''}" data-cm="${x.id}"><button class="cm-cb${on ? ' on' : ''}" data-cm-tick="${x.id}" role="checkbox" aria-checked="${on}" aria-label="Select ${esc(placeName(x))}">${on ? ic('check') : ''}</button><span class="cm-ind" style="width:${d * 18}px"></span>${icon}<span class="cm-t">${esc(placeName(x))}</span><button class="cm-sw" data-cm-color="${x.id}" title="Change ${esc(placeName(x))}’s color">${eff ? `<span class="sw-dot tc-${eff}${placeColor(x) ? '' : ' inh'}" aria-hidden="true"></span>` : '<span class="sw-dot sw-none" aria-hidden="true"></span>'}${colorText(x)}</button></div>`;
    }).join('');
    return `<div class="modal-h"><h2>Colors</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div>
      <div class="cm-bar"><button class="btn" data-cm-all>${n === total && total ? 'Select None' : 'Select All'}</button><span class="cm-n">${n ? `${n} selected` : 'Tick some, or ⌥-click one for all inside it'}</span><button class="btn primary" data-cm-set${n ? '' : ' disabled'}>${ic('palette')}Color…</button><button class="btn" data-cm-rm${n && [...picked].some((id) => placeColor(itemOf(id))) ? '' : ' disabled'}>Remove Colors</button></div>
      <div class="modal-b cm-list">${body || '<p class="note">No areas or projects yet.</p>'}</div>`;
  };
  const itemOf = (id) => getA(id) || getP(id);
  const L = openLayer({ modal: true, cls: 'narrow cm-modal', html: build(), onMount: (el) => {
    const redraw = () => { const list = $('.cm-list', el), st = list ? list.scrollTop : 0; el.innerHTML = build(); const l2 = $('.cm-list', el); if (l2) l2.scrollTop = st; };
    el.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-cm-color]');
      if (sw) { openColorFor([itemOf(sw.dataset.cmColor)], sw, redraw, { noManage: true }); return; }
      if (e.target.closest('[data-cm-all]')) {
        const ids = rows().map(([x]) => x && x.id).filter(Boolean);
        if (ids.every((id) => picked.has(id))) picked.clear(); else ids.forEach((id) => picked.add(id));
        redraw(); return;
      }
      if (e.target.closest('[data-cm-set]')) { openColorFor([...picked].map(itemOf), e.target.closest('[data-cm-set]'), redraw, { noManage: true }); return; }
      if (e.target.closest('[data-cm-rm]')) { removeColors([...picked].map(itemOf), redraw); return; }
      const row = e.target.closest('[data-cm]'); if (!row) return;
      const id = row.dataset.cm, x = itemOf(id); if (!x) return;
      if (e.altKey) { // this one and everything inside it
        const set = inside(x), on = !picked.has(id);
        set.forEach((y) => (on ? picked.add(y.id) : picked.delete(y.id)));
      } else if (e.shiftKey && last) { // a range
        const ids = rows().map(([y]) => y && y.id).filter(Boolean), a = ids.indexOf(last), b = ids.indexOf(id);
        if (a >= 0 && b >= 0) ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((y) => picked.add(y));
      } else if (picked.has(id)) picked.delete(id); else picked.add(id);
      last = id; redraw();
    });
  } });
  return L;
}
