/* ===================== Focus =====================
   A focus shows only some areas at a time (say Work, or Home) across Today, Upcoming, Anytime,
   Someday, Deadlines, Waiting, the Logbook, tags, smart lists, the calendar, the Board, the
   sidebar and its counts. The Inbox always shows everything, so nothing new gets missed, and
   Quick Find still finds everything: a project or area opened from it shows all of itself.
   A focus is a record { id, type: 'focus', title, areas: [area ids], loose, sched, order }:
   loose says whether to-dos and projects outside any area show, and sched is null or
   { days: [0–6], from: 'HH:MM', to: 'HH:MM' } (to at or before from runs past midnight).
   Focuses sync between devices; which one is on is each device's own. Pick one at the top of
   the sidebar, or let a schedule switch it. A pick lasts until the next scheduled change. */
const getFocus = (id) => (S.focuses || []).find((f) => f.id === id);
const focusTitle = (f) => (f && f.title) || 'Focus';
function normalizeFocus(f) {
  const out = Object.assign({ type: 'focus', title: '', areas: [], loose: true, sched: null, order: 0 }, f);
  if (!Array.isArray(out.areas)) out.areas = [];
  if (out.sched && !(Array.isArray(out.sched.days) && out.sched.days.length && out.sched.from && out.sched.to)) out.sched = null;
  return out;
}
try { ui.focusPick = JSON.parse(lsGet('sectis.focus') || 'null'); } catch (e) { ui.focusPick = null; }
ui.focusRec = null; ui.focusAreas = new Set();

/* ---- which focus is on ---- */
const hmMin = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
// every scheduled stretch from a week ago to tomorrow, as times
function focusWindows(now) {
  const out = [], base = new Date(now);
  for (const f of S.focuses || []) {
    const s = f.sched; if (!s) continue;
    const from = hmMin(s.from), to = hmMin(s.to);
    for (let i = -8; i <= 1; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      if (!s.days.includes(d.getDay())) continue;
      const st = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, from).getTime();
      const en = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (to <= from ? 1 : 0), 0, to).getTime();
      out.push({ f, st, en });
    }
  }
  return out;
}
const hasFocusSchedule = () => (S.focuses || []).some((f) => f.sched);
function scheduledFocus(now = Date.now()) {
  const w = focusWindows(now).filter((x) => x.st <= now && now < x.en).sort((a, b) => b.st - a.st)[0]; // the one that started last wins
  return w ? w.f : null;
}
function lastFocusChange(now = Date.now()) {
  let b = 0;
  for (const x of focusWindows(now)) { if (x.st <= now && x.st > b) b = x.st; if (x.en <= now && x.en > b) b = x.en; }
  return b;
}
function effectiveFocus(now = Date.now()) {
  const pick = ui.focusPick;
  if (hasFocusSchedule() && (!pick || (pick.at || 0) < lastFocusChange(now))) return scheduledFocus(now);
  return pick && pick.id ? getFocus(pick.id) || null : null;
}
function refreshFocus() {
  const f = S ? effectiveFocus() : null;
  ui.focusRec = f; ui.focusAreas = new Set(f ? f.areas : []);
  return f;
}
/* is this to-do or project shown under the current focus? A to-do still in the Inbox is outside
   any area, so it follows the focus's loose setting here like any other; the Inbox list itself
   (and its count and Board column) doesn't ask, so it still shows everything */
function inFocus(x) {
  const f = ui.focusRec; if (!f || !x) return true;
  const a = areaOf(x);
  return a ? ui.focusAreas.has(a.id) : f.loose !== false;
}
/* a project or area page outside the focus (opened from Quick Find, say) */
function viewOutsideFocus(v = ui.view) {
  if (!ui.focusRec) return false;
  if (v.type === 'area') return !ui.focusAreas.has(v.id);
  if (v.type === 'project') { const p = getP(v.id); return !!p && !inFocus(p); }
  return false;
}
/* a new to-do made in Today, Deadlines, a tag and the like would vanish if this focus hides
   to-dos outside any area, so it goes into the focus's first area instead. One made in the
   Inbox stays there: the Inbox shows everything */
function focusNewProps(p) {
  const f = ui.focusRec;
  if (!f || f.loose !== false || p.projectId || p.areaId || (ui.view && ui.view.type === 'inbox')) return p;
  const a = S.areas.filter((x) => ui.focusAreas.has(x.id)).sort(byOrder)[0];
  if (a) { p.areaId = a.id; if (p.start === 'inbox') p.start = 'anytime'; }
  return p;
}
/* the same for a to-do just made in the Inbox on its way somewhere else (the + on a Board's
   Deadlines, tag or smart-list column) */
