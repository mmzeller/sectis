/* ===================== Quick Entry: @ files a to-do =====================
   Type @ and a project or area in Quick Entry ("Order toner @PaperCut fri") and the to-do goes
   there. A few letters are enough when they point to one place: the start of its name, the
   start of any word in it, or the name run together ("@papercuthive"). A sub-project can be named
   on its own or under its project: @Project/Sub-Project (as deep as they go). As you type, a list
   of matches appears under the title: ↑ ↓ and Return or Tab pick one, Esc closes it. Places in
   the current focus come first. */
const placeOpen = (p) => !p.trashed && !p.isTemplate && p.status === 'open' && !deadAbove(p);
function placeCands() {
  const out = [];
  S.projects.forEach((p) => { if (placeOpen(p) && p.title) out.push({ kind: 'project', id: p.id, title: p.title, rec: p }); });
  S.areas.forEach((a) => { if (a.title) out.push({ kind: 'area', id: a.id, title: a.title, rec: a }); });
  return out;
}
const compactName = (s) => s.toLowerCase().replace(/[^a-z0-9À-￿]+/g, '');
const placeInFocus = (c) => (c.kind === 'area' ? !ui.focusRec || ui.focusAreas.has(c.id) : inFocus(c.rec));
// in focus first, then projects before areas, then shorter names, then sidebar order
function placeRank(a, b) {
  return (placeInFocus(b) - placeInFocus(a)) || ((a.kind === 'area') - (b.kind === 'area')) || (a.title.length - b.title.length) || ((a.rec.order || 0) - (b.rec.order || 0));
}
const BOUNDARY = /^($|[\s/.,;:!?)])/;
/* the longest name that `rest` starts with (whole words), or the first few words when they
   point to one name; returns { c, len } or null */
function matchName(rest, cands) {
  const lower = rest.toLowerCase();
  let best = null;
  for (const c of cands) {
    const t = c.title.toLowerCase();
    if (t && lower.startsWith(t) && BOUNDARY.test(lower.slice(t.length)) && (!best || t.length > best.len || (t.length === best.len && placeRank(c, best.c) < 0))) best = { c, len: t.length };
  }
  if (best) return best;
  const ends = []; const re = /[^\s/]+/g; let m; // words end at spaces and at the / before a sub-project
  while ((m = re.exec(rest)) && ends.length < 5) { if (m.index === 0 || ends.length) ends.push(m.index + m[0].length); else break; }
  for (let n = ends.length; n >= 1; n--) {
    const q = rest.slice(0, ends[n - 1]).replace(/[.,;:!?)]+$/, ''), ql = q.toLowerCase(), qc = compactName(q);
    if (!ql) continue;
    let hits = cands.filter((c) => c.title.toLowerCase().startsWith(ql));
    if (!hits.length && n === 1 && ql.length >= 2) hits = cands.filter((c) => c.title.toLowerCase().split(/[\s\-–—/&+]+/).some((w) => w.startsWith(ql)));
    if (!hits.length && qc.length >= 3) hits = cands.filter((c) => compactName(c.title).startsWith(qc));
    if (hits.length) return { c: hits.sort(placeRank)[0], len: q.length };
  }
  return null;
}
/* the open sub-projects of a project, as places */
const subCands = (p) => childProjects(p).filter((q) => placeOpen(q) && q.title).map((q) => ({ kind: 'project', id: q.id, title: q.title, rec: q }));
/* text after an @ → { type, id, len } */
function matchPlace(rest) {
  if (!rest || /^\s/.test(rest)) return null;
  const hit = matchName(rest, placeCands()); if (!hit) return null;
  const out = { type: hit.c.kind, id: hit.c.id, len: hit.len };
  // @Project/Sub-Project/…: each / goes one level in
  let p = hit.c.kind === 'project' ? hit.c.rec : null;
  while (p && rest[out.len] === '/') {
    const hh = matchName(rest.slice(out.len + 1), subCands(p)); if (!hh) break;
    out.id = hh.c.id; out.len += 1 + hh.len; p = hh.c.rec;
  }
  return out;
}
/* the first @place in a title: { place, start, end, text } */
function parsePlace(raw) {
  const re = /(^|\s)@/g; let m;
  while ((m = re.exec(raw))) {
    const at = m.index + m[1].length, r = matchPlace(raw.slice(at + 1));
    if (r) return { place: r, start: at, end: at + 1 + r.len, text: raw.slice(at + 1, at + 1 + r.len) };
  }
  return null;
}
function placeLabel(pl) {
  if (!pl) return '';
  if (pl.type === 'area') return aTitle(getA(pl.id));
  return getP(pl.id) ? projPath(getP(pl.id)) : 'New Project';
}
function placeIcon(pl) {
  if (pl.type === 'area') { const a = getA(pl.id); return a && placeColor(a) ? areaIc(a) : ic('area'); }
  return projIc(getP(pl.id));
}

