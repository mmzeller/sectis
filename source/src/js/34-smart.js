/* ===================== Smart lists =====================
   Saved filters, kept in the sidebar: to-dos with these tags (any or all), in these projects
   or areas, by start date, deadline, priority, Waiting For and words in the title or notes.
   They update as to-dos come and go, sync like everything else, and can be Board columns.
   A smart list is a record { id, type: 'smart', title, f: filters, group, order }. */
const SMART_WHEN = [['any', 'Any'], ['today', 'Today'], ['week', 'Next 7 Days'], ['dated', 'Scheduled'], ['nodate', 'No Date'], ['someday', 'Someday']];
const SMART_DL = [['any', 'Any'], ['has', 'Has One'], ['overdue', 'Overdue'], ['week', 'Within a Week'], ['month', 'Within a Month'], ['none', 'None']];
const SMART_PRIO = [['0', 'Any'], ['1', 'Low or Higher'], ['2', 'Medium or Higher'], ['3', 'High']];
const SMART_WAIT = [['any', 'Any'], ['only', 'Waiting'], ['not', 'Not Waiting'], ['stale', 'Waiting 7+ Days']];
const SMART_GROUP = [['place', 'Project & Area'], ['date', 'Date'], ['none', 'None']];
const getSmart = (id) => (S.smart || []).find((s) => s.id === id);
const smartTitle = (sl) => (sl && sl.title) || 'Smart List';
function smartFilter(sl) { return Object.assign({ tags: [], tagMode: 'any', places: [], when: 'any', deadline: 'any', priority: 0, waiting: 'any', text: '' }, (sl && sl.f) || {}); }
function smartMatcher(sl) {
  const f = smartFilter(sl), T = T0(), wk = addDays(T, 7), mo = addDays(T, 30);
  const tagSets = f.tags.filter(getTag).map(tagDescendants);
  const places = f.places.filter((k) => (k[0] === 'p' ? getP(k.slice(2)) : getA(k.slice(2))));
  const q = (f.text || '').trim().toLowerCase();
  return (t) => {
    if (!liveTodo(t) || !inLiveProject(t) || !inFocus(t)) return false;
    if (tagSets.length) {
      const eff = new Set(effectiveTags(t)), hit = (set) => [...set].some((id) => eff.has(id));
      if (f.tagMode === 'all' ? !tagSets.every(hit) : !tagSets.some(hit)) return false;
    }
    if (places.length && !places.some((k) => (k[0] === 'p' ? inProjectTree(t, k.slice(2)) : (areaOf(t) || {}).id === k.slice(2)))) return false;
    const dated = t.start === 'anytime' && !!t.when;
    if (f.when === 'today' && !isTodayItem(t)) return false;
    if (f.when === 'week' && !(isTodayItem(t) || (dated && t.when <= wk))) return false;
    if (f.when === 'dated' && !dated) return false;
    if (f.when === 'nodate' && (t.when || t.start === 'someday')) return false;
    if (f.when === 'someday' && t.start !== 'someday') return false;
    if (f.deadline === 'has' && !t.deadline) return false;
    if (f.deadline === 'overdue' && !(t.deadline && t.deadline < T)) return false;
    if (f.deadline === 'week' && !(t.deadline && t.deadline <= wk)) return false;
    if (f.deadline === 'month' && !(t.deadline && t.deadline <= mo)) return false;
    if (f.deadline === 'none' && t.deadline) return false;
    if (+f.priority && prio(t) < +f.priority) return false;
    if (f.waiting === 'only' && !t.waitFor) return false;
    if (f.waiting === 'not' && t.waitFor) return false;
    if (f.waiting === 'stale' && !(t.waitFor && t.waitSince && diffDays(t.waitSince, T) >= 7)) return false;
    if (q && !`${t.title || ''}\n${t.notes || ''}`.toLowerCase().includes(q)) return false;
    return true;
  };
}
function smartItems(sl) { return S.todos.filter(smartMatcher(sl)); }
function smartCount(sl) { return smartItems(sl).filter((t) => t.status === 'open').length; }
function smartSummary(sl) {
  const f = smartFilter(sl), bits = [], lab = (opts, v) => (opts.find((o) => String(o[0]) === String(v)) || [0, ''])[1];
  const tags = f.tags.map(getTag).filter(Boolean).map((t) => '#' + t.title);
  if (tags.length) bits.push(tags.join(f.tagMode === 'all' ? ' and ' : ' or '));
  const places = f.places.map((k) => (k[0] === 'p' ? getP(k.slice(2)) && projPath(getP(k.slice(2))) : getA(k.slice(2)) && aTitle(getA(k.slice(2))))).filter(Boolean);
  if (places.length) bits.push('in ' + places.join(', '));
  if (f.when !== 'any') bits.push(lab(SMART_WHEN, f.when));
  if (f.deadline !== 'any') bits.push(f.deadline === 'none' ? 'No deadline' : 'Deadline: ' + lab(SMART_DL, f.deadline).toLowerCase());
  if (+f.priority) bits.push('Priority: ' + lab(SMART_PRIO, f.priority).toLowerCase());
  if (f.waiting !== 'any') bits.push(lab(SMART_WAIT, f.waiting));
  if ((f.text || '').trim()) bits.push(`“${f.text.trim()}”`);
  return bits.join(' · ') || 'Every open to-do';
}
/* the list grouped by project and area (like Anytime), by date (like a tag), or not at all */
function smartGroups(sl, items) {
  const g = sl.group || 'place', T = T0();
  if (g === 'none') return [{ head: '', items, ctx: { parent: true, when: true, star: true } }];
  if (g === 'date') {
    return [
      ['Today', items.filter(isTodayItem).sort(byToday)],
      ['Upcoming', items.filter((t) => t.start === 'anytime' && t.when && t.when > T).sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : 0))],
      ['Anytime', items.filter((t) => t.start === 'anytime' && !t.when && !isTodayItem(t)).sort(byOrder)],
      ['Inbox', items.filter((t) => isInbox(t) && !isTodayItem(t)).sort(byOrder)],
      ['Someday', items.filter((t) => t.start === 'someday' && !isTodayItem(t)).sort(byOrder)],
    ].filter((x) => x[1].length).map(([label, list]) => ({ head: `<div class="sec-h"><span>${label}</span></div>`, items: list, ctx: { parent: true, when: true } }));
  }
  const out = [], ctx = { when: true, star: true };
  const loose = items.filter((t) => !t.projectId && !t.areaId).sort(byOrder);
  if (loose.length) out.push({ head: '', items: loose, ctx: { when: true, star: true } });
  // each project's to-dos under its name, then each of its sub-projects' under theirs
  const projGroup = (p) => {
    const ts = items.filter((t) => t.projectId === p.id).sort(byOrder);
    if (ts.length) out.push({ head: `<div class="grp-h proj-h">${projIc(p)}<button data-nav="project:${p.id}">${esc(isSub(p) ? projPath(p) : pTitle(p))}</button></div>`, items: ts, ctx });
    childProjects(p).filter((q) => !q.trashed && !q.isTemplate).sort(byOrder).forEach(projGroup);
  };
  const projectsIn = (areaId) => S.projects.filter((p) => !p.trashed && !p.isTemplate && inArea(p, areaId)).sort(byOrder);
  projectsIn(null).forEach(projGroup);
  S.areas.slice().sort(byOrder).forEach((a) => {
    const at = items.filter((t) => t.areaId === a.id && !t.projectId).sort(byOrder), ps = projectsIn(a.id);
    if (!at.length && !ps.some((p) => items.some((t) => inProjectTree(t, p.id)))) return;
    out.push({ head: `<div class="grp-h area-h">${placeColor(a) ? areaIc(a) : ic('area')}<button data-nav="area:${a.id}">${esc(aTitle(a))}</button></div>`, items: at, ctx });
    ps.forEach(projGroup);
  });
  return out;
}
function viewSmart(sl) {
  const all = smartItems(sl), items = all.filter(matchesTagFilter), n = all.filter((t) => t.status === 'open').length;
  let html = `<div class="lh"><span class="ic lh-ic" style="color:var(--c-smart)">${I.funnel}</span><h1 class="lh-title">${esc(smartTitle(sl))}</h1>`
    + `<button class="btn board-add" data-action="smart-edit" data-id="${sl.id}" title="Change what this list shows">${ic('sliders')}<span>Edit</span></button>`
    + `<button class="ib lh-share" data-action="share-view" aria-label="Share or export" title="Share or export this list">${ic('share')}</button><button class="ib" data-action="view-menu" aria-label="List options" title="List options">${ic('more')}</button></div>`
    + `<div class="lh-sub">${esc(smartSummary(sl))} · ${plural(n, 'open to-do')}</div>` + tagBarHTML(all);
  html += `<div class="list">${smartGroups(sl, items).map((g) => g.head + secHTML(`smart:${sl.id}`, g.items, g.ctx)).join('')}</div>`;
  if (!all.length) html += emptyHTML('funnel', 'Nothing matches right now', 'To-dos that fit this list’s filters show up here as they come and go. Click <b>Edit</b> to change the filters.');
  return html;
}
function smartMenuItems(sl, el) {
  return [
    { label: 'Edit Smart List…', icon: 'sliders', fn: () => openSmartEditor(sl) },
    { label: 'Duplicate Smart List', icon: 'copy', fn: () => duplicateSmart(sl) },
    ...boardMenuItems('s', sl.id, false, el),
    { label: 'Delete Smart List', icon: 'trash', danger: true, fn: () => deleteSmart(sl) },
  ];
}
function saveSmart(sl, data) {
  let rec = sl;
  commit(sl ? 'Edit Smart List' : 'New Smart List', () => {
    if (!rec) { const now = Date.now(); rec = { id: uid(), type: 'smart', title: '', f: {}, group: 'place', order: (maxOf(S.smart, 'order') || 0) + 1, createdAt: now, modifiedAt: now }; S.smart.push(rec); }
    Object.assign(rec, data); touch(rec);
  }, { render: false });
  navigate('smart:' + rec.id);
  return rec;
}
function duplicateSmart(sl) {
  saveSmart(null, { title: smartTitle(sl) + ' copy', f: JSON.parse(JSON.stringify(sl.f || {})), group: sl.group || 'place' });
}
async function deleteSmart(sl) {
  const ok = await confirmDialog({ title: `Delete “${esc(smartTitle(sl))}”?`, body: 'Only the list goes; its to-dos stay where they are.', ok: 'Delete', danger: true });
  if (!ok) return;
  commit('Delete Smart List', () => { S.smart = S.smart.filter((x) => x.id !== sl.id); }, { render: false });
  if (ui.view.type === 'smart' && ui.view.id === sl.id) navigate('today'); else render();
  toast(`Deleted “${smartTitle(sl)}”`, { undo: true });
}
/* the editor: a name, then each filter; the count updates as you go */
function openSmartEditor(sl = null) {
  const st = { title: sl ? sl.title || '' : '', f: JSON.parse(JSON.stringify(smartFilter(sl))), group: (sl && sl.group) || 'place', q: '' };
  const seg = (key, opts, val) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-k="${key}" data-v="${v}" class="${String(val) === String(v) ? 'on' : ''}" aria-pressed="${String(val) === String(v)}">${l}</button>`).join('')}</div>`;
  const tagChips = () => tagTree().map(({ tag, depth }) => `<button type="button" class="sm-chip tagc ${tcls(tag)}${st.f.tags.includes(tag.id) ? ' on' : ''}" data-tag="${tag.id}" aria-pressed="${st.f.tags.includes(tag.id)}">${depth ? '<span class="sm-nest">›</span>' : ''}<span class="sm-dot"></span>${tag.group ? `Any in ${esc(tag.title)}` : esc(tag.title)}</button>`).join('') || '<span class="note">No tags yet.</span>';
  const placeChips = () => {
    const ql = st.q.trim().toLowerCase(), m = (s) => !ql || s.toLowerCase().includes(ql);
    const chip = (k, label, icon) => `<button type="button" class="sm-chip${st.f.places.includes(k) ? ' on' : ''}" data-place="${k}" aria-pressed="${st.f.places.includes(k)}">${icon}<span>${esc(label)}</span></button>`;
    // sub-projects are named with the projects they're in
    const projs = (aid) => projTree(aid).map((r) => r.p);
    const pchip = (p) => chip('p:' + p.id, isSub(p) ? projPath(p) : pTitle(p), projIc(p));
    let out = projs(null).filter((p) => m(pTitle(p)) || st.f.places.includes('p:' + p.id)).map(pchip).join('');
    S.areas.slice().sort(byOrder).forEach((a) => {
      if (m(aTitle(a)) || st.f.places.includes('a:' + a.id)) out += chip('a:' + a.id, aTitle(a), areaIc(a));
      out += projs(a.id).filter((p) => m(pTitle(p)) || st.f.places.includes('p:' + p.id)).map(pchip).join('');
    });
    return out || '<span class="note">No matching projects or areas.</span>';
  };
  const count = () => { const n = S.todos.filter(smartMatcher({ f: st.f })).filter((t) => t.status === 'open').length; return `${plural(n, 'open to-do')} ${n === 1 ? 'matches' : 'match'}`; };
  const body = () => `<div class="modal-b sm-ed">
      <label class="sm-row"><span class="sm-l">Name</span><input class="pk-in sm-in" id="sm-name" value="${esc(st.title)}" placeholder="PaperCut this week" autocomplete="off"></label>
      <div class="sm-row"><span class="sm-l">Tags${st.f.tags.length > 1 ? seg('tagMode', [['any', 'Any of These'], ['all', 'All of These']], st.f.tagMode) : ''}</span><div class="sm-chips" id="sm-tags">${tagChips()}</div></div>
      <div class="sm-row"><span class="sm-l">In<input class="pk-in sm-q" id="sm-q" value="${esc(st.q)}" placeholder="Find a project or area" autocomplete="off"></span><div class="sm-chips sm-places" id="sm-places">${placeChips()}</div></div>
      <div class="sm-row"><span class="sm-l">When</span>${seg('when', SMART_WHEN, st.f.when)}</div>
      <div class="sm-row"><span class="sm-l">Deadline</span>${seg('deadline', SMART_DL, st.f.deadline)}</div>
      <div class="sm-row"><span class="sm-l">Priority</span>${seg('priority', SMART_PRIO, st.f.priority)}</div>
      <div class="sm-row"><span class="sm-l">Waiting For</span>${seg('waiting', SMART_WAIT, st.f.waiting)}</div>
      <label class="sm-row"><span class="sm-l">Contains</span><input class="pk-in sm-in" id="sm-text" value="${esc(st.f.text || '')}" placeholder="Words in the title or notes" autocomplete="off"></label>
      <div class="sm-row"><span class="sm-l">Group By</span>${seg('group', SMART_GROUP, st.group)}</div>
    </div>`;
  const html = `<div class="modal-h"><span class="ic" style="color:var(--c-smart)">${I.funnel}</span><h2>${sl ? 'Edit Smart List' : 'New Smart List'}</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div>`
    + `<div id="sm-body">${body()}</div><div class="modal-f"><span class="sm-count" id="sm-count">${count()}</span>${sl ? '<button class="btn danger" data-sm="delete">Delete</button>' : ''}<button class="btn" data-sm="cancel">Cancel</button><button class="btn primary" data-sm="save">${sl ? 'Save' : 'Create'}</button></div>`;
  const L = openLayer({ modal: true, cls: 'sm-modal', html, onMount: (el) => {
    const redraw = (keepFocus) => { const f = keepFocus && document.activeElement && document.activeElement.id; const s = f && document.activeElement.selectionStart; $('#sm-body', el).innerHTML = body(); if (f) { const i = $('#' + f, el); if (i) { i.focus(); try { i.setSelectionRange(s, s); } catch (e) { /* ignore */ } } } $('#sm-count', el).textContent = count(); };
    el.addEventListener('input', (e) => {
      if (e.target.id === 'sm-name') st.title = e.target.value;
      else if (e.target.id === 'sm-text') { st.f.text = e.target.value; $('#sm-count', el).textContent = count(); }
      else if (e.target.id === 'sm-q') { st.q = e.target.value; $('#sm-places', el).innerHTML = placeChips(); }
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.k) { const k = b.dataset.k, v = b.dataset.v; if (k === 'group') st.group = v; else st.f[k] = k === 'priority' ? +v : v; redraw(); return; }
      if (b.dataset.tag) { const id = b.dataset.tag; st.f.tags = st.f.tags.includes(id) ? st.f.tags.filter((x) => x !== id) : st.f.tags.concat(id); redraw(); return; }
      if (b.dataset.place) { const k = b.dataset.place; st.f.places = st.f.places.includes(k) ? st.f.places.filter((x) => x !== k) : st.f.places.concat(k); redraw(); return; }
      if (b.dataset.sm === 'cancel') { closeLayer(L); return; }
      if (b.dataset.sm === 'delete') { closeLayer(L); deleteSmart(sl); return; }
      if (b.dataset.sm === 'save') { closeLayer(L); saveSmart(sl, { title: st.title.trim() || smartSuggestName(st.f), f: st.f, group: st.group }); }
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('#sm-name, #sm-text')) { e.preventDefault(); $('[data-sm="save"]', el).click(); } });
    const n = $('#sm-name', el); if (n && !isCoarse()) { n.focus(); n.select(); }
  } });
  return L;
}
/* a name from the filters, when none was typed */
function smartSuggestName(f) {
  const s = smartSummary({ f }); return s === 'Every open to-do' ? 'Smart List' : s.length > 40 ? s.slice(0, 38) + '…' : s;
}
