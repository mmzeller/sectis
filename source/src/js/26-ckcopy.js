/* ===================== Copy and paste =====================
   One clipboard for to-dos and checklists, each device its own:
   - Copy To-Do / Copy N To-Dos (⌘C) keeps the selected to-dos: title, notes, tags, checklist,
     deadline and priority. Paste (⌘V) puts copies after the selected to-do, in its project,
     heading or list, or into the list you're in when nothing is selected. Paste as Checklist
     turns them into checklist items on the selected to-dos instead.
   - Copy Checklist keeps a to-do's checklist; Paste Checklist adds it, unchecked, to the
     selected to-dos, skipping items a to-do already has. Paste (⌘V) makes to-dos of it.
   - Either way the titles go to the system clipboard as lines, so they paste into other apps,
     and lines copied in another app paste into Sectis as to-dos.
   - Copying anything else (text in a title, say) replaces it, and Clear Copied Items in the
     menu forgets it. */
function loadCkClip() {
  lsSet('sectis.ckclip', ''); // the checklist-only clipboard from before 1.37 is let go
  try { const c = JSON.parse(lsGet('sectis.clip') || 'null'); ui.clip = c && (c.kind === 'todos' || c.kind === 'checklist') && Array.isArray(c.items) && c.items.length ? c : null; } catch (e) { ui.clip = null; }
}
function setClip(c) {
  ui.clip = c;
  lsSet('sectis.clip', c ? JSON.stringify(c) : '');
  if (c) { try { navigator.clipboard.writeText(c.text).catch(() => {}); } catch (e) { /* no system clipboard here */ } }
}
function clearClip(quiet) { if (!ui.clip) return; setClip(null); if (!quiet) toast('Cleared copied items'); }
const clipTitles = () => (!ui.clip ? [] : ui.clip.kind === 'todos' ? ui.clip.items.map((x) => x.title) : ui.clip.items).filter((s) => s && s.trim());
const pasteKeyHint = () => (isCoarse() ? '' : MODK + 'V');

