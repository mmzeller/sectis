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

/* target: {type:'inbox'} | {type:'area', id} | {type:'project', id, headingId} | {type:'none'} */
function moveItems(ids, target, opts = {}) {
  const items = itemsFor(ids);
  if (!items.length) return;
  const fn = () => {
    for (const x of items) {
      if (x.type === 'project') {
        if (target.type === 'area') x.areaId = target.id;
        else if (target.type === 'none' || target.type === 'inbox') x.areaId = null;
        touch(x); continue;
      }
      const prevContainer = containerKey(x), prevTags = placeTagIds(x);
      if (target.type === 'inbox') { x.projectId = null; x.areaId = null; x.headingId = null; x.start = 'inbox'; x.when = null; x.evening = false; x.reminder = null; }
      else if (target.type === 'area') { x.areaId = target.id; x.projectId = null; x.headingId = null; if (x.start === 'inbox') x.start = 'anytime'; }
      else if (target.type === 'project') { x.projectId = target.id; x.areaId = null; x.headingId = target.headingId || null; if (x.start === 'inbox') x.start = 'anytime'; }
      else if (target.type === 'none') { x.projectId = null; x.areaId = null; x.headingId = null; if (x.start === 'inbox') x.start = 'anytime'; }
      if (prevContainer !== containerKey(x) && !opts.keepOrder) x.order = endOrder(S.todos.filter((t) => t !== x && containerKey(t) === containerKey(x)));
      retag(x, prevTags);
      touch(x);
    }
  };
  if (opts.noCommit) fn(); else commit('Move', fn);
  if (!opts.silent && !items.every((x) => x.isDraft)) {
    const name = target.type === 'inbox' ? 'Inbox' : target.type === 'area' ? (getA(target.id) || {}).title : target.type === 'project' ? (getP(target.id) || {}).title || 'New Project' : 'No Area';
    toast(`Moved to ${name || 'list'}`, { undo: true });
  }
}
function containerKey(t) { return t.projectId ? `p:${t.projectId}:${t.headingId || ''}` : t.areaId ? `a:${t.areaId}` : t.start === 'inbox' ? 'inbox' : 'loose'; }

