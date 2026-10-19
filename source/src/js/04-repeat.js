/* ===================== Repeating to-dos =====================
   A repeating to-do is a hidden template. It spawns a normal to-do on each
   start date (schedule mode) or a set time after the last one is completed
   (after-completion mode). Editing the template changes future copies. */

function defaultRule(startDate) {
  const s = startDate || T0();
  return { mode: 'schedule', freq: 'weekly', interval: 1, weekdays: [dow(s)], monthly: { type: 'day', day: pd(s).getDate(), nth: 1, weekday: dow(s) },
    anchor: s, deadlineDays: null, reminder: null, evening: false, ends: { type: 'never', date: null, count: 10 }, count: 0 };
}
function nthWeekdayOf(y, m, nth, wd) {
  if (nth === -1) { const last = daysInMonth(y, m); for (let d = last; d > last - 7; d--) if (new Date(y, m, d).getDay() === wd) return dateFromParts(y, m, d); }
  let count = 0;
  for (let d = 1; d <= daysInMonth(y, m); d++) if (new Date(y, m, d).getDay() === wd && ++count === nth) return dateFromParts(y, m, d);
  return null;
}
function monthCandidate(r, y, m) {
  const mo = r.monthly || {};
  if (mo.type === 'nth') return nthWeekdayOf(y, m, mo.nth, mo.weekday);
  const day = mo.day === -1 ? daysInMonth(y, m) : Math.min(mo.day || 1, daysInMonth(y, m));
  return dateFromParts(y, m, day);
}
/* Occurrences of a scheduled rule are the dates on or after the anchor that match it.
   nextOccurrence returns the first one strictly after `from`. */
function weeklyMatch(r, d) {
  const iv = Math.max(1, r.interval | 0 || 1);
  const days = (r.weekdays && r.weekdays.length) ? r.weekdays : [dow(r.anchor)];
  if (!days.includes(dow(d))) return false;
  return Math.round(diffDays(weekStart(r.anchor), weekStart(d)) / 7) % iv === 0;
}
function nextOccurrence(r, from) {
  const a = r.anchor, iv = Math.max(1, r.interval | 0 || 1);
  if (from < a) from = addDays(a, -1);
  if (r.freq === 'daily') { const k = Math.floor(diffDays(a, from) / iv) + 1; return addDays(a, Math.max(0, k) * iv); }
  if (r.freq === 'weekly') {
    for (let i = 1; i <= 7 * iv + 7; i++) { const d = addDays(from, i); if (weeklyMatch(r, d)) return d; }
    return null;
  }
  if (r.freq === 'monthly') {
    const am = monthIndex(a); let mi = monthIndex(from);
    for (let i = 0; i < 12 * iv + 13; i++, mi++) {
      if ((mi - am) % iv !== 0) continue;
      const c = monthCandidate(r, Math.floor(mi / 12), mi % 12);
      if (c && c > from && c >= a) return c;
    }
    return null;
  }
  if (r.freq === 'yearly') {
    const ad = pd(a); let y = pd(from).getFullYear();
    for (let i = 0; i < iv + 3; i++, y++) {
      if ((y - ad.getFullYear()) % iv !== 0) continue;
      const c = dateFromParts(y, ad.getMonth(), Math.min(ad.getDate(), daysInMonth(y, ad.getMonth())));
      if (c > from) return c;
    }
    return null;
  }
  return null;
}
function firstOccurrence(r) { return nextOccurrence(r, addDays(r.anchor, -1)); }
function addInterval(r, base) {
  const iv = Math.max(1, r.interval | 0 || 1);
  if (r.freq === 'daily') return addDays(base, iv);
  if (r.freq === 'weekly') return addDays(base, 7 * iv);
  const d = pd(base);
  if (r.freq === 'monthly') { const mo = d.getMonth() + iv, y = d.getFullYear() + Math.floor(mo / 12), m = mo % 12; return dateFromParts(y, m, Math.min(d.getDate(), daysInMonth(y, m))); }
  return dateFromParts(d.getFullYear() + iv, d.getMonth(), Math.min(d.getDate(), daysInMonth(d.getFullYear() + iv, d.getMonth())));
}
function ruleEnded(r, date) {
  if (!r.ends || r.ends.type === 'never') return false;
  if (r.ends.type === 'on') return !!r.ends.date && date > r.ends.date;
  if (r.ends.type === 'after') return (r.count || 0) >= (r.ends.count || 1);
  return false;
}
function previewOccurrences(r, n = 4) {
  const out = [];
  if (r.mode === 'after') {
    let d = r.anchor; out.push(d);
    for (let i = 1; i < n; i++) { d = addInterval(r, d); out.push(d); }
    return out;
  }
  let d = firstOccurrence(r); let count = r.count || 0;
  const tmp = Object.assign({}, r, { count });
  while (d && out.length < n) { if (ruleEnded(tmp, d)) break; out.push(d); tmp.count++; d = nextOccurrence(r, d); }
  return out;
}
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function ruleSummary(r) {
  if (!r) return '';
  const iv = Math.max(1, r.interval | 0 || 1);
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.freq];
  if (r.mode === 'after') return `${iv === 1 ? `1 ${unit}` : `${iv} ${unit}s`} after completion`;
  let s = iv === 1 ? ({ daily: 'Every day', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' }[r.freq]) : `Every ${iv} ${unit}s`;
  if (r.freq === 'weekly') {
    const days = (r.weekdays || []).slice().sort((a, b) => ((a - (S.settings.weekStart || 0) + 7) % 7) - ((b - (S.settings.weekStart || 0) + 7) % 7));
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d)) && iv === 1) s = 'Every weekday';
    else if (days.length === 7 && iv === 1) s = 'Every day';
    else if (days.length) s += ` on ${days.map((d) => WD[d]).join(', ')}`;
  }
  if (r.freq === 'monthly') {
    const mo = r.monthly || {};
    if (mo.type === 'nth') s += ` on the ${mo.nth === -1 ? 'last' : ordinal(mo.nth)} ${WEEKDAYS[mo.weekday]}`;
    else s += ` on the ${mo.day === -1 ? 'last day' : ordinal(mo.day || 1)}`;
  }
  if (r.freq === 'yearly') s += ` on ${fmtDate(r.anchor, { weekday: false })}`;
  return s;
}

