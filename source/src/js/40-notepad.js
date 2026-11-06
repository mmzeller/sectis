/* ===================== Notepad =====================
   Notes that aren't to-dos: a serial number, a phone number, what someone said on a call.
   Open it from any screen with J, the notepad button at the bottom of the sidebar, or (on
   iPhone) the button at the top of every list. Start typing in the box at the top and it
   becomes a note; empty notes aren't kept. Each note remembers the list, project or area it
   was written on (This Page shows only those, and its chip goes back there). A page with notes
   shows a notepad badge with their count in its header; it opens the Notepad on This Page.
   Notes read formatted, like a to-do's notes (links you can click, **bold**, bullets,
   checkboxes you can tick), and stay formatted while you type in one (14-liveedit.js: the line
   you're on shows its Markdown). The things you keep notes for (serial
   numbers, IP and MAC addresses, license keys, phone numbers…) get a one-click copy button,
   and phone numbers call. A long note shows its first lines, with Show More.
   ••• on a note: Pin to Top, Make To-Do (the selected text, or the note: first line as the
   title, the rest as notes, into the Inbox), One To-Do per Line (each line, or each list item,
   becomes its own Inbox to-do), Copy Text, Show as Sticky, Move to This Page, Archive, Delete.
   Archived notes leave the list but search and Quick Find still find them; ••• in the header
   → Archived Notes lists them, and Group by Page sorts the list under the page each note was
   written on.
   A sticky is one note popped out as a small card of its own (Mac): it stays on screen on every
   page, whether the Notepad is open or not, and you can move it, resize it and edit it there.
   Notes sync like everything else ('note' records), go in backups, and Quick Find finds them.
   Sintr can add a meeting's summary as a note, on the page its to-dos went to.
   On a wide Mac window the Notepad sits beside the list; narrower, it slides over it; on
   iPhone it fills the screen.
   On a Mac it can also float: drag it by its title (or press the float button in its
   header, or double-click the title) and it becomes a window of its own you can put anywhere
   and resize from any edge or corner. Drag it back to the right edge of the window, or press
   the button again, and it goes back to the side. Attached, drag its left edge to make it
   wider or narrower (double-click the edge for the usual width). Each device remembers its
   own width, where and how big the floating Notepad was, and where its stickies are. */
