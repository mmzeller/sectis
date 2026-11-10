/* ===================== Templates =====================
   A template is a hidden project (with its to-dos and sub-projects) or a hidden to-do (with its
   checklist) that you copy whenever you need a fresh one. They're stored like repeating
   templates (isTemplate) with blueprint: true and no repeat rule, so they sync like anything
   else and stay out of every list. A project template remembers a default area (bpAreaId).

   Templates has its own place in the sidebar. On that page: New Template (a blank project or
   to-do, or one of your projects saved as one), and each template's row makes a copy, opens it
   for editing, duplicates it or deletes it (the buttons on the row, its ••• menu, a right-click
   or the keyboard). Dropping a project or to-dos on Templates in the sidebar saves them as
   templates. ⇧T, + New List and the ••• menus open the picker (openTemplatePicker) to make
   something from one wherever you are. A deleted template goes to the Trash, where Put Back
   brings it back; a new one you never named or filled in isn't kept at all. */
function isBlueprint(x) { return !!(x && x.isTemplate && x.blueprint); }
function projectBlueprints() { return S.projects.filter((p) => isBlueprint(p) && !p.trashed).sort((a, b) => pTitle(a).localeCompare(pTitle(b))); }
function todoBlueprints() { return S.todos.filter((t) => isBlueprint(t) && !t.trashed).sort((a, b) => (a.title || 'New To-Do').localeCompare(b.title || 'New To-Do')); }
const freshChecklist = (list) => (list || []).map((c) => ({ id: uid(), title: c.title, done: false }));
const keepColor = (p) => (placeColor(p) ? { color: p.color } : {});
const tplName = (x) => (x.type === 'project' ? pTitle(x) : x.title || 'New To-Do');

