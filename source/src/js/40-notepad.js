/* ===================== Notepad =====================
   Notes that aren't to-dos: a serial number, a phone number, what someone said on a call.
   Open it from any screen with J, the notepad button at the bottom of the sidebar, or (on
   iPhone) the button at the top of every list. Start typing in the box at the top and it
   becomes a note; empty notes aren't kept. Each note remembers the list, project or area it
   was written on (This Page shows only those, and its chip goes back there).
   ••• on a note: Pin to Top, Make To-Do (the selected text, or the note: first line as the
   title, the rest as notes, into the Inbox), Copy Text, Move to This Page, Delete.
   Notes sync like everything else ('note' records), go in backups, and Quick Find finds them.
   On a wide Mac window the Notepad sits beside the list; narrower, it slides over it; on
   iPhone it fills the screen.
   On a Mac it can also float: drag it by its title (or press the float button in its
   header, or double-click the title) and it becomes a window of its own you can put anywhere
   and resize from any edge or corner. Drag it back to the right edge of the window, or press
   the button again, and it goes back to the side. Attached, drag its left edge to make it
   wider or narrower (double-click the edge for the usual width). Each device remembers its
   own width, and where and how big the floating Notepad was. */
ui.np = { open: lsGet('sectis.np') === '1', q: '', page: false, focus: null, float: lsGet('sectis.npFloat') === '1' };
const NP_DOCK_AT = 1100;
const NP_W_MIN = 260, NP_W_MAX = 720, NP_H_MIN = 220, NP_PAD = 6, NP_SNAP = 28;
let npW = +lsGet('sectis.npw') || 0; // its width at the side (0: the usual 340)
let npRect = (() => { try { const r = JSON.parse(lsGet('sectis.npRect') || 'null'); return r && r.w > 0 && r.h > 0 ? r : null; } catch (e) { return null; } })(); // where it floats
const getNote = (id) => (S.notes || []).find((n) => n.id === id);
function normalizeNote(n) { return Object.assign({ type: 'note', text: '', ctx: null, pinned: false, createdAt: 0, modifiedAt: 0 }, n); }
const noteTitle = (n) => { const l = (n.text || '').split('\n').map((s) => s.trim()).find(Boolean); return l ? l.replace(/^(?:[-*•+]|\d+[.)])\s+/, '') : 'Empty Note'; };
const viewKeyNow = () => (ui.view.id ? `${ui.view.type}:${ui.view.id}` : ui.view.type);
/* the page a note was written on, as a label and icon (null once it's gone) */
function noteCtx(key) {
  if (!key) return null;
  const [type, id] = key.split(':');
  if (type === 'project') { const p = getP(id); return p && !p.trashed ? { label: pTitle(p), icon: projIc(p) } : null; }
  if (type === 'area') { const a = getA(id); return a ? { label: aTitle(a), icon: placeColor(a) ? areaIc(a) : ic('area') } : null; }
  if (type === 'tag') { const t = getTag(id); return t ? { label: t.title, icon: ic('tag', 'tc-ic ' + tcls(t)) } : null; }
  if (type === 'smart') { const s = getSmart(id); return s ? { label: smartTitle(s), icon: `<span class="ic" style="color:var(--c-smart)">${I.funnel}</span>` } : null; }
  const L = LISTS[type]; return L ? { label: L.title, icon: `<span class="ic" style="color:${L.color}">${I[L.icon]}</span>` } : null;
}
function noteWhen(ms) {
  if (!ms) return '';
  const d = new Date(ms), day = stampDay(ms), T = T0();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (day === T) return time;
  if (day === addDays(T, -1)) return 'Yesterday';
  return fmtDate(day, { weekday: false });
}

