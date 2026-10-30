/* ===================== Templates =====================
   A template is a hidden project (with its headings and to-dos) or a hidden to-do (with its
   checklist) that you copy whenever you need a fresh one. They're stored like repeating
   templates (isTemplate) with blueprint: true and no repeat rule, so they sync like anything
   else and stay out of every list. A project template remembers a default area (bpAreaId). */
function isBlueprint(x) { return !!(x && x.isTemplate && x.blueprint); }
function projectBlueprints() { return S.projects.filter((p) => isBlueprint(p) && !p.trashed).sort((a, b) => pTitle(a).localeCompare(pTitle(b))); }
function todoBlueprints() { return S.todos.filter((t) => isBlueprint(t) && !t.trashed).sort((a, b) => (a.title || 'New To-Do').localeCompare(b.title || 'New To-Do')); }
const freshChecklist = (list) => (list || []).map((c) => ({ id: uid(), title: c.title, done: false }));

/* copy a project's headings and to-dos into another project */
function copyProjectContents(from, to, opts = {}) {
  const hmap = {};
  S.headings.filter((h) => h.projectId === from.id && !h.archived).sort(byOrder).forEach((h) => {
    const nh = { id: uid(), projectId: to.id, title: h.title, order: h.order, archived: false };
    hmap[h.id] = nh.id; S.headings.push(nh); idx.heading.set(nh.id, nh);
  });
  S.todos.filter((c) => c.projectId === from.id && !c.trashed && !c.isTemplate && !c.isDraft && (opts.all || c.status === 'open')).sort(byOrder).forEach((c) => {
    const t = makeTodo({
      title: c.title, notes: c.notes, tags: c.tags.slice(), priority: c.priority || 0, checklist: freshChecklist(c.checklist),
      projectId: to.id, headingId: c.headingId ? hmap[c.headingId] || null : null,
      start: c.start === 'someday' ? 'someday' : 'anytime', order: c.order, todayOrder: todayTop(),
    });
    S.todos.push(t); idx.todo.set(t.id, t);
    if (!to.isTemplate) retag(t, new Set());
  });
}
function saveProjectAsTemplate(p) {
  let bp;
  commit('Save as Template', () => {
    bp = makeProject({ title: p.title, notes: p.notes, tags: p.tags.slice(), priority: p.priority || 0, areaId: null, bpAreaId: p.areaId || null, isTemplate: true, blueprint: true, start: 'anytime', order: endOrder(S.projects) });
    S.projects.push(bp); idx.project.set(bp.id, bp);
    copyProjectContents(p, bp, { all: true });
  });
  toast(`Saved “${pTitle(p)}” as a template`, { action: 'Edit Template', fn: () => navigate('project:' + bp.id) });
}
function saveTodoAsTemplate(t) {
  let bp;
  commit('Save as Template', () => {
    bp = makeTodo({ title: t.title, notes: t.notes, tags: t.tags.slice(), priority: t.priority || 0, checklist: freshChecklist(t.checklist), isTemplate: true, blueprint: true, start: 'anytime', order: endOrder(S.todos.filter(isBlueprint)) });
    S.todos.push(bp);
  });
  toast(`Saved “${t.title || 'New To-Do'}” as a template`, { action: 'Show Templates', fn: () => navigate('templates') });
}
function newProjectTemplate() {
  let bp;
  commit('New Template', () => { bp = makeProject({ title: '', isTemplate: true, blueprint: true, areaId: null, bpAreaId: null, start: 'anytime', order: endOrder(S.projects) }); S.projects.push(bp); });
  navigate('project:' + bp.id); ui.focusAfter = '[data-fkey="ptitle"]'; render();
}
function newTodoTemplate() {
  let bp;
  commit('New Template', () => { bp = makeTodo({ title: '', isTemplate: true, blueprint: true, start: 'anytime', order: endOrder(S.todos.filter(isBlueprint)) }); S.todos.push(bp); }, { render: false });
  ui.focusAfter = `[data-fkey="title-${bp.id}"]`;
  openTplModal(bp.id);
}
/* areaId: undefined uses the template's default area; null means no area */
function newProjectFromTemplate(id, areaId) {
  const bp = getP(id); if (!bp) return;
  const area = areaId !== undefined ? areaId : (bp.bpAreaId && getA(bp.bpAreaId) ? bp.bpAreaId : null);
  let p;
  commit('New Project from Template', () => {
    p = makeProject({ title: bp.title, notes: bp.notes, tags: bp.tags.slice(), priority: bp.priority || 0, areaId: area, start: 'anytime', order: endOrder(S.projects) });
    S.projects.push(p); idx.project.set(p.id, p);
    copyProjectContents(bp, p);
  });
  navigate('project:' + p.id);
  const i = $('[data-fkey="ptitle"]'); if (i && !isCoarse()) { i.focus(); i.select(); }
  toast(`Made a project from “${pTitle(bp)}”. Give it a new name if you like.`, { undo: true });
  return p;
}
/* target: a Move-picker target ({type, id, headingId}), or { sec } for a section, or nothing for the current list */
function newTodoFromTemplate(id, target) {
  const bp = getT(id); if (!bp) return;
  let props;
  if (target && target.type) {
    props = target.type === 'project' ? { start: 'anytime', projectId: target.id, headingId: target.headingId || null }
      : target.type === 'area' ? { start: 'anytime', areaId: target.id } : { start: 'inbox' };
  } else {
    let sec = target && target.sec;
    if (!sec && ui.view.type === 'board') sec = boardNewSec();
    props = ['logbook', 'trash', 'templates'].includes(ui.view.type) && !sec ? { start: 'inbox' } : defaultsForView();
    if (sec) Object.assign(props, sectionProps(sec) || {});
    if (props._fromInbox && props.start === 'inbox') props.start = props._fromInbox;
  }
  for (const k of Object.keys(props)) if (k.startsWith('_') || props[k] === undefined) delete props[k];
  const pj = props.projectId && getP(props.projectId);
  if (pj && (pj.status !== 'open' || pj.trashed)) { toast('Reopen the project to add to-dos'); return; }
  closeEditor({ noRender: true }); closeTplModal();
  let t;
  commit('New To-Do from Template', () => {
    t = createTodoIn(Object.assign(props, { title: bp.title, notes: bp.notes, priority: bp.priority || 0, tags: Array.from(new Set((props.tags || []).concat(bp.tags))), checklist: freshChecklist(bp.checklist) }));
  }, { render: false });
  if (visibleInCurrentView(t) && !(isMobile() && ui.mobile === 'home')) { ui.editing = t.id; ui.sel = new Set([t.id]); ui.anchor = t.id; ui.scrollToEditor = true; render(); }
  else { render(); toast(`Added “${t.title || 'New To-Do'}” to ${placeLabel(t)}`, { action: 'Show', fn: () => revealTodo(t.id) }); }
  return t;
}
/* the "from template" menu; opts.kinds limits it to 'project' or 'todo', opts.sec / opts.areaId say where */
function openTemplatePicker(anchor, opts = {}) {
  const kinds = opts.kinds || ['project', 'todo'];
  const projs = kinds.includes('project') ? projectBlueprints() : [], todos = kinds.includes('todo') ? todoBlueprints() : [];
  if (!projs.length && !todos.length) {
    toast(kinds.length === 1 && kinds[0] === 'project' ? 'No project templates yet. Use Save as Template in a project’s ••• menu.' : 'No templates yet. Use Save as Template in a project’s or to-do’s ••• menu.', { action: 'Templates', fn: () => navigate('templates') });
    return null;
  }
  const items = [];
  if (projs.length) { items.push({ header: 'New Project' }); projs.forEach((p) => items.push({ label: pTitle(p), icon: 'project', fn: () => newProjectFromTemplate(p.id, opts.areaId) })); }
  if (todos.length) {
    if (items.length) items.push({ sep: 1 });
    items.push({ header: 'New To-Do' });
    todos.forEach((t) => items.push({ label: t.title || 'New To-Do', icon: 'template', fn: () => newTodoFromTemplate(t.id, opts.sec ? { sec: opts.sec } : null) }));
  }
  items.push({ sep: 1 }, { label: 'Manage Templates', icon: 'template', fn: () => navigate('templates') });
  return openMenu(anchor, items);
}
function openAddTodoTemplateTo(id, anchor) {
  return openMove([], anchor, { title: 'Add To', onPick: (target) => newTodoFromTemplate(id, target) });
}
function deleteTemplate(id) {
  const x = itemById(id); if (!x) return;
  closeTplModal();
  trashItems([id]);
  if (ui.view.type === 'project' && ui.view.id === id) navigate('templates');
}

