/* ===================== Mutations ===================== */
function itemsFor(ids) { return ids.map(itemById).filter(Boolean); }
function todayTop() { return topOrder(todayItems(), 'todayOrder'); }

/* choice: 'today' | 'evening' | 'someday' | 'anytime' | 'clear' | { date } */
function scheduleItems(x, choice, reminder) {
  const T = T0();
  if (x.isTemplate) return;
  const wasToday = isTodayItem(x);
  if (choice === 'today' || choice === 'evening' || (choice && choice.date && choice.date <= T)) {
    x.start = 'anytime'; x.when = T; x.evening = choice === 'evening';
    if (!wasToday) x.todayOrder = todayTop();
  } else if (choice && choice.date) {
    x.start = 'anytime'; x.when = choice.date; x.evening = false;
  } else if (choice === 'someday') {
    x.start = 'someday'; x.when = null; x.evening = false; x.reminder = null;
  } else if (choice === 'anytime') {
    x.start = 'anytime'; x.when = null; x.evening = false; x.reminder = null;
  } else if (choice === 'clear') {
    x.when = null; x.evening = false; x.reminder = null;
    if (x.type === 'project' || x.start === 'someday' || x.projectId || x.areaId) x.start = 'anytime';
  }
  if (reminder !== undefined) x.reminder = x.when ? reminder : null;
  if (!x.when) x.reminder = null;
  touch(x);
}
function applyWhen(ids, choice, reminder) {
  const items = itemsFor(ids);
  if (!items.length) return;
  commit('Schedule', () => items.forEach((x) => scheduleItems(x, choice, reminder)));
  const label = choice === 'today' ? 'Today' : choice === 'evening' ? 'This Evening' : choice === 'someday' ? 'Someday' : choice === 'anytime' ? 'Anytime' : choice && choice.date ? fmtRel(choice.date) : null;
  if (label && items.some((x) => !x.isDraft && !visibleInCurrentView(x))) toast(`${items.length > 1 ? plural(items.length, 'item') + ' moved' : 'Moved'} to ${label}`, { undo: true });
}
function applyDeadline(ids, date) {
  commit('Deadline', () => itemsFor(ids).forEach((x) => { if (x.isTemplate) { if (x.repeat) x.repeat.deadlineDays = date ? Math.max(0, diffDays(x.next || T0(), date)) : null; } else x.deadline = date; touch(x); }));
}
function applyReminder(ids, hm) {
  commit('Reminder', () => itemsFor(ids).forEach((x) => { if (x.when) x.reminder = hm; touch(x); }));
}

/* can project p go inside project q? Not into itself or anything inside it */
function canNestIn(p, q) { return !!(p && q && p !== q && !projAncestors(q).includes(p)); }
/* a project's new place: inside another project, or at the top level of an area (or none) */
function placeProject(x, parentId, areaId, order) {
  const was = x.parentId || null;
  x.parentId = parentId || null; x.areaId = parentId ? null : areaId || null;
  if (order != null) x.order = order;
  else if (was !== x.parentId) x.order = endOrder(S.projects.filter((p) => p !== x && !p.trashed && (parentId ? p.parentId === parentId : inArea(p, areaId))));
}
/* moving a project: the to-dos in it (and in its sub-projects) swap the tags they had from where
   it was for the ones from where it goes */
