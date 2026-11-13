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
  if (p) return projPath(p);
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
      if ((t.priority || 0) !== (src.priority || 0)) { t.priority = src.priority || 0; changed = true; }
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
      projectId: target.type === 'project' ? target.id : null,
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

/* ---- expandable projects inside an area, and sub-projects inside a project ----
   A project's row opens to show what's in it, right there. Projects in an area start closed;
   sub-projects inside a project start open, since they're its sections (ui.subCollapsed holds
   the ones you closed). In the sidebar, a project's sub-projects stay folded away until you
   open them (ui.sbOpen), except around the project you have open. Each device remembers. */
function loadExpanded() {
  const set = (k) => { try { return new Set(JSON.parse(lsGet(k) || '[]')); } catch (e) { return new Set(); } };
  ui.expanded = set('sectis.expanded'); ui.sbCollapsed = set('sectis.sbCollapsed');
  ui.subCollapsed = set('sectis.subCollapsed'); ui.sbOpen = set('sectis.sbOpen');
}
function isExpanded(p) { return isSub(p) ? !ui.subCollapsed.has(p.id) : ui.expanded.has(p.id); }
function saveExpanded() { lsSet('sectis.expanded', JSON.stringify([...ui.expanded])); lsSet('sectis.subCollapsed', JSON.stringify([...ui.subCollapsed])); }
/* open (or close) rows without drawing again */
function markExpanded(ids, on) {
  ids.forEach((id) => {
    const p = getP(id);
    if (p && isSub(p)) { if (on) ui.subCollapsed.delete(id); else ui.subCollapsed.add(id); }
    else if (on) ui.expanded.add(id); else ui.expanded.delete(id);
  });
  saveExpanded();
}
/* sidebar: show or hide a project's sub-projects (⌥ for every project) */
function toggleSidebarProject(id, all) {
  const show = !ui.sbOpen.has(id);
  const ids = all ? S.projects.filter((p) => childProjects(p).length).map((p) => p.id) : [id];
  ids.forEach((x) => (show ? ui.sbOpen.add(x) : ui.sbOpen.delete(x)));
  lsSet('sectis.sbOpen', JSON.stringify([...ui.sbOpen]));
  renderSidebar();
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
function setExpanded(ids, on) { markExpanded(ids, on); render(); }
function areaProjectIds(areaId) { return S.projects.filter((p) => inArea(p, areaId) && liveProject(p)).map((p) => p.id); }
/* every sub-project inside a project, at any depth (Expand All / Collapse All) */
function subProjectIds(p) { return projDescendants(p).filter(liveProject).map((q) => q.id); }
/* an empty project, opened under its row or as a Board column: a button to add its first to-do */
function emptyProjectHTML(p, cls) {
  if (p.status !== 'open' || p.trashed) return `<div class="${cls}">No to-dos yet</div>`;
  return `<button class="${cls} add-first" data-action="bcol-add" data-sec="project:${p.id}:" title="New to-do in ${esc(pTitle(p))}">${ic('plus')}<span>New To-Do</span></button>`;
}
/* what's in a project, under its open row: its to-dos, then its sub-projects (which open the same way) */
function projectChildrenHTML(p) {
  const todos = S.todos.filter((t) => t.projectId === p.id && !t.trashed && !t.isTemplate && !t.isDraft && (t.status === 'open' || !t.logged)).filter(matchesTagFilter);
  // opened under its project's row: one that just follows the project's When doesn't repeat its date
  const ctx = { when: true, nested: true };
  // on a project's page, logged to-dos shown where they were show inside its sub-projects too
  const lin = ui.view.type === 'project' && loggedShownIn(ui.view.id) ? loggedInHTML(`project:${p.id}:`, loggedOfProject(p).filter(matchesTagFilter)) : '';
  const subs = subProjectsHTML(p, { nested: true });
  let html = `<div class="pchildren" data-children="${p.id}">`;
  html += secHTML(`project:${p.id}:`, todos.sort(byOrder), ctx) + lin + subs;
  if (!todos.length && !subs) html += emptyProjectHTML(p, 'pchildren-empty');
  return html + '</div>';
}
/* a sub-project shows under a tag while it, or anything in it, has the tag */
function subMatchesFilter(q) {
  if (!ui.tagFilter || matchesTagFilter(q)) return true;
  const inside = new Set([q.id, ...projDescendants(q).map((x) => x.id)]);
  return S.todos.some((t) => inside.has(t.projectId) && liveTodo(t) && matchesTagFilter(t));
}
/* A project's sub-projects as rows that open in place, in their order (or the list's sort). All
   of them, ones for later (Someday, or a start date to come) included: each shows its date or
   Someday, and nothing waits behind a Show button. */
function subProjectsHTML(p, opts = {}) {
  const all = childProjects(p).filter((q) => !q.trashed && !q.isTemplate && (q.status === 'open' || !q.logged)); // (a repeating one shows under Repeating)
  if (!all.length) return '';
  const shown = all.filter(subMatchesFilter).sort(byOrder);
  const ctx = { star: true, when: true, expandable: true, nested: !!opts.nested };
  return `<div class="sec subprojs" data-sec="subprojects:${p.id}" data-ok="order">${sortedRows(shown).map((q) => projRowHTML(q, ctx)).join('')}</div>`;
}
