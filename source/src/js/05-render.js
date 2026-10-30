/* ===================== Rendering ===================== */
const LISTS = {
  inbox: { title: 'Inbox', icon: 'inbox', color: 'var(--c-inbox)' },
  today: { title: 'Today', icon: 'star', color: 'var(--c-today)' },
  upcoming: { title: 'Upcoming', icon: 'calendar', color: 'var(--c-upcoming)' },
  anytime: { title: 'Anytime', icon: 'layers', color: 'var(--c-anytime)' },
  someday: { title: 'Someday', icon: 'box', color: 'var(--c-someday)' },
  waiting: { title: 'Waiting', icon: 'hourglass', color: 'var(--c-waiting)' },
  logbook: { title: 'Logbook', icon: 'logbook', color: 'var(--c-logbook)' },
  trash: { title: 'Trash', icon: 'trash', color: 'var(--c-trash)' },
  board: { title: 'Board', icon: 'columns', color: 'var(--c-board)' },
  templates: { title: 'Templates', icon: 'template', color: 'var(--c-template)' },
};
const byOrder = (a, b) => a.order - b.order || a.createdAt - b.createdAt;
const byToday = (a, b) => ((a.type === 'project' ? 0 : 1) - (b.type === 'project' ? 0 : 1)) || a.todayOrder - b.todayOrder || a.createdAt - b.createdAt;
const pTitle = (p) => (p && p.title) || 'New Project';
const aTitle = (a) => (a && a.title) || 'New Area';