/* ---- open, close and where it sits ---- */
function applyNotepadMode() {
  const app = $('#app'), np = $('#notepad'); if (!app || !np) return;
  const open = ui.np.open && !!S, phone = isMobile(), float = open && !phone && ui.np.float;
  const dock = open && !phone && !float && window.innerWidth >= NP_DOCK_AT;
  np.hidden = !open;
  app.classList.toggle('np-dock', dock);
  app.classList.toggle('np-over', open && !phone && !dock && !float);
  app.classList.toggle('np-float', float);
  app.classList.toggle('np-sheet', open && phone);
  document.body.classList.toggle('np-docked', dock); // the + button moves out of its way
  setNpWidth(npW ? (dock ? clamp(npW, NP_W_MIN, npDockMax()) : npW) : 0);
  if (float) setNpGeom(npFit(npRect || npDefaultRect()));
  else ['left', 'top', 'width', 'height'].forEach((k) => np.style.removeProperty(k));
  $$('[data-action="notepad"]').forEach((b) => b.classList.toggle('on', open));
}
/* ---- its size and where it floats ---- */
const npStays = () => { const app = $('#app'); return app.classList.contains('np-dock') || app.classList.contains('np-float'); }; // still open after you go somewhere
function setNpWidth(w) { if (w) document.documentElement.style.setProperty('--npw', Math.round(w) + 'px'); else document.documentElement.style.removeProperty('--npw'); }
/* beside the list, leave the list room */
function npDockMax() {
  const app = $('#app'), sb = app.classList.contains('sb-off') ? 0 : ($('#sidebar') || {}).offsetWidth || 0;
  return Math.max(NP_W_MIN, Math.min(NP_W_MAX, window.innerWidth - sb - 380));
}
function npDefaultRect() {
  const w = clamp(npW || 340, NP_W_MIN, NP_W_MAX), h = Math.min(560, window.innerHeight - 140);
  return { x: window.innerWidth - w - 56, y: 76, w, h };
}
/* a floating spot kept inside the window (what was saved stays as it was, for when the window grows again) */
function npFit(r) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = clamp(r.w, NP_W_MIN, vw - 2 * NP_PAD), h = clamp(r.h, NP_H_MIN, vh - 2 * NP_PAD);
  return { x: clamp(r.x, NP_PAD, vw - w - NP_PAD), y: clamp(r.y, NP_PAD, vh - h - NP_PAD), w, h };
}
function setNpGeom(r) {
  const np = $('#notepad'); if (!np) return;
  np.style.left = Math.round(r.x) + 'px'; np.style.top = Math.round(r.y) + 'px';
  np.style.width = Math.round(r.w) + 'px'; np.style.height = Math.round(r.h) + 'px';
}
function saveNpRect(r) { npRect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }; lsSet('sectis.npRect', JSON.stringify(npRect)); }
function setNotepadFloat(on) {
  if (isMobile()) return;
  if (on && !npRect) {
    // lift it off the side, a little in from where it was
    const r = $('#notepad').getBoundingClientRect(), d = npDefaultRect();
    saveNpRect(r.width ? { x: r.left - 40, y: 76, w: r.width, h: d.h } : d);
  }
  ui.np.float = on; lsSet('sectis.npFloat', on ? '1' : '');
  renderNotepad(); rewrapAfterNp();
}
const rewrapAfterNp = () => requestAnimationFrame(() => $$('textarea[data-autosize]').forEach(autosize)); // titles and notes rewrap at the new width
function npSizing(cursor) {
  if (cursor) { document.body.style.setProperty('--np-cur', cursor); document.body.classList.add('np-sizing'); }
  else { document.body.classList.remove('np-sizing'); document.body.style.removeProperty('--np-cur'); }
}
/* the spot on the right that shows it'll go back to the side */
function npSnapHint(on) {
  let el = $('#np-snap');
  if (on && !el) { el = document.createElement('div'); el.id = 'np-snap'; el.className = 'np-snap'; document.body.appendChild(el); }
  if (el) el.classList.toggle('on', !!on);
}
function openNotepad(opts = {}) {
  ui.np.open = true; lsSet('sectis.np', '1');
  if (opts.focus) { ui.np.q = ''; const n = getNote(opts.focus); if (n && ui.np.page && n.ctx !== viewKeyNow()) ui.np.page = false; }
  ui.np.focus = opts.focus || (opts.write === false ? null : 'draft');
  applyNotepadMode(); renderNotepad();
}
function closeNotepad() {
  if (!ui.np.open) return;
  const a = document.activeElement; if (a && a.closest && a.closest('#notepad')) a.blur();
  ui.np.open = false; lsSet('sectis.np', ''); ui.np.focus = null;
  dropEmptyNotes(); applyNotepadMode();
}
function toggleNotepad() { if (ui.np.open) closeNotepad(); else openNotepad({ write: !isCoarse() }); }
function dropEmptyNotes(except) {
  const empty = (S.notes || []).filter((n) => n.id !== except && !n.text.trim());
  if (!empty.length) return;
  S.notes = S.notes.filter((n) => !empty.includes(n)); saveSoon();
}