function retagInside(p, fn) {
  const inside = new Set([p.id, ...projDescendants(p).map((q) => q.id)]);
  const todos = S.todos.filter((t) => inside.has(t.projectId) && !t.isTemplate);
  const before = new Map(todos.map((t) => [t, placeTagIds(t)]));
  fn();
  todos.forEach((t) => retag(t, before.get(t)));
}
/* target: {type:'inbox'} | {type:'area', id} | {type:'project', id} | {type:'none'} */
function moveItems(ids, target, opts = {}) {
  const items = itemsFor(ids);
  if (!items.length) return;
  if (target.type === 'project' && items.some((x) => x.type === 'project' && !canNestIn(x, getP(target.id)))) { toast('A project can’t go inside itself'); return; }
  const fn = () => {
    for (const x of items) {
      if (x.type === 'project') {
        retagInside(x, () => { if (target.type === 'project') placeProject(x, target.id, null); else placeProject(x, null, target.type === 'area' ? target.id : null); });
        touch(x); continue;
      }
      const prevContainer = containerKey(x), prevTags = placeTagIds(x);
      if (target.type === 'inbox') { x.projectId = null; x.areaId = null; x.headingId = null; x.start = 'inbox'; x.when = null; x.evening = false; x.reminder = null; }
      else if (target.type === 'area') { x.areaId = target.id; x.projectId = null; x.headingId = null; if (x.start === 'inbox') x.start = 'anytime'; }
      else if (target.type === 'project') { x.projectId = target.id; x.areaId = null; x.headingId = null; if (x.start === 'inbox') x.start = 'anytime'; }
      else if (target.type === 'none') { x.projectId = null; x.areaId = null; x.headingId = null; if (x.start === 'inbox') x.start = 'anytime'; }
      if (prevContainer !== containerKey(x) && !opts.keepOrder) x.order = endOrder(S.todos.filter((t) => t !== x && containerKey(t) === containerKey(x)));
      retag(x, prevTags);
      touch(x);
    }
  };
  if (opts.noCommit) fn(); else commit('Move', fn);
  if (!opts.silent && !items.every((x) => x.isDraft)) {
    const name = target.type === 'inbox' ? 'Inbox' : target.type === 'area' ? (getA(target.id) || {}).title : target.type === 'project' ? pTitle(getP(target.id)) : 'No Area';
    toast(`Moved to ${name || 'list'}`, { undo: true });
  }
}
function containerKey(t) { return t.projectId ? `p:${t.projectId}:` : t.areaId ? `a:${t.areaId}` : t.start === 'inbox' ? 'inbox' : 'loose'; }

function setStatus(x, status) {
  if (status === 'open') { x.status = 'open'; x.completedAt = null; x.logged = false; }
  else { x.status = status; x.completedAt = Date.now(); x.logged = false; if (x.templateId) onInstanceDone(x); holdDone(x.id); }
  touch(x);
}
function toggleComplete(ids, status = 'done') {
  const items = itemsFor(ids).filter((x) => !x.isTemplate && !isTplChild(x));
  if (!items.length) return;
  const projects = items.filter((x) => x.type === 'project' && x.status === 'open');
  if (projects.length) { completeProjectFlow(projects[0], status); return; }
  const allDone = items.every((x) => x.status === status);
  commit(status === 'canceled' ? 'Cancel' : 'Complete', () => items.forEach((x) => setStatus(x, allDone ? 'open' : status)));
  if (!allDone) afterLinkedComplete(items);
  if (!allDone && S.settings.logMode === 'immediate') setTimeout(() => { if (autoLog()) render(); }, 1300);
}
/* completing a project completes what's still open inside it: its to-dos and its sub-projects */
async function completeProjectFlow(p, status = 'done') {
  const subs = projDescendants(p).filter((q) => !q.trashed && !q.isTemplate);
  const inside = new Set([p.id, ...subs.map((q) => q.id)]);
  const remaining = S.todos.filter((t) => inside.has(t.projectId) && t.status === 'open' && !t.trashed && !t.isTemplate);
  let mode = status;
  if (remaining.length) {
    const r = await choiceDialog({
      title: status === 'done' ? 'Complete project?' : 'Cancel project?',
      body: `“${esc(p.title || 'New Project')}” still has ${plural(remaining.length, 'open to-do')}.`,
      choices: [{ id: 'done', label: 'Mark remaining as completed', primary: status === 'done' }, { id: 'canceled', label: 'Mark remaining as canceled', primary: status === 'canceled' }],
    });
    if (!r) return; mode = r;
  }
  commit(status === 'done' ? 'Complete Project' : 'Cancel Project', () => {
    remaining.forEach((t) => setStatus(t, mode));
    S.todos.filter((t) => inside.has(t.projectId) && t.isTemplate).forEach((t) => { t.trashed = true; });
    subs.filter((q) => q.status === 'open').forEach((q) => setStatus(q, mode));
    setStatus(p, status);
  });
  toast(`${status === 'done' ? 'Completed' : 'Canceled'} “${p.title || 'New Project'}”`, { undo: true });
  if (S.settings.logMode === 'immediate') setTimeout(() => { if (autoLog()) render(); }, 1300);
}
/* reopening a sub-project reopens the projects it's in, so it's back in your lists */
function reopenProject(p) { commit('Reopen Project', () => [p, ...projAncestors(p)].forEach((q) => { if (q.status !== 'open') setStatus(q, 'open'); })); }
/* send items to the Logbook now, whatever the Logbook setting. Open to-dos are completed first;
   an open project is left alone (Complete Project asks about its remaining to-dos). */
