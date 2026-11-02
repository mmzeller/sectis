/* ===================== Upcoming: the month calendar =====================
   A month grid above the Upcoming list. Each day shows how many to-dos and projects start then
   (repeating ones included) and a red dot when something's due. Drop to-dos or projects on a
   day to schedule them; click a day to jump to it in the list; double-click to add a to-do on
   it. The arrows page through months; the chevron folds it away (remembered per device). */
function calMonthNow() { return T0().slice(0, 7); }
function calMonth() { const m = ui.calMonth && ui.calMonth >= calMonthNow() ? ui.calMonth : calMonthNow(); ui.calMonth = m; return m; }
function calShift(n) {
  const [y, m] = calMonth().split('-').map(Number), d = new Date(y, m - 1 + n, 1);
  ui.calMonth = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; if (ui.calMonth < calMonthNow()) ui.calMonth = calMonthNow();
  render();
}
const calFolded = () => lsGet('sectis.ucal') === 'folded';
function upcomingCalHTML() {
  const T = T0(), ym = calMonth(), [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`, last = dateFromParts(y, m - 1, daysInMonth(y, m - 1));
  const per = new Map(), due = new Map();
  const bump = (map, d) => map.set(d, (map.get(d) || 0) + 1);
  todayItems().filter(matchesTagFilter).forEach((x) => { if (x.status === 'open' && first <= T && T <= last) bump(per, T); });
  upcomingItems().filter(matchesTagFilter).forEach((x) => { if (x.when >= first && x.when <= last) bump(per, x.when); });
  templatePreviews().forEach((g) => { if (g.date >= first && g.date <= last) bump(per, g.date); });
  deadlineItems().filter(matchesTagFilter).forEach((x) => { if (x.status === 'open' && x.deadline >= first && x.deadline <= last) bump(due, x.deadline); });
  const ws = S.settings.weekStart || 0, lead = (dow(first) - ws + 7) % 7, n = daysInMonth(y, m - 1);
  let cells = '';
  for (let i = 0; i < 7; i++) cells += `<span class="ucal-w">${WD[(ws + i) % 7].slice(0, 2)}</span>`;
  for (let i = 0; i < lead; i++) cells += '<span class="ucal-d out"></span>';
  for (let d = 1; d <= n; d++) {
    const ds = `${ym}-${pad2(d)}`, past = ds < T, c = per.get(ds) || 0, dl = due.get(ds) || 0;
    const tip = [ds === T ? 'Today' : fmtDate(ds), c ? plural(c, 'item') : '', dl ? `${dl} due` : ''].filter(Boolean).join(' · ');
    cells += past
      ? `<span class="ucal-d past"><span class="n">${d}</span></span>`
      : `<button class="ucal-d${ds === T ? ' today' : ''}" data-action="cal-day" data-date="${ds}" data-drop-day="${ds}" title="${esc(tip)}. Drop to-dos here to schedule them; double-click to add one.">${dl ? '<span class="dlf"></span>' : ''}<span class="n">${d}</span>${c ? `<span class="cnt">${c}</span>` : ''}</button>`;
  }
  for (let i = (lead + n) % 7; i && i < 7; i++) cells += '<span class="ucal-d out"></span>';
  const folded = calFolded();
  return `<div class="ucal${folded ? ' folded' : ''}"><div class="ucal-h"><span class="ucal-m">${MONTHS[m - 1]}${y !== pd(T).getFullYear() ? ' ' + y : ''}</span>`
    + `<button class="ib" data-action="cal-prev" aria-label="Previous month" title="Previous month"${ym <= calMonthNow() ? ' disabled' : ''}>${ic('chevL')}</button>`
    + `<button class="link-btn ucal-now" data-action="cal-now"${ym === calMonthNow() ? ' disabled' : ''}>This Month</button>`
    + `<button class="ib" data-action="cal-next" aria-label="Next month" title="Next month">${ic('chevR')}</button>`
    + `<button class="ib ucal-fold" data-action="cal-fold" aria-label="${folded ? 'Show' : 'Hide'} the calendar" title="${folded ? 'Show' : 'Hide'} the calendar">${ic(folded ? 'chevD' : 'chevU')}</button></div>`
    + (folded ? '' : `<div class="ucal-g">${cells}</div>`) + '</div>';
}
/* click a day: today opens Today; any other day scrolls the list to it */
function calGoTo(ds) {
  if (ds === T0()) { navigate('today'); return; }
  const secs = $$('#content .sec[data-sec^="upcoming:"]').filter((s) => s.dataset.sec.slice(9) <= ds);
  const sec = secs[secs.length - 1]; if (!sec) return;
  const head = sec.previousElementSibling && sec.previousElementSibling.matches('.day-h') ? sec.previousElementSibling : sec;
  head.scrollIntoView({ block: 'start', behavior: 'smooth' });
  head.classList.remove('flash'); void head.offsetWidth; head.classList.add('flash');
}
function calAction(action, el) {
  if (action === 'cal-prev') calShift(-1);
  else if (action === 'cal-next') calShift(1);
  else if (action === 'cal-now') { ui.calMonth = calMonthNow(); render(); }
  else if (action === 'cal-fold') { lsSet('sectis.ucal', calFolded() ? '' : 'folded'); render(); }
  else if (action === 'cal-day') calGoTo(el.dataset.date);
}
document.addEventListener('dblclick', (e) => {
  const d = e.target.closest && e.target.closest('#content .ucal-d[data-date]');
  if (d) { e.preventDefault(); newTodo({ extra: { date: d.dataset.date } }); }
});
/* to-dos or projects dropped on a day */
function scheduleOn(ids, date) {
  const items = itemsFor(ids).filter((x) => x.status === 'open' && !x.isTemplate); if (!items.length) return;
  const props = date <= T0() ? sectionProps('today') : sectionProps('upcoming:' + date);
  commit('Schedule', () => items.forEach((x) => { applySectionProps(x, props); touch(x); }));
  toast(`${items.length > 1 ? plural(items.length, 'item') : `“${items[0].title || (items[0].type === 'project' ? 'New Project' : 'New To-Do')}”`} scheduled for ${date <= T0() ? 'Today' : fmtDate(date)}`, { undo: true });
}