ui.np = {
  open: lsGet('sectis.np') === '1', q: '', page: false, focus: null, float: lsGet('sectis.npFloat') === '1',
  editing: null, // the note being typed in (the live editor); the rest read formatted
  expanded: new Set(), // long notes opened with Show More
  arch: false, // showing Archived Notes
  group: lsGet('sectis.npGroup') === '1', // Group by Page
};
const NP_DOCK_AT = 1100;
const NP_W_MIN = 260, NP_W_MAX = 720, NP_H_MIN = 220, NP_PAD = 6, NP_SNAP = 28;
const NP_FOLD_AT = 150; // how much of a long note shows before Show More
const NP_MD = { values: true, tasks: true };
const NP_ST = { w: 240, h: 190, minW: 170, minH: 110 };
let npW = +lsGet('sectis.npw') || 0; // its width at the side (0: the usual 340)
let npRect = (() => { try { const r = JSON.parse(lsGet('sectis.npRect') || 'null'); return r && r.w > 0 && r.h > 0 ? r : null; } catch (e) { return null; } })(); // where it floats
let npStickies = (() => { try { const a = JSON.parse(lsGet('sectis.npStickies') || '[]'); return Array.isArray(a) ? a.filter((s) => s && s.id) : []; } catch (e) { return []; } })(); // which notes are stickies, and where
let npStZ = 1;
const getNote = (id) => (S.notes || []).find((n) => n.id === id);
function normalizeNote(n) { return Object.assign({ type: 'note', text: '', ctx: null, pinned: false, archived: false, createdAt: 0, modifiedAt: 0 }, n); }
const noteTitle = (n) => { const l = (n.text || '').split('\n').map((s) => s.trim()).find(Boolean); return l ? l.replace(/^(?:#{1,6}\s+|(?:[-*•+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?)/, '').replace(/\*\*|__|`/g, '') : 'Empty Note'; };
/* the page you're on, as a note remembers it (a Board: which Board) */
const viewKeyNow = () => (ui.view.type === 'board' && ui.boardId ? `board:${ui.boardId}` : ui.view.id ? `${ui.view.type}:${ui.view.id}` : ui.view.type);
/* the pages a note is attached to: where it was written, unless you've changed that, and any
   others you've added (Attach To…). ctx is the first; ctxs has them all when there's more than
   one, so a note on one page looks just as it always has. One written on a Board before notes
   knew which Board counts as the Board you're on now */
const noteKeys = (n) => [...new Set((Array.isArray(n.ctxs) && n.ctxs.length ? n.ctxs : n.ctx ? [n.ctx] : []).map((k) => (k === 'board' && ui.boardId ? `board:${ui.boardId}` : k)))];
const noteKey = (n) => noteKeys(n)[0] || null;
const noteOn = (n, key) => noteKeys(n).includes(key);
function setNoteKeys(n, keys) {
  keys = [...new Set(keys.filter(Boolean))];
  n.ctx = keys[0] || null;
  if (keys.length > 1) n.ctxs = keys; else delete n.ctxs;
  touch(n);
}
const liveNotes = () => (S.notes || []).filter((n) => n.text.trim());
const pageNoteCount = (key) => liveNotes().filter((n) => noteOn(n, key) && !n.archived).length;
/* the page a note was written on, as a label and icon (null once it's gone) */
function noteCtx(key) {
  if (!key) return null;
  const [type, id] = key.split(':');
  if (type === 'project') { const p = getP(id); return p && !p.trashed ? { label: pTitle(p), icon: projIc(p) } : null; }
  if (type === 'area') { const a = getA(id); return a ? { label: aTitle(a), icon: placeColor(a) ? areaIc(a) : ic('area') } : null; }
  if (type === 'tag') { const t = getTag(id); return t ? { label: t.title, icon: ic('tag', 'tc-ic ' + tcls(t)) } : null; }
  if (type === 'smart') { const s = getSmart(id); return s ? { label: smartTitle(s), icon: `<span class="ic" style="color:var(--c-smart)">${I.funnel}</span>` } : null; }
  if (type === 'board') { // by its name now; a Board on another Mac (Boards are each device's own) is just "Board"
    const b = (ui.boards || []).find((x) => x.id === (id || ui.boardId));
    return { label: (b && b.name) || 'Board', icon: `<span class="ic" style="color:var(--c-board)">${I.columns}</span>` };
  }
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
  renderStickies();
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
function npFit(r, minW = NP_W_MIN, minH = NP_H_MIN) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = clamp(r.w, minW, vw - 2 * NP_PAD), h = clamp(r.h, minH, vh - 2 * NP_PAD);
  return { x: clamp(r.x, NP_PAD, vw - w - NP_PAD), y: clamp(r.y, NP_PAD, vh - h - NP_PAD), w, h };
}
function setGeom(el, r) {
  if (!el) return;
  el.style.left = Math.round(r.x) + 'px'; el.style.top = Math.round(r.y) + 'px';
  el.style.width = Math.round(r.w) + 'px'; el.style.height = Math.round(r.h) + 'px';
}
const setNpGeom = (r) => setGeom($('#notepad'), r);
const roundRect = (r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });
function saveNpRect(r) { npRect = roundRect(r); lsSet('sectis.npRect', JSON.stringify(npRect)); }
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
const rewrapAfterNp = () => requestAnimationFrame(() => { $$('textarea[data-autosize]').forEach((t) => { if (!t.hidden) autosize(t); }); npMeasureFolds($('#notepad')); }); // titles and notes rewrap at the new width
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
  if (opts.focus) {
    ui.np.q = ''; const n = getNote(opts.focus);
    if (n) { ui.np.arch = !!n.archived; if (ui.np.page && !noteOn(n, viewKeyNow())) ui.np.page = false; }
  }
  ui.np.focus = opts.focus || (opts.write === false || ui.np.arch ? null : 'draft');
  applyNotepadMode(); renderNotepad();
}
function closeNotepad() {
  if (!ui.np.open) return;
  const a = document.activeElement; if (a && a.closest && a.closest('#notepad')) a.blur();
  ui.np.open = false; lsSet('sectis.np', ''); ui.np.focus = null; ui.np.editing = null;
  dropEmptyNotes(); applyNotepadMode(); noteBadge();
}
function toggleNotepad() { if (ui.np.open) closeNotepad(); else openNotepad({ write: !isCoarse() }); }
/* the badge in a page's header: open the Notepad on This Page (or close it again) */
function openNotepadHere() {
  if (ui.np.open && ui.np.page && !ui.np.arch) { closeNotepad(); return; }
  ui.np.page = true; ui.np.arch = false; ui.np.q = '';
  openNotepad({ write: false });
}
function dropEmptyNotes(except) {
  const empty = (S.notes || []).filter((n) => n.id !== except && !n.text.trim());
  if (!empty.length) return;
  S.notes = S.notes.filter((n) => !empty.includes(n)); saveSoon();
}

/* ---- drawing it ---- */
function noteCardHTML(n, o = {}) {
  const editing = ui.np.editing === n.id, places = noteKeys(n).map((k) => [k, noteCtx(k)]).filter(([, c]) => c);
  const [key, main] = places.find(([k]) => k === o.here) || places[0] || [null, null]; // in a page's group: that page first
  const c = o.noCtx ? null : main, others = places.filter(([k]) => k !== key);
  return `<div class="np-card${n.pinned && !n.archived ? ' pinned' : ''}${n.archived ? ' archived' : ''}" data-note="${n.id}">`
    + `<div class="np-view md" data-np-view="${n.id}"${editing ? ' hidden' : ''}>${editing ? '' : renderMarkdown(n.text, NP_MD)}</div>`
    + npEditorHTML(n.id, 'note-' + n.id, 'Note', editing ? n.text : null)
    + `<button class="np-more" data-np-fold="${n.id}" hidden>${ui.np.expanded.has(n.id) ? 'Show Less' : 'Show More'}</button>`
    + `<div class="np-meta">${n.pinned && !n.archived ? `<span class="np-pin" title="Pinned">${ic('pin')}</span>` : ''}${n.archived && o.archTag ? `<span class="np-arch" title="Archived">${ic('archive')}</span>` : ''}${stickyOf(n.id) && !isMobile() ? `<span class="np-pin" title="Showing as a sticky">${ic('popout')}</span>` : ''}${c ? `<button class="np-ctx" data-nav="${esc(key)}" title="${places.length > 1 ? 'On' : 'Written on'} ${esc(c.label)}">${c.icon}<span>${esc(c.label)}</span></button>` : ''}${others.length && key ? `<button class="np-ctx np-more-ctx" data-np-places="${n.id}" title="Also on ${esc(others.map(([, x]) => x.label).join(', '))}">${o.noCtx ? `Also on ${others.length === 1 ? esc(others[0][1].label) : others.length + ' more'}` : '+' + others.length}</button>` : ''}<span class="np-time" title="${esc(new Date(n.modifiedAt || n.createdAt).toLocaleString())}">${esc(noteWhen(n.modifiedAt || n.createdAt))}</span><span class="spacer"></span>`
    + `<button class="np-todo" data-np-todo="${n.id}" title="Make a to-do of this note, or of the text you've selected in it">${ic('plus')}<span>To-Do</span></button><button class="ib" data-np-more="${n.id}" aria-label="More" title="More">${ic('more')}</button></div></div>`;
}
/* a note's live editor; text null: hidden and empty until you click into the note */
const npEditorHTML = (id, fkey, label, text, ph) => `<div class="np-text le${text ? '' : ' le-empty'}" contenteditable="true" role="textbox" aria-multiline="true" data-np-text="${id}" data-fkey="${fkey}" aria-label="${label}" spellcheck="true"${ph ? ` data-placeholder="${esc(ph)}"` : ''}${text == null ? ' hidden' : ''}>${text == null ? '' : leHTML(text)}</div>`;
const draftHTML = () => `<div class="np-card np-draft">${npEditorHTML('draft', 'note-draft', 'New note', '', 'Jot something down…')}</div>`;
function notepadHTML() {
  const here = viewKeyNow(), herectx = noteCtx(here), arch = ui.np.arch;
  const words = ui.np.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const all = liveNotes(), match = (n) => words.every((w) => n.text.toLowerCase().includes(w));
  const pageCount = all.filter((n) => noteOn(n, here) && !n.archived).length;
  const newest = (a, b) => b.modifiedAt - a.modifiedAt, pinFirst = (a, b) => (b.pinned - a.pinned) || newest(a, b);
  const onPage = (n) => !ui.np.page || noteOn(n, here);
  let list, archHits = [];
  if (arch) list = all.filter((n) => n.archived && match(n)).sort(newest);
  else {
    list = all.filter((n) => !n.archived && onPage(n) && match(n)).sort(pinFirst);
    if (words.length) archHits = all.filter((n) => n.archived && onPage(n) && match(n)).sort(newest); // search still finds archived notes
  }
  let body;
  if (ui.np.group && !ui.np.page && !arch && list.length) {
    // under the page each was written on: this page first, then the most recently written in
    const groups = new Map();
    // a note on several pages goes under this page if it's one of them, else under its first
    list.forEach((n) => { const k = noteOn(n, here) ? here : noteKeys(n).find((x) => noteCtx(x)) || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); });
    const latest = (k) => Math.max(...groups.get(k).map((n) => n.modifiedAt));
    const keys = [...groups.keys()].sort((a, b) => (b === here) - (a === here) || (a === '') - (b === '') || latest(b) - latest(a));
    body = keys.map((k) => {
      const c = noteCtx(k), ns = groups.get(k);
      return `<div class="np-group"><div class="np-gh">${c ? `<button class="np-gl" data-nav="${esc(k)}" title="Go to ${esc(c.label)}">${c.icon}<span>${esc(c.label)}</span></button>` : '<span class="np-gl"><span>Other Notes</span></span>'}<span class="np-gn">${ns.length}</span></div>${ns.map((n) => noteCardHTML(n, { noCtx: !!c, here: k })).join('')}</div>`;
    }).join('');
  } else body = list.map((n) => noteCardHTML(n)).join('');
  if (archHits.length) body += `<div class="np-gh np-arch-h"><span class="np-gl">${ic('archive')}<span>Archived</span></span><span class="np-gn">${archHits.length}</span></div>${archHits.map((n) => noteCardHTML(n, { archTag: true })).join('')}`;
  const draft = words.length || arch ? '' : draftHTML();
  const empty = !list.length && !archHits.length ? `<p class="np-empty">${arch ? (words.length ? 'No archived notes match.' : 'No archived notes. Archive a note from its ••• menu to put it away without deleting it.') : words.length ? 'No notes match.' : ui.np.page ? `Nothing written on ${herectx ? esc(herectx.label) : 'this page'} yet.` : 'Notes that aren’t to-dos go here: a serial number, a phone number, what someone said.'}</p>` : '';
  const fl = ui.np.float, floatBtn = isMobile() ? '' : `<button class="ib np-fl" data-np="float" aria-label="${fl ? 'Attach to the Side' : 'Float the Notepad'}" title="${fl ? 'Attach to the side (or drag it to the right edge)' : 'Float it in its own window (or drag its title)'}">${ic(fl ? 'dockR' : 'popout')}</button>`;
  const closeBtn = `<button class="ib" data-np="close" aria-label="Close Notepad" title="Close (J)">${isMobile() ? '<span class="np-done">Done</span>' : ic('x')}</button>`;
  const grips = isMobile() ? '' : ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map((d) => `<div class="np-rs ${d}" data-np-rs="${d}" aria-hidden="true"${d === 'w' ? ' title="Drag to change the Notepad’s width. Double-click for the usual width."' : ''}></div>`).join('');
  const head = arch
    ? `<div class="np-h"><button class="ib np-back" data-np="back" aria-label="Back to Notes" title="Back to your notes">${ic('chevL')}</button><h2>Archived Notes</h2><span class="spacer"></span>${floatBtn}${closeBtn}</div>`
    : `<div class="np-h">${ic('notepad', 'np-ic')}<h2>Notepad</h2><span class="spacer"></span>${floatBtn}<button class="ib" data-np="menu" aria-label="Notepad options" title="Notepad options">${ic('more')}</button>${closeBtn}</div>`;
  return head
    + `<div class="np-tools"><label class="np-q">${ic('search')}<input id="np-q" data-fkey="np-q" value="${esc(ui.np.q)}" placeholder="${arch ? 'Search archived notes' : 'Search notes'}" autocomplete="off" aria-label="Search notes"></label>`
    + (arch ? '' : `<div class="seg np-scope" role="group" aria-label="Which notes"><button data-np-page="0" class="${ui.np.page ? '' : 'on'}" aria-pressed="${!ui.np.page}">All</button><button data-np-page="1" class="${ui.np.page ? 'on' : ''}" aria-pressed="${ui.np.page}" title="${herectx ? 'Notes written on ' + esc(herectx.label) : 'Notes written on this page'}">This Page${pageCount ? ` <span class="np-n">${pageCount}</span>` : ''}</button></div>`) + '</div>'
    + `<div class="np-list" id="np-list">${draft}${body}${empty}</div>${grips}`;
}
function renderNotepad() {
  const np = $('#notepad'); if (!np) return;
  applyNotepadMode();
  if (!ui.np.open) { np.innerHTML = ''; noteBadge(); return; }
  const box = $('#np-list', np), st = box ? box.scrollTop : 0;
  // keep typing where you were (the search box, or a note) across a redraw
  const a = document.activeElement, fk = a && np.contains(a) && a.dataset ? a.dataset.fkey : null;
  const ss = fk && 'selectionStart' in a ? a.selectionStart : null, se = fk && 'selectionEnd' in a ? a.selectionEnd : null;
  const lsel = fk && a.classList.contains('le') ? leGetSel(a) : null;
  np.innerHTML = notepadHTML();
  const nb = $('#np-list', np); if (nb) nb.scrollTop = st;
  $$('textarea[data-autosize]', np).forEach((t) => { if (!t.hidden) autosize(t); });
  npMeasureFolds(np);
  if (fk) {
    const el = $(`[data-fkey="${CSS.escape(fk)}"]`, np);
    if (el && !el.hidden) {
      el.focus({ preventScroll: true });
      if (el.classList.contains('le')) { if (lsel) leSetSel(el, lsel.s, lsel.e, lsel.back); } else try { el.setSelectionRange(ss, se); } catch (e) { /* ignore */ }
    }
  }
  if (ui.np.focus) {
    const f = ui.np.focus; ui.np.focus = null;
    if (f === 'draft') { const el = $('[data-np-text="draft"]', np); if (el) { el.focus({ preventScroll: true }); el.closest('.np-card').scrollIntoView({ block: 'nearest' }); } }
    else {
      const card = $(`.np-card[data-note="${CSS.escape(f)}"]`, np);
      if (card) { if (card.classList.contains('folded')) { ui.np.expanded.add(f); npMeasureFolds(card.parentElement); } card.scrollIntoView({ block: 'nearest' }); card.classList.add('flash'); }
    }
  }
  noteBadge();
}
/* long notes show their first lines, with Show More */
function npMeasureFolds(root) {
  if (!root) return;
  $$('.np-card[data-note]', root).forEach((card) => {
    const v = $('.np-view', card), b = $('.np-more', card); if (!v || !b) return;
    card.classList.remove('folded');
    if (v.hidden) { b.hidden = true; return; }
    const open = ui.np.expanded.has(card.dataset.note), tall = v.scrollHeight > NP_FOLD_AT + 30;
    b.hidden = !tall; b.textContent = open ? 'Show Less' : 'Show More';
    card.classList.toggle('folded', tall && !open);
  });
}
/* the badge with this page's note count, in the page's header */
function noteBadge() {
  const lh = S && $('#content .lh'); if (!lh) return;
  const old = $('.lh-np', lh), n = pageNoteCount(viewKeyNow());
  if (!n) { if (old) old.remove(); return; }
  const on = ui.np.open && ui.np.page && !ui.np.arch;
  const html = `<button class="lh-np${on ? ' on' : ''}" data-action="np-page" aria-pressed="${on}" title="${n === 1 ? '1 note' : n + ' notes'} written here. ${on ? 'Close the Notepad' : 'Show them in the Notepad'}." aria-label="${n === 1 ? '1 note' : n + ' notes'} written here">${ic('notepad')}<span>${n}</span></button>`;
  if (old) { old.outerHTML = html; return; }
  const btn = [...lh.children].find((c) => c.matches('button.ib, button.btn'));
  if (btn) btn.insertAdjacentHTML('beforebegin', html); else lh.insertAdjacentHTML('beforeend', html);
}

