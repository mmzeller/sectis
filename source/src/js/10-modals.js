/* ===================== Quick Find, Quick Entry, Tags, Shortcuts, Backup ===================== */

/* ---- Quick Find ---- */
function findResults(q, includeLog) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const m = (...ss) => { const hay = ss.join(' ').toLowerCase(); return words.every((w) => hay.includes(w)); };
  const out = [];
  Object.entries(LISTS).forEach(([key, L]) => { if (!words.length || m(L.title)) out.push({ g: 'Lists', kind: 'list', key, title: L.title, icon: L.icon, color: L.color }); });
  S.areas.slice().sort(byOrder).forEach((a) => { if (words.length && m(aTitle(a))) out.push({ g: 'Areas', kind: 'area', key: 'area:' + a.id, title: aTitle(a), icon: 'area', color: 'var(--c-area)' }); });
  S.projects.filter((p) => !p.trashed && (p.status === 'open' || includeLog)).sort(byOrder).forEach((p) => {
    if (!words.length ? p.status === 'open' && p.start !== 'someday' && !p.isTemplate : m(pTitle(p), p.notes)) out.push({ g: 'Projects', kind: 'project', key: 'project:' + p.id, title: pTitle(p), pie: projectProgress(p).frac, sub: [isSub(p) ? projPath(parentOf(p)) : areaOf(p) ? aTitle(areaOf(p)) : '', p.blueprint ? 'Template' : p.isTemplate ? 'Repeating' : '', p.status !== 'open' ? 'Completed' : ''].filter(Boolean).join(' · ') });
  });
  if (words.length) {
    tagTree().forEach(({ tag }) => { if (!tag.group && m(tag.title)) out.push({ g: 'Tags', kind: 'tag', key: 'tag:' + tag.id, title: tag.title, icon: 'tag', color: `var(--t-${tagColor(tag)})` }); });
    let n = 0;
    S.todos.filter((t) => !t.trashed && !t.isDraft && (t.isTemplate || t.status === 'open' || !t.logged || includeLog))
      .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.modifiedAt - a.modifiedAt)
      .forEach((t) => { if (n < 60 && m(t.title, t.notes, t.checklist.map((c) => c.title).join(' '))) { n++; out.push({ g: t.blueprint ? 'Templates' : t.isTemplate ? 'Repeating' : 'To-Dos', kind: t.isTemplate ? 'template' : 'todo', id: t.id, title: t.title || 'New To-Do', icon: t.blueprint ? 'template' : t.isTemplate ? 'repeat' : t.status === 'open' ? 'select' : 'logbook', color: t.status === 'open' ? 'var(--faint)' : 'var(--c-logbook)', sub: [parentLabel(t), t.when && t.start === 'anytime' ? fmtRel(t.when) : t.start === 'someday' ? 'Someday' : ''].filter(Boolean).join(' · ') }); } });
    (S.notes || []).filter((x) => x.text.trim() && m(x.text)).sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 20)
      .forEach((x) => { const xs = noteKeys(x).map(noteCtx).filter(Boolean), c = xs[0] ? { label: xs[0].label + (xs.length > 1 ? ` +${xs.length - 1}` : '') } : null; out.push({ g: 'Notepad', kind: 'note', id: x.id, title: noteTitle(x), icon: 'notepad', color: 'var(--c-note)', sub: [x.archived ? 'Archived' : '', c ? c.label : ''].filter(Boolean).join(' · ') }); });
  }
  return out;
}
function openFind(initial = '') {
  if (ui.editing) closeEditor({ noRender: false });
  let includeLog = false, results = [], k = 0;
  const L = openLayer({ modal: true, cls: 'find top', html: `<div class="qf-in">${ic('search')}<input id="qf" placeholder="Find lists, projects, tags, to-dos and notes" autocomplete="off" aria-label="Quick Find" enterkeyhint="go"></div><div class="qf-res" id="qf-res" role="listbox"></div><div class="qf-foot"><span>↑ ↓ to move · Return to open</span><label><input type="checkbox" id="qf-log"> Include Logbook</label></div>`,
    onMount: (el) => {
      const inp = $('#qf', el), box = $('#qf-res', el);
      const draw = () => {
        results = findResults(inp.value, includeLog); k = clamp(k, 0, Math.max(0, results.length - 1));
        let html = '', g = null;
        results.forEach((r, i) => {
          if (r.g !== g) { g = r.g; html += `<div class="qf-g">${esc(g)}</div>`; }
          const icon = r.pie != null ? pieIc(r.pie) : `<span class="ic" style="color:${r.color || 'var(--muted)'}">${I[r.icon]}</span>`;
          html += `<button class="qf-i${i === k ? ' kbd' : ''}" data-i="${i}" role="option">${r.kind === 'project' ? `<span class="ic" style="color:var(--accent)">${pieSVG(r.pie)}</span>` : icon}<span class="qf-t">${esc(r.title)}</span>${r.sub ? `<span class="qf-s">${esc(r.sub)}</span>` : ''}</button>`;
        });
        box.innerHTML = html || `<p class="note" style="padding:12px">No matches${includeLog ? '' : '. Try including the Logbook'}.</p>`;
      };
      const go = (r) => {
        if (!r) return; closeLayer(L);
        if (r.kind === 'todo') revealTodo(r.id); else if (r.kind === 'template') openTplModal(r.id); else if (r.kind === 'note') openNotepad({ focus: r.id }); else navigate(r.key);
      };
      inp.value = initial; draw();
      inp.addEventListener('input', () => { k = 0; draw(); });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); k = Math.min(results.length - 1, k + 1); draw(); $('.qf-i.kbd', box)?.scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); k = Math.max(0, k - 1); draw(); $('.qf-i.kbd', box)?.scrollIntoView({ block: 'nearest' }); }
        else if (e.key === 'Enter') { e.preventDefault(); go(results[k]); }
      });
      $('#qf-log', el).addEventListener('change', (e) => { includeLog = e.target.checked; draw(); inp.focus(); });
      box.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) go(results[+b.dataset.i]); });
      inp.focus({ preventScroll: true });
    } });
}
function revealTodo(id) {
  const t = getT(id); if (!t) return;
  let key;
  if (t.trashed) key = 'trash';
  else if (t.status !== 'open' && t.logged) key = 'logbook';
  else if (t.projectId && getP(t.projectId)) key = 'project:' + t.projectId;
  else if (t.areaId && getA(t.areaId)) key = 'area:' + t.areaId;
  else if (isInbox(t)) key = 'inbox';
  else if (isTodayItem(t)) key = 'today';
  else if (t.start === 'someday') key = 'someday';
  else if (t.when && t.when > T0()) key = 'upcoming';
  else key = 'anytime';
  if (!/^(project|area):|^inbox$/.test(key) && !inFocus(t)) showAllAreas(); // a list the focus hides it from (the Inbox hides nothing)
  navigate(key);
  if (key === 'logbook' || key === 'trash') { ui.sel = new Set([id]); ui.anchor = id; render(); const r = $(`#content .row[data-id="${CSS.escape(id)}"]`); if (r) r.scrollIntoView({ block: 'center' }); }
  else openEditor(id);
}

