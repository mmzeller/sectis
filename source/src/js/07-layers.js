/* ===================== Popovers, sheets, dialogs, toasts ===================== */
const layers = [];
function openLayer({ html, cls = '', anchor = null, modal = false, onMount, onClose, wide = false, dim }) {
  const root = $('#layer');
  const scrim = document.createElement('div');
  scrim.className = 'scrim' + (modal || isMobile() || dim ? ' dim' : '');
  const el = document.createElement('div');
  el.className = (modal ? 'modal ' : 'pop ') + (wide ? 'wide ' : '') + cls;
  el.setAttribute('role', 'dialog');
  el.innerHTML = html;
  root.append(scrim, el);
  const L = { el, scrim, onClose, anchor };
  layers.push(L);
  scrim.addEventListener('pointerdown', (e) => { e.preventDefault(); closeLayer(L); });
  if (!modal) placePop(el, anchor);
  if (onMount) onMount(el, L);
  return L;
}
function placePop(el, anchor) {
  if (isMobile()) return;
  const r = anchor && anchor.isConnected ? anchor.getBoundingClientRect()
    : anchor && typeof anchor.x === 'number' ? { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0 } // a pointer position (right-click)
    : { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3, width: 0 };
  const pw = el.offsetWidth, ph = el.offsetHeight;
  let x = r.left + r.width / 2 - pw / 2; x = clamp(x, 12, innerWidth - pw - 12);
  let y = r.bottom + 6; if (y + ph > innerHeight - 12) y = Math.max(12, r.top - ph - 6);
  el.style.left = x + 'px'; el.style.top = y + 'px';
}
function closeLayer(L = layers[layers.length - 1]) {
  if (!L) return;
  const i = layers.indexOf(L); if (i < 0) return;
  layers.splice(i, 1); L.el.remove(); L.scrim.remove();
  if (L.onClose) L.onClose();
}
function closeAllLayers() { while (layers.length) closeLayer(); }
const topLayer = () => layers[layers.length - 1];

/* ---- toasts ---- */
function toast(msg, opts = {}) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `<span class="t-msg">${esc(msg)}</span>${opts.undo ? '<button data-t="undo">Undo</button>' : ''}${opts.action ? `<button data-t="act">${esc(opts.action)}</button>` : ''}`;
  box.append(el);
  while (box.children.length > 3) box.firstChild.remove();
  const kill = () => el.remove();
  el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.t === 'undo') undo(); if (b.dataset.t === 'act' && opts.fn) opts.fn(); kill(); });
  setTimeout(kill, opts.ms || (opts.undo || opts.action ? 5200 : 2600));
}

/* ---- dialogs (the viewer can't show native confirm()) ---- */
function confirmDialog({ title, body, ok = 'OK', danger = false, cancel = 'Cancel' }) {
  return new Promise((resolve) => {
    let done = false;
    const L = openLayer({ modal: true, cls: 'narrow', html: `<div class="modal-h"><h2>${esc(title)}</h2></div><div class="modal-b"><p style="margin:0">${body || ''}</p></div><div class="modal-f"><button class="btn" data-r="0">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div>`,
      onClose: () => { if (!done) resolve(false); },
      onMount: (el) => { el.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; done = true; closeLayer(L); resolve(b.dataset.r === '1'); }); $('[data-r="1"]', el).focus(); } });
  });
}
function choiceDialog({ title, body, choices }) {
  return new Promise((resolve) => {
    let done = false;
    const L = openLayer({ modal: true, cls: 'narrow', html: `<div class="modal-h"><h2>${esc(title)}</h2></div><div class="modal-b"><p style="margin:0">${body || ''}</p></div><div class="modal-f"><button class="btn" data-r="">Cancel</button>${choices.map((c) => `<button class="btn ${c.primary ? 'primary' : c.danger ? 'danger' : ''}" data-r="${c.id}">${esc(c.label)}</button>`).join('')}</div>`,
      onClose: () => { if (!done) resolve(null); },
      onMount: (el) => { el.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; done = true; closeLayer(L); resolve(b.dataset.r || null); }); { const p = $('.btn.primary', el); if (p) p.focus(); } } });
  });
}

