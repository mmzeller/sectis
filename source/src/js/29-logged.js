/* ===================== Logged to-dos in their lists =====================
   Settings → Logged to-dos: At the Bottom keeps a project's (or area's) logged to-dos in one
   list at its end, behind Show logged items. Where They Were shows each one where it was,
   just below the completed to-dos there, newest first, with the day it was done; the list's
   Hide logged items button tucks them away for that list. Projects (and their sub-projects),
   areas, the Board and a project's sub-projects board all follow it. */
const loggedInline = () => S.settings.loggedPlace === 'inline';
/* logged to-dos of a project or area, newest first */
function loggedTodos(pred) {
  return S.todos.filter((t) => pred(t) && !t.trashed && !t.isTemplate && !t.isDraft && t.status !== 'open' && t.logged)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
}
const loggedOfProject = (p) => loggedTodos((t) => t.projectId === p.id);
/* a project's and all its sub-projects' */
function loggedInProject(p) { const ids = new Set([p.id, ...projDescendants(p).map((q) => q.id)]); return loggedTodos((t) => ids.has(t.projectId)); }
const loggedOfArea = (a) => loggedTodos((t) => t.areaId === a.id && !t.projectId);
/* the section a logged to-do belongs under: its project's own to-dos */
const loggedSecKey = (t) => `project:${t.projectId}:`;
/* whether this list shows its logged to-dos where they were right now */
function loggedShownIn(id) { return loggedInline() && !(ui.hideLogged || {})[id]; }
function loggedDay(t) { return t.completedAt ? fmtDate(stampDay(t.completedAt), { weekday: false }) : ''; }
/* the logged rows under one section; data-for says which section a drop there goes to */
function loggedInHTML(sec, list) {
  if (!list.length) return '';
  return `<div class="sec logged-in" data-sec="logbook" data-for="${sec}">${list.map((t) => rowHTML(t, { doneOn: loggedDay(t) })).join('')}</div>`;
}
/* the button at the end of a project or area, and in At the Bottom, the list under it */
function loggedFooterHTML(id, logged) {
  if (!logged.length) return '';
  if (loggedInline()) {
    const hidden = (ui.hideLogged || {})[id];
    return `<button class="show-more" data-action="toggle-logged" data-id="${id}" title="${hidden ? 'Show them where they were' : 'Hide them from this list'}">${hidden ? 'Show' : 'Hide'} ${plural(logged.length, 'logged item')}</button>`;
  }
  const open = ui.showLogged[id];
  return `<button class="show-more" data-action="toggle-logged" data-id="${id}">${open ? 'Hide' : 'Show'} ${plural(logged.length, 'logged item')}</button>`
    + (open ? `<div class="sec" data-sec="logbook">${logged.map((t) => rowHTML(t, { date: loggedDay(t) })).join('')}</div>` : '');
}
function toggleLogged(id) {
  if (loggedInline()) { ui.hideLogged = ui.hideLogged || {}; ui.hideLogged[id] = !ui.hideLogged[id]; } else ui.showLogged[id] = !ui.showLogged[id];
  render();
}
/* a project's logged to-dos, grouped by the section they go under (when they're shown there) */
function loggedBySec(p, filter = null) {
  const m = new Map();
  if (!loggedShownIn(p.id)) return m;
  loggedOfProject(p).filter((t) => !filter || filter(t)).forEach((t) => { const k = loggedSecKey(t); if (!m.has(k)) m.set(k, []); m.get(k).push(t); });
  return m;
}
