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
   iPhone it fills the screen. */
ui.np = { open: lsGet('sectis.np') === '1', q: '', page: false, focus: null };
const NP_DOCK_AT = 1100;
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
  const open = ui.np.open && !!S, phone = isMobile(), dock = open && !phone && window.innerWidth >= NP_DOCK_AT;
  np.hidden = !open;
  app.classList.toggle('np-dock', dock);
  app.classList.toggle('np-over', open && !phone && !dock);
  app.classList.toggle('np-sheet', open && phone);
  document.body.classList.toggle('np-docked', dock); // the + button moves out of its way
  $$('[data-action="notepad"]').forEach((b) => b.classList.toggle('on', open));
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
  return `<div class="np-h">${ic('notepad', 'np-ic')}<h2>Notepad</h2><span class="spacer"></span><button class="ib" data-np="close" aria-label="Close Notepad" title="Close (J)">${isMobile() ? '<span class="np-done">Done</span>' : ic('x')}</button></div>`
    + `<div class="np-tools"><label class="np-q">${ic('search')}<input id="np-q" value="${esc(ui.np.q)}" placeholder="Search notes" autocomplete="off" aria-label="Search notes"></label>`
    + `<div class="seg np-scope" role="group" aria-label="Which notes"><button data-np-page="0" class="${ui.np.page ? '' : 'on'}" aria-pressed="${!ui.np.page}">All</button><button data-np-page="1" class="${ui.np.page ? 'on' : ''}" aria-pressed="${ui.np.page}" title="${herectx ? 'Notes written on ' + esc(herectx.label) : 'Notes written on this page'}">This Page${pageCount ? ` <span class="np-n">${pageCount}</span>` : ''}</button></div></div>`
    + `<div class="np-list" id="np-list">${draft}${list.map(card).join('')}${empty}</div>`;
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
  if (b.dataset.npPage) { ui.np.page = b.dataset.npPage === '1'; renderNotepad(); return; }
  if (b.dataset.nav) { if (!$('#app').classList.contains('np-dock')) closeNotepad(); navigate(b.dataset.nav); return; } // to the page it was written on
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
  toast(`Added “${title.length > 40 ? title.slice(0, 39) + '…' : title}” to the Inbox`, { action: 'Show', fn: () => { if (!$('#app').classList.contains('np-dock')) closeNotepad(); revealTodo(t.id); } });
}
window.addEventListener('resize', debounce(applyNotepadMode, 60));
