/* ===================== Waiting For =====================
   A to-do can wait on someone (waitFor: a name; waitSince: the day it started waiting).
   The follow-up date is simply the to-do's When date, so it comes back to Today then. */
function isWaiting(t) { return !!(t && t.type === 'todo' && t.waitFor && t.status === 'open' && !t.trashed && !t.isTemplate); }
function waitingItems() { return S.todos.filter((t) => isWaiting(t) && liveTodo(t) && inLiveProject(t)); }
function waitNames() {
  const seen = new Map();
  S.todos.filter((t) => t.waitFor && !t.trashed).sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0))
    .forEach((t) => { const k = t.waitFor.trim(); if (k && !seen.has(k.toLowerCase())) seen.set(k.toLowerCase(), k); });
  return [...seen.values()].slice(0, 10);
}
function setWaiting(ids, name, follow) {
  const items = itemsFor(ids).filter((x) => x.type === 'todo' && !x.isTemplate && !isTplChild(x) && !x.trashed);
  if (!items.length) return;
  const T = T0();
  commit('Waiting For', () => items.forEach((t) => {
    if (!t.waitFor || t.waitFor.trim().toLowerCase() !== name.toLowerCase() || !t.waitSince) t.waitSince = T;
    t.waitFor = name;
    if (follow === 'clear') { if (t.when && t.when > T) t.when = null; if (t.start === 'inbox') t.start = 'anytime'; }
    else if (follow) { t.start = 'anytime'; t.when = follow; t.evening = false; }
    else if (t.start === 'inbox') t.start = 'anytime';
    touch(t);
  }));
  const f = follow && follow !== 'clear' ? ` · follow up ${follow <= T ? 'today' : fmtRel(follow)}` : '';
  toast(`${items.length > 1 ? plural(items.length, 'to-do') + ' waiting' : 'Waiting'} on ${name}${f}`, { undo: true });
}
function stopWaiting(ids) {
  const items = itemsFor(ids).filter((x) => x.type === 'todo' && x.waitFor);
  if (!items.length) return;
  commit('Stop Waiting', () => items.forEach((t) => { t.waitFor = null; t.waitSince = null; touch(t); }));
  toast(items.length > 1 ? `${plural(items.length, 'to-do')} no longer waiting` : 'No longer waiting', { undo: true });
}
function openWaiting(ids, anchor) {
  const items = itemsFor(ids).filter((x) => x.type === 'todo' && !x.isTemplate && !isTplChild(x) && !x.trashed);
  if (!items.length) { toast('Only to-dos can wait on someone'); return null; }
  const cur = items[0], T = T0();
  const keepDate = cur.waitFor && cur.when && cur.when > T ? cur.when : null;
  const choices = [['tomorrow', 'Tomorrow', addDays(T, 1)], ['3d', 'In 3 Days', addDays(T, 3)], ['week', 'Next Week', addDays(T, 7)], ['2w', 'In 2 Weeks', addDays(T, 14)], ['none', 'No Date', 'clear']];
  if (keepDate) choices.unshift(['keep', fmtDate(keepDate), keepDate]);
  let pick = keepDate ? 'keep' : '3d';
  const names = waitNames();
  const L = openLayer({ anchor, cls: 'wait-pop', html: `<div class="pk-h">Waiting For</div>
    <div class="wf-b">
      <label class="wf-l" for="wf-who">Who are you waiting on?</label>
      <input class="pk-in" id="wf-who" placeholder="A person, vendor or team" autocomplete="off" value="${esc(cur.waitFor || '')}" enterkeyhint="done">
      ${names.length ? `<div class="wf-names">${names.map((n) => `<button class="tchip" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <div class="wf-l">Follow up</div>
      <div class="wf-dates">${choices.map(([k, l]) => `<button class="tchip${k === pick ? ' on' : ''}" data-f="${k}">${esc(l)}</button>`).join('')}<label class="wf-pick tchip" title="Pick a date">${ic('calendar')}<input type="date" id="wf-date" aria-label="Follow-up date" min="${T}"></label></div>
      <p class="note wf-note">It comes back to Today on the follow-up date.</p>
    </div>
    <div class="wf-f">${items.some((t) => t.waitFor) ? '<button class="btn" data-wf="stop">Stop Waiting</button>' : ''}<span class="spacer"></span><button class="btn primary" data-wf="save">Save</button></div>`,
    onMount: (el) => {
      const who = $('#wf-who', el), dt = $('#wf-date', el);
      let custom = null;
      const mark = () => { $$('[data-f]', el).forEach((b) => b.classList.toggle('on', b.dataset.f === pick)); $('.wf-pick', el).classList.toggle('on', pick === 'custom'); };
      const save = () => {
        const name = who.value.trim() || 'Someone';
        const follow = pick === 'custom' ? custom : (choices.find((c) => c[0] === pick) || [])[2] || null;
        closeLayer(L); setWaiting(items.map((t) => t.id), name, follow);
      };
      el.addEventListener('click', (e) => {
        const n = e.target.closest('[data-name]'); if (n) { who.value = n.dataset.name; if (!isCoarse()) who.focus(); return; }
        const f = e.target.closest('[data-f]'); if (f) { pick = f.dataset.f; mark(); return; }
        const b = e.target.closest('[data-wf]'); if (!b) return;
        if (b.dataset.wf === 'stop') { closeLayer(L); stopWaiting(items.map((t) => t.id)); return; }
        save();
      });
      dt.addEventListener('change', () => { if (dt.value) { custom = dt.value; pick = 'custom'; mark(); } });
      who.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
      if (!isCoarse()) { who.focus({ preventScroll: true }); who.select(); }
    } });
  return L;
}

/* ---- the Waiting list: grouped by who you're waiting on ---- */
function viewWaiting() {
  const items = waitingItems().filter(matchesTagFilter);
  const groups = new Map();
  items.forEach((t) => { const k = t.waitFor.trim(), key = k.toLowerCase(); if (!groups.has(key)) groups.set(key, { name: k, list: [] }); groups.get(key).list.push(t); });
  const due = items.filter((t) => t.when && t.when <= T0()).length;
  const sub = items.length ? `${plural(items.length, 'to-do')} waiting on ${plural(groups.size, 'person', 'people')}${due ? ` · ${due} to follow up today` : ''}` : '';
  let html = headerHTML('waiting', sub) + tagBarHTML(waitingItems()) + '<div class="list">';
  [...groups.values()].sort((a, b) => a.name.localeCompare(b.name)).forEach((g) => {
    const list = g.list.sort((a, b) => (a.when || '9999') < (b.when || '9999') ? -1 : (a.when || '9999') > (b.when || '9999') ? 1 : byOrder(a, b));
    html += `<div class="sec-h"><span>${ic('hourglass')}${esc(g.name)}</span><span class="ghost-count">${list.length}</span></div>` + secHTML('waiting', list, { parent: true, when: true, noWait: true, waitInfo: true });
  });
  html += '</div>';
  if (!items.length) html += emptyHTML('hourglass', 'Nothing waiting', 'When a to-do is waiting on someone else, choose <b>Waiting For…</b> from its ••• menu or press <b>W</b>. It comes back to Today on the follow-up date.');
  return html;
}
