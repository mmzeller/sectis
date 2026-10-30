/* ===================== Rename in place =====================
   Rename in a project's or area's ••• and right-click menus edits the name right where it is:
   a project's row (in an area, Today or any list) or a column on the Board. Return or clicking
   away saves, Esc cancels. Anywhere else (the sidebar, or the project's own ••• menu) it opens
   the project or area with its name selected, ready to type over. */
const renamingNow = (t, id) => !!(ui.renaming && ui.renaming.t === t && ui.renaming.id === id);
function renameInputHTML(t, x) {
  const v = ui.renaming && ui.renaming.value != null ? ui.renaming.value : x.title || '';
  return `<input class="rename-in" data-rename="${t}:${x.id}" data-fkey="rn-${x.id}" value="${esc(v)}" placeholder="${t === 'p' ? 'New Project' : 'New Area'}" aria-label="Name" autocomplete="off" spellcheck="false" enterkeyhint="done">`;
}
function startRename(t, id) {
  const x = t === 'p' ? getP(id) : getA(id); if (!x) return;
  if (ui.editing) closeEditor({ noRender: true });
  ui.renaming = { t, id, value: null };
  render();
  const inp = $(`#content [data-rename="${t}:${CSS.escape(id)}"]`);
  if (inp) { inp.focus(); inp.select(); return; }
  ui.renaming = null; // not shown here: open it, with its name ready to change
  navigate(t === 'p' ? 'project:' + id : 'area:' + id);
  const title = $(`[data-fkey="${t === 'p' ? 'ptitle' : 'atitle'}"]`);
  if (title) { title.focus(); title.select(); }
}
function finishRename(inp, save) {
  if (!inp || !ui.renaming) return;
  const [t, id] = inp.dataset.rename.split(':');
  ui.renaming = null;
  const x = t === 'p' ? getP(id) : getA(id), v = inp.value.trim();
  if (save && x && v && v !== x.title) commit(t === 'p' ? 'Rename Project' : 'Rename Area', () => { x.title = v; touch(x); });
  else render();
}
function renameMenuItem(t, id) { return { label: 'Rename', icon: 'edit', fn: () => startRename(t, id) }; }
document.addEventListener('keydown', (e) => {
  const inp = e.target.closest && e.target.closest('.rename-in'); if (!inp) return;
  e.stopPropagation(); // typing a name isn't a shortcut
  if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); finishRename(inp, true); }
  else if (e.key === 'Escape') { e.preventDefault(); finishRename(inp, false); }
}, true);
document.addEventListener('input', (e) => { if (e.target.classList && e.target.classList.contains('rename-in') && ui.renaming) ui.renaming.value = e.target.value; }, true);
document.addEventListener('focusout', (e) => {
  const inp = e.target.closest && e.target.closest('.rename-in');
  if (inp && ui.renaming && inp.isConnected) setTimeout(() => { if (ui.renaming && document.activeElement !== inp) finishRename(inp, true); }, 0);
});
