/* ===================== Priority =====================
   An optional High, Medium or Low priority on to-dos and projects (0 is none). Shown as
   !!!, !! or ! before the title; Sort By → Priority puts High first and keeps your own order
   among equals, with items that have none after the rest. Set it with P, the ••• and right-click
   menus, the button in an open to-do, or !!! / !! / ! on their own in Quick Entry. */
const PRIORITY_NAMES = { 3: 'High', 2: 'Medium', 1: 'Low' };
const prio = (x) => (x && PRIORITY_NAMES[x.priority] ? x.priority : 0);
function priMarkHTML(x) {
  const p = prio(x); if (!p) return '';
  return `<span class="r-pri p${p}" title="${PRIORITY_NAMES[p]} priority" aria-label="${PRIORITY_NAMES[p]} priority">${'!'.repeat(p)}</span>`;
}
function priorityChipHTML(x, id = x.id) {
  const p = prio(x); if (!p || x.isTemplate && x.type === 'project') return '';
  return `<span class="chip pri p${p}"><button class="chip-main" data-action="priority" data-id="${id}" title="Change priority (P)"><b class="pri-bangs">${'!'.repeat(p)}</b><span>${PRIORITY_NAMES[p]} Priority</span></button><button class="chip-x" data-action="clear-priority" data-id="${id}" aria-label="Remove priority">${ic('x')}</button></span>`;
}
function setPriority(ids, level) {
  const items = ids.map(itemById).filter((x) => x && !x.trashed);
  if (!items.length || items.every((x) => prio(x) === level)) return;
  commit(level ? `${PRIORITY_NAMES[level]} Priority` : 'Remove Priority', () => items.forEach((x) => { x.priority = level; touch(x); }));
}
function openPriority(ids, anchor) {
  const items = ids.map(itemById).filter(Boolean);
  if (!items.length) return null;
  const cur = items.every((x) => prio(x) === prio(items[0])) ? prio(items[0]) : -1;
  return openMenu(anchor, [{ header: items.length > 1 ? `Priority · ${items.length} Selected` : 'Priority' },
    ...[3, 2, 1, 0].map((l) => ({ label: l ? PRIORITY_NAMES[l] : 'None', icon: l === cur ? 'check' : 'blank', hint: l ? '!'.repeat(l) : '', fn: () => setPriority(ids, l) }))]);
}
function priorityMenuItem(ids, anchor, hint = 'P') {
  const items = ids.map(itemById).filter(Boolean), one = items.length === 1 && prio(items[0]);
  return { label: one ? `Priority: ${PRIORITY_NAMES[one]}…` : 'Priority…', icon: 'priority', hint, fn: () => openPriority(ids, anchor) };
}