/* ---- reading and typing: formatted either way; a click puts you in the live editor ---- */
const noteBox = (el) => el && el.closest('.np-card, .np-sticky');
/* at: where in the formatted note it was clicked (its line and how far along), or the end */
function npEditNote(id, box, at) {
  const ed = box && $(`[data-np-text="${CSS.escape(id)}"]`, box), v = box && $('[data-np-view]', box); if (!ed) return;
  const n = getNote(id);
  if (box.closest('#notepad')) ui.np.editing = id; else box.classList.add('editing');
  if (v) v.hidden = true;
  box.classList.remove('folded'); const more = $('.np-more', box); if (more) more.hidden = true;
  ed.hidden = false; leRender(ed, n ? n.text : leText(ed));
  ed.focus({ preventScroll: true });
  if (at && at.ln != null) leCaretAtShown(ed, at.ln, at.vis); else leSetSel(ed, leText(ed).length);
}
/* where in a formatted note a click landed: the line it's on and how many characters along */
function npShownAt(v, x, y) {
  const p = lePointAt(x, y); if (!p || !v.contains(p.node)) return null;
  const host = p.node.nodeType === 1 ? p.node : p.node.parentElement, blk = host && host.closest('[data-ln]');
  if (!blk || !v.contains(blk)) return null;
  const st = { n: 0, done: false }; leCount(blk, p.node, p.offset, st);
  return { ln: +blk.dataset.ln, vis: st.n };
}
function npShowView(box, n) {
  const ta = $('[data-np-text]', box), v = $('[data-np-view]', box);
  box.classList.remove('editing');
  if (!v) { // a note just started in the box at the top: draw it as a note, with a fresh box above
    if (!box.closest('#notepad')) return;
    box.outerHTML = noteCardHTML(n);
    const list = $('#np-list'); if (list && !$('.np-draft', list) && !ui.np.q.trim() && !ui.np.arch) list.insertAdjacentHTML('afterbegin', draftHTML());
    const card = $(`#notepad .np-card[data-note="${CSS.escape(n.id)}"]`); if (card) npMeasureFolds(card.parentElement);
    return;
  }
  v.innerHTML = renderMarkdown(n.text, NP_MD); v.hidden = false; if (ta) ta.hidden = true;
  if (box.classList.contains('np-card')) npMeasureFolds(box.parentElement);
}
/* the same note shown twice (in the Notepad and as a sticky) stays the same in both */
function npMirror(n, from) {
  const src = noteBox(from);
  $$(`[data-np-text="${CSS.escape(n.id)}"]`).forEach((ed) => { if (ed !== from && !ed.hidden) leRender(ed, n.text); });
  $$(`[data-np-view="${CSS.escape(n.id)}"]`).forEach((v) => { if (noteBox(v) !== src) v.innerHTML = renderMarkdown(n.text, NP_MD); });
  $$(`.np-sticky[data-sticky="${CSS.escape(n.id)}"]`).forEach((st) => { st.dataset.v = n.modifiedAt; });
}
document.addEventListener('input', (e) => {
  const el = e.target; if (!el.closest || !el.closest('#notepad, #np-stickies')) return;
  if (el.id === 'np-q') { ui.np.q = el.value; renderNotepad(); return; }
  const id = el.dataset.npText; if (!id) return;
  const text = leText(el);
  if (id === 'draft') {
    if (!text.trim()) return;
    // the box at the top becomes a note as soon as there's something in it
    const now = Date.now(), n = normalizeNote({ id: uid(), text, ctx: viewKeyNow(), createdAt: now, modifiedAt: now });
    S.notes.unshift(n); saveSoon(); ui.np.editing = n.id;
    el.dataset.npText = n.id; el.dataset.fkey = 'note-' + n.id; el.removeAttribute('data-placeholder'); el.setAttribute('aria-label', 'Note');
    leState(el); // its undo history goes with it under its new name
    el.closest('.np-card').classList.remove('np-draft'); el.closest('.np-card').dataset.note = n.id;
    const hint = $('#notepad .np-empty'); if (hint) hint.remove();
    noteBadge();
    return;
  }
  const n = getNote(id); if (!n || n.text === text) return;
  n.text = text; touch(n); saveSoon(); npMirror(n, el);
});
document.addEventListener('click', (e) => {
  const v = e.target.closest && e.target.closest('[data-np-view]'); if (!v) return;
  if (e.target.closest('a, button')) return;
  const sel = window.getSelection(); if (sel && !sel.isCollapsed && v.contains(sel.anchorNode)) return; // selecting text to copy or make a to-do of
  npEditNote(v.dataset.npView, noteBox(v), npShownAt(v, e.clientX, e.clientY));
});
/* a checkbox in a formatted note ticks without opening the note (⌘Z undoes it) */
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('#notepad [data-tick], #np-stickies [data-tick]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const v = b.closest('[data-np-view]'), n = v && getNote(v.dataset.npView); if (!n) return;
  const lines = n.text.replace(/\r\n?/g, '\n').split('\n'), i = +b.dataset.tick, m = lines[i] != null && lines[i].match(LE_TASK); if (!m) return;
  lines[i] = m[1] + (m[2] === ' ' ? '[x]' : '[ ]') + lines[i].slice(m[0].length);
  commit(m[2] === ' ' ? 'Check Off' : 'Uncheck', () => { n.text = lines.join('\n'); touch(n); }, { render: false });
  npMirror(n, null);
  const card = noteBox(v); if (card && card.classList.contains('np-card')) npMeasureFolds(card.parentElement);
}, true);
/* changes to the layout wait until a click that's under way has landed, so what you clicked
   doesn't move out from under the pointer */