/* ---- the list of matches under the title ---- */
function placeSuggestions(q) {
  const ql = q.toLowerCase().trim(), qc = compactName(q);
  // what to type for a project: its name, or its path when it's a sub-project (Kitchen/Cabinets)
  const insertFor = (p) => projPath(p, '/');
  const slash = q.lastIndexOf('/');
  if (slash > 0) { // the sub-projects of the project named before the last /
    const parts = q.slice(0, slash).split('/').map((s) => s.toLowerCase().trim());
    let p = placeCands().filter((c) => c.kind === 'project' && c.title.toLowerCase() === parts[0]).sort(placeRank)[0];
    p = p && p.rec;
    for (const part of parts.slice(1)) { if (!p) break; p = childProjects(p).find((x) => placeOpen(x) && (x.title || '').toLowerCase() === part) || null; }
    if (!p) return [];
    const hq = q.slice(slash + 1).toLowerCase().trim();
    return childProjects(p).filter((x) => placeOpen(x) && x.title && (!hq || x.title.toLowerCase().startsWith(hq) || x.title.toLowerCase().split(/\s+/).some((w) => w.startsWith(hq))))
      .sort(byOrder).slice(0, 8)
      .map((x) => ({ type: 'project', id: x.id, label: x.title, sub: `In ${projPath(p)}`, insert: insertFor(x) }));
  }
  const score = (title) => {
    const t = title.toLowerCase();
    if (!ql) return 3;
    if (t.startsWith(ql)) return 0;
    if (t.split(/[\s\-–—/&+]+/).some((w) => w.startsWith(ql))) return 1;
    if (qc.length >= 2 && compactName(title).startsWith(qc)) return 1.5;
    if (ql.length >= 2 && t.includes(ql)) return 2;
    return -1;
  };
  const rows = [];
  const sub = (c) => c.kind === 'project' && isSub(c.rec);
  // sub-projects need a couple of letters, and come after projects and areas that match as well
  placeCands().forEach((c) => { const s = score(c.title); if (s >= 0 && !(sub(c) && (ql.length < 2 || s >= 2))) rows.push({ c, s: s + (sub(c) ? 0.5 : 0) }); });
  rows.sort((a, b) => (a.s - b.s) || (placeInFocus(b.c) - placeInFocus(a.c)) || (sub(a.c) - sub(b.c)) || ((a.c.kind === 'area') - (b.c.kind === 'area')) || ((a.c.rec.order || 0) - (b.c.rec.order || 0)));
  return rows.slice(0, 7).map(({ c }) => {
    if (c.kind === 'area') return { type: 'area', id: c.id, label: c.title, sub: 'Area', insert: c.title };
    if (sub(c)) return { type: 'project', id: c.id, label: c.title, sub: `In ${projPath(parentOf(c.rec))}`, insert: insertFor(c.rec) };
    const a = areaOf(c.rec);
    return { type: 'project', id: c.id, label: c.title, sub: a ? aTitle(a) : 'Project', insert: c.title };
  });
}
/* wires the list to a title field; key(e) returns true when it used the key */
function placeAutocomplete(ti, box, onPick) {
  let rows = [], k = 0, at = -1, closedAt = -1;
  const token = () => {
    const before = ti.value.slice(0, ti.selectionStart == null ? ti.value.length : ti.selectionStart);
    const m = before.match(/(^|\s)@([^@#\n]{0,48})$/);
    if (!m) return null;
    return { at: before.length - m[2].length - 1, q: m[2] };
  };
  const hide = () => { rows = []; at = -1; box.hidden = true; box.innerHTML = ''; ti.removeAttribute('aria-activedescendant'); ti.setAttribute('aria-expanded', 'false'); };
  const paint = () => {
    box.innerHTML = rows.map((r, i) => `<button type="button" class="qe-ac-i${i === k ? ' on' : ''}" id="qe-ac-${i}" role="option" aria-selected="${i === k}" data-aci="${i}">${placeIcon(r)}<span class="qe-ac-t">${esc(r.label)}</span><span class="qe-ac-s">${esc(r.sub)}</span></button>`).join('');
    box.hidden = false; ti.setAttribute('aria-expanded', 'true'); ti.setAttribute('aria-activedescendant', 'qe-ac-' + k);
  };
  const update = () => {
    const t = token();
    if (!t || t.at === closedAt) { hide(); return; }
    // a name already typed out in full, then a space: nothing left to choose
    if (/\s$/.test(t.q) && (matchPlace(t.q) || {}).len === t.q.trimEnd().length) { hide(); return; }
    if (t.q.split(/\s+/).length > 5) { hide(); return; }
    const list = placeSuggestions(t.q);
    if (!list.length) { hide(); return; }
    if (t.at !== at) k = 0;
    rows = list; at = t.at; k = Math.min(k, rows.length - 1); paint();
  };
  const pick = (i) => {
    const r = rows[i], t = token(); if (!r || !t) return;
    const end = ti.selectionStart, before = ti.value.slice(0, t.at), after = ti.value.slice(end).replace(/^\S*/, '');
    const ins = '@' + r.insert + ' ';
    ti.value = before + ins + after.replace(/^\s+/, '');
    const pos = before.length + ins.length; ti.setSelectionRange(pos, pos);
    hide(); onPick();
  };
  ti.setAttribute('role', 'combobox'); ti.setAttribute('aria-autocomplete', 'list'); ti.setAttribute('aria-controls', box.id); ti.setAttribute('aria-expanded', 'false');
  box.addEventListener('pointerdown', (e) => e.preventDefault()); // keep the caret in the title
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-aci]'); if (b) pick(+b.dataset.aci); });
  ti.addEventListener('click', update);
  ti.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') update(); });
  ti.addEventListener('blur', () => setTimeout(hide, 120));
  return {
    update,
    key(e) {
      if (box.hidden || !rows.length || e.isComposing) return false;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); k = (k + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length; paint(); return true; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); pick(k); return true; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closedAt = at; hide(); return true; }
      return false;
    },
  };
}