function spawnInstance(tpl, date) {
  const r = tpl.repeat;
  // One predictable ID per template and day, so two synced devices never make two copies.
  const id = `${tpl.id}-${date}`;
  r.count = (r.count || 0) + 1;
  syncHint(tpl.id);
  if (getT(id)) return getT(id);
  const inst = makeTodo({
    id,
    title: tpl.title, notes: tpl.notes, tags: tpl.tags.slice(),
    checklist: (tpl.checklist || []).map((c) => ({ id: uid(), title: c.title, done: false })),
    projectId: tpl.projectId, areaId: tpl.areaId, headingId: tpl.headingId,
    start: 'anytime', when: date, evening: !!r.evening, reminder: r.reminder || null,
    deadline: r.deadlineDays != null && r.deadlineDays !== '' ? addDays(date, +r.deadlineDays) : null,
    templateId: tpl.id, order: tpl.order, todayOrder: todayTop(), sample: tpl.sample,
  });
  S.todos.push(inst); idx.todo.set(inst.id, inst);
  syncHint(inst.id);
  return inst;
}
function generateRepeats() {
  const T = T0(); let changed = false;
  for (const tpl of S.todos.slice()) {
    if (!tpl.isTemplate || tpl.trashed || !tpl.repeat || !tpl.next) continue;
    const proj = tpl.projectId && getP(tpl.projectId);
    if (proj && (proj.trashed || proj.status !== 'open')) continue;
    const r = tpl.repeat;
    if (ruleEnded(r, tpl.next)) { tpl.next = null; syncHint(tpl.id); changed = true; continue; }
    if (tpl.next > T) continue;
    if (r.mode === 'after') { spawnInstance(tpl, tpl.next); tpl.next = null; changed = true; continue; }
    let d = tpl.next, last = null, guard = 0;
    while (d && d <= T && guard++ < 2000) { last = d; d = nextOccurrence(r, d); }
    spawnInstance(tpl, last);
    tpl.next = d && !ruleEnded(r, d) ? d : null;
    changed = true;
  }
  if (changed) { reindex(); saveSoon(); }
  return changed;
}
function onInstanceDone(inst) {
  const tpl = getT(inst.templateId);
  if (!tpl || !tpl.isTemplate || tpl.trashed || !tpl.repeat || tpl.repeat.mode !== 'after' || tpl.next) return;
  const hasOpen = S.todos.some((t) => t.templateId === tpl.id && t !== inst && t.status === 'open' && !t.trashed);
  if (hasOpen) return;
  const next = addInterval(tpl.repeat, T0());
  if (!ruleEnded(tpl.repeat, next)) tpl.next = next;
}
/* Turn a to-do into a repeating template (or update an existing template's rule). */
function setRepeat(id, rule) {
  const t = getT(id); if (!t) return;
  let tplId = null;
  commit('Repeat', () => {
    let tpl = t.isTemplate ? t : (t.templateId && getT(t.templateId)) || null;
    if (!tpl) {
      // the selected to-do becomes the template; the first copy is generated from it
      tpl = t; tpl.isTemplate = true; tpl.status = 'open'; tpl.completedAt = null;
      tpl.when = null; tpl.evening = false; tpl.reminder = null; tpl.deadline = null;
      if (tpl.start !== 'anytime') tpl.start = 'anytime';
    }
    tpl.repeat = Object.assign({}, rule, { count: tpl.repeat ? tpl.repeat.count || 0 : 0 });
    tpl.next = rule.mode === 'after' ? rule.anchor : firstOccurrence(tpl.repeat);
    if (tpl.next && tpl.next < T0() && rule.mode === 'schedule') { let d = tpl.next; while (d && d < T0()) d = nextOccurrence(tpl.repeat, d); tpl.next = d; }
    // a template already producing copies: drop the future (unstarted) copy so the new rule takes over
    if (tpl !== t) { /* editing from an instance: leave existing instances alone */ }
    tplId = tpl.id; touch(tpl);
    reindex(); generateRepeats();
  });
  if (ui.editing === id && getT(id) && getT(id).isTemplate) { ui.editing = null; openTplModal(id); }
  return tplId;
}
function stopRepeating(tplId) {
  const tpl = getT(tplId); if (!tpl) return;
  commit('Stop Repeating', () => { tpl.trashed = true; tpl.trashedAt = Date.now(); S.todos.filter((t) => t.templateId === tplId).forEach((t) => { t.templateId = null; }); });
  closeTplModal();
  toast('Stopped repeating. Existing to-dos were kept.', { undo: true });
}