/* ---- menus ---- */
function openMenu(anchor, items, opts = {}) {
  const html = items.map((it, i) => it.sep ? '<div class="menu-sep"></div>' : it.header ? `<div class="menu-h">${esc(it.header)}</div>` :
    `<button class="menu-i${it.danger ? ' danger' : ''}" data-mi="${i}" ${it.disabled ? 'disabled' : ''}>${it.icon ? ic(it.icon) : ''}<span>${esc(it.label)}</span>${it.hint ? `<span class="hint">${esc(it.hint)}</span>` : ''}</button>`).join('');
  const L = openLayer({ html, anchor, cls: 'menu', onMount: (el) => {
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-mi]'); if (!b) return; const it = items[+b.dataset.mi]; closeLayer(L); if (it.fn) it.fn(); });
    listKeys(el, '.menu-i:not([disabled])');
  } });
  return L;
}
/* arrow-key navigation for any list of buttons inside a layer */
function listKeys(el, sel, input) {
  let k = -1;
  const items = () => $$(sel, el);
  const mark = () => { items().forEach((b, i) => b.classList.toggle('kbd', i === k)); const b = items()[k]; if (b) b.scrollIntoView({ block: 'nearest' }); };
  (input || el).addEventListener('keydown', (e) => {
    const n = items().length; if (!n) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); k = (k + 1) % n; mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); k = (k - 1 + n) % n; mark(); }
    else if (e.key === 'Enter' && k >= 0 && items()[k]) { e.preventDefault(); e.stopPropagation(); items()[k].click(); }
  });
  el.tabIndex = -1; if (!input) el.focus({ preventScroll: true });
  return { reset: () => { k = -1; mark(); }, first: () => { k = 0; mark(); } };
}

/* ---- calendar ---- */
function calHTML(y, m, selected, allowPast, maxDate = null) {
  const ws = S.settings.weekStart || 0, T = T0();
  const first = new Date(y, m, 1).getDay(), offset = (first - ws + 7) % 7, n = daysInMonth(y, m);
  let cells = '';
  for (let i = 0; i < 7; i++) cells += `<span class="wd">${WD[(i + ws) % 7].slice(0, 2)}</span>`;
  for (let i = 0; i < offset; i++) cells += '<span></span>';
  for (let d = 1; d <= n; d++) {
    const s = dateFromParts(y, m, d);
    const cls = ['cal-d'];
    if (s === T) cls.push('today'); if (s === selected) cls.push('sel'); if ((!allowPast && s < T) || (maxDate && s > maxDate)) cls.push('past');
    cells += `<button class="${cls.join(' ')}" data-date="${s}"${maxDate && s > maxDate ? ' disabled' : ''} aria-label="${fmtDate(s)}">${s === T ? '★' : d}</button>`;
  }
  return `<div class="cal-h"><button class="ib" data-cal="-1" aria-label="Previous month">${ic('chevL')}</button><span>${MONTHS[m]} ${y}</span><button class="ib" data-cal="1" aria-label="Next month">${ic('chevR')}</button></div><div class="cal-g">${cells}</div>`;
}