/* ---- Quick Entry: natural-language title parsing ---- */
const WD_ABBR = ['mon', 'tue', 'tues', 'wed', 'thu', 'thur', 'thurs', 'fri', 'sat', 'sun'];
function inlineDateOK(phrase) {
  const p = phrase.toLowerCase().trim();
  if (!p || /^\+?\d+$/.test(p)) return false;
  if (/^[a-z]+$/.test(p)) return ['today', 'tomorrow', 'tmrw', 'tonight', 'someday'].includes(p) || WD_FULL.includes(p) || WD_ABBR.includes(p);
  if (/^(?:the )?\d+(?:st|nd|rd|th)?$/.test(p)) return /(st|nd|rd|th)$/.test(p) && p.startsWith('the ');
  return true;
}
function parseEntry(raw) {
  const out = { title: raw, tags: [], when: null, deadline: null, whenText: '', deadlineText: '', priority: 0, place: null, placeText: '' };
  const pl = parsePlace(raw); // @Project, @Area or @Project/Sub-Project
  if (pl) { out.place = pl.place; out.placeText = pl.text; raw = raw.slice(0, pl.start) + ' ' + raw.slice(pl.end); }
  let s = ' ' + raw + ' ';
  s = s.replace(/\s(!{1,3})(?=\s)/, (m, b) => { out.priority = b.length; return ' '; }); // ! low, !! medium, !!! high
  s = s.replace(/\s#([^\s#!]+)(?=\s)/g, (m, name) => { out.tags.push(name.replace(/[.,;:]+$/, '')); return ' '; });
  const bang = s.match(/\s!(\S+(?: \S+){0,2})/);
  if (bang) {
    const words = bang[1].split(' ');
    for (let n = words.length; n >= 1; n--) {
      const phrase = words.slice(0, n).join(' '); const p = parseDateText(phrase);
      if (p && (p.date || p.special === 'today' || p.special === 'evening')) { out.deadline = p.date || T0(); out.deadlineText = phrase; s = s.replace('!' + phrase, ' '); break; }
    }
  }
  const words = s.trim().split(/\s+/).filter(Boolean);
  for (let n = Math.min(4, words.length - 1); n >= 1; n--) {
    const phrase = words.slice(words.length - n).join(' ').replace(/[.,;:]+$/, '');
    if (!inlineDateOK(phrase)) continue;
    const p = parseDateText(phrase);
    if (p && p.special !== 'anytime') { out.when = p.date ? { date: p.date } : p.special; out.whenText = phrase; words.splice(words.length - n, n); break; }
  }
  out.title = words.join(' ').replace(/\s+([.,;:])/g, '$1').trim();
  return out;
}
/* preset: where it goes and what it starts with (the Timeline's New To-Do Due…: its deadline and place) */
function openQuickEntry(prefill = '', preset = null) {
  if (ui.editing) closeEditor({ noRender: false });
  const draft = makeTodo({ start: 'inbox', isDraft: true });
  if (preset) Object.assign(draft, preset, { isDraft: true });
  S.todos.push(draft); idx.todo.set(draft.id, draft);
  const ignore = { when: false, deadline: false, tags: false, priority: false, place: false };
  let saved = false, parsed = null;
  const L = openLayer({ modal: true, cls: 'qe-modal top',
    html: `<div class="qe"><div class="c-top"><span class="cb" aria-hidden="true"></span><textarea class="qe-title" id="qe-title" placeholder="New To-Do" autocomplete="off" aria-label="Title" enterkeyhint="done" rows="1" data-autosize data-oneline></textarea></div>
      <div class="qe-ac" id="qe-ac" role="listbox" aria-label="Projects and areas" hidden></div>
      <div class="qe-parsed" id="qe-parsed"></div>
      <div class="c-body"><textarea class="c-notes" id="qe-notes" rows="2" placeholder="Notes" aria-label="Notes"></textarea>
      <div class="c-foot"><div class="c-chips" id="qe-chips"></div><div class="c-tools">
        <button class="ib" data-qe="tags" title="Tags" aria-label="Tags">${ic('tag')}</button><button class="ib" data-qe="deadline" title="Deadline" aria-label="Deadline">${ic('flag')}</button>
        <button class="ib" data-qe="when" title="When" aria-label="When">${ic('calendar')}</button><button class="ib" data-qe="move" title="List" aria-label="Choose list">${ic('move')}</button></div></div>
      <div class="qe-dest" id="qe-dest"></div></div></div>
      <div class="modal-f"><span class="note" style="margin-right:auto;align-self:center">${S.settings.parseEntry ? 'Try “Call Sam tomorrow @Work #Errand !fri !!”' : ''}</span><button class="btn" data-qe="cancel">Cancel</button><button class="btn primary" data-qe="save">Save</button></div>`,
    onClose: () => { if (!saved) { S.todos = S.todos.filter((x) => x.id !== draft.id); reindex(); } },
    onMount: (el) => {
      const ti = $('#qe-title', el), no = $('#qe-notes', el);
      const d = () => getT(draft.id) || draft;
      const refresh = () => {
        const x = d();
        parsed = S.settings.parseEntry ? parseEntry(ti.value) : null;
        const chips = [];
        const placeOK = parsed && parsed.place && !ignore.place && !x.projectId && !x.areaId; // not once you've chosen a list
        if (placeOK) chips.push(`<span class="qe-p qe-place">${placeIcon(parsed.place)}${esc(qePlaceLabel(parsed.place))}<button data-ign="place" aria-label="Don’t file it there">${ic('x')}</button></span>`);
        if (parsed && parsed.when && !ignore.when && x.start === 'inbox' && !x.when) chips.push(`<span class="qe-p">${ic('calendar')}${esc(parsed.when.date ? fmtRel(parsed.when.date) : describeParsed({ special: parsed.when }))}<button data-ign="when" aria-label="Ignore date">${ic('x')}</button></span>`);
        if (parsed && parsed.deadline && !ignore.deadline && !x.deadline) chips.push(`<span class="qe-p">${ic('flag')}Deadline ${esc(fmtRel(parsed.deadline))}<button data-ign="deadline" aria-label="Ignore deadline">${ic('x')}</button></span>`);
        if (parsed && parsed.priority && !ignore.priority && !prio(x)) chips.push(`<span class="qe-p"><b class="pri-bangs p${parsed.priority}">${'!'.repeat(parsed.priority)}</b>${PRIORITY_NAMES[parsed.priority]} Priority<button data-ign="priority" aria-label="Ignore priority">${ic('x')}</button></span>`);
        if (parsed && parsed.tags.length && !ignore.tags) chips.push(`<span class="qe-p">${ic('tag')}${parsed.tags.map(esc).join(', ')}<button data-ign="tags" aria-label="Ignore tags">${ic('x')}</button></span>`);
        $('#qe-parsed', el).innerHTML = chips.join('');
        $('#qe-chips', el).innerHTML = whenChipHTML(x).replace(/data-action="(when|clear-when)"/g, 'data-qe="$1"') + deadlineChipHTML(x).replace(/data-action="(deadline|clear-deadline)"/g, 'data-qe="$1"') + x.tags.map((id) => getTag(id)).filter(Boolean).map((g) => `<span class="tg ${tcls(g)}">${esc(g.title)}</span>`).join('');
        const pp = placeOK ? parsed.place : null;
        const p = pp ? (pp.type === 'project' && getP(pp.id)) : x.projectId && getP(x.projectId), a = pp ? (pp.type === 'area' && getA(pp.id)) : x.areaId && getA(x.areaId);
        $('#qe-dest', el).innerHTML = `${p ? projIc(p) : a ? (placeColor(a) ? areaIc(a) : ic('area')) : ic('inbox')}<span>${esc(p ? projPath(p) : a ? aTitle(a) : x.start === 'inbox' ? 'Inbox' : 'No list')}</span>`;
      };
      const save = () => {
        const x = d(); const raw = ti.value;
        if (!raw.trim() && !no.value.trim()) { closeLayer(L); return; }
        commit('Quick Entry', () => {
          const pz = S.settings.parseEntry ? parseEntry(raw) : null;
          const placeOK = pz && pz.place && !ignore.place && !x.projectId && !x.areaId;
          x.title = pz && (placeOK || (pz.place && ignore.place) || (pz.when && !ignore.when && x.start === 'inbox' && !x.when) || (pz.deadline && !ignore.deadline && !x.deadline) || (pz.tags.length && !ignore.tags) || (pz.priority && !ignore.priority && !prio(x))) ? rebuildTitle(raw, pz, Object.assign({}, ignore, { place: ignore.place || !!(pz.place && !placeOK) })) : raw.trim();
          x.notes = no.value;
          if (pz && pz.when && !ignore.when && x.start === 'inbox' && !x.when) scheduleItems(x, pz.when);
          if (pz && pz.deadline && !ignore.deadline && !x.deadline) x.deadline = pz.deadline;
          if (pz && pz.priority && !ignore.priority && !prio(x)) x.priority = pz.priority;
          if (pz && pz.tags.length && !ignore.tags) pz.tags.forEach((n) => { const tg = findOrCreateTag(n); if (tg && !x.tags.includes(tg.id)) x.tags.push(tg.id); });
          if (placeOK) moveItems([x.id], { type: pz.place.type, id: pz.place.id }, { noCommit: true, silent: true });
          delete x.isDraft;
          x.order = topOrder(S.todos.filter((y) => y !== x && !y.trashed && containerKey(y) === containerKey(x)));
          x.todayOrder = todayTop();
          touch(x);
        });
        saved = true; closeLayer(L);
        const x2 = getT(draft.id);
        if (x2) toast(`Added to ${isTodayItem(x2) ? 'Today' : x2.projectId ? pTitle(getP(x2.projectId)) : x2.areaId ? aTitle(getA(x2.areaId)) : x2.start === 'someday' ? 'Someday' : x2.when ? 'Upcoming' : x2.start === 'inbox' ? 'Inbox' : 'Anytime'}`, { action: visibleInCurrentView(x2) ? null : 'Show', fn: () => revealTodo(draft.id) });
      };
      const ac = placeAutocomplete(ti, $('#qe-ac', el), () => { autosize(ti); refresh(); });
      ti.value = prefill; autosize(ti); refresh();
      ti.addEventListener('input', () => { refresh(); ac.update(); });
      ti.addEventListener('keydown', (e) => { if (ac.key(e)) return; if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } });
      no.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } });
      no.addEventListener('input', () => autosize(no));
      el.addEventListener('click', (e) => {
        const ig = e.target.closest('[data-ign]'); if (ig) { ignore[ig.dataset.ign] = true; refresh(); if (!isCoarse()) ti.focus(); return; }
        const b = e.target.closest('[data-qe]'); if (!b) return;
        const act = b.dataset.qe, x = d();
        const after = (P) => { if (!P) return; const prev = P.onClose; P.onClose = () => { if (prev) prev(); if (L.el.isConnected) { refresh(); if (!isCoarse()) ti.focus(); } }; };
        if (act === 'cancel') closeLayer(L);
        else if (act === 'save') save();
        else if (act === 'when') after(openWhen([x.id], b));
        else if (act === 'deadline') after(openWhen([x.id], b, 'deadline'));
        else if (act === 'clear-when') { scheduleItems(x, 'clear'); if (!x.projectId && !x.areaId) x.start = 'inbox'; refresh(); }
        else if (act === 'clear-deadline') { x.deadline = null; refresh(); }
        else if (act === 'tags') after(openTagPicker([x.id], b));
        else if (act === 'move') after(openMove([x.id], b, { onPick: (t) => { moveItems([x.id], t, { noCommit: true, silent: true }); reindex(); refresh(); } }));
      });
      ti.focus({ preventScroll: true });
    } });
}
function rebuildTitle(raw, pz, ignore) {
  // Re-insert any part the person chose to ignore, keep the rest stripped.
  let t = pz.title;
  if (ignore.tags && pz.tags.length) t += ' ' + pz.tags.map((x) => '#' + x).join(' ');
  if (ignore.deadline && pz.deadlineText) t += ' !' + pz.deadlineText;
  if (ignore.priority && pz.priority) t += ' ' + '!'.repeat(pz.priority);
  if (ignore.when && pz.whenText) t += ' ' + pz.whenText;
  if (ignore.place && pz.placeText) t += ' @' + pz.placeText;
  return t.trim() || raw.trim();
}