function loggableItems(ids) { return itemsFor(ids).filter((x) => !x.trashed && !x.isTemplate && !isTplChild(x) && !x.logged && !(x.type === 'project' && x.status === 'open')); }
function logItems(ids) {
  const items = loggableItems(ids);
  if (!items.length) return;
  const completing = items.some((x) => x.status === 'open');
  if (ui.editing && items.some((x) => x.id === ui.editing)) closeEditor({ noRender: true });
  commit('Move to Logbook', () => items.forEach((x) => {
    if (x.status === 'open') setStatus(x, 'done');
    x.logged = true; touch(x); ui.sel.delete(x.id);
    if (x.type === 'project') {
      const inside = new Set([x.id, ...projDescendants(x).map((q) => q.id)]);
      S.todos.forEach((t) => { if (inside.has(t.projectId) && t.status !== 'open' && !t.trashed && !t.logged) { t.logged = true; touch(t); } });
      S.projects.forEach((q) => { if (q !== x && inside.has(q.id) && q.status !== 'open' && !q.trashed && !q.logged) { q.logged = true; touch(q); } });
    }
  }));
  const what = items.length > 1 ? plural(items.length, 'item') : '';
  toast(completing ? `Completed${what ? ' ' + what : ''} and moved to the Logbook` : `Moved ${what ? what + ' ' : ''}to the Logbook`, { undo: true });
}

function trashItems(ids) {
  const items = itemsFor(ids);
  if (!items.length) return;
  commit('Delete', () => items.forEach((x) => { x.trashed = true; x.trashedAt = Date.now(); touch(x); ui.sel.delete(x.id); }));
  if (ui.editing && ids.includes(ui.editing)) ui.editing = null;
  if (ui.tplModal && ids.includes(ui.tplModal)) closeTplModal();
  toast(items.length > 1 ? `Moved ${items.length} items to Trash` : 'Moved to Trash', { undo: true });
  const vp = ui.view.type === 'project' && getP(ui.view.id);
  if (vp && [vp, ...projAncestors(vp)].some((q) => ids.includes(q.id))) navigate('today');
}
function restoreItems(ids) {
  commit('Put Back', () => itemsFor(ids).forEach((x) => {
    x.trashed = false; delete x.trashedAt;
    if (x.type === 'project' && x.areaId && !getA(x.areaId)) x.areaId = null;
    if (x.type === 'project' && x.parentId && !getP(x.parentId)) x.parentId = null;
    if (x.type === 'todo') {
      if (x.projectId && (!getP(x.projectId))) x.projectId = null;
      if (x.areaId && !getA(x.areaId)) x.areaId = null;
      x.headingId = null;
    }
    // what it's in comes back with it
    const p = x.type === 'todo' ? x.projectId && getP(x.projectId) : parentOf(x);
    if (p) [p, ...projAncestors(p)].forEach((q) => { if (q.trashed) { q.trashed = false; delete q.trashedAt; touch(q); } });
    touch(x);
  }));
  toast('Put back', { undo: true });
}
async function emptyTrash() {
  const n = S.todos.filter((t) => t.trashed).length + S.projects.filter((p) => p.trashed).length;
  if (!n) return;
  const ok = await confirmDialog({ title: 'Empty Trash?', body: `This permanently deletes ${plural(n, 'item')}. You can still undo right after.`, ok: 'Empty Trash', danger: true });
  if (!ok) return;
  commit('Empty Trash', () => {
    const deadProjects = new Set();
    S.projects.filter((p) => p.trashed).forEach((p) => { deadProjects.add(p.id); projDescendants(p).forEach((q) => deadProjects.add(q.id)); });
    S.todos = S.todos.filter((t) => !t.trashed && !deadProjects.has(t.projectId));
    S.projects = S.projects.filter((p) => !deadProjects.has(p.id));
  });
}

