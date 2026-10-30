/* ===================== Sintr =====================
   Sintr, the meeting-notes app, sends the action items from a meeting here through sync:
   yours as to-dos, other people's as Waiting For, each with an "Open in Sintr" link
   (sintr://note/…) in its notes. This part of Sectis:
   - opens Sectis at a to-do, project or area from its address (…/sectis/#todo:ID,
     #project:ID, #area:ID), which is how Sintr's to-do list opens one here;
   - adds Record in Sintr to the menus of projects, areas and to-dos once Sectis has
     to-dos from Sintr: it starts a Sintr note with that title whose action items come back
     to the same project or area;
   - tells Sintr where this Sectis lives when you open one of its links (sectis=…), so
     Sintr can link back. */
function sintrInUse() { return S.todos.some((t) => !t.trashed && typeof t.notes === 'string' && t.notes.includes('sintr://note/')); }
function sectisAddress() {
  return SECTIS_WEB && /^https?:$/.test(location.protocol) ? location.origin + location.pathname : '';
}
/* links to other apps: sintr:// ones say where this Sectis lives */
function appLinkHref(href) {
  const addr = sectisAddress();
  if (!addr || !/^sintr:/i.test(href) || /[?&]sectis=/.test(href)) return href;
  return href + (href.includes('?') ? '&' : '?') + 'sectis=' + encodeURIComponent(addr);
}
/* the project or area a to-do is in, for Record in Sintr */
function sintrPlaceOf(t) {
  const p = projectOf(t); if (p && !p.trashed) return { type: 'project', id: p.id, title: pTitle(p) };
  const a = t.areaId ? getA(t.areaId) : null; if (a) return { type: 'area', id: a.id, title: aTitle(a) };
  return null;
}
function recordInSintrURL(title, place) {
  const q = [`title=${encodeURIComponent(title || '')}`];
  if (place) q.push(`place=${place.type}:${encodeURIComponent(place.id)}`, `placeTitle=${encodeURIComponent(place.title || '')}`);
  return appLinkHref('sintr://new?' + q.join('&'));
}
function recordInSintrItem(title, place) {
  return { label: 'Record in Sintr', icon: 'mic', fn: () => { location.href = recordInSintrURL(title, place); } };
}

/* ---- opening Sectis at a to-do, project or area ---- */
function openFromAddress(opts = {}) {
  const m = (location.hash || '').match(/^#(todo|project|area):([\w-]{1,80})$/);
  if (!m) return null;
  const [, type, id] = m;
  const clear = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ } };
  let found = false;
  if (type === 'todo') { const t = getT(id); if (t && !t.isDraft) { found = true; revealTodo(id); } }
  else if (type === 'project') { const p = getP(id); if (p && !p.trashed) { found = true; navigate('project:' + id); } }
  else if (type === 'area' && getA(id)) { found = true; navigate('area:' + id); }
  if (found) { clear(); return 'opened'; }
  if (opts.quiet) return 'missing';
  clear();
  const what = type === 'todo' ? 'That to-do' : type === 'project' ? 'That project' : 'That area';
  toast(Y.enabled ? `${what} isn’t in Sectis on this device.` : `${what} isn’t here. Turn on sync to see the ones from your other devices.`);
  return 'missing';
}