let npPtrDown = false;
document.addEventListener('pointerdown', () => { npPtrDown = true; }, true);
['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => { npPtrDown = false; }, true));
function npAfterPointer(fn) {
  if (!npPtrDown) { fn(); return; }
  const go = () => { window.removeEventListener('pointerup', go, true); window.removeEventListener('pointercancel', go, true); setTimeout(fn, 0); };
  window.addEventListener('pointerup', go, true); window.addEventListener('pointercancel', go, true);
}
document.addEventListener('focusout', (e) => {
  const el = e.target; if (!el.dataset || !el.dataset.npText || el.dataset.npText === 'draft' || !el.closest('#notepad, #np-stickies')) return;
  const id = el.dataset.npText, inSticky = !!el.closest('#np-stickies');
  setTimeout(() => npAfterPointer(() => {
    const a = document.activeElement;
    if (a === el || (a && a.dataset && a.dataset.npText === id && !!a.closest('#np-stickies') === inSticky)) return; // still typing in it (or a redraw put you back)
    const n = getNote(id);
    if (!n || !n.text.trim()) { if (ui.np.editing === id) ui.np.editing = null; dropEmptyNotes(); if (ui.np.open) renderNotepad(); renderStickies(); return; }
    if (inSticky) { const st = $(`#np-stickies .np-sticky[data-sticky="${CSS.escape(id)}"]`); if (st) npShowView(st, n); return; }
    if (ui.np.editing === id) ui.np.editing = null;
    const card = $(`#notepad .np-card[data-note="${CSS.escape(id)}"]`); if (card) npShowView(card, n);
  }), 0);
});
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t.closest && t.closest('#np-stickies') && e.key === 'Escape' && t.dataset && t.dataset.npText) { e.preventDefault(); e.stopImmediatePropagation(); t.blur(); return; } // done typing in a sticky
  if (!ui.np.open || layers.length) return;
  const inside = t.closest && t.closest('#notepad');
  if (e.key === 'Escape' && (inside || $('#app').classList.contains('np-over'))) { e.preventDefault(); e.stopImmediatePropagation(); closeNotepad(); return; }
  if (inside && (e.metaKey || e.ctrlKey) && e.key === 'Enter' && t.dataset.npText) { e.preventDefault(); ui.np.editing = null; t.blur(); ui.np.focus = 'draft'; renderNotepad(); } // ⌘↩: done with this one, a fresh one
}, true);

