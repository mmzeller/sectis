/* ===================== Copy and paste checklists =====================
   Copy Checklist on a to-do keeps its items; Paste Checklist adds them, unchecked, to another
   to-do or to every selected one, skipping items a to-do already has. The items also go to
   the clipboard as lines, so pasting into any checklist's "Add item" works too. */
function loadCkClip() { try { const c = JSON.parse(lsGet('sectis.ckclip') || 'null'); ui.ckClip = c && Array.isArray(c.items) && c.items.length ? c : null; } catch (e) { ui.ckClip = null; } }
function copyChecklist(id) {
  const t = getT(id); if (!t || !t.checklist.length) return;
  ui.ckClip = { from: t.id, title: t.title || 'New To-Do', items: t.checklist.map((c) => c.title).filter((s) => s.trim()) };
  lsSet('sectis.ckclip', JSON.stringify(ui.ckClip));
  try { navigator.clipboard.writeText(ui.ckClip.items.join('\n')).catch(() => {}); } catch (e) { /* no clipboard here */ }
  toast(`Copied ${plural(ui.ckClip.items.length, 'checklist item')}. Choose Paste Checklist on another to-do, or select several first.`, { ms: 5200 });
}
const pasteTargets = (ids) => ids.map(getT).filter((t) => t && !t.trashed);
function pasteChecklist(ids) {
  if (!ui.ckClip) return;
  const targets = pasteTargets(ids).filter((t) => !(ids.length > 1 && t.id === ui.ckClip.from)); // pasting into several skips the one it came from
  if (!targets.length) return;
  // work out what each one lacks first, so a paste that adds nothing leaves no undo step behind
  const adds = targets.map((t) => {
    const have = new Set(t.checklist.map((c) => c.title.trim().toLowerCase()));
    return [t, ui.ckClip.items.filter((s) => !have.has(s.trim().toLowerCase()))];
  }).filter(([, fresh]) => fresh.length);
  const added = adds.reduce((n, [, fresh]) => n + fresh.length, 0), into = adds.length;
  if (added) commit('Paste Checklist', () => adds.forEach(([t, fresh]) => { t.checklist = t.checklist.concat(fresh.map((title) => ({ id: uid(), title, done: false }))); touch(t); }));
  if (!added) { toast(targets.length > 1 ? 'Those to-dos already have every item' : 'That to-do already has every item'); return; }
  toast(into > 1 ? `Added the checklist to ${into} to-dos` : `Added ${plural(added, 'checklist item')}`, { undo: true });
}
/* menu items: Copy for a to-do with a checklist, Paste once something's copied */
function checklistMenuItems(ids) {
  const out = [], one = ids.length === 1 && getT(ids[0]);
  if (one && one.checklist.length) out.push({ label: 'Copy Checklist', icon: 'copy', fn: () => copyChecklist(one.id) });
  const n = pasteTargets(ids).length;
  if (ui.ckClip && n && !(n === 1 && one && one.id === ui.ckClip.from)) {
    out.push({ label: `Paste Checklist (${plural(ui.ckClip.items.length, 'item')})`, icon: 'checklist', fn: () => pasteChecklist(ids) });
  }
  return out;
}