/* ---- the Templates list ---- */
function viewTemplates() {
  const projs = projectBlueprints(), todos = todoBlueprints();
  let html = `<div class="lh"><span class="ic lh-ic" style="color:var(--c-template)">${I.template}</span><h1 class="lh-title">Templates</h1><button class="btn board-add" data-action="templates-new">${ic('plus')}<span>New Template</span></button></div>
    <div class="lh-sub">Copy a whole project, or a to-do with its checklist, whenever you need a fresh one.</div><div class="list">`;
  if (projs.length) {
    html += `<div class="sec-h"><span>Projects</span></div>`;
    html += projs.map((p) => {
      const hs = S.headings.filter((h) => h.projectId === p.id && !h.archived).length;
      const n = S.todos.filter((t) => t.projectId === p.id && !t.trashed && !t.isTemplate && !t.isDraft).length;
      const area = p.bpAreaId && getA(p.bpAreaId);
      const sub = [hs ? plural(hs, 'heading') : '', plural(n, 'to-do'), area ? 'Goes in ' + aTitle(area) : ''].filter(Boolean).join(' · ');
      return `<div class="row tpl-row" data-nav="project:${p.id}" title="Edit this template">${ic('project', 'r-ic tpl-ic')}<div class="r-main"><div class="r-line"><span class="r-title${p.title ? '' : ' untitled'}">${esc(pTitle(p))}</span>${tagPills(p)}</div><div class="r-sub">${esc(sub)}</div></div><div class="r-right"><button class="btn tpl-use" data-action="use-ptemplate" data-id="${p.id}">New Project</button></div></div>`;
    }).join('');
  }
  if (todos.length) {
    html += `<div class="sec-h"><span>To-Dos</span></div>`;
    html += todos.map((t) => {
      const sub = [t.checklist.length ? plural(t.checklist.length, 'checklist item') : '', t.notes && t.notes.trim() ? 'Notes' : ''].filter(Boolean).join(' · ');
      return `<div class="row tpl-row" data-tpl="${t.id}" title="Edit this template">${ic('template', 'r-ic tpl-ic')}<div class="r-main"><div class="r-line"><span class="r-title${t.title ? '' : ' untitled'}">${esc(t.title || 'New To-Do')}</span>${tagPills(t)}</div>${sub ? `<div class="r-sub">${esc(sub)}</div>` : ''}</div><div class="r-right"><button class="btn tpl-use" data-action="use-ttemplate" data-id="${t.id}">Add To…</button></div></div>`;
    }).join('');
  }
  html += '</div>';
  if (!projs.length && !todos.length) html += emptyHTML('template', 'No templates yet', 'Choose <b>Save as Template</b> from a project’s or to-do’s ••• menu, or click <b>New Template</b>. Then use it from the <b>+ New List</b> menu or any list’s ••• menu.');
  return html;
}