/* ---- clicks ---- */
async function copyText(v) {
  try { await navigator.clipboard.writeText(v); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = v; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (err) { /* ignore */ }
    ta.remove(); return ok;
  }
}
document.addEventListener('pointerdown', (e) => {
  // keep the note's text selection when Make To-Do or ••• is pressed
  if (e.target.closest && e.target.closest('#notepad [data-np-todo], #notepad [data-np-more]')) e.preventDefault();
  // the Notepad over a narrow window steps aside when you click the list behind it
  if (ui.np.open && $('#app').classList.contains('np-over') && e.target.closest && !e.target.closest('#notepad') && !e.target.closest('#layer') && !e.target.closest('#np-stickies') && !e.target.closest('[data-action="notepad"], [data-action="np-page"]')) closeNotepad();
}, true);
/* a value's copy button (in the Notepad or a sticky) */
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('#notepad [data-copy], #np-stickies [data-copy]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const v = b.dataset.copy;
  copyText(v).then((ok) => {
    toast(ok ? `Copied ${v.length > 40 ? v.slice(0, 39) + '…' : v}` : 'Couldn’t copy');
    if (ok) { b.classList.add('copied'); setTimeout(() => b.classList.remove('copied'), 1200); }
  });
}, true);
$('#notepad').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.np === 'close') { closeNotepad(); return; }
  if (b.dataset.np === 'float') { setNotepadFloat(!ui.np.float); return; }
  if (b.dataset.np === 'menu') { notepadMenu(b); return; }
  if (b.dataset.np === 'back') { ui.np.arch = false; ui.np.q = ''; renderNotepad(); return; }
  if (b.dataset.npPage) { ui.np.page = b.dataset.npPage === '1'; renderNotepad(); return; }
  if (b.dataset.npFold) { const id = b.dataset.npFold; if (ui.np.expanded.has(id)) ui.np.expanded.delete(id); else ui.np.expanded.add(id); npMeasureFolds(b.closest('.np-card').parentElement); return; }
  if (b.dataset.nav) { if (!npStays()) closeNotepad(); navigate(b.dataset.nav); return; } // to the page it was written on
  if (b.dataset.npTodo) { noteToTodo(b.dataset.npTodo); return; }
  if (b.dataset.npMore) { noteMenu(getNote(b.dataset.npMore), b); }
  if (b.dataset.npPlaces) { notePlacesMenu(getNote(b.dataset.npPlaces), b); }
});
function notepadMenu(el) {
  const archived = liveNotes().filter((n) => n.archived).length;
  openMenu(el, [
    { label: 'Group by Page', icon: ui.np.group ? 'check' : 'blank', fn: () => { ui.np.group = !ui.np.group; lsSet('sectis.npGroup', ui.np.group ? '1' : ''); renderNotepad(); } },
    { sep: 1 },
    { label: 'Archived Notes', icon: 'archive', hint: archived ? String(archived) : '', disabled: !archived, fn: () => { ui.np.arch = true; ui.np.q = ''; ui.np.editing = null; renderNotepad(); } },
  ]);
}
function noteMenu(n, el) {
  if (!n) return;
  const here = viewKeyNow(), hc = noteCtx(here), picked = npSelected(n.id), lines = npTodoLines(picked || n.text).length;
  openMenu(el, [
    ...(n.archived ? [] : [{ label: n.pinned ? 'Unpin' : 'Pin to Top', icon: 'pin', fn: () => { commit(n.pinned ? 'Unpin Note' : 'Pin Note', () => { n.pinned = !n.pinned; }); renderNotepad(); } }]),
    { label: picked ? 'Make To-Do of Selection' : 'Make To-Do', icon: 'circle', fn: () => noteToTodo(n.id, picked) },
    ...(lines > 1 ? [{ label: picked ? 'One To-Do per Selected Line' : 'One To-Do per Line', icon: 'checklist', hint: String(lines), fn: () => noteToTodos(n.id, picked) }] : []),
    { label: 'Copy Text', icon: 'copy', fn: () => { copyText(n.text).then((ok) => toast(ok ? 'Copied' : 'Couldn’t copy')); } },
    ...(isMobile() || n.archived ? [] : [stickyOf(n.id) ? { label: 'Hide Sticky', icon: 'popout', fn: () => hideSticky(n.id) } : { label: 'Show as Sticky', icon: 'popout', fn: () => showSticky(n.id) }]),
    { label: 'Attach To…', icon: 'move', fn: () => openNotePlaces(n.id, el) },
    ...(hc && !noteOn(n, here) ? [
      { label: `Move to ${hc.label}`, icon: 'blank', fn: () => { commit('Move Note', () => setNoteKeys(n, [here])); renderNotepad(); toast(`Note moved to ${hc.label}`, { undo: true }); } },
      ...(noteKeys(n).length ? [{ label: `Also Attach to ${hc.label}`, icon: 'blank', fn: () => { commit('Attach Note', () => setNoteKeys(n, noteKeys(n).concat(here))); renderNotepad(); toast(`Note also on ${hc.label}`, { undo: true }); } }] : []),
    ] : []),
    { sep: 1 },
    n.archived
      ? { label: 'Move Out of Archive', icon: 'archive', fn: () => archiveNote(n.id, false) }
      : { label: 'Archive', icon: 'archive', fn: () => archiveNote(n.id, true) },
    { label: 'Delete Note', icon: 'trash', danger: true, fn: () => { commit('Delete Note', () => { S.notes = S.notes.filter((x) => x.id !== n.id); }); renderNotepad(); toast('Note deleted', { undo: true }); } },
  ]);
}
/* the +N beside a note's page: every page it's on, to go to, and Attach To… to change them */
function notePlacesMenu(n, el) {
  if (!n) return;
  const places = noteKeys(n).map((k) => [k, noteCtx(k)]).filter(([, c]) => c);
  openMenu(el, [{ header: 'On These Pages' }, ...places.map(([k, c]) => ({ label: c.label, iconHTML: c.icon, fn: () => navigate(k) })), { sep: 1 }, { label: 'Attach To…', icon: 'move', fn: () => openNotePlaces(n.id, el) }]);
}
/* Attach To…: tick every list, area, project or Board a note should be on. It shows in the
   Notepad on each of them (This Page, and the count beside each page's name) */