/* ---- drawing it ---- */
function notepadHTML() {
  const here = viewKeyNow(), herectx = noteCtx(here);
  const words = ui.np.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const all = (S.notes || []).filter((n) => n.text.trim());
  const pageCount = all.filter((n) => n.ctx === here).length;
  let list = all.filter((n) => (!ui.np.page || n.ctx === here) && words.every((w) => n.text.toLowerCase().includes(w)));
  list.sort((a, b) => (b.pinned - a.pinned) || (b.modifiedAt - a.modifiedAt));
  const card = (n) => {
    const c = noteCtx(n.ctx);
    return `<div class="np-card${n.pinned ? ' pinned' : ''}" data-note="${n.id}"><textarea class="np-text" data-np-text="${n.id}" data-fkey="note-${n.id}" data-autosize rows="1" aria-label="Note" spellcheck="true">${esc(n.text)}</textarea>`
      + `<div class="np-meta">${n.pinned ? `<span class="np-pin" title="Pinned">${ic('pin')}</span>` : ''}${c ? `<button class="np-ctx" data-nav="${esc(n.ctx)}" title="Written on ${esc(c.label)}">${c.icon}<span>${esc(c.label)}</span></button>` : ''}<span class="np-time" title="${esc(new Date(n.modifiedAt || n.createdAt).toLocaleString())}">${esc(noteWhen(n.modifiedAt || n.createdAt))}</span><span class="spacer"></span>`
      + `<button class="np-todo" data-np-todo="${n.id}" title="Make a to-do of this note, or of the text you've selected in it">${ic('plus')}<span>To-Do</span></button><button class="ib" data-np-more="${n.id}" aria-label="More" title="More">${ic('more')}</button></div></div>`;
  };
  const draft = words.length ? '' : `<div class="np-card np-draft"><textarea class="np-text" data-np-text="draft" data-fkey="note-draft" data-autosize rows="2" placeholder="Jot something down…" aria-label="New note"></textarea></div>`;
  const empty = !list.length ? `<p class="np-empty">${words.length ? 'No notes match.' : ui.np.page ? `Nothing written on ${herectx ? esc(herectx.label) : 'this page'} yet.` : 'Notes that aren’t to-dos go here: a serial number, a phone number, what someone said.'}</p>` : '';
  const fl = ui.np.float, floatBtn = isMobile() ? '' : `<button class="ib np-fl" data-np="float" aria-label="${fl ? 'Attach to the Side' : 'Float the Notepad'}" title="${fl ? 'Attach to the side (or drag it to the right edge)' : 'Float it in its own window (or drag its title)'}">${ic(fl ? 'dockR' : 'popout')}</button>`;
  const grips = isMobile() ? '' : ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map((d) => `<div class="np-rs ${d}" data-np-rs="${d}" aria-hidden="true"${d === 'w' ? ' title="Drag to change the Notepad’s width. Double-click for the usual width."' : ''}></div>`).join('');
  return `<div class="np-h">${ic('notepad', 'np-ic')}<h2>Notepad</h2><span class="spacer"></span>${floatBtn}<button class="ib" data-np="close" aria-label="Close Notepad" title="Close (J)">${isMobile() ? '<span class="np-done">Done</span>' : ic('x')}</button></div>`
    + `<div class="np-tools"><label class="np-q">${ic('search')}<input id="np-q" value="${esc(ui.np.q)}" placeholder="Search notes" autocomplete="off" aria-label="Search notes"></label>`
    + `<div class="seg np-scope" role="group" aria-label="Which notes"><button data-np-page="0" class="${ui.np.page ? '' : 'on'}" aria-pressed="${!ui.np.page}">All</button><button data-np-page="1" class="${ui.np.page ? 'on' : ''}" aria-pressed="${ui.np.page}" title="${herectx ? 'Notes written on ' + esc(herectx.label) : 'Notes written on this page'}">This Page${pageCount ? ` <span class="np-n">${pageCount}</span>` : ''}</button></div></div>`
    + `<div class="np-list" id="np-list">${draft}${list.map(card).join('')}${empty}</div>${grips}`;
}
function renderNotepad() {
  const np = $('#notepad'); if (!np) return;
  applyNotepadMode();
  if (!ui.np.open) { np.innerHTML = ''; return; }
  const box = $('#np-list', np), st = box ? box.scrollTop : 0;
  const qFocused = document.activeElement && document.activeElement.id === 'np-q', qs = qFocused ? document.activeElement.selectionStart : null;
  np.innerHTML = notepadHTML();
  const nb = $('#np-list', np); if (nb) nb.scrollTop = st;
  $$('textarea[data-autosize]', np).forEach(autosize);
  if (qFocused) { const q = $('#np-q', np); q.focus(); try { q.setSelectionRange(qs, qs); } catch (e) { /* ignore */ } }
  if (ui.np.focus) {
    const f = ui.np.focus; ui.np.focus = null;
    const el = $(`[data-np-text="${CSS.escape(f)}"]`, np);
    if (el) { el.focus({ preventScroll: true }); el.closest('.np-card').scrollIntoView({ block: 'nearest' }); if (f !== 'draft') { const e2 = el.value.length; el.setSelectionRange(e2, e2); el.closest('.np-card').classList.add('flash'); } }
  }
}