function focusAdopt(t) {
  if (!t || inFocus(t)) return;
  const a = S.areas.filter((x) => ui.focusAreas.has(x.id)).sort(byOrder)[0];
  if (a) { t.areaId = a.id; if (t.start === 'inbox') t.start = 'anytime'; }
}
function setFocus(id) {
  ui.focusPick = { id: id || '', at: Date.now() };
  lsSet('sectis.focus', JSON.stringify(ui.focusPick));
  refreshFocus();
  if (viewOutsideFocus()) navigate('today'); else render();
}
/* quietly back to All Areas, to show something the focus hides */
function showAllAreas() {
  if (!ui.focusRec) return;
  ui.focusPick = { id: '', at: Date.now() }; lsSet('sectis.focus', JSON.stringify(ui.focusPick));
  refreshFocus(); toast('Showing all areas');
}
function followFocusSchedule() {
  ui.focusPick = null; lsSet('sectis.focus', '');
  refreshFocus();
  if (viewOutsideFocus()) navigate('today'); else render();
  toast(ui.focusRec ? `${focusTitle(ui.focusRec)} focus, as scheduled` : 'Showing everything, as scheduled');
}
/* a schedule switching focus while Sectis is open */
function checkFocusSchedule() {
  if (!S || !hasFocusSchedule()) return;
  const f = effectiveFocus();
  if ((f && f.id) === (ui.focusRec && ui.focusRec.id)) return;
  if (ui.editing || layers.length || (D.st && D.st.active)) return; // after you're done
  refreshFocus();
  if (viewOutsideFocus()) navigate('today'); else render();
  toast(f ? `${focusTitle(f)} focus is on` : 'Focus is off. Showing everything');
}
setInterval(checkFocusSchedule, 20000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkFocusSchedule(); });

/* ---- words ---- */
function focusDays(days) {
  const d = days.slice().sort((a, b) => a - b).join();
  if (d === '0,1,2,3,4,5,6') return 'every day';
  if (d === '1,2,3,4,5') return 'weekdays';
  if (d === '0,6') return 'weekends';
  const ws = S.settings.weekStart || 0;
  return days.slice().sort((a, b) => ((a - ws + 7) % 7) - ((b - ws + 7) % 7)).map((x) => WD[x]).join(', ');
}
function focusSchedText(s) {
  if (!s) return '';
  const all = s.from === s.to && s.from === '00:00';
  return `${focusDays(s.days)}${all ? ', all day' : `, ${fmtTime(s.from)}–${fmtTime(s.to)}`}`;
}
function focusSummary(f) {
  const names = S.areas.filter((a) => f.areas.includes(a.id)).sort(byOrder).map(aTitle);
  let s = names.length ? names.join(', ') : 'No areas';
  if (f.loose !== false) s += names.length ? ', and to-dos outside any area' : ', only to-dos outside any area';
  if (f.sched) s += ' · on ' + focusSchedText(f.sched);
  return s;
}

/* ---- the switch at the top of the sidebar ---- */
function focusBarHTML() {
  const fs = (S.focuses || []).slice().sort(byOrder); if (!fs.length) return '';
  const cur = ui.focusRec ? ui.focusRec.id : '';
  const menuBtn = `<button class="ib fx-menu${cur ? ' on' : ''}" data-action="focus-menu" aria-label="Focus" title="Focus: show only some areas">${ic('focus')}</button>`;
  const fits = fs.length <= 3 && fs.reduce((n, f) => n + Math.min(focusTitle(f).length, 30), 3) <= 22;
  if (fits) {
    const seg = (id, label, title) => `<button class="fx-seg${cur === id ? ' on' : ''}" data-focus="${id}" aria-pressed="${cur === id}" title="${esc(title)}">${esc(label)}</button>`;
    return `<div class="fx-bar" role="group" aria-label="Focus">${menuBtn}<div class="fx-segs">${seg('', 'All', 'Show everything')}${fs.map((f) => seg(f.id, focusTitle(f), focusSummary(f))).join('')}</div></div>`;
  }
  return `<div class="fx-bar">${menuBtn}<button class="fx-pill${cur ? ' on' : ''}" data-action="focus-menu"><span>${cur ? esc(focusTitle(ui.focusRec)) : 'All Areas'}</span>${ic('chevD')}</button></div>`;
}
function openFocusMenu(el) {
  const fs = (S.focuses || []).slice().sort(byOrder), cur = ui.focusRec ? ui.focusRec.id : '';
  const items = [{ header: 'Focus' }, { label: 'All Areas', icon: cur ? 'blank' : 'check', fn: () => setFocus('') }];
  fs.forEach((f) => items.push({ label: focusTitle(f), icon: cur === f.id ? 'check' : 'blank', hint: f.sched ? focusSchedText(f.sched) : '', fn: () => setFocus(f.id) }));
  const sched = hasFocusSchedule() ? scheduledFocus() : undefined;
  if (sched !== undefined && (sched ? sched.id : '') !== cur) items.push({ sep: 1 }, { label: `Follow Schedule (${sched ? focusTitle(sched) : 'All Areas'})`, icon: 'calendar', fn: followFocusSchedule });
  items.push({ sep: 1 });
  fs.forEach((f) => items.push({ label: `Edit “${focusTitle(f)}”…`, icon: 'sliders', fn: () => openFocusEditor(f) }));
  items.push({ label: 'New Focus…', icon: 'plus', fn: () => openFocusEditor() });
  openMenu(el, items);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('#sidebar [data-focus], #content [data-focus]'); if (!b) return;
  e.preventDefault(); setFocus(b.dataset.focus);
});