function toggleTagOn(ids, tagId) {
  if (isTagGroup(getTag(tagId))) return; // groups only organize tags
  const items = itemsFor(ids);
  const all = items.every((x) => x.tags.includes(tagId));
  commit('Tags', () => items.forEach((x) => { x.tags = all ? x.tags.filter((t) => t !== tagId) : x.tags.includes(tagId) ? x.tags : x.tags.concat(tagId); touch(x); }));
}
function removeTag(id, tagId) { const x = itemById(id) || getA(id); if (!x) return; commit('Tags', () => { x.tags = x.tags.filter((t) => t !== tagId); touch(x); }); }

function duplicateItems(ids) {
  const items = itemsFor(ids).filter((x) => x.type === 'todo');
  let last = null;
  commit('Duplicate', () => items.forEach((t) => {
    const c = makeTodo(JSON.parse(JSON.stringify(Object.assign({}, t, { id: undefined, createdAt: undefined }))));
    c.id = uid(); c.createdAt = Date.now(); c.status = 'open'; c.completedAt = null; c.logged = false; c.trashed = false;
    c.checklist = (t.checklist || []).map((i) => ({ id: uid(), title: i.title, done: i.done }));
    c.order = t.order + 0.001; c.todayOrder = t.todayOrder + 0.001;
    if (c.isTemplate) { c.isTemplate = false; c.repeat = null; c.next = null; c.start = 'anytime'; }
    c.templateId = null; c.linkId = null;
    S.todos.push(c); last = c;
  }));
  if (last) { ui.sel = new Set([last.id]); render(); }
}
/* A to-do becomes a project with its checklist items as to-dos. In a project, it becomes one of
   its sub-projects, so it stays where it was. */
function convertToProject(id) {
  const t = getT(id); if (!t) return;
  const parent = projectOf(t);
  let p;
  commit('Convert to Project', () => {
    const inherited = parent ? placeTagIds(t) : new Set(); // its project's tags come with being inside it
    p = makeProject({ title: t.title, notes: t.notes, priority: t.priority || 0, areaId: parent ? null : t.areaId || null, parentId: parent ? parent.id : null,
      tags: t.tags.filter((x) => !inherited.has(x)), start: t.start === 'someday' ? 'someday' : 'anytime', when: t.when, deadline: t.deadline,
      order: parent ? endOrder(childProjects(parent)) : endOrder(S.projects) });
    S.projects.push(p);
    (t.checklist || []).forEach((c, i) => S.todos.push(makeTodo({ title: c.title, projectId: p.id, start: 'anytime', status: c.done ? 'done' : 'open', completedAt: c.done ? Date.now() : null, order: i })));
    S.todos = S.todos.filter((x) => x !== t);
  });
  ui.editing = null; navigate('project:' + p.id);
}

/* ---- projects and areas ---- */
function newProject(areaId) {
  let p;
  commit('New Project', () => { p = makeProject({ areaId: areaId || null, order: endOrder(S.projects) }); S.projects.push(p); });
  navigate('project:' + p.id); ui.focusAfter = '[data-fkey="ptitle"]'; render();
}
function newArea() {
  let a;
  commit('New Area', () => { a = { id: uid(), title: '', tags: [], order: endOrder(S.areas) }; S.areas.push(a); });
  navigate('area:' + a.id); ui.focusAfter = '[data-fkey="atitle"]'; render();
}
async function deleteArea(a) {
  const projs = S.projects.filter((p) => p.areaId === a.id && !p.trashed);
  const todos = S.todos.filter((t) => t.areaId === a.id && !t.trashed);
  const ok = await confirmDialog({ title: 'Delete area?', body: `“${esc(a.title || 'New Area')}” will be removed. ${projs.length || todos.length ? `Its ${[projs.length ? plural(projs.length, 'project') : '', todos.length ? plural(todos.length, 'to-do') : ''].filter(Boolean).join(' and ')} will move to the Trash.` : ''}`, ok: 'Delete Area', danger: true });
  if (!ok) return;
  commit('Delete Area', () => {
    projs.forEach((p) => { p.trashed = true; p.areaId = null; });
    todos.forEach((t) => { t.trashed = true; t.areaId = null; });
    S.areas = S.areas.filter((x) => x !== a);
  });
  navigate('today');
}
/* A new sub-project at the end of a project's sub-projects, or right after one (opts.after) or
   before them all (opts.first), named right where it shows. On the sub-projects board, opts.stack
   puts its column under the one it was added below. Once it's named, Return carries straight on
   with its first to-do. */