/* ---- typing ---- */
document.addEventListener('input', (e) => {
  const el = e.target; if (!el.closest || !el.closest('#notepad')) return;
  if (el.id === 'np-q') { ui.np.q = el.value; renderNotepad(); return; }
  const id = el.dataset.npText; if (!id) return;
  if (id === 'draft') {
    if (!el.value.trim()) return;
    // the box at the top becomes a note as soon as there's something in it
    const now = Date.now(), n = normalizeNote({ id: uid(), text: el.value, ctx: viewKeyNow(), createdAt: now, modifiedAt: now });
    S.notes.unshift(n); saveSoon();
    el.dataset.npText = n.id; el.dataset.fkey = 'note-' + n.id; el.removeAttribute('placeholder');
    el.closest('.np-card').classList.remove('np-draft'); el.closest('.np-card').dataset.note = n.id;
    const hint = $('#notepad .np-empty'); if (hint) hint.remove();
    return;
  }
  const n = getNote(id); if (!n) return;
  n.text = el.value; touch(n); saveSoon();
});
document.addEventListener('focusout', (e) => {
  const el = e.target; if (!el.closest || !el.closest('#notepad') || !el.dataset.npText || el.dataset.npText === 'draft') return;
  const n = getNote(el.dataset.npText);
  if (n && !n.text.trim()) setTimeout(() => { if (document.activeElement !== el) { dropEmptyNotes(); if (ui.np.open) renderNotepad(); } }, 150);
});
document.addEventListener('keydown', (e) => {
  if (!ui.np.open || layers.length) return;
  const inside = e.target.closest && e.target.closest('#notepad');
  if (e.key === 'Escape' && (inside || $('#app').classList.contains('np-over'))) { e.preventDefault(); e.stopImmediatePropagation(); closeNotepad(); return; }
  if (inside && (e.metaKey || e.ctrlKey) && e.key === 'Enter' && e.target.dataset.npText) { e.preventDefault(); e.target.blur(); ui.np.focus = 'draft'; renderNotepad(); } // ⌘↩: done with this one, a fresh one
}, true);