/* ---- making and editing one ---- */
function saveFocus(f, data) {
  let rec = f;
  commit(f ? 'Edit Focus' : 'New Focus', () => {
    if (!rec) { const now = Date.now(); rec = normalizeFocus({ id: uid(), order: (maxOf(S.focuses, 'order') || 0) + 1, createdAt: now, modifiedAt: now }); S.focuses.push(rec); }
    Object.assign(rec, data); touch(rec);
  }, { render: false });
  if (!f) setFocus(rec.id); // try out a new one straight away
  else { refreshFocus(); if (viewOutsideFocus()) navigate('today'); else render(); }
  return rec;
}
async function deleteFocus(f) {
  const ok = await confirmDialog({ title: `Delete the “${esc(focusTitle(f))}” focus?`, body: 'Only the focus goes. Its areas, projects and to-dos stay as they are.', ok: 'Delete', danger: true });
  if (!ok) return;
  commit('Delete Focus', () => { S.focuses = S.focuses.filter((x) => x.id !== f.id); });
  toast(`Deleted “${focusTitle(f)}”`, { undo: true });
}
/* a first focus is probably Work, then Home: guess the name and the areas that go with it */
function focusSuggestion() {
  const taken = (n) => (S.focuses || []).some((f) => focusTitle(f).toLowerCase() === n);
  const pick = (re) => S.areas.filter((a) => re.test(aTitle(a))).map((a) => a.id);
  if (!taken('work')) return { title: 'Work', areas: pick(/\b(work|office|job|business|police|it)\b/i) };
  if (!taken('home')) return { title: 'Home', areas: pick(/\b(home|personal|family|house|life)\b/i) };
  return { title: '', areas: [] };
}
function openFocusEditor(f = null) {
  const sug = f ? null : focusSuggestion();
  const st = {
    title: f ? f.title : sug.title, areas: f ? f.areas.filter(getA) : sug.areas.slice(), loose: f ? f.loose !== false : true,
    on: !!(f && f.sched), days: f && f.sched ? f.sched.days.slice() : [1, 2, 3, 4, 5], from: f && f.sched ? f.sched.from : '08:00', to: f && f.sched ? f.sched.to : '17:00',
  };
  const ws = S.settings.weekStart || 0, dayOrder = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + ws) % 7);
  const body = () => {
    const areas = S.areas.slice().sort(byOrder).map((a) => `<button type="button" class="sm-chip${st.areas.includes(a.id) ? ' on' : ''}" data-farea="${a.id}" aria-pressed="${st.areas.includes(a.id)}">${placeColor(a) ? areaIc(a) : ic('area')}<span>${esc(aTitle(a))}</span></button>`).join('') || '<span class="note">No areas yet. Make some with + New List → New Area, then choose them here.</span>';
    const days = dayOrder.map((d) => `<button type="button" class="fx-day${st.days.includes(d) ? ' on' : ''}" data-fday="${d}" aria-pressed="${st.days.includes(d)}" aria-label="${WEEKDAYS[d]}">${WD[d].slice(0, 2)}</button>`).join('');
    return `<div class="modal-b sm-ed fx-ed">
      <label class="sm-row"><span class="sm-l">Name</span><input class="pk-in sm-in" id="fx-name" value="${esc(st.title)}" placeholder="Work" autocomplete="off"></label>
      <div class="sm-row"><span class="sm-l">Show these areas</span><div class="sm-chips">${areas}</div></div>
      <div class="sm-row fx-line"><span class="sm-l">To-dos and projects outside any area<small>${st.loose ? 'They show in this focus too.' : 'Hidden, Inbox to-dos too, everywhere but the Inbox. New ones you make here go into its first area.'}</small></span><div class="seg" role="group"><button type="button" data-floose="1" class="${st.loose ? 'on' : ''}">Show</button><button type="button" data-floose="0" class="${st.loose ? '' : 'on'}">Hide</button></div></div>
      <div class="sm-row fx-line"><span class="sm-l">Turn on automatically<small>${st.on ? 'You can still switch by hand. That lasts until the next scheduled change.' : 'On a schedule, like weekdays from 8 to 5.'}</small></span><button type="button" class="switch${st.on ? ' on' : ''}" data-fsched="1" role="switch" aria-checked="${st.on}" aria-label="Turn on automatically"></button></div>
      ${st.on ? `<div class="sm-row"><div class="fx-days" role="group" aria-label="Days">${days}</div><div class="fx-times"><label>From <input type="time" class="pk-in" id="fx-from" value="${esc(st.from)}"></label><label>To <input type="time" class="pk-in" id="fx-to" value="${esc(st.to)}"></label></div></div>` : ''}
      <p class="note fx-note">The Inbox always shows everything, and Quick Find still finds everything.</p>
    </div>`;
  };
  const html = `<div class="modal-h"><span class="ic" style="color:var(--accent)">${I.focus}</span><h2>${f ? 'Edit Focus' : 'New Focus'}</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div>`
    + `<div id="fx-body">${body()}</div><div class="modal-f">${f ? '<button class="btn danger" data-fx="delete" style="margin-right:auto">Delete</button>' : ''}<button class="btn" data-fx="cancel">Cancel</button><button class="btn primary" data-fx="save">${f ? 'Save' : 'Create'}</button></div>`;
  const L = openLayer({ modal: true, cls: 'sm-modal fx-modal', html, onMount: (el) => {
    const redraw = () => { $('#fx-body', el).innerHTML = body(); };
    el.addEventListener('input', (e) => {
      if (e.target.id === 'fx-name') st.title = e.target.value;
      else if (e.target.id === 'fx-from') st.from = e.target.value || st.from;
      else if (e.target.id === 'fx-to') st.to = e.target.value || st.to;
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.farea) { const id = b.dataset.farea; st.areas = st.areas.includes(id) ? st.areas.filter((x) => x !== id) : st.areas.concat(id); redraw(); return; }
      if (b.dataset.floose) { st.loose = b.dataset.floose === '1'; redraw(); return; }
      if (b.dataset.fsched) { st.on = !st.on; redraw(); return; }
      if (b.dataset.fday) { const d = +b.dataset.fday; st.days = st.days.includes(d) ? st.days.filter((x) => x !== d) : st.days.concat(d); redraw(); return; }
      if (b.dataset.fx === 'cancel') { closeLayer(L); return; }
      if (b.dataset.fx === 'delete') { closeLayer(L); deleteFocus(f); return; }
      if (b.dataset.fx === 'save') {
        if (st.on && !st.days.length) { toast('Pick at least one day, or turn off the schedule'); return; }
        closeLayer(L);
        const order = S.areas.slice().sort(byOrder).map((a) => a.id);
        saveFocus(f, { title: st.title.trim() || 'Focus', areas: order.filter((id) => st.areas.includes(id)), loose: st.loose, sched: st.on ? { days: st.days.slice().sort((a, b) => a - b), from: st.from, to: st.to } : null });
      }
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'fx-name') { e.preventDefault(); $('[data-fx="save"]', el).click(); } });
    const n = $('#fx-name', el); if (n && !isCoarse()) { n.focus(); n.select(); }
  } });
  return L;
}
/* the Focus part of Settings */
function focusSettingsHTML() {
  const fs = (S.focuses || []).slice().sort(byOrder);
  return `<p class="note" style="margin:0 0 10px">Show only some areas at a time, like Work or Home, in every list, count and Board. Switch at the top of the sidebar, or let a schedule do it. Focuses sync; which one is on is up to each device.</p>`
    + fs.map((f) => `<div class="set-row"><span class="lbl">${esc(focusTitle(f))}${ui.focusRec && ui.focusRec.id === f.id ? ' <span class="fx-on">On</span>' : ''}<small>${esc(focusSummary(f))}</small></span><button class="btn" data-s="focus-edit" data-id="${f.id}">Edit…</button></div>`).join('')
    + `<div class="set-btns"><button class="btn" data-s="focus-new">New Focus…</button></div>`;
}
