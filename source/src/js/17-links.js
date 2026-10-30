/* ===================== One to-do in several places =====================
   "Also Add To…" makes a linked copy in another project or area. Linked copies
   share their title, notes, tags and checklist items; each place keeps its own
   checkbox (and checklist ticks, dates and position), so it can be checked off
   in one place or everywhere. */
function linkSiblings(t) {
  if (!t || !t.linkId) return [];
  return S.todos.filter((x) => x !== t && x.linkId === t.linkId && !x.trashed && !x.isDraft && !x.isTemplate);
}
function placeLabel(t) {
  const p = projectOf(t);
  if (p) { const h = t.headingId && getH(t.headingId); return pTitle(p) + (h && h.title ? ` › ${h.title}` : ''); }
  const a = areaOf(t); if (a) return aTitle(a);
  return isInbox(t) ? 'Inbox' : 'No list';
}
function samePlace(t, target) {
  if (target.type === 'project') return t.projectId === target.id;
  if (target.type === 'area') return !t.projectId && t.areaId === target.id;
  return false;
}
/* the most recently edited copy wins for the shared parts */
function propagateLinks() {
  const groups = new Map();
  for (const t of S.todos) if (t.linkId && !t.trashed && !t.isDraft && !t.isTemplate) { if (!groups.has(t.linkId)) groups.set(t.linkId, []); groups.get(t.linkId).push(t); }
  let changed = false;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const src = g.reduce((a, b) => ((b.modifiedAt || 0) > (a.modifiedAt || 0) ? b : a));
    const ckKey = (list) => list.map((c) => c.id + '\u0000' + c.title).join('\u0001');
    for (const t of g) {
      if (t === src) continue;
      if (t.title !== src.title) { t.title = src.title; changed = true; }
      if (t.notes !== src.notes) { t.notes = src.notes; changed = true; }
      if (t.tags.join() !== src.tags.join()) { t.tags = src.tags.slice(); changed = true; }
      if (ckKey(t.checklist) !== ckKey(src.checklist)) {
        const done = new Map(t.checklist.map((c) => [c.id, c.done]));
        t.checklist = src.checklist.map((c) => ({ id: c.id, title: c.title, done: done.get(c.id) || false }));
        changed = true;
      }
    }
  }
  return changed;
}
function alsoAddTo(ids, target) {
  if (target.type === 'inbox' || target.type === 'none') { toast('Pick a project or an area'); return; }
  let added = 0, skipped = 0;
  commit('Also Add To', () => ids.forEach((id) => {
    const t = getT(id);
    if (!t || t.isTemplate || isTplChild(t) || t.templateId) { skipped++; return; }
    if ([t, ...linkSiblings(t)].some((x) => samePlace(x, target))) { skipped++; return; }
    if (!t.linkId) t.linkId = t.id;
    const c = makeTodo({
      title: t.title, notes: t.notes, tags: t.tags.slice(), linkId: t.linkId,
      checklist: t.checklist.map((k) => ({ id: k.id, title: k.title, done: false })),
      start: t.start === 'inbox' ? 'anytime' : t.start, when: t.when, evening: t.evening, deadline: t.deadline, reminder: t.reminder,
      projectId: target.type === 'project' ? target.id : null, headingId: target.type === 'project' ? target.headingId || null : null,
      areaId: target.type === 'area' ? target.id : null, modifiedAt: t.modifiedAt,
    });
    c.order = endOrder(S.todos.filter((x) => !x.trashed && containerKey(x) === containerKey(c)));
    c.todayOrder = orderBetween(t.todayOrder, null)[0];
    retag(c, new Set());
    if (c.tags.join() !== t.tags.join()) touch(c); // tags are shared, so the new place's tags reach every copy
    S.todos.push(c); added++;
  }));
  const name = target.type === 'project' ? pTitle(getP(target.id)) : aTitle(getA(target.id));
  if (added) toast(`${added > 1 ? plural(added, 'to-do') + ' are' : 'Also'} in ${name}${added > 1 ? ' too' : ''}`, { undo: true });
  else if (skipped) toast(ids.length > 1 ? `Those to-dos are already in ${name}` : `Already in ${name}`);
}
function openAlsoAddTo(ids, anchor) {
  ids = ids.filter((id) => { const t = getT(id); return t && !t.isTemplate && !isTplChild(t) && !t.templateId; });
  if (!ids.length) { toast('Repeating to-dos can’t be in more than one place'); return null; }
  return openMove(ids, anchor, { title: 'Also Add To', noInbox: true, onPick: (target) => alsoAddTo(ids, target) });
}
function completeEverywhere(id) {
  const t = getT(id); if (!t) return;
  const all = [t, ...linkSiblings(t)].filter((x) => x.status === 'open');
  if (!all.length) return;
  commit('Complete Everywhere', () => all.forEach((x) => setStatus(x, 'done')));
  toast(`Completed in ${plural([t, ...linkSiblings(t)].length, 'place')}`, { undo: true });
}
function unlinkTodo(id) {
  const t = getT(id); if (!t) return;
  commit('Unlink', () => { t.linkId = null; touch(t); });
  toast('This copy is now separate', { undo: true });
}
/* after checking one copy off, offer the others */
function afterLinkedComplete(items) {
  if (items.length !== 1) return;
  const t = items[0]; if (t.status !== 'done') return;
  const open = linkSiblings(t).filter((x) => x.status === 'open');
  if (!open.length) return;
  toast(`Done in ${placeLabel(t)}. Still open in ${open.length > 1 ? plural(open.length, 'other place') : placeLabel(open[0])}.`, { action: 'Complete Everywhere', fn: () => completeEverywhere(t.id), ms: 7000 });
}