/* ---- clicks ---- */
document.addEventListener('pointerdown', (e) => {
  // keep the note's text selection when Make To-Do is pressed
  if (e.target.closest && e.target.closest('#notepad [data-np-todo]')) e.preventDefault();
  // the Notepad over a narrow window steps aside when you click the list behind it
  if (ui.np.open && $('#app').classList.contains('np-over') && e.target.closest && !e.target.closest('#notepad') && !e.target.closest('#layer') && !e.target.closest('[data-action="notepad"]')) closeNotepad();
}, true);
$('#notepad').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.np === 'close') { closeNotepad(); return; }
  if (b.dataset.np === 'float') { setNotepadFloat(!ui.np.float); return; }
  if (b.dataset.npPage) { ui.np.page = b.dataset.npPage === '1'; renderNotepad(); return; }
  if (b.dataset.nav) { if (!npStays()) closeNotepad(); navigate(b.dataset.nav); return; } // to the page it was written on
  if (b.dataset.npTodo) { noteToTodo(b.dataset.npTodo); return; }
  if (b.dataset.npMore) { noteMenu(getNote(b.dataset.npMore), b); }
});
function noteMenu(n, el) {
  if (!n) return;
  const here = viewKeyNow(), hc = noteCtx(here);
  openMenu(el, [
    { label: n.pinned ? 'Unpin' : 'Pin to Top', icon: 'pin', fn: () => { commit(n.pinned ? 'Unpin Note' : 'Pin Note', () => { n.pinned = !n.pinned; }); renderNotepad(); } },
    { label: 'Make To-Do', icon: 'circle', fn: () => noteToTodo(n.id) },
    { label: 'Copy Text', icon: 'copy', fn: () => { try { navigator.clipboard.writeText(n.text).then(() => toast('Copied'), () => toast('Couldn’t copy')); } catch (e) { toast('Couldn’t copy'); } } },
    ...(hc && n.ctx !== here ? [{ label: `Move to ${hc.label}`, icon: 'move', fn: () => { commit('Move Note', () => { n.ctx = here; touch(n); }); renderNotepad(); } }] : []),
    { sep: 1 },
    { label: 'Delete Note', icon: 'trash', danger: true, fn: () => { commit('Delete Note', () => { S.notes = S.notes.filter((x) => x.id !== n.id); }); renderNotepad(); toast('Note deleted', { undo: true }); } },
  ]);
}
/* the selected text, or the whole note: its first line the title, the rest the to-do's notes */
function noteToTodo(id) {
  const n = getNote(id); if (!n || !n.text.trim()) return;
  const ta = $(`#notepad [data-np-text="${CSS.escape(id)}"]`);
  const sel = ta && document.activeElement === ta && ta.selectionStart !== ta.selectionEnd ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : n.text;
  const lines = sel.split('\n'), i = lines.findIndex((l) => l.trim());
  if (i < 0) return;
  const title = lines[i].trim().replace(/^(?:[-*•+]|\d+[.)]|\[[ xX]?\])\s+/, ''), notes = lines.slice(i + 1).join('\n').trim();
  let t;
  commit('Make To-Do', () => { t = makeTodo({ title, notes, start: 'inbox' }); t.order = topOrder(S.todos.filter((x) => isInbox(x) && !x.trashed)); S.todos.push(t); });
  toast(`Added “${title.length > 40 ? title.slice(0, 39) + '…' : title}” to the Inbox`, { action: 'Show', fn: () => { if (!npStays()) closeNotepad(); revealTodo(t.id); } });
}
window.addEventListener('resize', debounce(applyNotepadMode, 60));