/* ---- Settings: see 42-settings.js ---- */
function dropSampleData() {
  const sampleProjects = new Set(S.projects.filter((p) => p.sample).map((p) => p.id));
  S.projects.filter((p) => p.sample).forEach((p) => projDescendants(p).forEach((q) => sampleProjects.add(q.id))); // and anything you put inside them
  S.todos = S.todos.filter((t) => !t.sample && !sampleProjects.has(t.projectId));
  S.projects = S.projects.filter((p) => !sampleProjects.has(p.id));
  const keepAreas = new Set(S.projects.map((p) => p.areaId).concat(S.todos.map((t) => t.areaId)));
  S.areas = S.areas.filter((a) => !a.sample || keepAreas.has(a.id));
  reindex();
}
function removeSample() {
  commit('Remove Samples', dropSampleData);
  toast('Sample to-dos removed', { undo: true });
}

/* a tag becomes a group (a heading for tags, never on anything), or a group a tag again */
function setTagGroup(t, on) {
  const users = on ? S.todos.concat(S.projects, S.areas).filter((x) => (x.tags || []).includes(t.id)) : [];
  commit(on ? 'Make Tag a Group' : 'Make Group a Tag', () => {
    if (on) {
      if (tagParent(t)) t.order = endOrder(tagKids(null)); // to the top level, at the end
      t.group = true; t.parentId = null;
      users.forEach((x) => { x.tags = x.tags.filter((id) => id !== t.id); touch(x); });
    } else delete t.group;
  });
  if (ui.tagFilter === t.id) { ui.tagFilter = null; render(); }
  toast(on ? `“${t.title}” is a group now${users.length ? `, and it's off the ${plural(users.length, 'item')} it was on` : ''}` : `“${t.title}” is a tag again`, { undo: true });
}
/* ---- Tag manager ----
   Drag a tag's grip (or ⌘↑ / ⌘↓ in its name) to reorder it among the tags beside it; a tag's
   children move with it. Sort A to Z puts every level in alphabetical order, with Undo. */
function openTagManager() {
  let armed = null, undoAZ = null; // undoAZ: each tag's order before the last Sort A to Z
  const build = () => {
    const tree = tagTree(), seen = new Set();
    const rowHTML = (tag) => {
      const desc = tagDescendants(tag.id);
      const opts = tree.filter((n) => !desc.has(n.tag.id)).map((n) => `<option value="${n.tag.id}" ${tagParent(tag) === n.tag.id ? 'selected' : ''}>${'  '.repeat(n.depth)}${esc(n.tag.title)}</option>`).join('');
      const used = S.todos.filter((t) => t.tags.includes(tag.id) && !t.trashed).length;
      return `<div class="tm-row${tag.group ? ' tm-grow' : ''}"><span class="tm-grip" data-tmgrip="${tag.id}" title="Drag to reorder" aria-hidden="true">${ic('grip')}</span><button class="tm-sw ${tcls(tag)}" data-tm-color="${tag.id}" aria-label="Color: ${TAG_COLOR_NAMES[tagColor(tag)]}${TAG_COLOR_NAMES[tag.color] ? '' : ' (same as parent)'}" title="Color"></button><input class="field${tag.group ? ' tm-gname' : ''}" data-tm-title="${tag.id}" value="${esc(tag.title)}" aria-label="${tag.group ? 'Group name' : 'Tag name'}">${tag.group ? '<span class="tm-badge" title="A group only organizes tags. It can\'t be put on to-dos.">Group</span>' : `<select data-tm-parent="${tag.id}" aria-label="Group or parent tag"><option value="">No group</option>${opts}</select>`}<button class="ib" data-tm-more="${tag.id}" aria-label="More for ${esc(tag.title)}" title="More">${ic('more')}</button><button class="ib${armed === tag.id ? ' del-armed' : ''}" data-tm-del="${tag.id}" aria-label="Delete tag" title="${plural(used, 'to-do')}">${armed === tag.id ? 'Delete' : ic('trash')}</button></div>`;
    };
    const group = (tag, depth) => {
      seen.add(tag.id);
      const kids = depth < 6 ? tagKids(tag.id).filter((k) => !seen.has(k.id)) : [];
      return `<div class="tm-grp" data-tm-grp="${tag.id}">${rowHTML(tag)}${kids.length ? `<div class="tm-kids">${kids.map((k) => group(k, depth + 1)).join('')}</div>` : ''}</div>`;
    };
    let rows = tagKids(null).map((t) => group(t, 0)).join('');
    S.tags.forEach((t) => { if (!seen.has(t.id)) rows += group(t, 0); });
    const az = undoAZ ? `<button class="btn" data-tm-az="undo">Undo Sort</button>`
      : `<button class="btn" data-tm-az="1"${S.tags.length > 1 ? '' : ' disabled'} title="Sort every tag, and the tags under each one, A to Z">Sort A to Z</button>`;
    return `<div class="modal-h"><h2>Tags</h2>${az}<button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div><div class="modal-b">${rows ? `<div class="tm-list">${rows}</div>` : '<p class="note">No tags yet.</p>'}<div class="tm-row" style="margin-top:8px"><input class="field" id="tm-new" placeholder="New tag name" aria-label="New tag name"><button class="btn" data-tm-add="1">Add</button><button class="btn" data-tm-addgrp="1" title="A heading to keep tags under. It isn't a tag itself.">New Group</button></div><p class="note">Drag the grip to reorder tags; this is the order they appear in everywhere. Click a tag’s dot to change its color. Put tags in a <b>group</b> (choose it beside the tag) to keep them together, like Departments: a group is only a heading, so it never goes on a to-do or shows in the tag bar. Use ••• to make a tag a group or back, or to sort a group’s tags A to Z. A tag can also go under another tag; filtering by that tag then shows its children too.</p></div>`;
  };
  const L = openLayer({ modal: true, cls: 'narrow tm-modal', html: build(), onMount: (el) => {
    const redraw = (focusId) => {
      const st = el.scrollTop; el.innerHTML = build(); el.scrollTop = st;
      if (focusId) { const f = el.querySelector(`[data-tm-title="${CSS.escape(focusId)}"]`); if (f) f.focus({ preventScroll: false }); }
    };
    const changed = () => { undoAZ = null; };
    const add = () => { const i = $('#tm-new', el); const v = i.value.trim(); if (!v) return; changed(); let t; commit('New Tag', () => { t = findOrCreateTag(v); }); if (!t) toast(`“${v}” is a group’s name`); redraw(); $('#tm-new', el).focus(); };
    const addGroup = () => {
      const i = $('#tm-new', el), v = i.value.trim() || 'New Group'; let g;
      changed();
      commit('New Tag Group', () => { g = { id: uid(), title: v, parentId: null, group: true, order: endOrder(tagKids(null)), color: nextTagColor() }; S.tags.push(g); idx.tag.set(g.id, g); });
      i.value = ''; redraw(g.id); const f = el.querySelector(`[data-tm-title="${CSS.escape(g.id)}"]`); if (f) f.select();
    };
    const newTagIn = (g) => {
      let t; changed();
      commit('New Tag', () => { t = { id: uid(), title: 'New Tag', parentId: g.id, order: endOrder(tagKids(g.id)) }; S.tags.push(t); idx.tag.set(t.id, t); });
      redraw(t.id); const f = el.querySelector(`[data-tm-title="${CSS.escape(t.id)}"]`); if (f) f.select();
    };
    const sortInside = (t) => { changed(); setOrder('Sort Tags A to Z', tagKids(t.id).sort(byTitle).map((x) => x.id)); redraw(); };
    const setOrder = (label, ids) => commit(label, () => ids.forEach((id, i) => { const t = getTag(id); if (t) t.order = i; }));
    const rename = (field) => { const t = getTag(field.dataset.tmTitle), v = field.value.trim(); if (t && v && v !== t.title) commit('Rename Tag', () => { t.title = v; }); };
    el.addEventListener('change', (e) => {
      const tId = e.target.dataset.tmTitle, pId = e.target.dataset.tmParent;
      if (tId) rename(e.target);
      if (pId) {
        const t = getTag(pId);
        if (t) { changed(); commit('Nest Tag', () => { const np = e.target.value || null; t.parentId = np; t.order = endOrder(S.tags.filter((x) => x !== t && tagParent(x) === np)); }); }
        redraw();
      }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'tm-new') { e.preventDefault(); add(); return; }
      const id = e.target.dataset.tmTitle; if (!id) return;
      if (e.key === 'Enter') { e.target.blur(); return; }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const t = getTag(id); if (!t) return;
        rename(e.target);
        const sibs = tagKids(tagParent(t)).map((x) => x.id), i = sibs.indexOf(id), j = i + (e.key === 'ArrowUp' ? -1 : 1);
        if (i < 0 || j < 0 || j >= sibs.length) return;
        [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
        changed(); setOrder('Move Tag', sibs); redraw(id);
      }
    });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-tm-add]')) { add(); return; }
      if (e.target.closest('[data-tm-addgrp]')) { addGroup(); return; }
      const mb = e.target.closest('[data-tm-more]');
      if (mb) {
        const t = getTag(mb.dataset.tmMore); if (!t) return;
        const kids = tagKids(t.id).length;
        openMenu(mb, [
          t.group ? { label: 'Make It a Tag', icon: 'tag', fn: () => { changed(); setTagGroup(t, false); redraw(); } }
            : { label: 'Make It a Group', icon: 'layers', fn: () => { changed(); setTagGroup(t, true); redraw(); } },
          ...(t.group ? [{ label: 'New Tag in This Group', icon: 'plus', fn: () => newTagIn(t) }] : []),
          { label: 'Sort Tags Inside A to Z', icon: 'sort', disabled: kids < 2, fn: () => sortInside(t) },
        ]);
        return;
      }
      const cb = e.target.closest('[data-tm-color]');
      if (cb) {
        const t = getTag(cb.dataset.tmColor); if (!t) return;
        openTagColor(t, cb, (c) => { commit('Tag Color', () => { if (c) t.color = c; else delete t.color; }); redraw(); });
        return;
      }
      const az = e.target.closest('[data-tm-az]');
      if (az) {
        if (az.dataset.tmAz === 'undo') {
          const prev = undoAZ; undoAZ = null;
          commit('Undo Sort', () => S.tags.forEach((t) => { if (prev.has(t.id)) t.order = prev.get(t.id); }));
        } else {
          const prev = new Map(S.tags.map((t) => [t.id, t.order]));
          commit('Sort Tags A to Z', () => {
            const groups = new Map();
            S.tags.forEach((t) => { const k = tagParent(t) || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
            groups.forEach((list) => list.sort(byTitle).forEach((t, i) => { t.order = i; }));
          });
          undoAZ = prev;
        }
        redraw(); return;
      }
      const d = e.target.closest('[data-tm-del]'); if (!d) return;
      const id = d.dataset.tmDel;
      if (armed !== id) { armed = id; redraw(); return; }
      const tag = getTag(id);
      changed();
      commit('Delete Tag', () => {
        // its tags move up a level, keeping the color they showed
        S.tags.forEach((t) => { if (t.parentId === id) { if (!TAG_COLOR_NAMES[t.color] && !tagParent(tag)) t.color = tagColor(tag); t.parentId = tag.parentId || null; } });
        S.tags = S.tags.filter((t) => t.id !== id);
        S.todos.concat(S.projects, S.areas).forEach((x) => { if (x.tags.includes(id)) x.tags = x.tags.filter((t) => t !== id); });
        if (ui.tagFilter === id) ui.tagFilter = null;
      });
      armed = null; redraw();
    });
    // drag a grip to reorder a tag (and its children) among the tags beside it
    el.addEventListener('pointerdown', (e) => {
      const grip = e.target.closest('[data-tmgrip]'); if (!grip) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const grp = grip.closest('.tm-grp'), list = grp && grp.parentElement; if (!list) return;
      e.preventDefault();
      if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.tmTitle) rename(document.activeElement);
      const sibs = () => $$(':scope > .tm-grp', list);
      const start = sibs().map((x) => x.dataset.tmGrp).join();
      grp.classList.add('tm-dragging'); document.body.classList.add('dragging-active');
      let y = e.clientY, raf = 0;
      const place = () => {
        let before = null;
        for (const g of sibs()) {
          if (g === grp) continue;
          const r = $(':scope > .tm-row', g).getBoundingClientRect();
          if (y < r.top + r.height / 2) { before = g; break; }
        }
        if (before ? grp.nextElementSibling !== before : list.lastElementChild !== grp) list.insertBefore(grp, before);
      };
      const edge = () => { // scroll the window of tags when held near its top or bottom
        const r = el.getBoundingClientRect(), dy = y < r.top + 40 ? -8 : y > r.bottom - 40 ? 8 : 0;
        if (dy) { el.scrollTop += dy; place(); }
        raf = requestAnimationFrame(edge);
      };
      raf = requestAnimationFrame(edge);
      const move = (ev) => { if (ev.cancelable) ev.preventDefault(); y = ev.clientY; place(); };
      const up = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        grp.classList.remove('tm-dragging'); document.body.classList.remove('dragging-active');
        const ids = sibs().map((x) => x.dataset.tmGrp);
        if (ids.join() === start) return;
        changed(); setOrder('Reorder Tags', ids); redraw();
      };
      document.addEventListener('pointermove', move, { passive: false });
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    });
  } });
  return L;
}