/* ---- expandable projects inside an area ---- */
function loadExpanded() {
  try { ui.expanded = new Set(JSON.parse(lsGet('sectis.expanded') || '[]')); } catch (e) { ui.expanded = new Set(); }
  try { ui.sbCollapsed = new Set(JSON.parse(lsGet('sectis.sbCollapsed') || '[]')); } catch (e) { ui.sbCollapsed = new Set(); }
}
/* sidebar: hide or show the projects under an area (⌥ for every area) */
function toggleSidebarArea(id, all) {
  const hide = !ui.sbCollapsed.has(id);
  const ids = all ? S.areas.map((a) => a.id) : [id];
  ids.forEach((x) => (hide ? ui.sbCollapsed.add(x) : ui.sbCollapsed.delete(x)));
  lsSet('sectis.sbCollapsed', JSON.stringify([...ui.sbCollapsed]));
  renderSidebar();
}
function setSidebarAreas(hide) {
  ui.sbCollapsed = new Set(hide ? S.areas.map((a) => a.id) : []);
  lsSet('sectis.sbCollapsed', JSON.stringify([...ui.sbCollapsed]));
  renderSidebar();
}
function setExpanded(ids, on) {
  ids.forEach((id) => (on ? ui.expanded.add(id) : ui.expanded.delete(id)));
  lsSet('sectis.expanded', JSON.stringify([...ui.expanded]));
  render();
}
function areaProjectIds(areaId) { return S.projects.filter((p) => p.areaId === areaId && liveProject(p)).map((p) => p.id); }
/* an empty project, opened under its row or as a Board column: a button to add its first to-do */
function emptyProjectHTML(p, cls) {
  if (p.status !== 'open' || p.trashed) return `<div class="${cls}">No to-dos yet</div>`;
  return `<button class="${cls} add-first" data-action="bcol-add" data-sec="project:${p.id}:" title="New to-do in ${esc(pTitle(p))}">${ic('plus')}<span>New To-Do</span></button>`;
}
function projectChildrenHTML(p) {
  const todos = S.todos.filter((t) => t.projectId === p.id && !t.trashed && !t.isTemplate && !t.isDraft && (t.status === 'open' || !t.logged)).filter(matchesTagFilter);
  const headings = S.headings.filter((h) => h.projectId === p.id && !h.archived).sort(byOrder);
  const ctx = { when: true };
  let html = `<div class="pchildren" data-children="${p.id}">`;
  html += secHTML(`project:${p.id}:`, todos.filter((t) => !t.headingId || !getH(t.headingId) || getH(t.headingId).archived).sort(byOrder), ctx);
  headings.forEach((h) => {
    const ts = todos.filter((t) => t.headingId === h.id).sort(byOrder);
    html += `<div class="sub-h" data-zone="project:${p.id}:${h.id}">${esc(h.title || 'Untitled heading')}</div>` + secHTML(`project:${p.id}:${h.id}`, ts, ctx);
  });
  if (!todos.length) html += emptyProjectHTML(p, 'pchildren-empty');
  return html + '</div>';
}