function copyTodos(ids) {
  const vis = visibleRowIds(), at = (id) => { const i = vis.indexOf(id); return i < 0 ? 1e9 : i; };
  const todos = ids.slice().sort((a, b) => at(a) - at(b)).map(getT).filter((t) => t && !t.blueprint); // in the order they're shown
  if (!todos.length) return;
  const items = todos.map((t) => ({ title: t.title || '', notes: t.notes || '', tags: (t.tags || []).slice(), checklist: (t.checklist || []).map((c) => c.title).filter((s) => s.trim()), deadline: t.deadline || null, priority: t.priority || 0 }));
  setClip({ kind: 'todos', items, text: items.map((x) => x.title || 'New To-Do').join('\n'), at: Date.now() });
  const n = plural(items.length, 'to-do');
  toast(isCoarse() ? `Copied ${n}. Choose Paste in a to-do's menu or a list's ••• menu.` : `Copied ${n}. ${MODK}V pastes after the selected to-do.`, { ms: 4200 });
}
function copyChecklist(id) {
  const t = getT(id); if (!t || !t.checklist.length) return;
  const items = t.checklist.map((c) => c.title).filter((s) => s.trim());
  setClip({ kind: 'checklist', from: t.id, title: t.title || 'New To-Do', items, text: items.join('\n'), at: Date.now() });
  toast(`Copied ${plural(items.length, 'checklist item')}. Choose Paste Checklist on another to-do, or select several first.`, { ms: 5200 });
}
const pasteTargets = (ids) => ids.map(getT).filter((t) => t && !t.trashed && !t.blueprint);
/* titles become checklist items on each to-do that lacks them */
function pasteChecklist(ids, titles = clipTitles()) {
  if (!titles.length) return;
  const from = ui.clip && ui.clip.kind === 'checklist' ? ui.clip.from : null;
  const targets = pasteTargets(ids).filter((t) => !(ids.length > 1 && t.id === from)); // pasting into several skips the one it came from
  if (!targets.length) return;
  // work out what each one lacks first, so a paste that adds nothing leaves no undo step behind
  const adds = targets.map((t) => {
    const have = new Set(t.checklist.map((c) => c.title.trim().toLowerCase()));
    return [t, titles.filter((s) => !have.has(s.trim().toLowerCase()))];
  }).filter(([, fresh]) => fresh.length);
  const added = adds.reduce((n, [, fresh]) => n + fresh.length, 0), into = adds.length;
  if (added) commit('Paste Checklist', () => adds.forEach(([t, fresh]) => { t.checklist = t.checklist.concat(fresh.map((title) => ({ id: uid(), title, done: false }))); touch(t); }));
  if (!added) { toast(targets.length > 1 ? 'Those to-dos already have every item' : 'That to-do already has every item'); return; }
  toast(into > 1 ? `Added the checklist to ${into} to-dos` : `Added ${plural(added, 'checklist item')}`, { undo: true });
}
/* copies of to-dos (or plain titles) after the selected to-do, or into this list */
function pasteTodos(src, opts = {}) {
  if (!src || !src.length) return;
  const spot = newTodoSpot(opts, src.length);
  if (spot.closed) { toast('Reopen the project to add to-dos'); return; }
  if (spot.qe) { toast('Open a list or project to paste into'); return; }
  const at = (v, i) => (Array.isArray(v) ? v[i] : v);
  const made = [];
  commit(src.length > 1 ? 'Paste To-Dos' : 'Paste To-Do', () => {
    // last first: those placed at the top of a list then end up in their copied order
    for (let i = src.length - 1; i >= 0; i--) {
      const s = typeof src[i] === 'string' ? { title: src[i] } : src[i];
      const place = {}; for (const k of Object.keys(spot.place)) place[k] = at(spot.place[k], i);
      const tags = [...new Set([...(spot.props.tags || []), ...(s.tags || []).filter((id) => getTag(id))])];
      const props = Object.assign({}, spot.props, {
        title: s.title || '', notes: s.notes || '', tags, priority: s.priority || spot.props.priority || 0,
        deadline: s.deadline || spot.props.deadline || null, checklist: (s.checklist || []).map((title) => ({ id: uid(), title, done: false })),
      });
      made.unshift(createTodoIn(props, place));
    }
  }, { render: false });
  ui.sel = new Set(made.map((t) => t.id)); ui.anchor = made[made.length - 1].id; ui.selectMode = false;
  render();
  toast(`Pasted ${plural(made.length, 'to-do')}`, { undo: true });
}
/* ⌘V or Paste: whatever's on the clipboard, into the list (to-dos) */
function pasteClipHere(opts = {}) {
  if (!ui.clip) return;
  if (ui.clip.kind === 'todos') pasteTodos(ui.clip.items, opts);
  else pasteTodos(ui.clip.items.slice(), opts);
}
/* Paste into a named place (a project, area, heading or day), for its menus */
function pasteIntoItems(sec) {
  if (!ui.clip) return [];
  const n = ui.clip.items.length;
  return [{ label: ui.clip.kind === 'todos' ? (n > 1 ? `Paste ${n} To-Dos Here` : 'Paste To-Do Here') : `Paste Checklist Here as ${n > 1 ? n + ' To-Dos' : 'a To-Do'}`, icon: 'paste', fn: () => pasteClipHere({ sec }) }];
}