/* a tag's color: nine soft colors or gray for none; a nested tag can also share its parent's */
function openTagColor(tag, anchor, done) {
  const cur = TAG_COLOR_NAMES[tag.color] ? tag.color : null;
  const parent = tagParent(tag) && getTag(tagParent(tag));
  const sw = (c) => `<button class="sw ${'tc-' + c}${cur === c ? ' on' : ''}" data-sw="${c}" aria-label="${TAG_COLOR_NAMES[c]}" aria-pressed="${cur === c}" title="${TAG_COLOR_NAMES[c]}">${cur === c ? ic('check') : ''}</button>`;
  const same = parent ? `<div class="pk-sep"></div><button class="menu-i sw-auto-i" data-sw="" aria-pressed="${!cur}"><span class="sw-dot tc-${tagColor(parent)}" aria-hidden="true"></span><span>Same as “${esc(parent.title)}”</span>${cur ? '' : `<span class="check">${ic('check')}</span>`}</button>` : '';
  const L = openLayer({ anchor, cls: 'sw-pop', html: `<div class="pk-h">Color for “${esc(tag.title)}”</div><div class="sw-grid">${TAG_COLORS.concat('gray').map(sw).join('')}</div>${same}`,
    onMount: (el) => {
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-sw]'); if (!b) return; closeLayer(L); done(b.dataset.sw || null); });
      if (!isCoarse()) { const f = $('.sw.on', el) || $('.sw-auto-i', el) || $('.sw', el); if (f) f.focus({ preventScroll: true }); }
    } });
  return L;
}

