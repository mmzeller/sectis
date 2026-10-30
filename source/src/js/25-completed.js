/* ===================== Completion date =====================
   When a to-do or project was completed (or canceled) can be changed, for something done weeks
   ago and only now checked off. Typed dates look back: "fri" is last Friday, "oct 2" the most
   recent October 2, "3 weeks ago" works too. The Logbook, status reports and the order of
   completed to-dos all follow the new date. */
function parsePastDate(raw) {
  const T = T0();
  const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]+$/, '');
  if (!s) return null;
  if (['today', 'tod', 'now'].includes(s)) return T;
  if (s === 'last week') return addDays(T, -7);
  let m;
  if ((m = s.match(/^(\d{1,3})\s*(d|days?|w|wks?|weeks?|m|mos?|months?|y|yrs?|years?)(?: ago)?$/)) || (s === 'last month' && (m = [0, '1', 'm'])) || (s === 'last year' && (m = [0, '1', 'y']))) {
    const n = +m[1], u = m[2][0];
    if (u === 'd') return addDays(T, -n);
    if (u === 'w') return addDays(T, -7 * n);
    const d = pd(T), tot = d.getFullYear() * 12 + d.getMonth() - (u === 'm' ? n : 12 * n);
    const y = Math.floor(tot / 12), mo = ((tot % 12) + 12) % 12;
    return dateFromParts(y, mo, Math.min(d.getDate(), daysInMonth(y, mo)));
  }
  if ((m = s.match(/^(last |on |this )?([a-z]+)$/))) {
    const wd = matchWeekday(m[2]);
    if (wd >= 0) { let d = m[1] === 'last ' ? addDays(T, -1) : T; while (dow(d) !== wd) d = addDays(d, -1); return d; }
  }
  if ((m = s.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?$/))) { // the 15th: this month's, or the last one that's passed
    const n = +m[1], d0 = pd(T); let y = d0.getFullYear(), mo = d0.getMonth();
    for (let i = 0; i < 14; i++) { if (n <= daysInMonth(y, mo)) { const c = dateFromParts(y, mo, n); if (c <= T) return c; } if (--mo < 0) { mo = 11; y--; } }
    return null;
  }
  const p = parseDateText(s);
  if (!p) return null;
  if (p.special === 'today' || p.special === 'evening') return T;
  if (!p.date) return null;
  if (p.date <= T) return p.date;
  // a month and day still ahead this year means last year's; "tomorrow", "next week" or a date with its year can't be
  const monthDay = s.split(/[\s,]+/).some((w) => matchMonth(w) >= 0) || /^\d{1,2}[/-]\d{1,2}$/.test(s);
  if (!monthDay || /\d{4}/.test(s)) return null;
  let d = p.date;
  for (let i = 0; i < 2 && d > T; i++) { const x = pd(d), y = x.getFullYear() - 1; d = dateFromParts(y, x.getMonth(), Math.min(x.getDate(), daysInMonth(y, x.getMonth()))); }
  return d <= T ? d : null;
}
const completedItems = (ids) => ids.map(itemById).filter((x) => x && x.status !== 'open' && !x.isTemplate);
function completedLabel(x) { return x.status === 'canceled' ? 'Canceled' : 'Completed'; }
function completedChipHTML(x) {
  if (x.status === 'open' || !x.completedAt || x.isTemplate) return '';
  return `<span class="chip donec ${x.status}"><button class="chip-main" data-action="completed-date" data-id="${x.id}" title="Change the date">${ic(x.status === 'canceled' ? 'x' : 'check')}<span>${completedLabel(x)} ${esc(fmtDate(stampDay(x.completedAt)))}</span></button></span>`;
}
function completedMenuItem(ids, anchor, after = (L) => L) {
  const items = completedItems(ids); if (!items.length) return null;
  return { label: items.every((x) => x.status === 'canceled') ? 'Date Canceled…' : 'Date Completed…', icon: 'calendar', fn: () => after(openCompletedDate(ids, anchor)) };
}
function openCompletedDate(ids, anchor) {
  const items = completedItems(ids); if (!items.length) return null;
  const T = T0(), sel = stampDay(items[0].completedAt || Date.now());
  let shown = sel, cy = pd(sel).getFullYear(), cm = pd(sel).getMonth();
  const title = items.every((x) => x.status === 'canceled') ? 'Canceled On' : 'Completed On';
  const cal = () => calHTML(cy, cm, shown, true, T);
  const L = openLayer({ anchor, cls: 'picker done-picker', html: `<div class="pk-h">${title}</div>
    <input class="pk-in" id="cd-in" placeholder="yesterday, last fri, oct 2, 3 weeks ago…" autocomplete="off" aria-label="Type a date">
    <div class="pk-hint" id="cd-hint"></div>
    <button class="pk-opt today${sel === T ? ' on' : ''}" data-cd="0">${ic('star')}Today</button><button class="pk-opt${sel === addDays(T, -1) ? ' on' : ''}" data-cd="-1">${ic('calendar')}Yesterday</button>
    <div class="cal" id="cd-cal">${cal()}</div>`,
    onMount: (el) => {
      const inp = $('#cd-in', el), hint = $('#cd-hint', el);
      const apply = (d) => { closeLayer(L); setCompletedDate(ids, d); };
      inp.addEventListener('input', () => {
        const d = parsePastDate(inp.value);
        hint.textContent = inp.value.trim() ? (d ? '→ ' + fmtDate(d) : 'Try “last fri”, “oct 2” or “3 weeks ago”') : '';
        hint.classList.toggle('bad', !d);
        if (d) { shown = d; cy = pd(d).getFullYear(); cm = pd(d).getMonth(); $('#cd-cal', el).innerHTML = cal(); }
      });
      inp.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const d = parsePastDate(inp.value); if (d) apply(d); });
      el.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cal]');
        if (c) { cm += +c.dataset.cal; if (cm < 0) { cm = 11; cy--; } if (cm > 11) { cm = 0; cy++; } $('#cd-cal', el).innerHTML = cal(); return; }
        const d = e.target.closest('[data-date]'); if (d && !d.disabled) { apply(d.dataset.date); return; }
        const b = e.target.closest('[data-cd]'); if (b) apply(addDays(T, +b.dataset.cd));
      });
      if (!isCoarse()) inp.focus({ preventScroll: true });
    } });
  return L;
}
function setCompletedDate(ids, day) {
  const items = completedItems(ids); if (!items.length || !day) return;
  const now = Date.now(), wasLogged = new Map(items.map((x) => [x.id, x.logged]));
  let repeatMoved = false;
  commit('Change Completion Date', () => items.forEach((x) => {
    const was = new Date(x.completedAt || now), d = pd(day);
    d.setHours(was.getHours(), was.getMinutes(), was.getSeconds(), 0); // same time of day, never in the future
    x.completedAt = Math.min(d.getTime(), now);
    touch(x);
    if (retimeRepeat(x, day)) repeatMoved = true;
  }));
  if (repeatMoved && generateRepeats()) render();
  const nowLogged = items.filter((x) => x.logged && !wasLogged.get(x.id)).length; // older ones go to the Logbook (daily logging)
  const what = items.length > 1 ? `${items.length} items marked` : 'Marked';
  toast(`${what} ${items.every((x) => x.status === 'canceled') ? 'canceled' : 'completed'} on ${fmtDate(day)}${nowLogged ? ' and moved to the Logbook' : ''}`,
    nowLogged && ui.view.type !== 'logbook' ? { action: 'Show', fn: () => navigate('logbook') } : {});
}
/* "Repeat after completion": the next copy counts from the new date, if this is the latest copy */
function retimeRepeat(x, day) {
  const tpl = x.templateId && itemById(x.templateId);
  if (!tpl || !tpl.isTemplate || tpl.trashed || !tpl.repeat || tpl.repeat.mode !== 'after' || !tpl.next) return false;
  const list = x.type === 'project' ? S.projects : S.todos;
  if (list.some((t) => t.templateId === tpl.id && t !== x && !t.trashed && (t.status === 'open' || (t.createdAt || 0) > (x.createdAt || 0)))) return false;
  const next = addInterval(tpl.repeat, day);
  if (ruleEnded(tpl.repeat, next) || next === tpl.next) return false;
  tpl.next = next; return true;
}
