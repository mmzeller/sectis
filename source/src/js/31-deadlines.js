/* ===================== Deadlines =====================
   Everything with a deadline, across all projects and areas, soonest first:
   Overdue, Today, Tomorrow, This Week, then by month. Checked items stay until they're logged,
   like everywhere else. Dropping to-dos on Deadlines in the sidebar asks for a deadline. */
function deadlineItems() {
  const has = (x) => !!x.deadline && !x.isTemplate && !x.trashed && inFocus(x);
  return S.todos.filter((t) => has(t) && liveTodo(t) && inLiveProject(t)).concat(S.projects.filter((p) => has(p) && liveProject(p)));
}
const byDeadline = (a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : (b.priority || 0) - (a.priority || 0) || byToday(a, b));
function deadlineGroups(items) {
  const T = T0(), tm = addDays(T, 1), wk = addDays(T, 7), cy = pd(T).getFullYear();
  const out = [], at = new Map();
  const put = (key, label, x) => { if (!at.has(key)) { at.set(key, { key, label, items: [] }); out.push(at.get(key)); } at.get(key).items.push(x); };
  items.slice().sort(byDeadline).forEach((x) => {
    const d = x.deadline;
    if (d < T && x.status === 'open') put('overdue', 'Overdue', x);
    else if (d <= T) put('today', 'Today', x);
    else if (d === tm) put('tomorrow', 'Tomorrow', x);
    else if (d <= wk) put('week', 'This Week', x);
    else { const dd = pd(d); put('m' + d.slice(0, 7), (d.slice(0, 7) === T.slice(0, 7) ? 'Rest of ' : '') + MONTHS[dd.getMonth()] + (dd.getFullYear() !== cy ? ' ' + dd.getFullYear() : ''), x); }
  });
  // Overdue first even when a checked item from an earlier day sorted ahead of it
  return out.sort((a, b) => (a.key === 'overdue' ? -1 : b.key === 'overdue' ? 1 : 0));
}
function deadlineCounts() {
  const T = T0(), wk = addDays(T, 7); let soon = 0, overdue = 0;
  for (const x of deadlineItems()) { if (x.status !== 'open') continue; if (x.deadline < T) overdue++; if (x.deadline <= wk) soon++; }
  return { soon, overdue };
}
function viewDeadlines() {
  const all = deadlineItems(), items = all.filter(matchesTagFilter);
  const c = deadlineCounts();
  const sub = c.overdue ? `${plural(c.overdue, 'overdue item')} · ${c.soon} due within a week` : c.soon ? `${c.soon} due within a week` : '';
  let html = '';
  deadlineGroups(items).forEach((g) => {
    const n = g.items.filter((x) => x.status === 'open').length;
    html += `<div class="sec-h dl-h${g.key === 'overdue' ? ' overdue' : ''}" data-dlg="${esc(g.key)}"><span>${esc(g.label)}</span>${n ? `<span class="sec-n">${n}</span>` : ''}</div>` + secHTML('deadlines', g.items, { parent: true, when: true });
  });
  return headerHTML('deadlines', sub) + tagBarHTML(all) + `<div class="list">${html}</div>` +
    (all.length ? '' : emptyHTML('flag', 'No deadlines', 'Give a to-do or a project a deadline (press D) and it shows up here, soonest first.'));
}