/* copy a project's to-dos and sub-projects (with theirs) into another project */
function copyProjectContents(from, to, opts = {}, seen = new Set([from.id])) {
  S.todos.filter((c) => c.projectId === from.id && !c.trashed && !c.isTemplate && !c.isDraft && (opts.all || c.status === 'open')).sort(byOrder).forEach((c) => {
    const t = makeTodo({
      title: c.title, notes: c.notes, tags: c.tags.slice(), priority: c.priority || 0, checklist: freshChecklist(c.checklist),
      projectId: to.id, start: c.start === 'someday' ? 'someday' : 'anytime', order: c.order, todayOrder: todayTop(),
    });
    S.todos.push(t); idx.todo.set(t.id, t);
    if (!to.isTemplate && !isTplChild(t)) retag(t, new Set());
  });
  childProjects(from).filter((q) => !q.trashed && !q.isTemplate && !seen.has(q.id) && (opts.all || q.status === 'open')).sort(byOrder).forEach((q) => {
    seen.add(q.id);
    const c = makeProject(Object.assign({ title: q.title, notes: q.notes, tags: q.tags.slice(), priority: q.priority || 0, parentId: to.id, start: q.start === 'someday' ? 'someday' : 'anytime', order: q.order }, keepColor(q)));
    S.projects.push(c); idx.project.set(c.id, c);
    copyProjectContents(q, c, opts, seen);
  });
}
function makeProjectBlueprint(p) {
  const bp = makeProject(Object.assign({ title: p.title, notes: p.notes, tags: p.tags.slice(), priority: p.priority || 0, areaId: null, bpAreaId: (areaOf(p) || {}).id || null, isTemplate: true, blueprint: true, start: 'anytime', order: endOrder(S.projects) }, keepColor(p)));
  S.projects.push(bp); idx.project.set(bp.id, bp);
  copyProjectContents(p, bp, { all: true });
  return bp;
}
function makeTodoBlueprint(t) {
  const bp = makeTodo({ title: t.title, notes: t.notes, tags: t.tags.slice(), priority: t.priority || 0, checklist: freshChecklist(t.checklist), isTemplate: true, blueprint: true, start: 'anytime', order: endOrder(S.todos.filter(isBlueprint)) });
  S.todos.push(bp); idx.todo.set(bp.id, bp);
  return bp;
}
const showTemplates = () => { if (ui.view.type !== 'templates') navigate('templates'); };
function saveProjectAsTemplate(p) {
  let bp;
  commit('Save as Template', () => { bp = makeProjectBlueprint(p); });
  toast(`Saved “${pTitle(p)}” as a template`, { action: 'Edit Template', fn: () => navigate('project:' + bp.id) });
  return bp;
}
function saveTodoAsTemplate(t) {
  let bp;
  commit('Save as Template', () => { bp = makeTodoBlueprint(t); });
  toast(`Saved “${t.title || 'New To-Do'}” as a template`, { action: 'Edit Template', fn: () => { showTemplates(); openTplModal(bp.id); } });
  return bp;
}
/* several at once (dropped on Templates in the sidebar): the projects and to-dos themselves stay where they are */
function saveAsTemplates(ids) {
  const items = itemsFor(ids).filter((x) => !x.trashed && !x.isTemplate && !isTplChild(x) && !(x.type === 'project' && deadAbove(x)));
  if (!items.length) { toast('That’s already a template'); return; }
  if (items.length === 1) { if (items[0].type === 'project') saveProjectAsTemplate(items[0]); else saveTodoAsTemplate(items[0]); return; }
  commit('Save as Templates', () => items.forEach((x) => (x.type === 'project' ? makeProjectBlueprint(x) : makeTodoBlueprint(x))));
  toast(`Saved ${items.length} templates`, { action: 'Show Templates', fn: showTemplates });
}
function newProjectTemplate() {
  let bp;
  commit('New Template', () => { bp = makeProject({ title: '', isTemplate: true, blueprint: true, areaId: null, bpAreaId: null, start: 'anytime', order: endOrder(S.projects) }); S.projects.push(bp); });
  navigate('project:' + bp.id); ui.focusAfter = '[data-fkey="ptitle"]'; render();
}
function newTodoTemplate() {
  showTemplates();
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
    p = makeProject(Object.assign({ title: bp.title, notes: bp.notes, tags: bp.tags.slice(), priority: bp.priority || 0, areaId: area, start: 'anytime', order: endOrder(S.projects) }, keepColor(bp)));
    S.projects.push(p); idx.project.set(p.id, p);
    copyProjectContents(bp, p);
  });
  navigate('project:' + p.id);
  const i = $('[data-fkey="ptitle"]'); if (i && !isCoarse()) { i.focus(); i.select(); }
  toast(`Made a project from “${pTitle(bp)}”. Give it a new name if you like.`, { undo: true });
  return p;
}
/* target: a Move-picker target ({type, id}), or { sec } for a section, or nothing for the current list */
function newTodoFromTemplate(id, target) {
  const bp = getT(id); if (!bp) return;
  let props;
  if (target && target.type) {
    props = target.type === 'project' ? { start: 'anytime', projectId: target.id }
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
/* what a template holds, in a line: "4 to-dos · 2 sub-projects · Goes in Home" */
function tplSummary(x, opts = {}) {
  if (x.type === 'project') {
    const subs = projDescendants(x).filter((q) => !q.trashed && !q.isTemplate), inside = new Set([x.id, ...subs.map((q) => q.id)]);
    const n = S.todos.filter((t) => inside.has(t.projectId) && !t.trashed && !t.isTemplate && !t.isDraft).length;
    const area = x.bpAreaId && getA(x.bpAreaId);
    return [plural(n, 'to-do'), subs.length ? plural(subs.length, 'sub-project') : '', area && !opts.noArea ? 'Goes in ' + aTitle(area) : ''].filter(Boolean).join(' · ');
  }
  return [x.checklist.length ? plural(x.checklist.length, 'checklist item') : '', x.notes && x.notes.trim() ? 'Notes' : '', prio(x) ? PRIORITY_NAMES[prio(x)] + ' priority' : ''].filter(Boolean).join(' · ');
}
/* Make something from a template: a small window with a search box, the project templates,
   then the to-do templates. opts.kinds limits it to 'project' or 'todo'; opts.sec says which
   section a to-do goes in, opts.areaId which area a project goes in. */
function openTemplatePicker(anchor, opts = {}) {
  const kinds = opts.kinds || ['project', 'todo'], only = kinds.length === 1 ? kinds[0] : null;
  const projs = kinds.includes('project') ? projectBlueprints() : [], todos = kinds.includes('todo') ? todoBlueprints() : [];
  const none = !projs.length && !todos.length;
  const build = (q = '') => {
    const ql = q.trim().toLowerCase(), m = (x) => !ql || tplName(x).toLowerCase().includes(ql);
    const ps = projs.filter(m), ts = todos.filter(m);
    const item = (x) => `<button class="pick-i tp-i" data-tp="${x.id}">${ic(x.type === 'project' ? 'project' : 'template')}<span>${esc(tplName(x))}${tplSummary(x) ? `<small class="pick-in">${esc(tplSummary(x))}</small>` : ''}</span></button>`;
    let out = '';
    if (ps.length) out += (only ? '' : '<div class="menu-h">New Project</div>') + ps.map(item).join('');
    if (ts.length) out += (only ? '' : '<div class="menu-h">New To-Do</div>') + ts.map(item).join('');
    return out || `<p class="note" style="padding:6px 10px">No templates named that.</p>`;
  };
  const empty = `<p class="tp-none">${only === 'project' ? 'No project templates yet.' : only === 'todo' ? 'No to-do templates yet.' : 'No templates yet.'} Save ${only === 'todo' ? 'a to-do' : only === 'project' ? 'a project' : 'a project or a to-do'} as one from its ••• menu, or start one from scratch.</p>`;
  const foot = (none && kinds.includes('project') ? `<button class="menu-i" data-tpx="new-p">${ic('plus')}<span>New Project Template</span></button>` : '')
    + (none && kinds.includes('todo') ? `<button class="menu-i" data-tpx="new-t">${ic('plus')}<span>New To-Do Template</span></button>` : '')
    + `<button class="menu-i" data-tpx="manage">${ic('template')}<span>${none ? 'Go to Templates' : 'Manage Templates'}</span></button>`;
  const L = openLayer({ anchor, cls: 'move-pop tp-pop', html: `<div class="pk-h">${only === 'project' ? 'New Project from Template' : only === 'todo' ? 'New To-Do from Template' : 'New from Template'}</div>${none ? empty : `<input class="pk-in" id="tp-in" placeholder="Find a template" autocomplete="off" aria-label="Find a template"><div class="pick-list" id="tp-list">${build()}</div>`}<div class="pk-sep"></div>${foot}`,
    onMount: (el) => {
      const inp = $('#tp-in', el), list = $('#tp-list', el);
      const nav = listKeys(el, '.pick-i, .menu-i', inp || undefined);
      if (inp) { inp.addEventListener('input', () => { list.innerHTML = build(inp.value); nav.first(); }); if (!isCoarse()) inp.focus({ preventScroll: true }); }
      el.addEventListener('click', (e) => {
        const x = e.target.closest('[data-tpx]');
        if (x) { closeLayer(L); if (x.dataset.tpx === 'new-p') newProjectTemplate(); else if (x.dataset.tpx === 'new-t') newTodoTemplate(); else navigate('templates'); return; }
        const b = e.target.closest('[data-tp]'); if (!b) return;
        closeLayer(L);
        const t = itemById(b.dataset.tp); if (!isBlueprint(t)) return;
        if (t.type === 'project') newProjectFromTemplate(t.id, opts.areaId);
        else newTodoFromTemplate(t.id, opts.sec ? { sec: opts.sec } : null);
      });
    } });
  return L;
}
function openAddTodoTemplateTo(id, anchor) {
  return openMove([], anchor, { title: 'Add To', onPick: (target) => newTodoFromTemplate(id, target) });
}
const tplArea = (bp) => (bp && bp.bpAreaId && getA(bp.bpAreaId)) || null;
/* a project template in an area you choose this once */
function openProjectTemplateIn(id, anchor) {
  const bp = getP(id); if (!bp) return null;
  return openMove([], anchor, { title: 'New Project In', areasOnly: true, placeholder: 'Find an area', cur: { areaId: (tplArea(bp) || {}).id || null }, onPick: (tg) => newProjectFromTemplate(id, tg.type === 'area' ? tg.id : null) });
}
/* the area new projects from this template go in */
function openTemplateArea(id, anchor) {
  const bp = getP(id); if (!bp) return null;
  return openMove([], anchor, { title: 'New Projects Go In', areasOnly: true, placeholder: 'Find an area', cur: { areaId: (tplArea(bp) || {}).id || null }, onPick: (tg) => commit('Template Area', () => { bp.bpAreaId = tg.type === 'area' ? tg.id : null; touch(bp); }) });
}
function editTemplate(id) {
  const x = itemById(id); if (!isBlueprint(x)) return;
  if (x.type === 'project') navigate('project:' + id); else { showTemplates(); openTplModal(id); }
}
function duplicateTemplate(id) {
  const x = itemById(id); if (!isBlueprint(x)) return;
  closeTplModal();
  commit('Duplicate Template', () => {
    if (x.type === 'project') {
      const c = makeProject(Object.assign({ title: pTitle(x) + ' copy', notes: x.notes, tags: x.tags.slice(), priority: x.priority || 0, areaId: null, bpAreaId: x.bpAreaId || null, isTemplate: true, blueprint: true, start: 'anytime', order: endOrder(S.projects) }, keepColor(x)));
      S.projects.push(c); idx.project.set(c.id, c);
      copyProjectContents(x, c, { all: true });
    } else {
      S.todos.push(makeTodo({ title: tplName(x) + ' copy', notes: x.notes, tags: x.tags.slice(), priority: x.priority || 0, checklist: freshChecklist(x.checklist), isTemplate: true, blueprint: true, start: 'anytime', order: endOrder(S.todos.filter(isBlueprint)) }));
    }
  }, { render: false });
  if (ui.view.type !== 'templates') navigate('templates'); else render();
  toast(`Duplicated “${tplName(x)}”`, { undo: true });
}
/* a new template you never named or put anything in */
function isEmptyBlueprint(x) {
  if (!isBlueprint(x) || x.trashed || itemById(x.id) !== x) return false;
  if (x.title || (x.notes || '').trim() || x.tags.length) return false;
  if (x.type === 'project') return !S.todos.some((t) => t.projectId === x.id && !t.trashed) && !childProjects(x).length;
  return !x.checklist.length;
}
/* …isn't kept: leaving it (another page, closing its window) takes it away again */
function dropEmptyBlueprint(x) {
  if (!isEmptyBlueprint(x)) return false;
  if (x.type === 'project') { S.todos = S.todos.filter((t) => t.projectId !== x.id); S.projects = S.projects.filter((p) => p !== x); }
  else S.todos = S.todos.filter((t) => t !== x);
  const top = undoStack[undoStack.length - 1]; if (top && top.label === 'New Template') undoStack.pop();
  reindex(); saveSoon(); return true;
}
/* to the Trash, where Put Back brings it back */
function deleteTemplate(id) {
  const x = itemById(id); if (!isBlueprint(x) || x.trashed) return;
  const vp = ui.view.type === 'project' && getP(ui.view.id), inside = !!vp && (vp.id === id || projAncestors(vp).some((q) => q.id === id));
  const empty = isEmptyBlueprint(x);
  closeTplModal(); // (an empty to-do template goes as its window closes)
  if (empty) { if (inside) navigate('templates'); else { dropEmptyBlueprint(x); render(); } return; }
  commit('Delete Template', () => { x.trashed = true; x.trashedAt = Date.now(); touch(x); }, { render: !inside });
  if (inside) navigate('templates');
  toast(`Moved the template “${tplName(x)}” to the Trash`, { undo: true });
}
/* pick one of your projects to save as a template */
function openSaveProjectAsTemplate(anchor) {
  if (!S.projects.some((p) => !p.trashed && !p.isTemplate && p.status === 'open' && !deadAbove(p))) { toast('There are no open projects to save as a template yet'); return null; }
  return openMove([], anchor, { title: 'Save as Template', noInbox: true, noAreas: true, placeholder: 'Find a project', onPick: (tg) => { const p = tg.type === 'project' && getP(tg.id); if (p) { saveProjectAsTemplate(p); showTemplates(); } } });
}
function newTemplateMenuItems(anchor) {
  return [
    { label: 'New Project Template', icon: 'project', fn: newProjectTemplate },
    { label: 'New To-Do Template', icon: 'template', fn: newTodoTemplate },
    { sep: 1 },
    { label: 'From One of Your Projects…', icon: 'copy', fn: () => openSaveProjectAsTemplate(anchor && anchor.isConnected ? anchor : null) },
  ];
}
/* what you can do with a template. opts.page: it's the page (or window) you're on, so no
   header and no Edit; its own menu adds what only makes sense there. */
function templateMenuItems(id, anchor, opts = {}) {
  const x = itemById(id); if (!isBlueprint(x)) return [];
  const at = () => (anchor && anchor.isConnected === false ? null : anchor);
  const items = opts.page ? [] : [{ header: tplName(x) }];
  if (x.type === 'project') {
    const area = tplArea(x);
    items.push({ label: area ? `New Project in ${aTitle(area)}` : 'New Project', icon: 'project', fn: () => newProjectFromTemplate(id) });
    if (S.areas.length) items.push({ label: 'New Project In…', icon: 'area', fn: () => openProjectTemplateIn(id, at()) });
    items.push({ sep: 1 });
    if (!opts.page) items.push({ label: 'Edit Template', icon: 'pencil', fn: () => editTemplate(id) });
    if (S.areas.length) items.push({ label: 'New Projects Go In…', icon: 'area', hint: area ? aTitle(area) : 'No Area', fn: () => openTemplateArea(id, at()) });
  } else {
    items.push({ label: 'Add To…', icon: 'move', fn: () => openAddTodoTemplateTo(id, at()) });
    items.push({ label: 'Add to Inbox', icon: 'inbox', fn: () => newTodoFromTemplate(id, { type: 'inbox' }) });
    items.push({ sep: 1 });
    if (!opts.page) items.push({ label: 'Edit Template', icon: 'pencil', fn: () => editTemplate(id) });
  }
  if (opts.more) items.push(...opts.more);
  items.push({ label: 'Duplicate Template', icon: 'copy', fn: () => duplicateTemplate(id) });
  if (opts.page && x.type === 'project') items.push({ label: 'All Templates', icon: 'template', fn: () => navigate('templates') });
  items.push({ sep: 1 }, { label: 'Delete Template', icon: 'trash', danger: true, fn: () => deleteTemplate(id) });
  return items;
}
/* a template's own menu: on its row, or by right-clicking it */
function templateMenu(id, anchor) {
  const items = templateMenuItems(id, anchor);
  return items.length ? openMenu(anchor, items) : null;
}

/* ---- the Templates page ---- */
function tplRowHTML(x) {
  const isP = x.type === 'project', area = isP && tplArea(x);
  const use = isP ? (area ? `Make a new project from this template, in ${aTitle(area)}` : 'Make a new project from this template') : 'Add a to-do from this template to a list';
  return `<div class="tpl-row" ${isP ? `data-nav="project:${x.id}"` : `data-tpl="${x.id}"`} data-tplrow="${x.id}" tabindex="0" role="button" aria-label="Edit the template ${esc(tplName(x))}">${ic(isP ? 'project' : 'template', 'tpl-ic')}<div class="r-main"><div class="r-line"><span class="r-title${x.title ? '' : ' untitled'}">${esc(tplName(x))}</span>${tagPills(x)}</div>${tplSummary(x) ? `<div class="r-sub">${esc(tplSummary(x))}</div>` : ''}</div><div class="tpl-acts"><button class="btn tpl-use" data-action="${isP ? 'use-ptemplate' : 'use-ttemplate'}" data-id="${x.id}" title="${esc(use)}">${isP ? 'New Project' : 'Add To…'}</button><button class="ib tpl-del" data-action="delete-template" data-id="${x.id}" aria-label="Delete the template ${esc(tplName(x))}" title="Delete this template">${ic('trash')}</button><button class="ib tpl-more" data-action="tpl-menu" data-id="${x.id}" aria-label="More for the template ${esc(tplName(x))}" title="More">${ic('more')}</button></div></div>`;
}
function tplListHTML() {
  const ql = (ui.tplQuery || '').trim().toLowerCase();
  const m = (x) => !ql || [tplName(x), x.notes || '', ...(x.tags || []).map(tagTitle)].join(' ').toLowerCase().includes(ql);
  const projs = projectBlueprints().filter(m), todos = todoBlueprints().filter(m);
  let html = '';
  if (projs.length) html += `<div class="sec-h tpl-h"><span>Projects</span><span class="ghost-count">${projs.length}</span></div>${projs.map(tplRowHTML).join('')}`;
  if (todos.length) html += `<div class="sec-h tpl-h"><span>To-Dos</span><span class="ghost-count">${todos.length}</span></div>${todos.map(tplRowHTML).join('')}`;
  return html || `<p class="tpl-nomatch">No templates match “${esc((ui.tplQuery || '').trim())}”.</p>`;
}
function viewTemplates() {
  const n = projectBlueprints().length + todoBlueprints().length;
  let html = `<div class="lh"><span class="ic lh-ic" style="color:var(--c-template)">${I.template}</span><h1 class="lh-title">Templates</h1>${n ? `<button class="btn primary board-add" data-action="templates-new">${ic('plus')}<span>New Template</span></button>` : ''}</div>
    <div class="lh-sub">Projects and to-dos you can make a fresh copy of whenever you need one.</div>`;
  if (!n) {
    ui.tplQuery = '';
    return html + `<div class="empty tpl-empty">${ic('template')}<p><b>No templates yet</b></p><p>A project template keeps its to-dos, sub-projects and checklists. A to-do template keeps its notes and checklist.</p><div class="tpl-empty-btns"><button class="btn primary" data-action="tpl-new-project">${ic('plus')}<span>Project Template</span></button><button class="btn" data-action="tpl-new-todo">${ic('plus')}<span>To-Do Template</span></button></div><p class="tpl-empty-or">Already have a project that fits? <button class="link-btn" data-action="tpl-from-project">Save it as a template</button>${isCoarse() ? '' : ', or drag it onto Templates in the sidebar'}.</p></div>`;
  }
  if (n > 6 || ui.tplQuery) html += `<label class="tpl-find">${ic('search')}<input id="tpl-q" data-fkey="tpl-q" type="text" placeholder="Find a template" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Find a template" value="${esc(ui.tplQuery || '')}"></label>`;
  return html + `<div class="list tpl-list" id="tpl-list">${tplListHTML()}</div>`;
}
/* templates in the Trash: a row each, with Put Back */
function trashedTemplatesHTML(list) {
  if (!list.length) return '';
  return `<div class="sec-h tpl-h"><span>Templates</span><span class="ghost-count">${list.length}</span></div>` + list.map((x) => {
    const isP = x.type === 'project';
    return `<div class="tpl-row trashed-row"${isP ? ` data-nav="project:${x.id}" title="Open it to see what’s in it"` : ''}>${ic(isP ? 'project' : 'template', 'tpl-ic')}<div class="r-main"><div class="r-line"><span class="r-title${x.title ? '' : ' untitled'}">${esc(tplName(x))}</span></div><div class="r-sub">${esc([isP ? 'Project template' : 'To-do template', tplSummary(x, { noArea: true })].filter(Boolean).join(' · '))}</div></div><div class="tpl-acts"><button class="restore" data-action="restore" data-id="${x.id}">Put Back</button></div></div>`;
  }).join('');
}
/* typing in the Templates page's search box redraws just its list */
document.addEventListener('input', (e) => {
  if (!e.target || e.target.id !== 'tpl-q') return;
  ui.tplQuery = e.target.value;
  const list = $('#tpl-list'); if (list) list.innerHTML = tplListHTML();
});
/* a template's row with the keyboard: Return edits it, ⌫ deletes it, ↑ ↓ move between rows */
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t && t.id === 'tpl-q') {
    if (e.key === 'Escape' && t.value) { e.preventDefault(); e.stopImmediatePropagation(); t.value = ''; ui.tplQuery = ''; const list = $('#tpl-list'); if (list) list.innerHTML = tplListHTML(); }
    else if (e.key === 'ArrowDown') { const r = $('#content .tpl-row'); if (r) { e.preventDefault(); e.stopImmediatePropagation(); r.focus(); } }
    return;
  }
  if (!t || !t.matches || !t.matches('#content .tpl-row[data-tplrow]') || e.metaKey || e.ctrlKey || e.altKey || layers.length) return;
  const id = t.dataset.tplrow, rows = $$('#content .tpl-row[data-tplrow]'), i = rows.indexOf(t);
  const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (e.key === 'Enter' || e.key === ' ') { stop(); editTemplate(id); }
  else if (e.key === 'Backspace' || e.key === 'Delete') { stop(); deleteTemplate(id); const left = $$('#content .tpl-row[data-tplrow]'), again = left[Math.min(i, left.length - 1)]; if (again) again.focus(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { stop(); const n = rows[i + (e.key === 'ArrowDown' ? 1 : -1)] || (e.key === 'ArrowUp' ? $('#tpl-q') : null); if (n) n.focus(); }
}, true);