/* ---- Keyboard shortcuts ---- */
/* one key to a chip, modifiers in the Mac's order (⌃ ⌥ ⇧ ⌘), each named when you point at it */
const KEY_NAMES = { '⌘': 'Command', '⇧': 'Shift', '⌥': 'Option', '⌃': 'Control', '↑': 'Up Arrow', '↓': 'Down Arrow', '/': 'Slash', '#': 'Number Sign (⇧3)' };
function openShortcuts() {
  const M = IS_MAC ? '⌘' : 'Ctrl', SH = IS_MAC ? '⇧' : 'Shift', OPT = IS_MAC ? '⌥' : 'Alt', CTL = IS_MAC ? '⌃' : 'Ctrl';
  const chip = (x) => { const n = KEY_NAMES[x], sym = x.length === 1 && /[^A-Z0-9]/.test(x); return `<kbd${sym ? ' class="sym"' : ''}${n ? ` title="${n}" aria-label="${n}"` : ''}>${esc(x)}</kbd>`; };
  const k = (...keys) => `<span class="sc-k">${keys.map(chip).join('')}</span>`;
  const or = (...ks) => ks.join('<span class="sc-or">or</span>');
  const pair = (a, b) => a + '<span class="sc-or">/</span>' + b;
  const rows = [
    ['Create', [['New to-do', or(k('N'), k('Space'))], ['New sub-project (in a project)', k(SH, 'N')], ['New from a template', k(SH, 'T')], ['Quick Entry', k('Q')], ['Quick Find', or(k('/'), k(M, 'F'))]]],
    ['Selected to-dos', [['Open', k('Return')], ['Complete', or(k('K'), k(M, 'K'))], ['Cancel', k(OPT, 'K')], ['Today', k('T')], ['This Evening', k('E')], ['Anytime', k('A')], ['Someday', k('O')], ['When…', k('S')], ['Deadline…', k('D')], ['Priority…', k('P')], ['Tags…', k('#')], ['Move…', k('M')], ['Repeat…', k('R')], ['Waiting For…', k('W')], ['Copy', k(M, 'C')], ['Paste after it', k(M, 'V')], ['Duplicate', k(M, 'D')], ['Move up / down', pair(k(M, '↑'), k(M, '↓'))], ['Delete', k('Delete')]]],
    ['Navigate', [['Next / previous to-do', pair(k('↓'), k('↑'))], ['Extend selection', pair(k(SH, '↓'), k(SH, '↑'))], ['Inbox … Trash, Board, Templates', k('1') + '<span class="sc-or">to</span>' + k('9')], ['Show or hide the sidebar', IS_MAC ? k(CTL, M, 'S') : k('Ctrl', 'Alt', 'S')], ['Notepad', k('J')], ['Undo', k(M, 'Z')], ['Close / deselect', k('Esc')]]],
    ['While editing a to-do', [['Save and close', or(k('Return'), k(M, 'Return'))], ['Complete', k(M, 'K')], ['When…', k(M, 'S')], ['Deadline…', k(SH, M, 'D')], ['Add checklist', k(SH, M, 'C')], ['Move checklist item', pair(k(M, '↑'), k(M, '↓'))], ['Paste lines as to-dos (one each)', k(M, 'V')]]],
    ['In a note', [['Bold', k(M, 'B')], ['Italic', k(M, 'I')], ['Strikethrough', k(SH, M, 'X')], ['Code', k(M, 'E')], ['Link', k(M, 'K')], ['Checkbox, or tick it', k(SH, M, 'L')], ['Done, start a new note', k(M, 'Return')], ['Undo / redo', pair(k(M, 'Z'), k(SH, M, 'Z'))]]],
  ];
  openLayer({ modal: true, html: `<div class="modal-h"><h2>Keyboard Shortcuts</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div><div class="modal-b"><div class="sc-grid">${rows.map(([h, list]) => `<h4>${h}</h4>${list.map(([l, keys]) => `<div class="sc"><span>${l}</span><span>${keys}</span></div>`).join('')}`).join('')}</div></div>` });
}

