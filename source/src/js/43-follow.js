/* ===================== When follows the project =====================
   A to-do or sub-project takes its project's When (a date, This Evening, or no date) unless it
   has one of its own. Give Hamilton a When and everything in it starts then too; move Hamilton
   and they move with it, sub-projects and theirs included.
   - Picking a date (or Someday) for one of them makes that date its own: it stays put when the
     project's changes. Clearing it (✕, or Same as … in the When picker) puts it back to the
     project's.
   - Items that follow carry whenFrom (their project's id). Nothing else needs to know: Today,
     Upcoming, the Timeline and the rest just see the date.
   - It runs after every change (commit), comparing each item's When and place before and after,
     so it doesn't matter how a date changed: the picker, dragging, Quick Entry, the Timeline…
   - A new to-do, or one moved into a project, follows it unless it brings a different date of
     its own (or Someday). A sub-project made a top-level project keeps its date as its own.
   - Projects that hadn't started yet when this arrived (1.50) had their undated to-dos and
     sub-projects made to follow them, once per device. Ones already started were left alone, so
     their to-dos didn't all land in Today at once; they join when the project's When changes. */
const whenKey = (x) => (x.start === 'someday' ? 'someday' : x.start === 'anytime' && x.when ? x.when + (x.evening ? '+e' : '') : '');
const placeOf = (x) => (x.type === 'todo' ? x.projectId || null : x.parentId && x.parentId !== x.id ? x.parentId : null);
const canFollow = (x) => x.status === 'open' && !x.trashed && !x.isTemplate && !x.blueprint;
/* the project whose When this one follows (when it follows one) */
function whenParent(x) { const pid = x && x.whenFrom && placeOf(x); return pid === x.whenFrom ? getP(pid) || null : null; }
/* the project it would follow if its date were cleared */
function whenHome(x) { const pid = x && placeOf(x); return pid ? getP(pid) || null : null; }
const followsHere = (x) => !!x.whenFrom && ui.view.type === 'project'; // its project's date is in the header
function whenBefore() {
  const m = new Map();
  if (!S) return m;
  for (const t of S.todos) m.set(t.id, [whenKey(t), placeOf(t)]);
  for (const p of S.projects) m.set(p.id, [whenKey(p), placeOf(p)]);
  return m;
}
/* c takes p's When */
function followWhen(c, p) {
  const was = whenKey(c) + '|' + (c.whenFrom || '');
  c.whenFrom = p.id;
  if (p.start === 'anytime' && p.when) { c.start = 'anytime'; c.when = p.when; c.evening = !!p.evening; }
  else { if (c.start !== 'inbox') c.start = 'anytime'; c.when = null; c.evening = false; }
  if (!c.when) c.reminder = null;
  if (whenKey(c) + '|' + c.whenFrom !== was) touch(c);
}
function stopFollowing(c) { if (c.whenFrom) { delete c.whenFrom; touch(c); } }
function propagateWhens(before) {
  if (!S) return;
  const projs = new Map(S.projects.map((p) => [p.id, p]));
  const kids = new Map();
  const add = (pid, x) => { if (!kids.has(pid)) kids.set(pid, []); kids.get(pid).push(x); };
  for (const t of S.todos) { if (t.projectId && projs.has(t.projectId)) add(t.projectId, t); else if (t.whenFrom) stopFollowing(t); }
  for (const p of S.projects) { const pid = placeOf(p); if (pid && projs.has(pid)) add(pid, p); else if (p.whenFrom) stopFollowing(p); }
  const seen = new Set();
  const changed = (x) => { const b = before && before.get(x.id); return !b || b[0] !== whenKey(x); };
  const visit = (p) => {
    if (seen.has(p.id)) return; seen.add(p.id);
    if (p.isTemplate || p.blueprint || p.trashed) return; // templates keep what they have
    const pChanged = changed(p), pKey = whenKey(p);
    for (const c of kids.get(p.id) || []) {
      if (canFollow(c)) {
        const b = before && before.get(c.id), key = whenKey(c);
        const placed = !b || b[1] !== p.id; // new here, or just moved in
        const edited = !!b && b[0] !== key; // its own When changed in this change
        let follow;
        if (placed) follow = key === '' || key === pKey || (!!c.whenFrom && !edited);
        else if (edited) follow = key === '' || key === pKey; // cleared, or set to the project's
        else if (pChanged) follow = !!c.whenFrom || key === '';
        else follow = !!c.whenFrom; // keep up (a change that came from another device)
        if (follow) followWhen(c, p); else stopFollowing(c);
      }
      if (c.type === 'project') visit(c);
    }
  };
  for (const p of S.projects) if (!placeOf(p) || !projs.has(placeOf(p))) visit(p);
  for (const p of S.projects) visit(p); // anything a broken tree left out
}
/* everything undated inside p (and inside its sub-projects that follow) follows it */
function adoptWhen(p, seen = new Set()) {
  if (seen.has(p.id) || p.isTemplate || p.blueprint) return; seen.add(p.id);
  const inside = S.todos.filter((t) => t.projectId === p.id).concat(childProjects(p));
  for (const c of inside) {
    if (canFollow(c) && (c.whenFrom || whenKey(c) === '' || whenKey(c) === whenKey(p))) followWhen(c, p);
    if (c.type === 'project') adoptWhen(c, seen);
  }
}
/* once per device: projects that haven't started yet take their undated to-dos and sub-projects
   along (see above) */
function followWhensOnce() {
  if (lsGet('sectis.whenFollow') === '1' || !S) return;
  const T = T0();
  S.projects.filter((p) => canFollow(p) && !p.logged && p.start === 'anytime' && p.when && p.when > T).forEach((p) => adoptWhen(p));
  lsSet('sectis.whenFollow', '1');
  reindex(); saveSoon();
}