function setStatus(x, status) {
  if (status === 'open') { x.status = 'open'; x.completedAt = null; x.logged = false; }
  else { x.status = status; x.completedAt = Date.now(); x.logged = false; if (x.templateId) onInstanceDone(x); }
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
async function completeProjectFlow(p, status = 'done') {
  const remaining = S.todos.filter((t) => t.projectId === p.id && t.status === 'open' && !t.trashed && !t.isTemplate);
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
    S.todos.filter((t) => t.projectId === p.id && t.isTemplate).forEach((t) => { t.trashed = true; });
    setStatus(p, status);
  });
  toast(`${status === 'done' ? 'Completed' : 'Canceled'} “${p.title || 'New Project'}”`, { undo: true });
  if (S.settings.logMode === 'immediate') setTimeout(() => { if (autoLog()) render(); }, 1300);
}
function reopenProject(p) { commit('Reopen Project', () => setStatus(p, 'open')); }
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
    if (x.type === 'project') S.todos.forEach((t) => { if (t.projectId === x.id && t.status !== 'open' && !t.trashed && !t.logged) { t.logged = true; touch(t); } });
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
  if (ui.view.type === 'project' && ids.includes(ui.view.id)) navigate('today');
}
function restoreItems(ids) {
  commit('Put Back', () => itemsFor(ids).forEach((x) => {
    x.trashed = false; delete x.trashedAt;
    if (x.type === 'project' && x.areaId && !getA(x.areaId)) x.areaId = null;
    if (x.type === 'todo') {
      if (x.projectId && (!getP(x.projectId))) x.projectId = null;
      const p = x.projectId && getP(x.projectId); if (p && p.trashed) { p.trashed = false; }
      if (x.areaId && !getA(x.areaId)) x.areaId = null;
      if (x.headingId && !getH(x.headingId)) x.headingId = null;
    }
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
    const deadProjects = new Set(S.projects.filter((p) => p.trashed).map((p) => p.id));
    S.todos = S.todos.filter((t) => !t.trashed && !deadProjects.has(t.projectId));
    S.projects = S.projects.filter((p) => !p.trashed);
    S.headings = S.headings.filter((h) => !deadProjects.has(h.projectId));
  });
}

function toggleTagOn(ids, tagId) {
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
function convertToProject(id) {
  const t = getT(id); if (!t) return;
  let p;
  commit('Convert to Project', () => {
    p = makeProject({ title: t.title, notes: t.notes, areaId: t.areaId || (projectOf(t) && projectOf(t).areaId) || null, tags: t.tags.slice(), start: t.start === 'someday' ? 'someday' : 'anytime', when: t.when, deadline: t.deadline, order: endOrder(S.projects) });
    S.projects.push(p);
    (t.checklist || []).forEach((c, i) => S.todos.push(makeTodo({ title: c.title, projectId: p.id, start: 'anytime', status: c.done ? 'done' : 'open', completedAt: c.done ? Date.now() : null, order: i })));
    S.todos = S.todos.filter((x) => x !== t);
  });
  ui.editing = null; navigate('project:' + p.id);
}

/* ---- projects, areas, headings ---- */
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
function newHeading(projectId, afterId) {
  let h;
  commit('New Heading', () => {
    const hs = S.headings.filter((x) => x.projectId === projectId && !x.archived);
    h = { id: uid(), projectId, title: '', order: endOrder(hs), archived: false };
    S.headings.push(h);
  });
  ui.focusAfter = `[data-fkey="h-${h.id}"]`; render();
}
async function deleteHeading(h) {
  const todos = S.todos.filter((t) => t.headingId === h.id && !t.trashed && t.status === 'open');
  if (todos.length) {
    const r = await choiceDialog({ title: 'Delete heading?', body: `The heading has ${plural(todos.length, 'to-do')}.`, choices: [{ id: 'keep', label: 'Keep its to-dos', primary: true }, { id: 'trash', label: 'Delete its to-dos too', danger: true }] });
    if (!r) return;
    commit('Delete Heading', () => {
      S.todos.filter((t) => t.headingId === h.id).forEach((t) => { if (r === 'trash' && t.status === 'open') t.trashed = true; t.headingId = null; });
      S.headings = S.headings.filter((x) => x !== h);
    });
  } else commit('Delete Heading', () => { S.todos.filter((t) => t.headingId === h.id).forEach((t) => { t.headingId = null; }); S.headings = S.headings.filter((x) => x !== h); });
}
async function archiveHeading(h) {
  const open = S.todos.filter((t) => t.headingId === h.id && t.status === 'open' && !t.trashed);
  if (open.length) {
    const ok = await confirmDialog({ title: 'Archive heading?', body: `Its ${plural(open.length, 'remaining to-do')} will be marked complete and moved to the Logbook.`, ok: 'Archive' });
    if (!ok) return;
  }
  commit('Archive Heading', () => {
    S.todos.filter((t) => t.headingId === h.id && !t.trashed).forEach((t) => { if (t.status === 'open') setStatus(t, 'done'); t.logged = true; });
    h.archived = true;
  });
  toast(`Archived “${h.title || 'heading'}”`, { undo: true });
}
function headingToProject(h) {
  const src = getP(h.projectId); let p;
  commit('Convert Heading', () => {
    p = makeProject({ title: h.title, areaId: src ? src.areaId : null, order: endOrder(S.projects) });
    S.projects.push(p);
    S.todos.filter((t) => t.headingId === h.id).forEach((t) => { const before = placeTagIds(t); t.projectId = p.id; t.headingId = null; retag(t, before); });
    S.headings = S.headings.filter((x) => x !== h);
  });
  navigate('project:' + p.id);
}
function moveHeading(h, projectId) {
  commit('Move Heading', () => {
    h.projectId = projectId; h.order = endOrder(S.headings.filter((x) => x.projectId === projectId));
    S.todos.filter((t) => t.headingId === h.id).forEach((t) => { const before = placeTagIds(t); t.projectId = projectId; retag(t, before); });
  });
}
function duplicateProject(p) {
  let c;
  commit('Duplicate Project', () => {
    c = makeProject(Object.assign({}, p, { id: uid(), title: (p.title || 'New Project') + ' copy', status: 'open', completedAt: null, logged: false, trashed: false, order: p.order + 0.01, createdAt: Date.now(), isTemplate: false, repeat: null, next: null, templateId: null }));
    c.tags = p.tags.slice(); S.projects.push(c);
    const hmap = {};
    S.headings.filter((h) => h.projectId === p.id && !h.archived).forEach((h) => { const nh = Object.assign({}, h, { id: uid(), projectId: c.id }); hmap[h.id] = nh.id; S.headings.push(nh); });
    S.todos.filter((t) => t.projectId === p.id && !t.trashed && t.status === 'open' && !t.isTemplate).forEach((t) => {
      S.todos.push(makeTodo(Object.assign(JSON.parse(JSON.stringify(t)), { id: uid(), projectId: c.id, headingId: t.headingId ? hmap[t.headingId] || null : null, templateId: null, checklist: t.checklist.map((i) => ({ id: uid(), title: i.title, done: false })) })));
    });
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
    case 'project': Object.assign(p, { start: 'anytime', projectId: v.id, headingId: extra.headingId || null }); break;
    case 'area': Object.assign(p, { start: 'anytime', areaId: v.id }); break;
    case 'tag': p.tags = [v.id]; break;
    default: break;
  }
  if (extra.projectId !== undefined) { p.projectId = extra.projectId; p.areaId = null; p.start = p.start === 'inbox' ? 'anytime' : p.start; }
  if (extra.areaId !== undefined) { p.areaId = extra.areaId; p.projectId = null; p.start = p.start === 'inbox' ? 'anytime' : p.start; }
  if (ui.tagFilter && ui.tagFilter !== '__none') p.tags = Array.from(new Set((p.tags || []).concat(ui.tagFilter)));
  return p;
}