/* menu items for one to-do or several selected */
function checklistMenuItems(ids) {
  const out = [], one = ids.length === 1 && getT(ids[0]);
  const todos = ids.map(getT).filter((t) => t && !t.blueprint);
  if (todos.length) out.push({ label: todos.length > 1 ? `Copy ${todos.length} To-Dos` : 'Copy To-Do', icon: 'copy', hint: isCoarse() ? '' : MODK + 'C', fn: () => copyTodos(todos.map((t) => t.id)) });
  if (one && one.checklist.length) out.push({ label: 'Copy Checklist', icon: 'checklist', fn: () => copyChecklist(one.id) });
  if (ui.clip) {
    const c = ui.clip, n = c.items.length, targets = pasteTargets(ids).length;
    if (c.kind === 'todos') {
      out.push({ label: n > 1 ? `Paste ${n} To-Dos` : 'Paste To-Do', icon: 'paste', hint: pasteKeyHint(), fn: pasteClipHere });
      if (targets) out.push({ label: `Paste as Checklist (${plural(n, 'item')})`, icon: 'checklist', fn: () => pasteChecklist(ids) });
    } else {
      if (targets && !(targets === 1 && one && one.id === c.from)) out.push({ label: `Paste Checklist (${plural(n, 'item')})`, icon: 'checklist', fn: () => pasteChecklist(ids) });
      out.push({ label: `Paste as ${n > 1 ? n + ' To-Dos' : 'a To-Do'}`, icon: 'paste', hint: pasteKeyHint(), fn: pasteClipHere });
    }
    out.push({ label: 'Clear Copied Items', icon: 'x', fn: () => clearClip() });
  }
  return out;
}
/* a list's ••• menu, for pasting with nothing selected (handy on iPhone) */
function listPasteMenuItems() {
  if (!ui.clip || ['logbook', 'trash', 'waiting', 'timeline', 'templates'].includes(ui.view.type)) return [];
  const n = ui.clip.items.length;
  return [
    { label: ui.clip.kind === 'todos' ? (n > 1 ? `Paste ${n} To-Dos` : 'Paste To-Do') : `Paste Checklist as ${n > 1 ? n + ' To-Dos' : 'a To-Do'}`, icon: 'paste', hint: pasteKeyHint(), fn: pasteClipHere },
    { label: 'Clear Copied Items', icon: 'x', fn: () => clearClip() },
  ];
}

/* ---- keys: ⌘C and ⌘V with to-dos selected (not while typing) ---- */
let pasteWait = null;
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod || e.altKey || e.shiftKey || layers.length || isTyping(e.target) || (e.code !== 'KeyC' && e.code !== 'KeyV')) return;
  const sel = window.getSelection && window.getSelection();
  if (sel && !sel.isCollapsed && String(sel).trim()) return; // copying text on the page
  if (e.code === 'KeyC') {
    const ids = selectedIds().filter((id) => getT(id));
    const ids2 = ids.length ? ids : ui.editing ? [ui.editing] : [];
    if (!ids2.length) return;
    e.preventDefault(); e.stopImmediatePropagation(); copyTodos(ids2);
    return;
  }
  // ⌘V: the paste event below brings the clipboard's text, so text copied in another app
  // is used rather than to-dos copied earlier. Where no paste event comes (Safari, with
  // nothing to type into), what was copied in Sectis is pasted.
  e.stopImmediatePropagation();
  clearTimeout(pasteWait);
  pasteWait = setTimeout(() => { pasteWait = null; if (ui.clip) pasteClipHere(); }, 120);
}, true);
document.addEventListener('paste', (e) => {
  if (isTyping(e.target) || layers.length) return;
  clearTimeout(pasteWait); pasteWait = null;
  const text = ((e.clipboardData || window.clipboardData) && (e.clipboardData || window.clipboardData).getData('text')) || '';
  const lines = splitPasted(text);
  if (ui.clip && (!text.trim() || text.trim() === ui.clip.text.trim())) { e.preventDefault(); pasteClipHere(); return; }
  if (!lines.length) return;
  e.preventDefault();
  if (ui.clip) setClip(null); // the clipboard moved on: it holds something else now
  pasteTodos(lines);
});
/* copying or cutting text anywhere in Sectis replaces what was copied */
['copy', 'cut'].forEach((type) => document.addEventListener(type, (e) => {
  if (!ui.clip) return;
  const el = e.target, s = window.getSelection && window.getSelection();
  const some = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el.selectionStart !== el.selectionEnd : !!(s && !s.isCollapsed);
  if (some) { ui.clip = null; lsSet('sectis.clip', ''); } // ⌘C with nothing selected copies nothing, so it keeps
}));