/* ---- When / Deadline picker ---- */
function openWhen(ids, anchor, mode = 'when') {
  ids = ids.filter((id) => itemById(id));
  if (!ids.length) return;
  const items = itemsFor(ids);
  const x0 = items[0];
  if (mode === 'when' && x0.isTemplate) { openRepeat(x0.id, anchor); return; }
  const sel = mode === 'when' ? x0.when : x0.deadline;
  let view = pd(sel || T0()); let cy = view.getFullYear(), cm = view.getMonth();
  let pendingRem = x0.reminder || null, remOpen = !!x0.reminder;
  const hasDate = () => items.some((x) => x.when);
  const remHTML = () => remOpen ? `<div class="pk-rem">${ic('bell')}<input type="time" id="pk-time" value="${pendingRem || '09:00'}" aria-label="Reminder time"><button class="ib" data-pk="rem-clear" aria-label="Remove reminder">${ic('x')}</button></div>` : `<button class="pk-opt" data-pk="rem-add">${ic('bell')}Add Reminder</button>`;
  const build = () => `<div class="pk-h">${mode === 'when' ? 'When' : 'Deadline'}</div>
    <input class="pk-in" id="pk-in" placeholder="${mode === 'when' ? 'tomorrow, fri, oct 24, in 2 weeks…' : 'fri, next month, 11/30…'}" autocomplete="off" aria-label="Type a date">
    <div class="pk-hint" id="pk-hint"></div>
    ${mode === 'when' ? `<button class="pk-opt today${x0.when && x0.when <= T0() && !x0.evening ? ' on' : ''}" data-pk="today">${ic('star')}Today</button><button class="pk-opt evening${isEveningItem(x0) ? ' on' : ''}" data-pk="evening">${ic('moon')}This Evening</button>` : ''}
    <div class="cal" id="cal">${calHTML(cy, cm, sel, mode === 'deadline')}</div>
    ${mode === 'when' ? `<button class="pk-opt someday${x0.start === 'someday' ? ' on' : ''}" data-pk="someday">${ic('box')}Someday</button><div id="pk-remwrap">${remHTML()}</div>` : ''}
    <button class="pk-clear" data-pk="clear">Clear</button>`;
  const L = openLayer({ html: build(), anchor, cls: 'picker', onMount: (el) => {
    const inp = $('#pk-in', el), hint = $('#pk-hint', el);
    const apply = (choice) => {
      closeLayer(L);
      if (mode === 'deadline') { applyDeadline(ids, choice && choice.date ? choice.date : choice === 'today' || choice === 'evening' ? T0() : null); return; }
      applyWhen(ids, choice, remOpen ? (pendingRem || '09:00') : null);
    };
    inp.addEventListener('input', () => {
      const p = parseDateText(inp.value);
      const ok = p && (mode === 'when' || p.date || p.special === 'today');
      hint.textContent = inp.value.trim() ? (ok ? '→ ' + describeParsed(p) : 'Keep typing — try “fri” or “oct 24”') : '';
      hint.classList.toggle('bad', !ok);
      if (ok && p.date) { const d = pd(p.date); cy = d.getFullYear(); cm = d.getMonth(); $('#cal', el).innerHTML = calHTML(cy, cm, p.date, mode === 'deadline'); }
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return; e.preventDefault();
      const p = parseDateText(inp.value); if (!p) return;
      if (p.special === 'anytime') return apply('clear');
      apply(p.date ? { date: p.date } : p.special);
    });
    el.addEventListener('click', (e) => {
      const cal = e.target.closest('[data-cal]');
      if (cal) { cm += +cal.dataset.cal; if (cm < 0) { cm = 11; cy--; } if (cm > 11) { cm = 0; cy++; } $('#cal', el).innerHTML = calHTML(cy, cm, sel, mode === 'deadline'); return; }
      const d = e.target.closest('[data-date]'); if (d) { apply({ date: d.dataset.date }); return; }
      const b = e.target.closest('[data-pk]'); if (!b) return;
      const k = b.dataset.pk;
      if (k === 'rem-add') { remOpen = true; pendingRem = pendingRem || '09:00'; $('#pk-remwrap', el).innerHTML = remHTML(); if (hasDate()) applyReminder(ids, pendingRem); const ti = $('#pk-time', el); if (ti && !isCoarse()) ti.focus(); return; }
      if (k === 'rem-clear') { remOpen = false; pendingRem = null; $('#pk-remwrap', el).innerHTML = remHTML(); if (hasDate()) applyReminder(ids, null); return; }
      if (k === 'clear') { apply(mode === 'when' ? 'clear' : null); return; }
      apply(k);
    });
    el.addEventListener('change', (e) => { if (e.target.id === 'pk-time') { pendingRem = e.target.value || null; if (hasDate()) applyReminder(ids, pendingRem); } });
    if (!isCoarse()) inp.focus({ preventScroll: true });
  } });
  return L;
}