/* ---- Backup: export / import ---- */
/*WEB-ONLY*/
/* Saving a file. In the installed app (Dock or Home Screen) Safari can turn a download
   into a page load that replaces Sectis with an error page, so there the download runs
   inside a hidden frame (a failure stays in the frame), and on iPhone it goes through
   the share sheet, which has Save to Files. Returns 'saved', 'shared' or 'failed'. */
const isStandalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function saveFile(name, text, type) {
  const file = typeof File === 'function' ? new File([text], name, { type }) : null;
  if (isStandalone() && isIOS() && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return 'shared'; } catch (e) { return e && e.name === 'AbortError' ? 'cancelled' : 'failed'; }
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    if (isStandalone()) {
      const f = document.createElement('iframe');
      f.hidden = true; f.setAttribute('aria-hidden', 'true');
      document.body.append(f);
      const d = f.contentDocument;
      const a = d.createElement('a'); a.href = url; a.download = name; d.body.append(a); a.click();
      setTimeout(() => { f.remove(); URL.revokeObjectURL(url); }, 60000);
    } else {
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    return 'saved';
  } catch (e) { return 'failed'; }
}
function savedNote(r, name) {
  if (r === 'saved') return `Saved ${name} to your Downloads.${isStandalone() ? ' If it isn’t there, use Copy or Share instead.' : ''}`;
  if (r === 'shared') return 'Done.';
  if (r === 'cancelled') return '';
  return 'Couldn’t save a file here. Use Copy or Share instead.';
}
function downloadText(name, text) { return saveFile(name, text, 'application/json'); }
/*END-WEB-ONLY*/
function openExport() {
  const json = JSON.stringify(Object.assign({ app: 'Sectis', version: APP_VERSION, exportedAt: new Date().toISOString() }, S));
  const name = `sectis-backup-${T0()}.json`;
  const n = S.todos.filter((t) => !t.trashed).length;
  const canSave = SECTIS_WEB && !IN_FRAME;
  openLayer({ modal: true, html: `<div class="modal-h"><h2>Export Backup</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div><div class="modal-b"><p style="margin-top:0">${plural(n, 'to-do')}, ${plural(S.projects.length, 'project')}, ${plural(S.areas.length, 'area')} and ${plural(S.tags.length, 'tag')}. ${canSave ? 'Save the file somewhere safe, or copy the text.' : 'Copy the text and keep it in a file somewhere safe.'}</p><textarea class="ta" id="ex-ta" readonly aria-label="Backup data">${esc(json)}</textarea><p class="note" id="ex-note"></p></div><div class="modal-f"><button class="btn${canSave ? '' : ' primary'}" data-ex="copy">Copy</button>${canSave ? `<button class="btn primary" data-ex="file">Save ${esc(name)}</button>` : ''}</div>`,
    onMount: (el) => el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ex]'); if (!b) return;
      const note = $('#ex-note', el);
      if (b.dataset.ex === 'file') { note.textContent = savedNote(await saveFile(name, json, 'application/json'), name); }
      else { try { await navigator.clipboard.writeText(json); note.textContent = 'Copied. Paste it into a text file to keep it.'; } catch (err) { const ta = $('#ex-ta', el); ta.focus(); ta.select(); note.textContent = 'Press ' + MODK + 'C to copy the selected text.'; } }
    }) });
}
function openImport() {
  let pending = null;
  const L = openLayer({ modal: true, html: `<div class="modal-h"><h2>Import</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div><div class="modal-b">
    <p style="margin-top:0">Choose a Sectis backup file, or paste its text. You can also paste a plain list to add each line as a to-do in your Inbox.</p>
    <input type="file" id="im-file" accept=".json,application/json,text/plain" aria-label="Backup file"><textarea class="ta" id="im-ta" placeholder="…or paste here" aria-label="Backup text" style="margin-top:10px;min-height:120px"></textarea><p class="note" id="im-note"></p></div>
    <div class="modal-f"><button class="btn" data-action="close-layer">Cancel</button><button class="btn primary" id="im-go" disabled>Import</button></div>`,
    onMount: (el) => {
      const note = $('#im-note', el), go = $('#im-go', el);
      const check = (text) => {
        pending = null; go.disabled = true; note.textContent = ''; note.classList.remove('warn');
        if (!text.trim()) return;
        try {
          const data = JSON.parse(text);
          if (!data || !Array.isArray(data.todos)) throw new Error('not sectis');
          pending = { kind: 'backup', data };
          note.textContent = `Backup${data.exportedAt ? ' from ' + new Date(data.exportedAt).toLocaleString() : ''}: ${plural(data.todos.filter((t) => !t.trashed).length, 'to-do')}, ${plural((data.projects || []).length, 'project')}. Importing replaces everything here (you can undo).`;
          go.textContent = 'Replace My Data'; go.className = 'btn danger'; go.disabled = false;
        } catch (e) {
          const lines = splitPasted(text);
          if (lines.length) { pending = { kind: 'lines', lines }; note.textContent = `This isn’t a backup file. Add ${plural(lines.length, 'line')} as to-dos in your Inbox?`; go.textContent = `Add ${plural(lines.length, 'To-Do')}`; go.className = 'btn primary'; go.disabled = false; }
        }
      };
      $('#im-ta', el).addEventListener('input', (e) => check(e.target.value));
      $('#im-file', el).addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#im-ta', el).value = String(r.result).slice(0, 2000) + (String(r.result).length > 2000 ? '\n…' : ''); check(String(r.result)); }; r.readAsText(f); });
      go.addEventListener('click', async () => {
        if (!pending) return;
        if (pending.kind === 'backup') { const data = pending.data; await makeBackup('import'); commit('Import', () => { const keepFs = S.meta && S.meta.fileName; S = normalizeState(data); if (keepFs) S.meta.fileName = keepFs; S.meta.sampleLoaded = true; }); closeAllLayers(); navigate('today'); toast('Backup imported', { undo: true }); }
        else { commit('Add To-Dos', () => { let o = topOrder(inboxItems()) - pending.lines.length; pending.lines.forEach((line) => { S.todos.push(makeTodo({ title: line, start: 'inbox', order: o++ })); }); }); closeAllLayers(); navigate('inbox'); toast(`Added ${plural(pending.lines.length, 'to-do')}`, { undo: true }); }
      });
    } });
}