function render() {
  if (!S) return;
  tagRankCache = null;
  if (ensureTagColors()) saveSoon();
  if (followMerges()) { reindex(); saveSoon(); }
  autoLog();
  applyTheme();
  const f = captureFocus();
  renderSidebar();
  renderMain();
  renderBatch();
  renderShell();
  if (ui.tplModal) renderTplModal();
  restoreFocus(f);
  afterRender();
}
function captureFocus() {
  const a = document.activeElement;
  if (!a || !a.dataset || !a.dataset.fkey) return null;
  return { key: a.dataset.fkey, s: a.selectionStart, e: a.selectionEnd };
}
function restoreFocus(f) {
  if (ui.focusAfter) { const el = $(ui.focusAfter); ui.focusAfter = null; if (el) { el.focus({ preventScroll: false }); if (el.select && !el.value) el.select(); return; } }
  if (!f) return;
  const el = document.querySelector(`[data-fkey="${CSS.escape(f.key)}"]`);
  if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(f.s, f.e); } catch (e) { /* not a text field */ } }
}
function afterRender() {
  $$('textarea[data-autosize]').forEach(autosize);
  if (ui.scrollToEditor) {
    ui.scrollToEditor = false;
    const card = $('#content .card');
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
function autosize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
function renderShell() {
  const app = $('#app');
  app.classList.toggle('m-home', ui.mobile === 'home');
  app.classList.toggle('m-list', ui.mobile !== 'home');
  app.classList.toggle('sel-mode', ui.selectMode);
  app.classList.toggle('touch', isCoarse());
  app.classList.toggle('compact', S.settings.density === 'compact');
  const magic = $('#magic');
  const hide = ui.sel.size > 1 || ui.selectMode || (!(isMobile() && ui.mobile === 'home') && ['logbook', 'trash', 'templates'].includes(ui.view.type));
  magic.classList.toggle('hidden-in', hide);
  const L = LISTS[ui.view.type];
  document.title = isMobile() && ui.mobile === 'home' ? 'Sectis' : `${L ? L.title : ui.view.type === 'project' ? pTitle(getP(ui.view.id)) : ui.view.type === 'area' ? aTitle(getA(ui.view.id)) : ui.view.type === 'tag' ? tagTitle(ui.view.id) : 'Sectis'} – Sectis`;
}

/* ---------- sidebar ---------- */
function renderSidebar() {
  const c = counts(), v = ui.view;
  // open to-dos per project and per area (an area's count includes its projects)
  const openIn = { p: new Map(), a: new Map() };
  for (const t of S.todos) {
    if (t.status !== 'open' || t.trashed || t.isTemplate || t.isDraft || !inLiveProject(t)) continue;
    if (t.projectId) openIn.p.set(t.projectId, (openIn.p.get(t.projectId) || 0) + 1);
    const ar = areaOf(t); if (ar) openIn.a.set(ar.id, (openIn.a.get(ar.id) || 0) + 1);
  }
  const cnt = (n) => (n ? `<span class="sb-count">${n}</span>` : '');
  // areas can hide the projects listed under them; the project you have open stays visible
  const areaToggle = (a, n) => (n ? `<span class="sb-disc${ui.sbCollapsed.has(a.id) ? '' : ' open'}" data-sbtoggle="${a.id}" role="button" aria-expanded="${!ui.sbCollapsed.has(a.id)}" aria-label="${ui.sbCollapsed.has(a.id) ? 'Show' : 'Hide'} projects in ${esc(aTitle(a))}" title="${ui.sbCollapsed.has(a.id) ? 'Show' : 'Hide'} projects (⌥-click for all areas)">${ic('chevR')}</span>` : '');
  const sbAreaProjects = (a, list) => (ui.sbCollapsed.has(a.id) ? list.filter((p) => v.type === 'project' && v.id === p.id) : list);
  const on = (key) => (v.type + (v.id ? ':' + v.id : '')) === key ? ' on' : '';
  const item = (key, cnt, extra = '') => {
    const L = LISTS[key];
    return `<button class="sb-item${on(key)}" data-nav="${key}" data-drop-list="${key}"><span class="ic" style="color:${L.color}">${I[L.icon]}</span><span class="sb-name">${L.title}</span>${extra}${cnt ? `<span class="sb-count">${cnt}</span>` : ''}</button>`;
  };
  const projRow = (p) => {
    const pr = projectProgress(p);
    return `<button class="sb-item sb-proj${on('project:' + p.id)}" data-nav="project:${p.id}" data-drop-list="project:${p.id}" data-drag="project" data-kind="project" data-id="${p.id}" data-sb="1">${pieIc(pr.frac)}<span class="sb-name${p.title ? '' : ' untitled'}">${esc(pTitle(p))}</span>${p.deadline && p.deadline <= T0() ? `<span class="sb-due">!</span>` : ''}${cnt(openIn.p.get(p.id))}</button>`;
  };
  const sbProjects = (areaId) => S.projects.filter((p) => !p.trashed && !p.isTemplate && p.status === 'open' && p.start !== 'someday' && (p.areaId || null) === areaId).sort(byOrder);
  let html = `<div class="sb-top"><div class="sb-brand">Sectis</div><button class="sb-find" data-action="find">${ic('search')}<span>Quick Find</span><kbd>/</kbd></button></div><nav class="sb-scroll" id="sb-scroll">`;
  html += `<div class="sb-group">${item('inbox', c.inbox)}</div>`;
  html += `<div class="sb-group">${item('today', c.today, c.due ? `<span class="sb-due" title="Deadlines due">${c.due}</span>` : '')}${item('upcoming')}${item('anytime')}${item('someday')}${c.waiting || ui.view.type === 'waiting' ? item('waiting', c.waiting) : ''}</div>`;
  html += `<div class="sb-group">${item('logbook')}${item('trash')}</div>`;
  html += `<div class="sb-group sb-board-g"><button class="sb-item${on('board')}" data-nav="board" title="Projects and areas side by side (8)"><span class="ic" style="color:var(--c-board)">${I.columns}</span><span class="sb-name">Board</span></button></div>`;
  const loose = sbProjects(null);
  if (loose.length) html += `<div class="sb-group" data-sb-area="">${loose.map(projRow).join('')}</div>`;
  S.areas.slice().sort(byOrder).forEach((a) => {
    html += `<div class="sb-group" data-sb-area="${a.id}"><button class="sb-item sb-area-row${on('area:' + a.id)}" data-nav="area:${a.id}" data-drop-list="area:${a.id}" data-drag="area" data-kind="area" data-id="${a.id}" data-sb="1">${ic('area')}<span class="sb-name${a.title ? '' : ' untitled'}">${esc(aTitle(a))}</span>${cnt(openIn.a.get(a.id))}${areaToggle(a, sbProjects(a.id).length)}</button>${sbAreaProjects(a, sbProjects(a.id)).map(projRow).join('')}</div>`;
  });
  html += `</nav><div class="sb-foot"><button class="sb-new" data-action="new-list">${ic('plus')}<span>New List</span></button><button class="ib sync-ind" id="sync-ind" data-action="settings" aria-label="Sync status" hidden>${ic('cloud')}</button><button class="ib" data-action="quick-entry" aria-label="Quick Entry" title="Quick Entry (Q)">${ic('bolt')}</button><button class="ib" data-action="settings" aria-label="Settings" title="Settings">${ic('gear')}</button></div>`;
  const sb = $('#sidebar');
  const scroll = $('#sb-scroll'); const st = scroll ? scroll.scrollTop : 0;
  sb.innerHTML = html;
  $('#sb-scroll').scrollTop = st;
  renderSyncIndicator();
}

/* ---------- rows ---------- */
function checkboxHTML(x) {
  return `<button class="cb ${x.status !== 'open' ? x.status : ''}" data-action="toggle" data-id="${x.id}" aria-label="${x.status === 'open' ? 'Complete' : 'Mark as open'}">${ic(x.status === 'canceled' ? 'x' : 'check')}</button>`;
}
function parentLabel(x) {
  if (x.type === 'todo') {
    const p = projectOf(x);
    if (p) { const h = x.headingId && getH(x.headingId); return pTitle(p) + (h && h.title ? ` › ${h.title}` : ''); }
  }
  const a = areaOf(x); if (a) return aTitle(a);
  if (x.type === 'todo' && isInbox(x) && !x.isTemplate) return 'Inbox';
  return '';
}
/* tags shown on rows. "Own Only" leaves out what a row already says by where it lives: tags it gets
   from its project and area (and from where its linked copies live), a project's area tags, and any
   tag named the same as the project or area it sits in. An open to-do always shows every tag. */
function shownTagIds(x) {
  const mode = S.settings.rowTags || 'own';
  if (mode === 'none') return [];
  if (mode === 'all') return inTagOrder(x.tags);
  const hide = new Set(), names = new Set();
  const nm = (s) => (s || '').trim().toLowerCase();
  const place = (t) => { // a to-do's project and area
    placeTagIds(t).forEach((id) => hide.add(id));
    const p = t.projectId && getP(t.projectId), a = areaOf(t);
    if (p) names.add(nm(p.title)); if (a) names.add(nm(a.title));
  };
  if (x.type === 'todo') {
    place(x);
    if (x.linkId) linkSiblings(x).forEach(place);
  } else {
    names.add(nm(x.title));
    const a = x.areaId && getA(x.areaId);
    if (a) { a.tags.forEach((id) => hide.add(id)); names.add(nm(a.title)); }
  }
  names.delete('');
  return inTagOrder(x.tags.filter((id) => { if (hide.has(id)) return false; const g = getTag(id); return !(g && names.has(nm(g.title))); }));
}
function tagPills(x) { return shownTagIds(x).map((id) => getTag(id)).filter(Boolean).map((t) => `<span class="tg ${tcls(t)}">${esc(t.title)}</span>`).join(''); }
function deadlineHTML(x) { if (!x.deadline || x.isTemplate) return ''; const d = deadlineInfo(x.deadline); return `<span class="dl${d.due && x.status === 'open' ? ' due' : ''}" title="Deadline ${fmtDate(x.deadline)}">${ic('flag')}${esc(d.text)}</span>`; }
function rowHTML(x, ctx = {}) {
  if (x.type === 'project') return projRowHTML(x, ctx);
  if (ui.editing === x.id && !ctx.static) return cardHTML(x);
  const cls = ['row', 'todo'];
  if (ui.sel.has(x.id)) cls.push('selected');
  if (x.status !== 'open') cls.push(x.status);
  if (x.trashed) cls.push('trashed-row');
  let line = '';
  if (ctx.star && isScheduledToday(x)) line += isEveningItem(x) ? ic('moon', 'r-moon') : ic('star', 'r-star');
  if (ctx.when && x.start === 'anytime' && x.when && x.when > T0()) line += `<span class="r-when">${esc(fmtRel(x.when))}</span>`;
  if (ctx.when && x.start === 'someday') line += ic('box', 'r-box');
  if (ctx.when && isScheduledToday(x) && !ctx.star) line += isEveningItem(x) ? ic('moon', 'r-moon') : ic('star', 'r-star');
  line += priMarkHTML(x) + `<span class="r-title${x.title ? '' : ' untitled'}">${esc(x.title || 'New To-Do')}</span>`;
  if (x.waitFor && x.status === 'open' && !ctx.noWait && !x.isTemplate) line += `<span class="r-wait" title="Waiting on ${esc(x.waitFor)}">${ic('hourglass')}${esc(x.waitFor)}</span>`;
  if (x.templateId) line += ic('repeat', 'r-ic');
  if (x.linkId && !x.trashed && linkSiblings(x).length) line += `<span class="ic r-ic r-link" title="Also in ${esc(linkSiblings(x).map(placeLabel).join(', '))}">${I.link}</span>`;
  if (x.reminder && x.when) line += ic('bell', 'r-ic');
  if (x.notes && x.notes.trim()) line += ic('notes', 'r-ic');
  const canExpand = x.checklist.length && !ctx.tpl && !ctx.static;
  const ckOpen = canExpand && ui.expanded.has(x.id);
  if (ckOpen) cls.push('ck-open');
  if (x.checklist.length) {
    const d = x.checklist.filter((c) => c.done).length, n = x.checklist.length;
    line += canExpand
      ? `<button class="r-ck r-ck-btn${ckOpen ? ' open' : ''}" data-action="ck-expand" data-id="${x.id}" aria-expanded="${!!ckOpen}" aria-label="${ckOpen ? 'Hide' : 'Show'} checklist, ${d} of ${n} done" title="${ckOpen ? 'Hide' : 'Show'} checklist (⌥-click for all)">${ic('checklist', 'r-ic')}${d}/${n}${ic('chevR', 'r-ck-chev')}</button>`
      : `<span class="r-ck">${ic('checklist', 'r-ic')}${d}/${n}</span>`;
  }
  line += tagPills(x);
  const parent = [ctx.parent ? parentLabel(x) : '', ctx.waitInfo && x.waitSince ? `Waiting since ${fmtDate(x.waitSince, { weekday: false })}` : ''].filter(Boolean).join(' · ');
  const lead = ctx.date ? `<span class="r-date">${esc(ctx.date)}</span>` : '';
  const right = deadlineHTML(x) + (x.trashed ? `<button class="restore" data-action="restore" data-id="${x.id}">Put Back</button>` : '');
  return `<div class="${cls.join(' ')}" data-id="${x.id}" data-kind="todo" data-drag="todo"><span class="sel-ring">${ic('check')}</span>${lead}${ctx.tpl ? '<span class="cb tpl-cb" aria-hidden="true"></span>' : checkboxHTML(x)}<div class="r-main"><div class="r-line">${line}</div>${parent ? `<div class="r-sub">${esc(parent)}</div>` : ''}${ckOpen ? ckInlineHTML(x) : ''}</div>${right ? `<div class="r-right">${right}</div>` : ''}</div>`;
}
/* a to-do's checklist shown under its row; items can be ticked here without opening the to-do */
function ckInlineHTML(t) {
  const box = (c) => (t.trashed
    ? `<span class="ck-box${c.done ? ' on' : ''}">${ic('check')}</span>`
    : `<button class="ck-box${c.done ? ' on' : ''}" data-action="ck-toggle" data-id="${t.id}" data-ck="${c.id}" aria-label="${c.done ? 'Uncheck' : 'Check'} ${esc(c.title || 'item')}">${ic('check')}</button>`);
  return `<div class="r-cklist">${t.checklist.map((c) => `<div class="r-ckit${c.done ? ' on' : ''}">${box(c)}<span class="r-ckt${c.title ? '' : ' untitled'}">${esc(c.title || 'Untitled item')}</span></div>`).join('')}</div>`;
}
function projRowHTML(p, ctx = {}) {
  const pr = projectProgress(p);
  const exp = ctx.expandable && ui.expanded.has(p.id);
  const cls = ['row', 'prow']; if (ui.sel.has(p.id)) cls.push('selected'); if (p.status !== 'open') cls.push(p.status); if (p.trashed) cls.push('trashed-row');
  let line = '';
  if (ctx.star && isScheduledToday(p)) line += isEveningItem(p) ? ic('moon', 'r-moon') : ic('star', 'r-star');
  if (ctx.when && p.start === 'anytime' && p.when && p.when > T0()) line += `<span class="r-when">${esc(fmtRel(p.when))}</span>`;
  line += priMarkHTML(p) + `<span class="r-title${p.title ? '' : ' untitled'}">${esc(pTitle(p))}</span>${tagPills(p)}`;
  const sub = [ctx.parent ? parentLabel(p) : '', pr.open ? plural(pr.open, 'to-do') : ''].filter(Boolean).join(' · ');
  const lead = ctx.date ? `<span class="r-date">${esc(ctx.date)}</span>` : '';
  const right = deadlineHTML(p) + (p.trashed ? `<button class="restore" data-action="restore" data-id="${p.id}">Put Back</button>` : '');
  const disc = ctx.expandable ? `<button class="disc${exp ? ' open' : ''}" data-action="toggle-expand" data-id="${p.id}" aria-label="${exp ? 'Collapse' : 'Expand'} ${esc(pTitle(p))}" aria-expanded="${exp}" title="${exp ? 'Collapse' : 'Expand'} (⌥-click for all)">${ic('chevR')}</button>` : '';
  const openBtn = ctx.expandable ? `<button class="ib open-proj" data-nav="project:${p.id}" title="Open project" aria-label="Open ${esc(pTitle(p))}">${ic('move')}</button>` : '';
  return `<div class="${cls.join(' ')}${ctx.expandable ? ' expandable' : ''}${exp ? ' expanded' : ''}" data-id="${p.id}" data-kind="project" data-drag="project" data-open="project:${p.id}"${ctx.expandable ? ' data-expandable="1"' : ''}>${lead}${disc}${pieIc(pr.frac, 'pie-ic')}<div class="r-main"><div class="r-line">${line}</div>${sub ? `<div class="r-sub">${esc(sub)}</div>` : ''}</div>${right || openBtn ? `<div class="r-right">${right}${openBtn}</div>` : ''}</div>${exp ? projectChildrenHTML(p) : ''}`;
}
function ghostRowHTML(tpl, date) {
  if (tpl.type === 'project') return ghostProjRowHTML(tpl, date);
  return `<div class="row ghost" data-tpl="${tpl.id}" title="Repeating to-do — click to edit">${ic('repeat', 'r-ic')}<div class="r-main"><div class="r-line">${date ? `<span class="r-when">${esc(fmtRel(date))}</span>` : ''}<span class="r-title">${esc(tpl.title || 'New To-Do')}</span>${tagPills(tpl)}</div><div class="r-sub">${esc(ruleSummary(tpl.repeat))}${parentLabel(tpl) ? ' · ' + esc(parentLabel(tpl)) : ''}</div></div></div>`;
}
function ghostProjRowHTML(p, date) {
  const n = S.todos.filter((t) => t.projectId === p.id && !t.trashed && !t.isTemplate && t.status === 'open').length;
  return `<div class="row ghost" data-nav="project:${p.id}" title="Repeating project — click to edit">${ic('repeat', 'r-ic')}<div class="r-main"><div class="r-line">${date ? `<span class="r-when">${esc(fmtRel(date))}</span>` : ''}<span class="r-title" style="font-weight:600">${esc(pTitle(p))}</span>${tagPills(p)}</div><div class="r-sub">${esc(ruleSummary(p.repeat))}${n ? ' · ' + plural(n, 'to-do') : ''}${p.areaId && getA(p.areaId) ? ' · ' + esc(aTitle(getA(p.areaId))) : ''}</div></div></div>`;
}
function secHTML(sec, items, ctx = {}, okey = 'order') {
  const mode = currentSort();
  if (mode !== 'manual' && SORT_SEC.test(sec)) items = sortItems(items, mode);
  if (SINK_SEC.test(sec)) items = sinkDone(items);
  return `<div class="sec" data-sec="${sec}" data-ok="${okey}">${items.map((x) => rowHTML(x, ctx)).join('')}</div>`;
}

/* ---------- editor card ---------- */
function whenChipHTML(x, id = x.id) {
  if (x.isTemplate) return '';
  const rem = x.reminder && x.when ? ` at ${fmtTime(x.reminder)}` : '';
  let cls = '', icon = '', label = '';
  if (x.start === 'someday') { cls = 'someday'; icon = 'box'; label = 'Someday'; }
  else if (x.when && x.when <= T0()) { if (isEveningItem(x)) { cls = 'evening'; icon = 'moon'; label = 'This Evening'; } else { cls = 'today'; icon = 'star'; label = 'Today'; } }
  else if (x.when) { cls = 'date'; icon = 'calendar'; label = fmtDate(x.when); }
  else return '';
  return `<span class="chip ${cls}"><button class="chip-main" data-action="when" data-id="${id}">${ic(icon)}<span>${esc(label + rem)}</span></button><button class="chip-x" data-action="clear-when" data-id="${id}" aria-label="Clear date">${ic('x')}</button></span>`;
}
function deadlineChipHTML(x, id = x.id) {
  if (x.isTemplate) {
    const dd = x.repeat && x.repeat.deadlineDays;
    if (dd == null || dd === '') return '';
    return `<span class="chip deadline"><button class="chip-main" data-action="repeat" data-id="${id}">${ic('flag')}<span>Deadline ${dd == 0 ? 'same day' : plural(+dd, 'day') + ' after start'}</span></button></span>`;
  }
  if (!x.deadline) return '';
  const d = deadlineInfo(x.deadline);
  return `<span class="chip deadline${d.due && x.status === 'open' ? ' due' : ''}"><button class="chip-main" data-action="deadline" data-id="${id}">${ic('flag')}<span>Deadline: ${esc(fmtDate(x.deadline))}${d.due || /left|Tomorrow/.test(d.text) ? ` · ${esc(d.text)}` : ''}</span></button><button class="chip-x" data-action="clear-deadline" data-id="${id}" aria-label="Clear deadline">${ic('x')}</button></span>`;
}
function repeatChipHTML(x) {
  if (x.isTemplate && x.repeat) return `<span class="chip repeat"><button class="chip-main" data-action="repeat" data-id="${x.id}">${ic('repeat')}<span>${esc(ruleSummary(x.repeat))}${x.next ? ` · next ${esc(fmtRel(x.next))}` : ''}</span></button></span>`;
  if (x.templateId && getT(x.templateId) && !getT(x.templateId).trashed) return `<span class="chip repeat"><button class="chip-main" data-action="open-template" data-id="${x.templateId}">${ic('repeat')}<span>${esc(ruleSummary(getT(x.templateId).repeat))}</span></button></span>`;
  return '';
}
/* notes: formatted view until you tap into it, then the plain text for editing */
function notesBlockHTML(edit, id, fkey, text, cls, label) {
  const editing = ui.notesEdit === fkey || !String(text || '').trim();
  return `<div class="${cls} notes-view md" data-notes-for="${fkey}"${editing ? ' hidden' : ''}>${editing ? '' : renderMarkdown(text)}</div><textarea class="${cls}" data-edit="${edit}" data-id="${id}" data-fkey="${fkey}" data-autosize rows="1" placeholder="Notes" aria-label="${label}"${editing ? '' : ' hidden'}>${esc(text)}</textarea>`;
}
function checklistItemHTML(t, c, tpl) {
  return `<div class="ck-item${c.done ? ' on' : ''}" data-ck="${c.id}"><button class="ck-box${c.done ? ' on' : ''}" data-action="ck-toggle" data-id="${t.id}" data-ck="${c.id}" aria-label="Toggle item">${ic('check')}</button><textarea class="ck-input" data-edit="ck" data-id="${t.id}" data-ck="${c.id}" data-fkey="ck-${c.id}" enterkeyhint="next" aria-label="Checklist item" rows="1" data-autosize data-oneline>${esc(c.title)}</textarea><button class="ib ck-more" data-action="ck-menu" data-id="${t.id}" data-ck="${c.id}" aria-label="Item options">${ic('more')}</button><span class="ck-grip" data-ckgrip="${c.id}" title="Drag to reorder" aria-hidden="true">${ic('grip')}</span></div>`;
}
function cardHTML(t) {
  const tpl = t.isTemplate, tplChild = isTplChild(t);
  const ckOpen = t.checklist.length || ui.ckOpen === t.id;
  const ck = ckOpen ? `<div class="ck">${t.checklist.map((c) => checklistItemHTML(t, c, tpl)).join('')}<div class="ck-item"><span class="ck-box" style="opacity:.4"></span><textarea class="ck-input" data-edit="ck-new" data-id="${t.id}" data-fkey="cknew-${t.id}" placeholder="Add item" enterkeyhint="next" aria-label="New checklist item" rows="1" data-autosize data-oneline></textarea></div></div>` : '';
  const tags = t.tags.length ? `<div class="c-tags">${inTagOrder(t.tags).map((id) => getTag(id)).filter(Boolean).map((g) => `<button class="tg ${tcls(g)}" data-action="tags" data-id="${t.id}">${esc(g.title)}</button>`).join('')}</div>` : '';
  const links = linkSiblings(t).map((s) => `<span class="chip linkc${s.status !== 'open' ? ' done' : ''}"><button class="chip-main" data-action="reveal" data-id="${s.id}" title="Go to this copy">${ic('link')}<span>${s.status === 'open' ? 'Also in' : s.status === 'done' ? 'Done in' : 'Canceled in'} ${esc(placeLabel(s))}</span></button></span>`).join('');
  const wait = t.waitFor && !tpl ? `<span class="chip waitc"><button class="chip-main" data-action="waiting" data-id="${t.id}" title="Change who or when">${ic('hourglass')}<span>Waiting on ${esc(t.waitFor)}${t.waitSince ? ` since ${esc(fmtDate(t.waitSince, { weekday: false }))}` : ''}</span></button><button class="chip-x" data-action="stop-waiting" data-id="${t.id}" aria-label="Stop waiting">${ic('x')}</button></span>` : '';
  const chips = completedChipHTML(t) + whenChipHTML(t) + wait + repeatChipHTML(t) + deadlineChipHTML(t) + (tplChild ? '' : priorityChipHTML(t)) + links;
  const tools = [
    `<button class="ib" data-action="tags" data-id="${t.id}" title="Tags (#)" aria-label="Tags">${ic('tag')}</button>`,
    !ckOpen ? `<button class="ib" data-action="ck-open" data-id="${t.id}" title="Checklist" aria-label="Checklist">${ic('checklist')}</button>` : '',
    !t.deadline && !tpl && !tplChild ? `<button class="ib" data-action="deadline" data-id="${t.id}" title="Deadline (D)" aria-label="Deadline">${ic('flag')}</button>` : '',
    !prio(t) && !tplChild && !t.blueprint ? `<button class="ib" data-action="priority" data-id="${t.id}" title="Priority (P)" aria-label="Priority">${ic('priority')}</button>` : '',
    !t.when && t.start !== 'someday' && !tpl && !tplChild ? `<button class="ib" data-action="when" data-id="${t.id}" title="When (S)" aria-label="When">${ic('calendar')}</button>` : '',
    `<button class="ib" data-action="todo-menu" data-id="${t.id}" title="More" aria-label="More">${ic('more')}</button>`,
  ].join('');
  return `<div class="card" data-id="${t.id}" data-kind="todo">
    ${tpl ? (t.blueprint ? `<div class="c-tpl">${ic('template')}<span>To-do template. New to-dos made from it get this title, notes, checklist and tags.</span></div>` : `<div class="c-tpl">${ic('repeat')}<span>Repeating to-do. Changes apply to the copies it makes from now on.</span></div>`) : ''}
    <div class="c-top">${tpl || tplChild ? `<span class="cb tpl-cb" aria-hidden="true"></span>` : checkboxHTML(t)}<textarea class="c-title" data-edit="title" data-id="${t.id}" data-fkey="title-${t.id}" placeholder="New To-Do" enterkeyhint="done" aria-label="Title" autocomplete="off" rows="1" data-autosize data-oneline>${esc(t.title)}</textarea></div>
    <div class="c-body">${notesBlockHTML('notes', t.id, `notes-${t.id}`, t.notes, 'c-notes', 'Notes')}${ck}${tags}
    <div class="c-foot"><div class="c-chips">${chips}</div><div class="c-tools">${tools}</div></div></div></div>`;
}

/* ---------- headers & bars ---------- */
function headerHTML(key, sub, menu = true) {
  const L = LISTS[key];
  return `<div class="lh"><span class="ic lh-ic" style="color:${L.color}">${I[L.icon]}</span><h1 class="lh-title">${L.title}</h1>${menu && key !== 'trash' ? `<button class="ib lh-share" data-action="share-view" aria-label="Share or export" title="Share or export this list">${ic('share')}</button>` : ''}${menu ? `<button class="ib" data-action="view-menu" aria-label="List options" title="List options">${ic('more')}</button>` : ''}</div>${sub ? `<div class="lh-sub">${sub}</div>` : ''}`;
}
function tagBarHTML(items) {
  const present = new Set();
  items.forEach((x) => effectiveTags(x).forEach((t) => { present.add(t); let p = getTag(t); let guard = 0; while (p && p.parentId && guard++ < 8) { present.add(p.parentId); p = getTag(p.parentId); } }));
  if (ui.tagFilter && ui.tagFilter !== '__none') present.add(ui.tagFilter);
  if (!present.size) return '';
  const chips = tagTree().filter((n) => present.has(n.tag.id)).map((n) => `<button class="tchip ${tcls(n.tag)}${ui.tagFilter === n.tag.id ? ' on' : ''}" data-action="tag-filter" data-tag="${n.tag.id}"><span class="tdot" aria-hidden="true"></span>${esc(n.tag.title)}</button>`).join('');
  return `<div class="tagbar"><button class="tchip${!ui.tagFilter ? ' on' : ''}" data-action="tag-filter" data-tag="">All</button>${chips}<button class="tchip${ui.tagFilter === '__none' ? ' on' : ''}" data-action="tag-filter" data-tag="__none">No Tag</button></div>`;
}
function emptyHTML(icon, title, text) {
  return `<div class="empty">${ic(icon)}<p><b>${esc(title)}</b></p>${text ? `<p>${text}</p>` : ''}</div>`;
}
function mobileBarHTML() {
  if (ui.selectMode) return `<div class="m-bar"><button class="m-back" data-action="select-all">Select All</button><span class="sel-count">${ui.sel.size ? ui.sel.size + ' Selected' : ''}</span><button class="m-back" data-action="select-done">Done</button></div>`;
  return `<div class="m-bar"><button class="m-back" data-action="m-back">${ic('chevL')}Lists</button><span class="spacer"></span><button class="ib" data-action="find" aria-label="Quick Find">${ic('search')}</button>${ui.view.type !== 'trash' ? `<button class="ib lh-share" data-action="share-view" aria-label="Share or export" title="Share or export this list">${ic('share')}</button>` : ''}<button class="ib" data-action="view-menu" aria-label="List options">${ic('more')}</button></div>`;
}

/* ---------- main views ---------- */
function renderMain() {
  const v = ui.view;
  if ((v.type === 'project' && (!getP(v.id))) || (v.type === 'area' && !getA(v.id)) || (v.type === 'tag' && !getTag(v.id))) ui.view = { type: 'today' };
  let html = '';
  switch (ui.view.type) {
    case 'inbox': html = viewInbox(); break;
    case 'today': html = viewToday(); break;
    case 'upcoming': html = viewUpcoming(); break;
    case 'anytime': html = viewAnytime(); break;
    case 'someday': html = viewSomeday(); break;
    case 'logbook': html = viewLogbook(); break;
    case 'trash': html = viewTrash(); break;
    case 'project': html = viewProject(getP(ui.view.id)); break;
    case 'area': html = viewArea(getA(ui.view.id)); break;
    case 'tag': html = viewTag(getTag(ui.view.id)); break;
    case 'board': html = viewBoard(); break;
    case 'templates': html = viewTemplates(); break;
    case 'waiting': html = viewWaiting(); break;
    default: html = viewToday();
  }
  // Boards scroll sideways inside the page. Each change redraws the page, which would put a board
  // back at its first column, so remember how far each board was scrolled and put it back.
  const sideways = {};
  $$('#content [data-hscroll]').forEach((el) => { sideways[el.dataset.hscroll] = el.scrollLeft; });
  $('#content').classList.toggle('board-view', ui.view.type === 'board' || (ui.view.type === 'project' && projectBoardOn(getP(ui.view.id))));
  $('#content').innerHTML = mobileBarHTML() + html;
  $$('#content [data-hscroll]').forEach((el) => { const x = sideways[el.dataset.hscroll]; if (x) el.scrollLeft = x; });
  addSortPill();
}
function viewInbox() {
  const all = inboxItems();
  const items = all.filter(matchesTagFilter).sort(byOrder);
  return headerHTML('inbox') + tagBarHTML(all) + `<div class="list">${secHTML('inbox', items, {})}</div>` +
    (all.length ? '' : emptyHTML('inbox', 'Inbox is empty', 'New to-dos land here until you give them a date or a place. Press Q for Quick Entry.'));
}
function viewToday() {
  const all = todayItems();
  const items = all.filter(matchesTagFilter).sort(byToday);
  const main = items.filter((x) => !isEveningItem(x)), eve = items.filter(isEveningItem);
  const d = pd(T0());
  let list = '';
  if (S.settings.groupToday) {
    const groups = new Map();
    main.forEach((x) => { const k = x.type === 'project' ? 'projects' : (projectOf(x) ? 'p:' + x.projectId : areaOf(x) ? 'a:' + areaOf(x).id : 'none'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
    const order = ['projects', 'none', ...[...groups.keys()].filter((k) => k !== 'projects' && k !== 'none')];
    order.forEach((k) => {
      const g = groups.get(k); if (!g) return;
      let h = '';
      if (k.startsWith('p:')) { const p = getP(k.slice(2)); h = `<div class="grp-h proj-h">${pieIc(projectProgress(p).frac)}<button data-nav="project:${p.id}">${esc(pTitle(p))}</button></div>`; }
      else if (k.startsWith('a:')) { const a = getA(k.slice(2)); h = `<div class="grp-h area-h">${ic('area')}<button data-nav="area:${a.id}">${esc(aTitle(a))}</button></div>`; }
      list += h + secHTML('today', g, { parent: false }, 'todayOrder');
    });
    if (!main.length) list += secHTML('today', [], {}, 'todayOrder');
  } else list = secHTML('today', main, { parent: true }, 'todayOrder');
  if (eve.length) list += `<div class="sec-h evening" data-zone="evening">${ic('moon')}<span>This Evening</span></div>` + secHTML('evening', eve, { parent: !S.settings.groupToday }, 'todayOrder');
  return headerHTML('today', `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`) + tagBarHTML(all) + `<div class="list">${list}</div>` +
    (all.length ? '' : emptyHTML('star', 'Nothing scheduled for today', 'Drag to-dos onto Today in the sidebar, or select one and press T.'));
}
function templatePreviews(horizonDays = 400) {
  const out = [], T = T0(), end = addDays(T, horizonDays);
  for (const tpl of S.todos.concat(S.projects)) {
    if (!tpl.isTemplate || tpl.trashed || !tpl.repeat || !tpl.next) continue;
    const p = tpl.type === 'todo' && tpl.projectId && getP(tpl.projectId); if (p && (p.trashed || p.status !== 'open' || p.isTemplate)) continue;
    if (!matchesTagFilter(tpl)) continue;
    if (tpl.repeat.mode === 'after') { out.push({ tpl, date: tpl.next }); continue; }
    let d = tpl.next, n = 0; const sim = Object.assign({}, tpl.repeat);
    while (d && d <= end && n < 12) { if (ruleEnded(sim, d)) break; if (d > T) out.push({ tpl, date: d }); sim.count = (sim.count || 0) + 1; n++; d = nextOccurrence(tpl.repeat, d); }
  }
  return out;
}
function viewUpcoming() {
  const T = T0();
  const all = upcomingItems();
  const items = all.filter(matchesTagFilter).sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : byToday(a, b)));
  const ghosts = templatePreviews();
  const lastDate = [...items.map((x) => x.when), ...ghosts.map((g) => g.date)].sort().pop() || T;
  let html = '';
  const rowsFor = (from, to, withDate) => {
    const its = items.filter((x) => x.when >= from && x.when <= to);
    const gs = ghosts.filter((g) => g.date >= from && g.date <= to).sort((a, b) => (a.date < b.date ? -1 : 1));
    return { its, gs, html: its.map((x) => rowHTML(x, { parent: true, when: withDate })).join('') + gs.map((g) => ghostRowHTML(g.tpl, withDate ? g.date : null)).join('') };
  };
  for (let i = 1; i <= 7; i++) {
    const d = addDays(T, i), r = rowsFor(d, d, false);
    html += `<div class="day-h" data-zone="upcoming:${d}"><span class="day-n">${pd(d).getDate()}</span><span class="day-w">${i === 1 ? 'Tomorrow' : WEEKDAYS[dow(d)]}</span></div><div class="sec" data-sec="upcoming:${d}" data-ok="todayOrder">${r.html}</div>`;
  }
  let cursor = addDays(T, 8);
  const cm = pd(T).getMonth(), cy = pd(T).getFullYear();
  const endOfMonth = dateFromParts(cy, cm, daysInMonth(cy, cm));
  if (cursor <= endOfMonth) {
    const r = rowsFor(cursor, endOfMonth, true);
    html += `<div class="day-h month" data-zone="upcoming:${cursor}"><span class="day-n">Rest of ${MONTHS[cm]}</span></div><div class="sec" data-sec="upcoming:${cursor}" data-ok="todayOrder">${r.html}</div>`;
    cursor = addDays(endOfMonth, 1);
  }
  let m = monthIndex(cursor) ; const lastM = Math.max(monthIndex(lastDate), monthIndex(T) + 3);
  const capM = monthIndex(T) + 12;
  for (; m <= Math.min(lastM, capM); m++) {
    const y = Math.floor(m / 12), mo = m % 12;
    const from = dateFromParts(y, mo, Math.max(1, m === monthIndex(cursor) ? pd(cursor).getDate() : 1)), to = dateFromParts(y, mo, daysInMonth(y, mo));
    const r = rowsFor(from, to, true);
    html += `<div class="day-h month" data-zone="upcoming:${from}"><span class="day-n">${MONTHS[mo]}${y !== cy ? ' ' + y : ''}</span></div><div class="sec" data-sec="upcoming:${from}" data-ok="todayOrder">${r.html}</div>`;
  }
  if (lastM > capM) {
    const from = dateFromParts(Math.floor((capM + 1) / 12), (capM + 1) % 12, 1);
    const r = rowsFor(from, '9999-12-31', true);
    if (r.its.length || r.gs.length) html += `<div class="day-h month" data-zone="upcoming:${from}"><span class="day-n">Later</span></div><div class="sec" data-sec="upcoming:${from}" data-ok="todayOrder">${r.html}</div>`;
  }
  return headerHTML('upcoming') + tagBarHTML(all) + `<div class="list">${html}</div>`;
}
function groupedView(key, todoFilter, somedayProjects) {
  const todosAll = S.todos.filter(todoFilter);
  const projAll = somedayProjects ? S.projects.filter((p) => liveProject(p) && p.start === 'someday') : [];
  const tagSrc = todosAll.concat(projAll);
  const todos = todosAll.filter(matchesTagFilter), projs = projAll.filter(matchesTagFilter).sort(byOrder);
  const ctx = { star: key === 'anytime', when: key === 'someday' };
  const sortT = (a, b) => { const ha = a.headingId && getH(a.headingId), hb = b.headingId && getH(b.headingId); const oa = ha ? ha.order + 1 : 0, ob = hb ? hb.order + 1 : 0; return oa - ob || byOrder(a, b); };
  let html = '';
  const loose = todos.filter((t) => !t.projectId && !t.areaId).sort(byOrder);
  html += secHTML(`${key}:loose`, loose, ctx);
  const projGroup = (p) => {
    const ts = todos.filter((t) => t.projectId === p.id).sort(sortT);
    if (!ts.length) return '';
    return `<div class="grp-h proj-h">${pieIc(projectProgress(p).frac)}<button data-nav="project:${p.id}">${esc(pTitle(p))}</button></div>` + secHTML(`${key}:project:${p.id}`, ts, ctx);
  };
  const activeProjects = (areaId) => S.projects.filter((p) => liveProject(p) && p.status === 'open' && (p.areaId || null) === areaId && !(p.start === 'someday' && key === 'anytime')).sort(byOrder);
  if (projs.filter((p) => !p.areaId).length) html += `<div class="sec" data-sec="${key}:projects:" data-ok="order">${projs.filter((p) => !p.areaId).map((p) => projRowHTML(p, {})).join('')}</div>`;
  activeProjects(null).forEach((p) => { if (key !== 'someday' || p.start !== 'someday') html += projGroup(p); });
  S.areas.slice().sort(byOrder).forEach((a) => {
    const at = todos.filter((t) => t.areaId === a.id && !t.projectId).sort(byOrder);
    const ap = projs.filter((p) => p.areaId === a.id);
    const inner = activeProjects(a.id).filter((p) => key !== 'someday' || p.start !== 'someday').map(projGroup).join('');
    if (!at.length && !ap.length && !inner) return;
    html += `<div class="grp-h area-h">${ic('area')}<button data-nav="area:${a.id}">${esc(aTitle(a))}</button></div>` + secHTML(`${key}:area:${a.id}`, at, ctx) +
      (ap.length ? `<div class="sec" data-sec="${key}:projects:${a.id}" data-ok="order">${ap.map((p) => projRowHTML(p, {})).join('')}</div>` : '') + inner;
  });
  const emptyCopy = key === 'anytime' ? ['Nothing here yet', 'To-dos you can start any time show up here, grouped by project and area.'] : ['Someday is empty', 'Park ideas here for later. Select a to-do and press O.'];
  return headerHTML(key) + tagBarHTML(tagSrc) + `<div class="list">${html}</div>` + (tagSrc.length ? '' : emptyHTML(LISTS[key].icon, ...emptyCopy));
}
function viewAnytime() { return groupedView('anytime', anytimeTodo, false); }
function viewSomeday() { return groupedView('someday', somedayTodo, true); }
function logbookItems() {
  return S.todos.filter((t) => !t.trashed && !t.isTemplate && t.status !== 'open' && t.logged)
    .concat(S.projects.filter((p) => !p.trashed && p.status !== 'open' && p.logged))
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
}
function dayGroupLabel(day) {
  const n = diffDays(day, T0());
  if (n === 0) return 'Today'; if (n === 1) return 'Yesterday';
  if (n < 7) return WEEKDAYS[dow(day)];
  const d = pd(day); return `${MONTHS[d.getMonth()]}${d.getFullYear() !== pd(T0()).getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
function viewLogbook() {
  const all = logbookItems();
  const items = all.filter(matchesTagFilter);
  const shown = items.slice(0, ui.logbookLimit);
  let html = '', cur = null, buf = [];
  const flush = () => { if (buf.length) html += `<div class="lb-h">${esc(cur)}</div><div class="sec" data-sec="logbook">${buf.join('')}</div>`; buf = []; };
  shown.forEach((x) => {
    const day = stampDay(x.completedAt || Date.now()); const g = dayGroupLabel(day);
    if (g !== cur) { flush(); cur = g; }
    buf.push(rowHTML(x, { parent: true, date: fmtDate(day, { weekday: false }) }));
  });
  flush();
  if (items.length > shown.length) html += `<button class="show-more" data-action="logbook-more">Show ${Math.min(150, items.length - shown.length)} more</button>`;
  return headerHTML('logbook') + tagBarHTML(all) + `<div class="list">${html}</div>` + (all.length ? '' : emptyHTML('logbook', 'Logbook is empty', 'Completed to-dos and projects are kept here.'));
}
function viewTrash() {
  const projs = S.projects.filter((p) => p.trashed).sort((a, b) => (b.trashedAt || 0) - (a.trashedAt || 0));
  const todos = S.todos.filter((t) => t.trashed && !t.isTemplate && !(t.projectId && getP(t.projectId) && getP(t.projectId).trashed)).sort((a, b) => (b.trashedAt || 0) - (a.trashedAt || 0));
  const n = projs.length + todos.length;
  const head = `<div class="lh"><span class="ic lh-ic" style="color:var(--c-trash)">${I.trash}</span><h1 class="lh-title">Trash</h1>${n ? `<button class="btn" data-action="empty-trash">Empty Trash</button>` : ''}</div>`;
  return head + `<div class="list">${projs.length ? `<div class="sec" data-sec="trash">${projs.map((p) => projRowHTML(p, { parent: true })).join('')}</div>` : ''}${secHTML('trash', todos, { parent: true })}</div>` + (n ? '' : emptyHTML('trash', 'Trash is empty', 'Deleted to-dos and projects wait here until you empty the Trash.'));
}
function templatesIn(filter) { return S.todos.filter((t) => t.isTemplate && !t.blueprint && !t.trashed && filter(t)).sort(byOrder); }
function projectTemplatesIn(filter) { return S.projects.filter((p) => p.isTemplate && !p.blueprint && !p.trashed && filter(p)).sort(byOrder); }
function repeatingSectionHTML(tpls) {
  if (!tpls.length) return '';
  return `<div class="sec-h">${ic('repeat')}<span>Repeating</span></div><div class="sec" data-sec="repeating">${tpls.map((t) => ghostRowHTML(t, t.next)).join('')}</div>`;
}
function viewProject(p) {
  const pr = projectProgress(p);
  const todosAll = S.todos.filter((t) => t.projectId === p.id && !t.trashed && !t.isTemplate && !t.isDraft);
  const live = todosAll.filter((t) => t.status === 'open' || !t.logged);
  const items = live.filter(matchesTagFilter);
  const logged = todosAll.filter((t) => t.status !== 'open' && t.logged).sort((a, b) => b.completedAt - a.completedAt);
  const headings = sinkHeadings(S.headings.filter((h) => h.projectId === p.id && !h.archived).sort(byOrder));
  const ctx = { when: true, tpl: !!p.isTemplate };
  const src = !p.isTemplate && p.templateId && getP(p.templateId) && !getP(p.templateId).trashed ? getP(p.templateId) : null;
  const meta = whenChipHTML(p) + (src ? `<span class="chip repeat"><button class="chip-main" data-nav="project:${src.id}">${ic('repeat')}<span>${esc(ruleSummary(src.repeat))}</span></button></span>` : '') + deadlineChipHTML(p) + priorityChipHTML(p) + p.tags.map((id) => getTag(id)).filter(Boolean).map((g) => `<span class="chip tagc"><button class="chip-main" data-action="tags" data-id="${p.id}">${ic('tag', 'tc-ic ' + tcls(g))}<span>${esc(g.title)}</span></button><button class="chip-x" data-action="remove-tag" data-id="${p.id}" data-tag="${g.id}" aria-label="Remove tag">${ic('x')}</button></span>`).join('');
  let html = `<div class="lh">${p.blueprint ? `<span class="ic lh-ic" style="color:var(--c-template)">${I.template}</span>` : `<span class="ic lh-ic pie-lg">${pieSVG(pr.frac)}</span>`}<textarea class="lh-title" data-edit="project-title" data-id="${p.id}" data-fkey="ptitle" placeholder="New Project" aria-label="Project title" autocomplete="off" rows="1" data-autosize data-oneline>${esc(p.title)}</textarea>${p.trashed ? '' : `<button class="ib lh-board${projectBoardOn(p) ? ' on' : ''}" data-action="proj-board" data-id="${p.id}" aria-pressed="${projectBoardOn(p)}" title="${projectBoardOn(p) ? 'Show as a list' : 'Show headings as a board'}" aria-label="${projectBoardOn(p) ? 'Show as a list' : 'Show headings as a board'}">${ic('columns')}</button>`}<button class="ib lh-share" data-action="share-view" aria-label="Share or export" title="Share or export this list">${ic('share')}</button><button class="ib" data-action="proj-menu" data-id="${p.id}" aria-label="Project options" title="Project options">${ic('more')}</button></div>`;
  if (p.trashed) html += `<div class="lh-banner">This project is in the Trash. <button class="link-btn" data-action="restore" data-id="${p.id}">Put Back</button></div>`;
  else if (p.blueprint) html += `<div class="lh-banner rp-banner">${ic('template')}<span><b>Project template.</b> New projects made from it get these headings, to-dos and checklists${p.bpAreaId && getA(p.bpAreaId) ? ` and go in ${esc(aTitle(getA(p.bpAreaId)))}` : ''}. Editing it doesn’t change projects already made.</span><button class="link-btn" data-action="use-ptemplate" data-id="${p.id}">New Project</button></div>`;
  else if (p.isTemplate) html += `<div class="lh-banner rp-banner">${ic('repeat')}<span><b>Repeating project.</b> ${esc(ruleSummary(p.repeat))}${p.next ? `. Next copy ${esc(fmtRel(p.next))}` : p.repeat && p.repeat.mode === 'after' ? '. The next copy comes after you complete the current one' : '. This repeat has ended'}. Changes here apply to future copies.</span><button class="link-btn" data-action="repeat" data-id="${p.id}">Change</button></div>`;
  else if (p.status !== 'open') html += `<div class="lh-banner"><b>${p.status === 'done' ? 'Completed' : 'Canceled'}</b> ${p.completedAt ? `on <button class="link-btn" data-action="completed-date" data-id="${p.id}" title="Change the date">${esc(fmtDate(stampDay(p.completedAt)))}</button> ·` : ''} <button class="link-btn" data-action="reopen-project" data-id="${p.id}">Reopen</button></div>`;
  html += notesBlockHTML('project-notes', p.id, 'pnotes', p.notes, 'lh-notes', 'Project notes');
  if (meta) html += `<div class="lh-meta">${meta}</div>`;
  html += tagBarHTML(live);
  if (projectBoardOn(p)) html += projectBoardHTML(p, items, headings, ctx);
  else {
  html += `<div class="list">${secHTML(`project:${p.id}:`, items.filter((t) => !t.headingId || !getH(t.headingId) || getH(t.headingId).archived).sort(byOrder), ctx)}`;
  headings.forEach((h) => {
    html += `<div class="hrow${headingDoneCls(h)}" data-heading="${h.id}" data-drag="heading" data-kind="heading" data-id="${h.id}" data-zone="project:${p.id}:${h.id}"><textarea class="h-title" data-edit="heading-title" data-id="${h.id}" data-fkey="h-${h.id}" placeholder="New Heading" aria-label="Heading" autocomplete="off" rows="1" data-autosize data-oneline>${esc(h.title)}</textarea><button class="ib" data-action="heading-menu" data-id="${h.id}" aria-label="Heading options">${ic('more')}</button></div>`;
    html += secHTML(`project:${p.id}:${h.id}`, items.filter((t) => t.headingId === h.id).sort(byOrder), ctx);
  });
  html += '</div>';
  }
  if (!p.isTemplate) html += repeatingSectionHTML(templatesIn((t) => t.projectId === p.id));
  if (logged.length) {
    const open = ui.showLogged[p.id];
    html += `<button class="show-more" data-action="toggle-logged" data-id="${p.id}">${open ? 'Hide' : 'Show'} ${plural(logged.length, 'logged item')}</button>`;
    if (open) html += `<div class="sec" data-sec="logbook">${logged.map((t) => rowHTML(t, { date: fmtDate(stampDay(t.completedAt), { weekday: false }) })).join('')}</div>`;
  }
  if (!todosAll.length && !headings.length && p.isTemplate && !projectBoardOn(p)) html += emptyHTML('repeat', 'Add the steps', 'Each new copy of this project starts with the to-dos and headings you add here.');
  else if (!todosAll.length && !headings.length && !projectBoardOn(p)) html += emptyHTML('project', 'No to-dos yet', 'Press N or the + button to add the first one. Add headings from the ••• menu to split the project into stages.');
  return html;
}
function viewArea(a) {
  const todosAll = S.todos.filter((t) => t.areaId === a.id && !t.projectId && liveTodo(t));
  const projAll = S.projects.filter((p) => p.areaId === a.id && liveProject(p));
  const items = todosAll.filter(matchesTagFilter).sort(byOrder);
  const active = projAll.filter((p) => p.status !== 'open' || (p.start === 'anytime' && !(p.when && p.when > T0()))).filter(matchesTagFilter).sort(byOrder);
  const later = projAll.filter((p) => p.status === 'open' && (p.start === 'someday' || (p.when && p.when > T0()))).filter(matchesTagFilter).sort(byOrder);
  const meta = a.tags.map((id) => getTag(id)).filter(Boolean).map((g) => `<span class="chip tagc"><button class="chip-main" data-action="area-tags" data-id="${a.id}">${ic('tag', 'tc-ic ' + tcls(g))}<span>${esc(g.title)}</span></button><button class="chip-x" data-action="remove-tag" data-id="${a.id}" data-tag="${g.id}" aria-label="Remove tag">${ic('x')}</button></span>`).join('');
  let html = `<div class="lh"><span class="ic lh-ic" style="color:var(--c-area)">${I.area}</span><textarea class="lh-title" data-edit="area-title" data-id="${a.id}" data-fkey="atitle" placeholder="New Area" aria-label="Area title" autocomplete="off" rows="1" data-autosize data-oneline>${esc(a.title)}</textarea><button class="ib lh-share" data-action="share-view" aria-label="Share or export" title="Share or export this list">${ic('share')}</button><button class="ib" data-action="area-menu" data-id="${a.id}" aria-label="Area options" title="Area options">${ic('more')}</button></div>`;
  if (meta) html += `<div class="lh-meta">${meta}</div>`;
  html += tagBarHTML(todosAll.concat(projAll));
  html += `<div class="list">${secHTML(`area:${a.id}`, items, { when: true })}`;
  if (projAll.length) { const allOpen = projAll.every((p) => ui.expanded.has(p.id)), noneOpen = !projAll.some((p) => ui.expanded.has(p.id)); html += `<div class="exp-bar"><span>${plural(projAll.length, 'project')}</span><button class="link-btn" data-action="expand-all" data-id="${a.id}"${allOpen ? ' disabled' : ''}>Expand All</button><button class="link-btn" data-action="collapse-all" data-id="${a.id}"${noneOpen ? ' disabled' : ''}>Collapse All</button></div>`; }
  html += `<div class="sec" data-sec="areaprojects:${a.id}" data-ok="order">${sortedRows(active).map((p) => projRowHTML(p, { star: true, when: true, expandable: true })).join('')}</div>`;
  if (later.length) {
    const open = ui.laterOpen[a.id];
    html += `<button class="show-more" data-action="toggle-later" data-id="${a.id}">${open ? 'Hide' : 'Show'} ${plural(later.length, 'later project')}</button>`;
    if (open) html += `<div class="sec" data-sec="areaprojects:${a.id}" data-ok="order">${sortedRows(later).map((p) => projRowHTML(p, { when: true, expandable: true })).join('')}</div>`;
  }
  html += '</div>' + repeatingSectionHTML([...projectTemplatesIn((p) => p.areaId === a.id), ...templatesIn((t) => t.areaId === a.id && !t.projectId)]);
  if (!todosAll.length && !projAll.length) html += emptyHTML('area', 'This area is empty', 'Areas hold the ongoing parts of your life, like Home or Work. Add to-dos here, or create a project inside it from the ••• menu.');
  return html;
}
function viewTag(tag) {
  const want = tagDescendants(tag.id);
  const has = (x) => { for (const t of effectiveTags(x)) if (want.has(t)) return true; return false; };
  const todos = S.todos.filter((t) => liveTodo(t) && inLiveProject(t) && has(t));
  const groups = [
    ['Today', todos.filter(isTodayItem).sort(byToday)],
    ['Upcoming', todos.filter((t) => t.start === 'anytime' && t.when && t.when > T0()).sort((a, b) => (a.when < b.when ? -1 : 1))],
    ['Anytime', todos.filter((t) => t.start === 'anytime' && !t.when && !isTodayItem(t)).sort(byOrder)],
    ['Inbox', todos.filter((t) => isInbox(t) && !isTodayItem(t)).sort(byOrder)],
    ['Someday', todos.filter((t) => t.start === 'someday' && !isTodayItem(t)).sort(byOrder)],
  ];
  let html = `<div class="lh"><span class="ic lh-ic" style="color:var(--t-${tagColor(tag)})">${I.tag}</span><h1 class="lh-title">${esc(tag.title)}</h1><button class="ib lh-share" data-action="share-view" aria-label="Share or export" title="Share or export this list">${ic('share')}</button></div><div class="lh-sub">${plural(todos.filter((t) => t.status === 'open').length, 'open to-do')}</div><div class="list">`;
  groups.forEach(([label, list]) => { if (list.length) html += `<div class="sec-h"><span>${label}</span></div>` + secHTML('tag', list, { parent: true, when: true }); });
  html += '</div>';
  if (!todos.length) html += emptyHTML('tag', 'Nothing tagged yet', `Add the “${esc(tag.title)}” tag to a to-do and it shows up here.`);
  return html;
}

/* ---------- batch bar ---------- */
function renderBatch() {
  const n = ui.sel.size;
  const show = n > 1 || ui.selectMode;
  const el = $('#batch');
  if (!show) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="batch" role="toolbar" aria-label="Selected to-dos"><span class="bcount">${n} selected</span>
    <button data-action="b-when" ${n ? '' : 'disabled'}>${ic('calendar')}When</button><button data-action="b-move" ${n ? '' : 'disabled'}>${ic('move')}Move</button>
    <button data-action="b-tags" ${n ? '' : 'disabled'}>${ic('tag')}Tags</button><button data-action="b-deadline" ${n ? '' : 'disabled'}>${ic('flag')}Deadline</button>
    <button data-action="b-complete" ${n ? '' : 'disabled'}>${ic('check')}Complete</button><button data-action="b-share" ${n ? '' : 'disabled'}>${ic('share')}Share</button><button data-action="b-delete" ${n ? '' : 'disabled'}>${ic('trash')}Delete</button></div>`;
}

function visibleInCurrentView(x) {
  const v = ui.view;
  switch (v.type) {
    case 'inbox': return x.type === 'todo' && isInbox(x);
    case 'today': return isTodayItem(x);
    case 'upcoming': return x.start === 'anytime' && !!x.when && x.when > T0();
    case 'anytime': return x.type === 'todo' ? anytimeTodo(x) : false;
    case 'someday': return x.type === 'todo' ? somedayTodo(x) : x.start === 'someday';
    case 'project': return x.projectId === v.id || x.id === v.id;
    case 'area': { const a = areaOf(x); return !!a && a.id === v.id; }
    case 'logbook': return x.status !== 'open' && x.logged;
    case 'trash': return !!x.trashed;
    case 'tag': return effectiveTags(x).has(v.id);
    case 'templates': return false;
    case 'waiting': return isWaiting(x);
    case 'board': return boardCols().some((c) => (c.t === 'p' ? x.projectId === c.id || x.id === c.id : (areaOf(x) || {}).id === c.id));
    default: return true;
  }
}