function newSubProject(parentId, opts = {}) {
  const parent = getP(parentId); if (!parent || parent.trashed) return null;
  if (parent.status !== 'open') { toast('Reopen the project to add to it'); return null; }
  const sibs = childProjects(parent).filter((x) => !x.trashed).sort(byOrder);
  let p;
  commit('New Sub-Project', () => {
    let order = endOrder(sibs);
    if (opts.after || opts.first) { const a = opts.after && getP(opts.after), i = a ? sibs.indexOf(a) + 1 : 0; order = orderBetween(sibs[i - 1] ? sibs[i - 1].order : null, sibs[i] ? sibs[i].order : null)[0]; }
    p = makeProject({ parentId, order });
    S.projects.push(p);
  }, { render: false });
  if (opts.stack && ui.hUnder) { ui.hUnder.add(p.id); saveHUnder(); } // on the board, stacked under that column
  if (ui.editing) closeEditor({ noRender: true });
  ui.sel.clear(); ui.anchor = null;
  ui.renaming = { t: 'p', id: p.id, value: null, fresh: true };
  const shown = () => $(`#content [data-rename="p:${CSS.escape(p.id)}"]`);
  render();
  if (!shown()) { navigate('project:' + parentId); render(); } // not on screen here: open the project it's in
  const inp = shown();
  if (inp) { inp.focus(); return p; }
  ui.renaming = null; navigate('project:' + p.id); ui.focusAfter = '[data-fkey="ptitle"]'; render();
  return p;
}
/* a new sub-project left unnamed (Esc, or clicking away) isn't kept */
function dropFreshProject(p) {
  if (!p || p.title || S.todos.some((t) => t.projectId === p.id) || childProjects(p).length) return false;
  S.projects = S.projects.filter((x) => x !== p); reindex();
  const top = undoStack[undoStack.length - 1]; if (top && top.label === 'New Sub-Project') undoStack.pop();
  saveSoon(); return true;
}
/* put a project inside another one, with everything in it */
function moveProjectInto(p, targetId) {
  const to = getP(targetId);
  if (!p || !to || p.isTemplate || to.trashed) return;
  if (!canNestIn(p, to)) { toast('A project can’t go inside itself'); return; }
  commit('Move Into Project', () => {
    retagInside(p, () => placeProject(p, to.id, null)); touch(p);
    if (isSub(to)) ui.subCollapsed.delete(to.id); else { ui.expanded.add(to.id); lsSet('sectis.expanded', JSON.stringify([...ui.expanded])); } // open, so it shows
  });
  toast(`“${pTitle(p)}” is now in “${pTitle(to)}”`, { undo: true });
}
/* take a sub-project out of the project it's in: it goes right after that project */
function moveProjectOut(p) {
  const parent = parentOf(p); if (!parent) return;
  commit('Move Out of Project', () => {
    const sibs = S.projects.filter((q) => q !== p && !q.trashed && (parent.parentId ? q.parentId === parent.parentId : inArea(q, parent.areaId))).sort(byOrder);
    const i = sibs.indexOf(parent) + 1;
    retagInside(p, () => placeProject(p, parent.parentId || null, parent.parentId ? null : parent.areaId, orderBetween(sibs[i - 1] ? sibs[i - 1].order : null, sibs[i] ? sibs[i].order : null)[0]));
    touch(p);
  });
  toast(`Moved “${pTitle(p)}” out of “${pTitle(parent)}”`, { undo: true });
}
/* to-dos that arrive for a project that was merged into another (it became a heading there, which
   is a sub-project now) go to where it went */