function openNotePlaces(id, anchor) {
  const n = getNote(id); if (!n) return;
  const build = (q = '') => {
    const on = new Set(noteKeys(n)), ql = q.trim().toLowerCase(), m = (t) => !ql || (t || '').toLowerCase().includes(ql);
    const row = (key, icon, label, cls = '') => `<button class="pick-i${cls}" data-key="${esc(key)}" role="menuitemcheckbox" aria-checked="${on.has(key)}">${icon}<span>${esc(label)}</span>${on.has(key) ? `<span class="check">${ic('check')}</span>` : ''}</button>`;
    let out = '';
    // what it's on now that the lists below don't offer (a tag, a smart list, a finished project…)
    const offered = (k) => /^(inbox|today|upcoming|anytime|someday|waiting|deadlines|timeline|logbook)$/.test(k) || /^area:/.test(k) || (/^project:/.test(k) && (getP(k.slice(8)) || {}).status === 'open') || /^board:/.test(k);
    [...on].filter((k) => !offered(k)).forEach((k) => { const c = noteCtx(k); if (c && m(c.label)) out += `<button class="pick-i" data-key="${esc(k)}" role="menuitemcheckbox" aria-checked="true">${c.icon}<span>${esc(c.label)}</span><span class="check">${ic('check')}</span></button>`; });
    const projs = (areaId) => S.projects.filter((p) => !p.trashed && !p.isTemplate && p.status === 'open' && (p.areaId || null) === areaId).sort(byOrder);
    let places = projs(null).filter((p) => m(pTitle(p))).map((p) => row('project:' + p.id, projIc(p, '', projectProgress(p).frac), pTitle(p), ' p')).join('');
    S.areas.slice().sort(byOrder).forEach((a) => {
      const ps = projs(a.id).filter((p) => m(pTitle(p)) || m(aTitle(a)));
      if (m(aTitle(a)) || ps.length) places += row('area:' + a.id, placeColor(a) ? areaIc(a) : ic('area'), aTitle(a), ' a') + ps.map((p) => row('project:' + p.id, projIc(p, '', projectProgress(p).frac), pTitle(p), ' p in')).join('');
    });
    if (places) out += '<div class="menu-h">Areas &amp; Projects</div>' + places;
    const lists = ['inbox', 'today', 'upcoming', 'anytime', 'someday', 'waiting', 'deadlines', 'timeline', 'logbook'].filter((k) => m(LISTS[k].title));
    if (lists.length) out += '<div class="menu-h">Lists</div>' + lists.map((k) => row(k, `<span class="ic" style="color:${LISTS[k].color}">${I[LISTS[k].icon]}</span>`, LISTS[k].title)).join('');
    const boards = isMobile() ? [] : (ui.boards || []).filter((b) => m(b.name || 'Board'));
    if (boards.length) out += '<div class="menu-h">Boards</div>' + boards.map((b) => row('board:' + b.id, `<span class="ic" style="color:var(--c-board)">${I.columns}</span>`, b.name || 'Board')).join('');
    return out || '<p class="note" style="padding:6px 10px">Nothing matches.</p>';
  };
  const L = openLayer({ anchor, cls: 'move-pop np-places', html: `<div class="pk-h">Attach Note To</div><input class="pk-in" placeholder="Find a list, area or project" autocomplete="off" aria-label="Find a list, area or project"><div class="pick-list" role="menu">${build()}</div><p class="np-places-tip">Tick as many as you like: the note shows in the Notepad on each.</p>`,
    onMount: (el) => {
      const inp = $('.pk-in', el), list = $('.pick-list', el);
      const nav = listKeys(el, '.pick-i', inp);
      const redraw = () => { const top = list.scrollTop; list.innerHTML = build(inp.value); list.scrollTop = top; };
      inp.addEventListener('input', () => { list.innerHTML = build(inp.value); nav.first(); });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-key]'); if (!b) return;
        const k = b.dataset.key, has = noteOn(n, k), c = noteCtx(k);
        commit(has ? 'Detach Note' : 'Attach Note', () => setNoteKeys(n, has ? noteKeys(n).filter((x) => x !== k) : noteKeys(n).concat(k)), { render: false });
        renderNotepad(); render(); redraw();
        const again = $(`[data-key="${CSS.escape(k)}"]`, list); if (again) again.focus({ preventScroll: true });
        if (c) toast(has ? `Note taken off ${c.label}` : `Note also on ${c.label}`, { undo: true });
      });
      if (!isCoarse()) inp.focus({ preventScroll: true });
    } });
  return L;
}
function archiveNote(id, on) {
  const n = getNote(id); if (!n) return;
  if (ui.np.editing === id) ui.np.editing = null;
  commit(on ? 'Archive Note' : 'Unarchive Note', () => { n.archived = on; touch(n); });
  renderNotepad();
  if (on) toast('Note archived', { undo: true, action: 'Show', fn: () => { ui.np.arch = true; openNotepad({ focus: id }); } });
  else toast('Note moved back to your notes');
}
/* the text selected in a note: in its text box while typing, or in the formatted note */
function npSelected(id) {
  const a = document.activeElement;
  if (a && a.dataset && a.dataset.npText === id && a.classList.contains('le')) { const r = leGetSel(a); if (r && r.s !== r.e) return leText(a).slice(r.s, r.e); }
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.anchorNode) {
    const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement, v = node && node.closest('[data-np-view]');
    if (v && v.dataset.npView === id) return sel.toString();
  }
  return '';
}
/* the selected text, or the whole note: its first line the title, the rest the to-do's notes */
function noteToTodo(id, picked) {
  const n = getNote(id); if (!n || !n.text.trim()) return;
  const sel = picked || npSelected(id) || n.text;
  const lines = sel.split('\n'), i = lines.findIndex((l) => l.trim());
  if (i < 0) return;
  const title = lines[i].trim().replace(/^(?:#{1,6}\s+|(?:[-*•+]|\d+[.)])\s+)?(?:\[[ xX]?\]\s+)?/, '').replace(/\*\*|__|`/g, ''), notes = lines.slice(i + 1).join('\n').trim();
  let t;
  commit('Make To-Do', () => { t = makeTodo({ title, notes, start: 'inbox' }); t.order = topOrder(S.todos.filter((x) => isInbox(x) && !x.trashed)); S.todos.push(t); });
  toast(`Added “${title.length > 40 ? title.slice(0, 39) + '…' : title}” to the Inbox`, { action: 'Show', fn: () => { if (!npStays()) closeNotepad(); revealTodo(t.id); } });
}
/* the to-dos in some text: its list items if it has any (so a title line above a list isn't
   one), otherwise every line; headings and checked-off items are left out */
function npTodoLines(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const bullet = /^(?:[-*•+]|\d+[.)])\s+/;
  const listed = lines.filter((l) => bullet.test(l) || /^\[[ xX]?\]\s/.test(l));
  return (listed.length ? listed : lines)
    .filter((l) => !/^#{1,6}\s/.test(l) && !/^(?:(?:[-*•+]|\d+[.)])\s+)?\[[xX]\]/.test(l))
    .map((l) => l.replace(bullet, '').replace(/^\[[ xX]?\]\s*/, '').replace(/\*\*|__|`/g, '').trim())
    .filter(Boolean);
}
function noteToTodos(id, picked) {
  const n = getNote(id); if (!n) return;
  const titles = npTodoLines(picked || n.text); if (!titles.length) return;
  const made = [];
  commit('Make To-Dos', () => {
    let o = topOrder(S.todos.filter((x) => isInbox(x) && !x.trashed)) - titles.length + 1;
    titles.forEach((title) => { const t = makeTodo({ title, start: 'inbox' }); t.order = o++; S.todos.push(t); made.push(t); });
  });
  toast(`Added ${made.length} to-dos to the Inbox`, { undo: true, action: 'Show', fn: () => { if (!npStays()) closeNotepad(); navigate('inbox'); revealTodo(made[0].id); } });
}
window.addEventListener('resize', debounce(() => { applyNotepadMode(); if (ui.np.open) npMeasureFolds($('#notepad')); }, 60));

/* ---- stickies: one note on its own small card, on every page (Mac) ---- */
const stickyOf = (id) => npStickies.find((s) => s.id === id);
function saveStickies() { lsSet('sectis.npStickies', JSON.stringify(npStickies)); }
function showSticky(id) {
  if (stickyOf(id) || isMobile()) return;
  const k = npStickies.length % 6, side = $('#app').classList.contains('np-dock') ? $('#notepad').offsetWidth : 0;
  npStickies.push(roundRect({ x: window.innerWidth - side - NP_ST.w - 70 - k * 26, y: 96 + k * 26, w: NP_ST.w, h: NP_ST.h }));
  npStickies[npStickies.length - 1].id = id;
  saveStickies(); renderStickies(); if (ui.np.open) renderNotepad();
  const st = $(`#np-stickies .np-sticky[data-sticky="${CSS.escape(id)}"]`); if (st) { st.style.zIndex = ++npStZ; st.classList.add('flash'); }
}
function hideSticky(id) {
  npStickies = npStickies.filter((s) => s.id !== id); saveStickies(); renderStickies(); if (ui.np.open) renderNotepad();
}
function stickyHTML(n) {
  return `<div class="np-st-h" title="Drag to move"><span class="np-st-t"></span><button class="ib" data-st="open" title="Show in the Notepad" aria-label="Show in the Notepad">${ic('notepad')}</button><button class="ib" data-st="close" title="Put it away (it stays in the Notepad)" aria-label="Close sticky">${ic('x')}</button></div>`
    + `<div class="np-st-b"><div class="np-view md" data-np-view="${n.id}">${renderMarkdown(n.text, NP_MD)}</div>${npEditorHTML(n.id, 'sticky-' + n.id, 'Sticky note', null)}</div>`
    + ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map((d) => `<div class="np-rs ${d}" data-st-rs="${d}" aria-hidden="true"></div>`).join('');
}
function renderStickies() {
  let box = $('#np-stickies');
  const list = S && !isMobile() ? npStickies.map((s) => ({ s, n: getNote(s.id) })).filter((x) => x.n && !x.n.archived && x.n.text.trim()) : [];
  if (!list.length) { if (box) box.innerHTML = ''; return; }
  if (!box) { box = document.createElement('div'); box.id = 'np-stickies'; box.className = 'np-stickies'; document.body.appendChild(box); }
  const keep = new Set(list.map((x) => x.n.id));
  $$('.np-sticky', box).forEach((el) => { if (!keep.has(el.dataset.sticky)) el.remove(); });
  list.forEach(({ s, n }) => {
    let el = $(`.np-sticky[data-sticky="${CSS.escape(n.id)}"]`, box);
    if (!el) { el = document.createElement('div'); el.className = 'np-sticky'; el.dataset.sticky = n.id; el.innerHTML = stickyHTML(n); el.dataset.v = n.modifiedAt; box.appendChild(el); }
    else if (+el.dataset.v !== n.modifiedAt && !el.classList.contains('editing')) {
      // changed somewhere else (the Notepad, another device)
      $('[data-np-view]', el).innerHTML = renderMarkdown(n.text, NP_MD); el.dataset.v = n.modifiedAt;
    }
    if (!el.classList.contains('moving')) setGeom(el, npFit(s, NP_ST.minW, NP_ST.minH));
  });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('#np-stickies [data-st]'); if (!b) return;
  const id = b.closest('.np-sticky').dataset.sticky;
  if (b.dataset.st === 'close') hideSticky(id);
  else if (b.dataset.st === 'open') openNotepad({ focus: id });
});

/* ---- following the pointer: a frame at a time, until it's let go ---- */
function npTrack(step, end) {
  let raf = 0, last = null;
  const run = () => { raf = 0; if (last) step(last); };
  const move = (ev) => { last = ev; if (!raf) raf = requestAnimationFrame(run); };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (raf) { cancelAnimationFrame(raf); run(); }
    end();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
/* a box resized from one edge or corner, kept inside the window and no smaller than min */
function edgeRect(r0, dir, dx, dy, minW, minH) {
  const vw = window.innerWidth, vh = window.innerHeight;
  let L = r0.left, T = r0.top, R = r0.right, B = r0.bottom;
  if (dir.includes('w')) L = clamp(r0.left + dx, NP_PAD, R - minW);
  if (dir.includes('e')) R = clamp(r0.right + dx, L + minW, vw - NP_PAD);
  if (dir.includes('n')) T = clamp(r0.top + dy, NP_PAD, B - minH);
  if (dir.includes('s')) B = clamp(r0.bottom + dy, T + minH, vh - NP_PAD);
  return { x: L, y: T, w: R - L, h: B - T };
}

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
  let w = r0.width, rect = null;
  npSizing(float ? NP_CURSORS[dir] : 'col-resize'); h.classList.add('on');
  npTrack((ev) => {
    if (!float) { w = clamp(r0.width - (ev.clientX - x0), NP_W_MIN, maxW); setNpWidth(w); return; }
    rect = edgeRect(r0, dir, ev.clientX - x0, ev.clientY - y0, NP_W_MIN, NP_H_MIN); setNpGeom(rect);
  }, () => {
    npSizing(null); h.classList.remove('on');
    if (float) { if (rect) saveNpRect(rect); }
    else if (Math.abs(w - r0.width) > 1) { npW = Math.round(w); lsSet('sectis.npw', String(npW)); }
    rewrapAfterNp();
  });
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
  let moving = false, snap = false, rect = null, size = null;
  npTrack((ev) => {
    if (!moving) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      moving = true; npSizing('grabbing');
      if (wasFloat) size = { w: r0.width, h: r0.height };
      else {
        // off the side: it becomes a window the size it last floated at
        const d = npRect || { w: r0.width, h: npDefaultRect().h };
        size = { w: d.w, h: d.h }; ui.np.float = true; applyNotepadMode();
      }
    }
    rect = npFit({ x: ev.clientX - gx * size.w, y: ev.clientY - gy, w: size.w, h: size.h });
    setNpGeom(rect);
    snap = ev.clientX >= window.innerWidth - NP_SNAP; npSnapHint(snap);
  }, () => {
    npSizing(null); npSnapHint(false);
    if (!moving) return;
    if (snap) { ui.np.float = false; lsSet('sectis.npFloat', ''); if (rect && wasFloat) saveNpRect({ x: r0.left, y: r0.top, w: r0.width, h: r0.height }); } // it floats back where it was next time
    else { saveNpRect(rect); ui.np.float = true; lsSet('sectis.npFloat', '1'); }
    renderNotepad(); rewrapAfterNp();
  });
}, true);
document.addEventListener('dblclick', (e) => {
  if (isMobile() || !(e.target.closest && e.target.closest('#notepad .np-h')) || e.target.closest('button, input')) return;
  setNotepadFloat(!ui.np.float);
});

/* ---- moving and resizing a sticky ---- */
document.addEventListener('pointerdown', (e) => {
  const st = e.target.closest && e.target.closest('#np-stickies .np-sticky'); if (!st || e.button !== 0) return;
  st.style.zIndex = ++npStZ; // to the front
  const s = stickyOf(st.dataset.sticky); if (!s) return;
  const h = e.target.closest('[data-st-rs]'), hd = !h && e.target.closest('.np-st-h');
  if ((!h && !hd) || (hd && e.target.closest('button'))) return;
  e.preventDefault();
  const r0 = st.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
  let rect = null;
  st.classList.add('moving'); npSizing(h ? NP_CURSORS[h.dataset.stRs] : 'grabbing');
  npTrack((ev) => {
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    rect = h ? edgeRect(r0, h.dataset.stRs, dx, dy, NP_ST.minW, NP_ST.minH) : npFit({ x: r0.left + dx, y: r0.top + dy, w: r0.width, h: r0.height }, NP_ST.minW, NP_ST.minH);
    setGeom(st, rect);
  }, () => {
    st.classList.remove('moving'); npSizing(null);
    if (rect) { Object.assign(s, roundRect(rect)); saveStickies(); }
  });
}, true);