/* ---- Tags picker ---- */
function openTagPicker(ids, anchor, kind = 'item') {
  const targets = () => kind === 'area' ? ids.map(getA).filter(Boolean) : itemsFor(ids);
  const build = (q = '') => {
    const ql = q.trim().toLowerCase();
    const rows = tagTree().filter((n) => !ql || n.tag.title.toLowerCase().includes(ql)).map((n) => {
      const ts = targets(); const count = ts.filter((x) => x.tags.includes(n.tag.id)).length;
      return `<button class="pick-i" data-tag="${n.tag.id}" style="padding-left:${10 + n.depth * 16}px">${ic('tag', 'tc-ic ' + tcls(n.tag))}<span>${esc(n.tag.title)}</span>${count === ts.length && count ? `<span class="check">${ic('check')}</span>` : count ? '<span class="partial">–</span>' : ''}</button>`;
    }).join('');
    const exact = S.tags.some((t) => t.title.toLowerCase() === ql);
    return rows + (ql && !exact ? `<button class="pick-i" data-new="1">${ic('plus')}<span>Create tag “${esc(q.trim())}”</span></button>` : '') + (!rows && !ql ? '<p class="note" style="padding:6px 10px">No tags yet. Type a name to create one.</p>' : '');
  };
  const L = openLayer({ anchor, cls: 'tags-pop', html: `<div class="pk-h">Tags</div><input class="pk-in" id="tg-in" placeholder="Find or create a tag" autocomplete="off" aria-label="Tag name"><div class="pick-list" id="tg-list">${build()}</div><div class="pk-sep"></div><button class="menu-i" data-manage="1">${ic('edit')}<span>Manage Tags…</span></button>`,
    onMount: (el) => {
      const inp = $('#tg-in', el), list = $('#tg-list', el);
      const nav = listKeys(el, '.pick-i', inp);
      const refresh = () => { list.innerHTML = build(inp.value); nav.reset(); };
      const toggle = (tagId) => {
        if (kind === 'area') { const a = getA(ids[0]); commit('Tags', () => { a.tags = a.tags.includes(tagId) ? a.tags.filter((t) => t !== tagId) : a.tags.concat(tagId); }); }
        else toggleTagOn(ids, tagId);
        refresh();
      };
      inp.addEventListener('input', refresh);
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || $('.pick-i.kbd', el)) return; e.preventDefault();
        const q = inp.value.trim(); if (!q) { closeLayer(L); return; }
        const exact = S.tags.find((t) => t.title.toLowerCase() === q.toLowerCase());
        if (exact) toggle(exact.id); else { let t; commit('New Tag', () => { t = findOrCreateTag(q); }, { render: false }); toggle(t.id); }
        inp.value = ''; refresh();
      });
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-manage]')) { closeLayer(L); openTagManager(); return; }
        const b = e.target.closest('.pick-i'); if (!b) return;
        if (b.dataset.new) { let t; commit('New Tag', () => { t = findOrCreateTag(inp.value); }, { render: false }); if (t) toggle(t.id); inp.value = ''; refresh(); return; }
        toggle(b.dataset.tag);
      });
      if (!isCoarse()) inp.focus({ preventScroll: true });
    } });
  return L;
}