function followMerges() {
  let changed = false;
  for (const p of S.projects) {
    if (!p.mergedInto || !p.trashed) continue; // put back from the Trash, it's a project again
    const to = getP(p.mergedInto.projectId || subIdFor(p.mergedInto.headingId || ''));
    if (!to || to.trashed || to.status !== 'open' || deadAbove(to)) continue;
    S.todos.forEach((t) => {
      if (t.projectId !== p.id || t.trashed || t.isDraft) return;
      const before = placeTagIds(t);
      t.projectId = to.id; t.headingId = null; t.areaId = null; retag(t, before); touch(t); changed = true;
    });
  }
  return changed;
}
function duplicateProject(p) {
  let c;
  commit('Duplicate Project', () => {
    c = makeProject(Object.assign({}, p, { id: uid(), title: (p.title || 'New Project') + ' copy', status: 'open', completedAt: null, logged: false, trashed: false, order: p.order + 0.01, createdAt: Date.now(), isTemplate: false, repeat: null, next: null, templateId: null }));
    c.tags = p.tags.slice(); S.projects.push(c);
    // its open to-dos and sub-projects (with theirs), all the way down
    const copyIn = (from, to) => {
      S.todos.filter((t) => t.projectId === from.id && !t.trashed && t.status === 'open' && !t.isTemplate).forEach((t) => {
        S.todos.push(makeTodo(Object.assign(JSON.parse(JSON.stringify(t)), { id: uid(), projectId: to.id, headingId: null, templateId: null, linkId: null, checklist: t.checklist.map((i) => ({ id: uid(), title: i.title, done: false })) })));
      });
      childProjects(from).filter((q) => !q.trashed && !q.isTemplate && q.status === 'open').forEach((q) => {
        const qc = makeProject(Object.assign({}, q, { id: uid(), parentId: to.id, createdAt: Date.now(), templateId: null, tags: q.tags.slice() }));
        S.projects.push(qc); copyIn(q, qc);
      });
    };
    copyIn(p, c);
  });
  navigate('project:' + c.id);
}

/* ---- creating to-dos ---- */
function createTodoIn(props, place = {}) {
  const t = makeTodo(props);
  // ordering: place.order / place.todayOrder override; otherwise top of its container and of Today
  const same = S.todos.filter((x) => !x.trashed && containerKey(x) === containerKey(t));
  t.order = place.order != null ? place.order : topOrder(same);
  t.todayOrder = place.todayOrder != null ? place.todayOrder : todayTop();
  S.todos.push(t); idx.todo.set(t.id, t);
  retag(t, new Set());
  return t;
}
function defaultsForView(extra = {}) {
  const v = ui.view, T = T0();
  const p = { start: 'inbox' };
  switch (v.type) {
    case 'today': Object.assign(p, { start: 'anytime', when: T, evening: !!extra.evening }); break;
    case 'upcoming': Object.assign(p, { start: 'anytime', when: extra.date || addDays(T, 1) }); break;
    case 'anytime': p.start = 'anytime'; break;
    case 'someday': p.start = 'someday'; break;
    case 'project': Object.assign(p, { start: 'anytime', projectId: v.id }); break;
    case 'area': Object.assign(p, { start: 'anytime', areaId: v.id }); break;
    case 'tag': p.tags = [v.id]; break;
    case 'deadlines': p.deadline = extra.deadline || T; break;
    case 'smart': if (getSmart(v.id)) Object.assign(p, smartNewProps(getSmart(v.id))); break;
    default: break;
  }
  if (extra.projectId !== undefined) { p.projectId = extra.projectId; p.areaId = null; p.start = p.start === 'inbox' ? 'anytime' : p.start; }
  if (extra.areaId !== undefined) { p.areaId = extra.areaId; p.projectId = null; p.start = p.start === 'inbox' ? 'anytime' : p.start; }
  if (ui.tagFilter && ui.tagFilter !== '__none') p.tags = Array.from(new Set((p.tags || []).concat(ui.tagFilter)));
  focusNewProps(p);
  return p;
}