/* ---- resizing: its left edge at the side; any edge or corner when it floats ---- */
const NP_CURSORS = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' };
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest && e.target.closest('#notepad .np-rs');
  if (!h || e.button !== 0) return;
  const app = $('#app'), np = $('#notepad'), dir = h.dataset.npRs, float = app.classList.contains('np-float');
  if (!float && dir !== 'w') return;
  e.preventDefault(); e.stopPropagation();
  // at the side it can't crowd out the list; over a narrow window it stops short of the left edge
  const r0 = np.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, maxW = app.classList.contains('np-dock') ? npDockMax() : Math.min(NP_W_MAX, app.clientWidth - 44);
  let w = r0.width, rect = null, raf = 0, last = null;
  npSizing(float ? NP_CURSORS[dir] : 'col-resize'); h.classList.add('on');
  const step = () => {
    raf = 0; const dx = last.clientX - x0, dy = last.clientY - y0;
    if (!float) { w = clamp(r0.width - dx, NP_W_MIN, maxW); setNpWidth(w); return; }
    const vw = window.innerWidth, vh = window.innerHeight;
    let L = r0.left, T = r0.top, R = r0.right, B = r0.bottom;
    if (dir.includes('w')) L = clamp(r0.left + dx, NP_PAD, R - NP_W_MIN);
    if (dir.includes('e')) R = clamp(r0.right + dx, L + NP_W_MIN, vw - NP_PAD);
    if (dir.includes('n')) T = clamp(r0.top + dy, NP_PAD, B - NP_H_MIN);
    if (dir.includes('s')) B = clamp(r0.bottom + dy, T + NP_H_MIN, vh - NP_PAD);
    rect = { x: L, y: T, w: R - L, h: B - T }; setNpGeom(rect);
  };
  const move = (ev) => { last = ev; if (!raf) raf = requestAnimationFrame(step); };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (raf) { cancelAnimationFrame(raf); step(); }
    npSizing(null); h.classList.remove('on');
    if (float) { if (rect) saveNpRect(rect); }
    else if (Math.abs(w - r0.width) > 1) { npW = Math.round(w); lsSet('sectis.npw', String(npW)); }
    rewrapAfterNp();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}, true);
document.addEventListener('dblclick', (e) => {
  const h = e.target.closest && e.target.closest('#notepad .np-rs');
  if (!h || $('#app').classList.contains('np-float')) return;
  e.preventDefault(); npW = 0; lsSet('sectis.npw', ''); applyNotepadMode(); rewrapAfterNp();
});

/* ---- moving: drag it by its title ---- */
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || isMobile() || !ui.np.open) return;
  const hd = e.target.closest && e.target.closest('#notepad .np-h');
  if (!hd || e.target.closest('button, input, a, textarea')) return;
  e.preventDefault(); // no text selection while dragging
  const app = $('#app'), np = $('#notepad'), r0 = np.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
  const gx = (x0 - r0.left) / r0.width, gy = y0 - r0.top; // where on it you took hold
  const wasFloat = app.classList.contains('np-float');
  let moving = false, snap = false, rect = null, size = null, raf = 0, last = null;
  const step = () => {
    raf = 0;
    if (!moving) {
      if (Math.hypot(last.clientX - x0, last.clientY - y0) < 5) return;
      moving = true; npSizing('grabbing');
      if (wasFloat) size = { w: r0.width, h: r0.height };
      else {
        // off the side: it becomes a window the size it last floated at
        const d = npRect || { w: r0.width, h: npDefaultRect().h };
        size = { w: d.w, h: d.h }; ui.np.float = true; applyNotepadMode();
      }
    }
    rect = npFit({ x: last.clientX - gx * size.w, y: last.clientY - gy, w: size.w, h: size.h });
    setNpGeom(rect);
    snap = last.clientX >= window.innerWidth - NP_SNAP; npSnapHint(snap);
  };
  const move = (ev) => { last = ev; if (!raf) raf = requestAnimationFrame(step); };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (raf) { cancelAnimationFrame(raf); step(); }
    npSizing(null); npSnapHint(false);
    if (!moving) return;
    if (snap) { ui.np.float = false; lsSet('sectis.npFloat', ''); if (rect && wasFloat) saveNpRect({ x: r0.left, y: r0.top, w: r0.width, h: r0.height }); } // it floats back where it was next time
    else { saveNpRect(rect); ui.np.float = true; lsSet('sectis.npFloat', '1'); }
    renderNotepad(); rewrapAfterNp();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}, true);
document.addEventListener('dblclick', (e) => {
  if (isMobile() || !(e.target.closest && e.target.closest('#notepad .np-h')) || e.target.closest('button, input')) return;
  setNotepadFloat(!ui.np.float);
});