/* ---- Move picker ---- */
function openMove(ids, anchor, opts = {}) {
  const items = itemsFor(ids);
  const projectsOnly = items.length && items.every((x) => x.type === 'project');
  const headingMode = opts.heading;
  const cur = items[0] || {};
  const build = (q = '') => {
    const ql = q.trim().toLowerCase(); const m = (s) => !ql || (s || '').toLowerCase().includes(ql);
    let out = '';
    if (projectsOnly) {
      if (m('no area')) out += `<button class="pick-i" data-to="none">${ic('x')}<span>No Area</span>${!cur.areaId ? `<span class="check">${ic('check')}</span>` : ''}</button>`;
      S.areas.slice().sort(byOrder).forEach((a) => { if (m(aTitle(a))) out += `<button class="pick-i a" data-to="area:${a.id}">${ic('area')}<span>${esc(aTitle(a))}</span>${cur.areaId === a.id ? `<span class="check">${ic('check')}</span>` : ''}</button>`; });
      return out;
    }
    const projRows = (areaId) => S.projects.filter((p) => !p.trashed && !p.isTemplate && p.status === 'open' && (p.areaId || null) === areaId).sort(byOrder).map((p) => {
      let r = '';
      const hs = S.headings.filter((h) => h.projectId === p.id && !h.archived).sort(byOrder);
      const pm = m(pTitle(p)); const hm = hs.filter((h) => m(h.title) || pm);
      if (pm || hm.length) {
        r += `<button class="pick-i p${cur.projectId === p.id && !cur.headingId ? ' cur' : ''}" data-to="project:${p.id}">${pieIc(projectProgress(p).frac)}<span>${esc(pTitle(p))}</span></button>`;
        hm.forEach((h) => { r += `<button class="pick-i h${cur.headingId === h.id ? ' cur' : ''}" data-to="project:${p.id}:${h.id}"><span>${esc(h.title || 'New Heading')}</span></button>`; });
      }
      return r;
    }).join('');
    if (!headingMode && !opts.noInbox && m('inbox')) out += `<button class="pick-i inbox" data-to="inbox">${ic('inbox')}<span>Inbox</span></button>`;
    out += projRows(null);
    S.areas.slice().sort(byOrder).forEach((a) => {
      const pr = projRows(a.id);
      if (!headingMode && m(aTitle(a))) out += `<button class="pick-i a" data-to="area:${a.id}">${ic('area')}<span>${esc(aTitle(a))}</span></button>`;
      else if (pr) out += `<div class="menu-h">${esc(aTitle(a))}</div>`;
      out += pr;
    });
    return out || '<p class="note" style="padding:6px 10px">No matching lists.</p>';
  };
  const L = openLayer({ anchor, cls: 'move-pop', html: `<div class="pk-h">${esc(opts.title || (headingMode ? 'Move Heading' : 'Move'))}</div><input class="pk-in" id="mv-in" placeholder="Find a list" autocomplete="off" aria-label="Find a list"><div class="pick-list" id="mv-list">${build()}</div>`,
    onMount: (el) => {
      const inp = $('#mv-in', el), list = $('#mv-list', el);
      const nav = listKeys(el, '.pick-i', inp);
      inp.addEventListener('input', () => { list.innerHTML = build(inp.value); nav.first(); });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-to]'); if (!b) return;
        closeLayer(L);
        const [type, id, hid] = b.dataset.to.split(':');
        if (opts.onPick) { opts.onPick({ type, id, headingId: hid || null }); return; }
        moveItems(ids, { type, id, headingId: hid || null });
      });
      if (!isCoarse()) inp.focus({ preventScroll: true });
    } });
  return L;
}

/* ---- Repeat editor ---- */
function openRepeat(id, anchor) {
  const t = itemById(id); if (!t) return;
  const tpl = t.isTemplate ? t : (t.templateId && itemById(t.templateId) && !itemById(t.templateId).trashed ? itemById(t.templateId) : null);
  const r = JSON.parse(JSON.stringify(tpl ? tpl.repeat : defaultRule(t.when && t.when > T0() ? t.when : T0())));
  if (!tpl) { if (t.reminder) r.reminder = t.reminder; if (t.evening) r.evening = true; if (t.deadline && t.when) r.deadlineDays = Math.max(0, diffDays(t.when, t.deadline)); }
  if (tpl && tpl.next) r.anchor = r.mode === 'after' ? tpl.next : r.anchor;
  r.monthly = r.monthly || { type: 'day', day: pd(r.anchor).getDate(), nth: 1, weekday: dow(r.anchor) };
  r.ends = r.ends || { type: 'never', date: null, count: 10 };
  const unit = () => ({ daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.freq]);
  const body = () => {
    const prev = previewOccurrences(Object.assign({}, r, { count: 0 }), 4);
    const ws = S.settings.weekStart || 0;
    return `<div class="seg" role="group" aria-label="Repeat type"><button data-rp-mode="schedule" class="${r.mode === 'schedule' ? 'on' : ''}">On a schedule</button><button data-rp-mode="after" class="${r.mode === 'after' ? 'on' : ''}">After completion</button></div>
    <div class="rp-row"><span>Repeat</span><select id="rp-freq" aria-label="Frequency">${['daily', 'weekly', 'monthly', 'yearly'].map((f) => `<option value="${f}" ${r.freq === f ? 'selected' : ''}>${f[0].toUpperCase() + f.slice(1)}</option>`).join('')}</select>
      <span>every</span><input type="number" id="rp-int" min="1" max="99" value="${r.interval}" aria-label="Interval"><span>${r.interval == 1 ? unit() : unit() + 's'}${r.mode === 'after' ? ' after completion' : ''}</span></div>
    ${r.mode === 'schedule' && r.freq === 'weekly' ? `<div class="rp-row"><span>On</span><div class="wd-pick">${[0, 1, 2, 3, 4, 5, 6].map((i) => (i + ws) % 7).map((d) => `<button data-rp-wd="${d}" class="${r.weekdays.includes(d) ? 'on' : ''}" aria-pressed="${r.weekdays.includes(d)}">${WD[d].slice(0, 2)}</button>`).join('')}</div></div>` : ''}
    ${r.mode === 'schedule' && r.freq === 'monthly' ? `<div class="rp-row"><span>On</span><select id="rp-mtype" aria-label="Monthly pattern"><option value="day" ${r.monthly.type === 'day' ? 'selected' : ''}>day</option><option value="nth" ${r.monthly.type === 'nth' ? 'selected' : ''}>the</option></select>
      ${r.monthly.type === 'day' ? `<select id="rp-mday" aria-label="Day of month">${Array.from({ length: 31 }, (_, i) => i + 1).map((d) => `<option value="${d}" ${r.monthly.day === d ? 'selected' : ''}>${ordinal(d)}</option>`).join('')}<option value="-1" ${r.monthly.day === -1 ? 'selected' : ''}>last day</option></select>`
      : `<select id="rp-nth" aria-label="Which week">${[1, 2, 3, 4, -1].map((n) => `<option value="${n}" ${r.monthly.nth === n ? 'selected' : ''}>${n === -1 ? 'last' : ordinal(n)}</option>`).join('')}</select><select id="rp-mwd" aria-label="Weekday">${WEEKDAYS.map((w, i) => `<option value="${i}" ${r.monthly.weekday === i ? 'selected' : ''}>${w}</option>`).join('')}</select>`}</div>` : ''}
    <div class="rp-row"><span>${r.mode === 'after' ? 'First on' : 'Starting'}</span><input type="date" id="rp-anchor" value="${r.anchor}" aria-label="Start date"></div>
    <div class="rp-row"><span>Deadline</span><select id="rp-dl" aria-label="Deadline"><option value="">None</option>${[0, 1, 2, 3, 5, 7, 14, 30].map((n) => `<option value="${n}" ${r.deadlineDays !== null && r.deadlineDays !== '' && +r.deadlineDays === n ? 'selected' : ''}>${n === 0 ? 'Same day' : plural(n, 'day') + ' later'}</option>`).join('')}</select></div>
    <div class="rp-row"><span>Reminder</span><input type="time" id="rp-rem" value="${r.reminder || ''}" aria-label="Reminder time">${r.reminder ? `<button class="link-btn" data-rp-clear-rem="1">Remove</button>` : ''}<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="rp-eve" ${r.evening ? 'checked' : ''}>This Evening</label></div>
    <div class="rp-row"><span>Ends</span><select id="rp-ends" aria-label="Ends"><option value="never" ${r.ends.type === 'never' ? 'selected' : ''}>Never</option><option value="on" ${r.ends.type === 'on' ? 'selected' : ''}>On date</option><option value="after" ${r.ends.type === 'after' ? 'selected' : ''}>After</option></select>
      ${r.ends.type === 'on' ? `<input type="date" id="rp-end-date" value="${r.ends.date || addDays(r.anchor, 90)}" aria-label="End date">` : ''}${r.ends.type === 'after' ? `<input type="number" id="rp-end-count" min="1" max="999" value="${r.ends.count || 10}" aria-label="Number of times"><span>times</span>` : ''}</div>
    ${t.type === 'project' ? '<p class="note" style="margin:8px 0 0">Each copy is a new project with this project’s to-dos and headings, scheduled for its start date.</p>' : ''}
    <div class="rp-prev"><b>${esc(ruleSummary(r))}</b><br>${prev.length ? (r.mode === 'after' ? 'First copy ' : 'Next: ') + prev.map((d) => esc(fmtDate(d, { weekday: true }))).join(' · ') : 'No dates match these settings.'}</div>`;
  };
  const L = openLayer({ modal: true, cls: 'narrow', html: `<div class="modal-h"><h2>Repeat</h2></div><div class="modal-b" id="rp-body">${body()}</div><div class="modal-f">${tpl ? `<button class="btn" data-rp="stop" style="margin-right:auto">Stop Repeating</button>` : ''}<button class="btn" data-rp="cancel">Cancel</button><button class="btn primary" data-rp="save">${tpl ? 'Save' : 'Repeat'}</button></div>`,
    onMount: (el) => {
      const redraw = () => { $('#rp-body', el).innerHTML = body(); };
      el.addEventListener('click', (e) => {
        const m = e.target.closest('[data-rp-mode]'); if (m) { r.mode = m.dataset.rpMode; if (r.mode === 'after' && r.freq === 'weekly') r.weekdays = [dow(r.anchor)]; redraw(); return; }
        const w = e.target.closest('[data-rp-wd]'); if (w) { const d = +w.dataset.rpWd; r.weekdays = r.weekdays.includes(d) ? r.weekdays.filter((x) => x !== d) : r.weekdays.concat(d); if (!r.weekdays.length) r.weekdays = [d]; redraw(); return; }
        if (e.target.closest('[data-rp-clear-rem]')) { r.reminder = null; redraw(); return; }
        const b = e.target.closest('[data-rp]'); if (!b) return;
        if (b.dataset.rp === 'cancel') { closeLayer(L); return; }
        if (b.dataset.rp === 'stop') { closeLayer(L); stopRepeating(tpl.id); return; }
        if (b.dataset.rp === 'save') {
          if (r.mode === 'schedule' && !firstOccurrence(r)) { toast('No dates match these settings'); return; }
          closeLayer(L);
          const tplId = setRepeat(tpl ? tpl.id : t.id, r);
          if (!tpl) toast(`${t.type === 'project' ? 'Project repeats' : 'Repeating'} ${ruleSummary(r).toLowerCase()}`);
          if (tplId && !ui.tplModal && !tpl) { /* stays in list as its first copy, or in Upcoming */ }
        }
      });
      el.addEventListener('change', (e) => {
        const id = e.target.id, v = e.target.value;
        if (id === 'rp-freq') { r.freq = v; if (v === 'weekly' && !r.weekdays.length) r.weekdays = [dow(r.anchor)]; }
        if (id === 'rp-int') r.interval = clamp(parseInt(v, 10) || 1, 1, 99);
        if (id === 'rp-mtype') r.monthly.type = v;
        if (id === 'rp-mday') r.monthly.day = +v;
        if (id === 'rp-nth') r.monthly.nth = +v;
        if (id === 'rp-mwd') r.monthly.weekday = +v;
        if (id === 'rp-anchor' && v) { r.anchor = v; if (r.freq === 'weekly' && r.weekdays.length === 1) r.weekdays = [dow(v)]; if (r.freq === 'monthly') { r.monthly.day = pd(v).getDate(); r.monthly.weekday = dow(v); } }
        if (id === 'rp-dl') r.deadlineDays = v === '' ? null : +v;
        if (id === 'rp-rem') r.reminder = v || null;
        if (id === 'rp-eve') r.evening = e.target.checked;
        if (id === 'rp-ends') { r.ends.type = v; if (v === 'on' && !r.ends.date) r.ends.date = addDays(r.anchor, 90); }
        if (id === 'rp-end-date') r.ends.date = v;
        if (id === 'rp-end-count') r.ends.count = clamp(parseInt(v, 10) || 1, 1, 999);
        redraw();
      });
    } });
  return L;
}
