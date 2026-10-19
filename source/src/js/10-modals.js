/* ===================== Quick Find, Quick Entry, Settings, Tags, Shortcuts, Backup ===================== */

/* ---- Quick Find ---- */
function findResults(q, includeLog) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const m = (...ss) => { const hay = ss.join(' ').toLowerCase(); return words.every((w) => hay.includes(w)); };
  const out = [];
  Object.entries(LISTS).forEach(([key, L]) => { if (!words.length || m(L.title)) out.push({ g: 'Lists', kind: 'list', key, title: L.title, icon: L.icon, color: L.color }); });
  S.areas.slice().sort(byOrder).forEach((a) => { if (words.length && m(aTitle(a))) out.push({ g: 'Areas', kind: 'area', key: 'area:' + a.id, title: aTitle(a), icon: 'area', color: 'var(--c-area)' }); });
  S.projects.filter((p) => !p.trashed && (p.status === 'open' || includeLog)).sort(byOrder).forEach((p) => {
    if (!words.length ? p.status === 'open' && p.start !== 'someday' : m(pTitle(p), p.notes)) out.push({ g: 'Projects', kind: 'project', key: 'project:' + p.id, title: pTitle(p), pie: projectProgress(p).frac, sub: (areaOf(p) ? aTitle(areaOf(p)) : '') + (p.status !== 'open' ? ' · Completed' : '') });
  });
  if (words.length) {
    tagTree().forEach(({ tag }) => { if (m(tag.title)) out.push({ g: 'Tags', kind: 'tag', key: 'tag:' + tag.id, title: tag.title, icon: 'tag', color: 'var(--muted)' }); });
    let n = 0;
    S.todos.filter((t) => !t.trashed && !t.isDraft && (t.isTemplate || t.status === 'open' || !t.logged || includeLog))
      .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.modifiedAt - a.modifiedAt)
      .forEach((t) => { if (n < 60 && m(t.title, t.notes, t.checklist.map((c) => c.title).join(' '))) { n++; out.push({ g: t.isTemplate ? 'Repeating' : 'To-Dos', kind: t.isTemplate ? 'template' : 'todo', id: t.id, title: t.title || 'New To-Do', icon: t.isTemplate ? 'repeat' : t.status === 'open' ? 'select' : 'logbook', color: t.status === 'open' ? 'var(--faint)' : 'var(--c-logbook)', sub: [parentLabel(t), t.when && t.start === 'anytime' ? fmtRel(t.when) : t.start === 'someday' ? 'Someday' : ''].filter(Boolean).join(' · ') }); } });
  }
  return out;
}
function openFind(initial = '') {
  if (ui.editing) closeEditor({ noRender: false });
  let includeLog = false, results = [], k = 0;
  const L = openLayer({ modal: true, cls: 'find top', html: `<div class="qf-in">${ic('search')}<input id="qf" placeholder="Find lists, projects, tags and to-dos" autocomplete="off" aria-label="Quick Find" enterkeyhint="go"></div><div class="qf-res" id="qf-res" role="listbox"></div><div class="qf-foot"><span>↑ ↓ to move · Return to open</span><label><input type="checkbox" id="qf-log"> Include Logbook</label></div>`,
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
        if (r.kind === 'todo') revealTodo(r.id); else if (r.kind === 'template') openTplModal(r.id); else navigate(r.key);
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
  const out = { title: raw, tags: [], when: null, deadline: null, whenText: '', deadlineText: '' };
  let s = ' ' + raw + ' ';
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
function openQuickEntry(prefill = '') {
  if (ui.editing) closeEditor({ noRender: false });
  const draft = makeTodo({ start: 'inbox', isDraft: true });
  S.todos.push(draft); idx.todo.set(draft.id, draft);
  const ignore = { when: false, deadline: false, tags: false };
  let saved = false, parsed = null;
  const L = openLayer({ modal: true, cls: 'qe-modal top',
    html: `<div class="qe"><div class="c-top"><span class="cb" aria-hidden="true"></span><textarea class="qe-title" id="qe-title" placeholder="New To-Do" autocomplete="off" aria-label="Title" enterkeyhint="done" rows="1" data-autosize data-oneline></textarea></div>
      <div class="qe-parsed" id="qe-parsed"></div>
      <div class="c-body"><textarea class="c-notes" id="qe-notes" rows="2" placeholder="Notes" aria-label="Notes"></textarea>
      <div class="c-foot"><div class="c-chips" id="qe-chips"></div><div class="c-tools">
        <button class="ib" data-qe="tags" title="Tags" aria-label="Tags">${ic('tag')}</button><button class="ib" data-qe="deadline" title="Deadline" aria-label="Deadline">${ic('flag')}</button>
        <button class="ib" data-qe="when" title="When" aria-label="When">${ic('calendar')}</button><button class="ib" data-qe="move" title="List" aria-label="Choose list">${ic('move')}</button></div></div>
      <div class="qe-dest" id="qe-dest"></div></div></div>
      <div class="modal-f"><span class="note" style="margin-right:auto;align-self:center">${S.settings.parseEntry ? 'Try “Call Sam tomorrow #Errand !fri”' : ''}</span><button class="btn" data-qe="cancel">Cancel</button><button class="btn primary" data-qe="save">Save</button></div>`,
    onClose: () => { if (!saved) { S.todos = S.todos.filter((x) => x.id !== draft.id); reindex(); } },
    onMount: (el) => {
      const ti = $('#qe-title', el), no = $('#qe-notes', el);
      const d = () => getT(draft.id) || draft;
      const refresh = () => {
        const x = d();
        parsed = S.settings.parseEntry ? parseEntry(ti.value) : null;
        const chips = [];
        if (parsed && parsed.when && !ignore.when && x.start === 'inbox' && !x.when) chips.push(`<span class="qe-p">${ic('calendar')}${esc(parsed.when.date ? fmtRel(parsed.when.date) : describeParsed({ special: parsed.when }))}<button data-ign="when" aria-label="Ignore date">${ic('x')}</button></span>`);
        if (parsed && parsed.deadline && !ignore.deadline && !x.deadline) chips.push(`<span class="qe-p">${ic('flag')}Deadline ${esc(fmtRel(parsed.deadline))}<button data-ign="deadline" aria-label="Ignore deadline">${ic('x')}</button></span>`);
        if (parsed && parsed.tags.length && !ignore.tags) chips.push(`<span class="qe-p">${ic('tag')}${parsed.tags.map(esc).join(', ')}<button data-ign="tags" aria-label="Ignore tags">${ic('x')}</button></span>`);
        $('#qe-parsed', el).innerHTML = chips.join('');
        $('#qe-chips', el).innerHTML = whenChipHTML(x).replace(/data-action="(when|clear-when)"/g, 'data-qe="$1"') + deadlineChipHTML(x).replace(/data-action="(deadline|clear-deadline)"/g, 'data-qe="$1"') + x.tags.map((id) => getTag(id)).filter(Boolean).map((g) => `<span class="tg">${esc(g.title)}</span>`).join('');
        const p = x.projectId && getP(x.projectId), a = x.areaId && getA(x.areaId), h = x.headingId && getH(x.headingId);
        $('#qe-dest', el).innerHTML = `${p ? pieIc(projectProgress(p).frac) : a ? ic('area') : ic('inbox')}<span>${esc(p ? pTitle(p) + (h ? ' › ' + (h.title || 'New Heading') : '') : a ? aTitle(a) : x.start === 'inbox' ? 'Inbox' : 'No list')}</span>`;
      };
      const save = () => {
        const x = d(); const raw = ti.value;
        if (!raw.trim() && !no.value.trim()) { closeLayer(L); return; }
        commit('Quick Entry', () => {
          const pz = S.settings.parseEntry ? parseEntry(raw) : null;
          x.title = pz && ((pz.when && !ignore.when && x.start === 'inbox' && !x.when) || (pz.deadline && !ignore.deadline && !x.deadline) || (pz.tags.length && !ignore.tags)) ? rebuildTitle(raw, pz, ignore) : raw.trim();
          x.notes = no.value;
          if (pz && pz.when && !ignore.when && x.start === 'inbox' && !x.when) scheduleItems(x, pz.when);
          if (pz && pz.deadline && !ignore.deadline && !x.deadline) x.deadline = pz.deadline;
          if (pz && pz.tags.length && !ignore.tags) pz.tags.forEach((n) => { const tg = findOrCreateTag(n); if (tg && !x.tags.includes(tg.id)) x.tags.push(tg.id); });
          delete x.isDraft;
          x.order = topOrder(S.todos.filter((y) => y !== x && !y.trashed && containerKey(y) === containerKey(x)));
          x.todayOrder = todayTop();
          touch(x);
        });
        saved = true; closeLayer(L);
        const x2 = getT(draft.id);
        if (x2) toast(`Added to ${isTodayItem(x2) ? 'Today' : x2.projectId ? pTitle(getP(x2.projectId)) : x2.areaId ? aTitle(getA(x2.areaId)) : x2.start === 'someday' ? 'Someday' : x2.when ? 'Upcoming' : x2.start === 'inbox' ? 'Inbox' : 'Anytime'}`, { action: visibleInCurrentView(x2) ? null : 'Show', fn: () => revealTodo(draft.id) });
      };
      ti.value = prefill; autosize(ti); refresh();
      ti.addEventListener('input', refresh);
      ti.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } });
      no.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } });
      no.addEventListener('input', () => autosize(no));
      el.addEventListener('click', (e) => {
        const ig = e.target.closest('[data-ign]'); if (ig) { ignore[ig.dataset.ign] = true; refresh(); return; }
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
  if (ignore.when && pz.whenText) t += ' ' + pz.whenText;
  return t.trim() || raw.trim();
}

/* ---- Settings ---- */
function openSettings() {
  if (ui.editing) closeEditor({ noRender: false });
  const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-set="${key}" data-val="${v}" class="${String(S.settings[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const sw = (key) => `<button class="switch${S.settings[key] ? ' on' : ''}" data-switch="${key}" role="switch" aria-checked="${!!S.settings[key]}" aria-label="${key}"></button>`;
  const hasSample = S.todos.some((t) => t.sample) || S.projects.some((p) => p.sample) || S.areas.some((a) => a.sample);
  const notifState = !('Notification' in window) || IN_FRAME ? 'unavailable' : Notification.permission;
  const fsOK = fileSyncSupported();
  const build = () => `<div class="modal-h"><h2>Settings</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div><div class="modal-b">
    <div class="set-sec"><h3>Appearance</h3><div class="set-row"><span class="lbl">Theme</span>${seg('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']])}</div></div>
    <div class="set-sec"><h3>Lists</h3>
      <div class="set-row"><span class="lbl">Move completed items to the Logbook<small>Completed to-dos stay visible, checked, until then.</small></span>${seg('logMode', [['immediate', 'Immediately'], ['daily', 'Daily'], ['manual', 'Manually']])}</div>
      <div class="set-row"><span class="lbl">Group Today by project and area</span>${sw('groupToday')}</div>
      <div class="set-row"><span class="lbl">Week starts on</span>${seg('weekStart', [[0, 'Sunday'], [1, 'Monday']])}</div>
      <div class="set-row"><span class="lbl">Quick Entry reads dates and tags<small>“Pay rent friday #Home !oct 31” sets When, tag and deadline.</small></span>${sw('parseEntry')}</div></div>
    <div class="set-sec"><h3>Sync</h3>${syncSettingsHTML()}</div>
    <div class="set-sec"><h3>Reminders</h3>
      <div class="set-row"><span class="lbl">System notifications<small>${notifState === 'unavailable' ? 'Not available here. Reminders still show inside Sectis while it is open.' : notifState === 'denied' ? 'Blocked in your browser settings. Reminders still show inside Sectis.' : 'Reminders fire while Sectis is open, in a tab or as an installed app.'}</small></span>${notifState === 'unavailable' || notifState === 'denied' ? '' : sw('notify')}</div></div>
    <div class="set-sec"><h3>Tags</h3><div class="set-btns"><button class="btn" data-s="tags">Manage Tags…</button></div></div>
    <div class="set-sec"><h3>Your data</h3>
      <p class="note" style="margin:0 0 10px">Your to-dos are saved in this browser on this device. Nothing is sent anywhere.</p>
      <div class="set-btns"><button class="btn" data-s="export">${'Export Backup…'}</button><button class="btn" data-s="import">Import…</button></div>
      ${fsOK ? `<div class="set-row" style="margin-top:10px"><span class="lbl">Data file<small>${fileSync.name ? `Saving to <b>${esc(fileSync.name)}</b>${fileSync.needsPermission ? ' (click Reconnect to allow access)' : ''}` : 'Keep your to-dos in a file, for example on a thumb drive next to Sectis.'}</small></span><div class="set-btns">${fileSync.name ? `${fileSync.needsPermission ? '<button class="btn primary" data-s="fs-reconnect">Reconnect</button>' : ''}<button class="btn" data-s="fs-unlink">Disconnect</button>` : '<button class="btn" data-s="fs-new">Create File…</button><button class="btn" data-s="fs-open">Open File…</button>'}</div></div>` : ''}
      <div class="set-btns" style="margin-top:12px">${hasSample ? '<button class="btn" data-s="sample-remove">Remove Sample To-Dos</button>' : '<button class="btn" data-s="sample-add">Add Sample To-Dos</button>'}<button class="btn" data-s="erase" style="color:var(--red)">Erase All Data…</button></div></div>
    <div class="about"><span><b>Sectis</b> version ${APP_VERSION}</span><span>Press <kbd>?</kbd> for keyboard shortcuts</span></div></div>`;
  const L = openLayer({ modal: true, html: build(), onMount: (el) => {
    el.addEventListener('click', async (e) => {
      const s = e.target.closest('[data-set]');
      if (s) { const key = s.dataset.set; let v = s.dataset.val; if (key === 'weekStart') v = +v; S.settings[key] = v; saveSoon(); if (key === 'logMode') autoLog(); render(); el.innerHTML = build(); return; }
      const w = e.target.closest('[data-switch]');
      if (w) {
        const key = w.dataset.switch;
        if (key === 'notify' && !S.settings.notify) { try { const r = await Notification.requestPermission(); if (r !== 'granted') { toast('Notifications were not allowed'); el.innerHTML = build(); return; } } catch (err) { toast('Notifications aren’t available here'); return; } }
        S.settings[key] = !S.settings[key]; saveSoon(); render(); el.innerHTML = build(); return;
      }
      const b = e.target.closest('[data-s]'); if (!b) return;
      const act = b.dataset.s;
      if (act === 'tags') { closeLayer(L); openTagManager(); }
      if (act === 'export') { closeLayer(L); openExport(); }
      if (act === 'import') { closeLayer(L); openImport(); }
      if (act === 'sample-remove') { removeSample(); el.innerHTML = build(); }
      if (act === 'sample-add') { commit('Sample To-Dos', () => seedSample()); el.innerHTML = build(); }
      if (act === 'erase') { const ok = await confirmDialog({ title: 'Erase all data?', body: Y.enabled ? 'Every to-do, project, area and tag will be deleted here and on every device that syncs with this one. Export a backup first if you might want them back.' : 'Every to-do, project, area and tag in this browser will be deleted. Export a backup first if you might want them back.', ok: 'Erase Everything', danger: true }); if (ok) { commit('Erase All', () => { const keep = S.settings; S = emptyState(); S.settings = keep; S.meta.sampleLoaded = true; }); navigate('inbox'); closeLayer(L); } }
      if (act === 'fs-new') { await fileSyncCreate(); el.innerHTML = build(); }
      if (act === 'fs-open') { await fileSyncOpen(); el.innerHTML = build(); }
      if (act === 'fs-reconnect') { await fileSyncReconnect(); el.innerHTML = build(); }
      if (act === 'fs-unlink') { await fileSyncUnlink(); el.innerHTML = build(); }
      if (act === 'sync-setup') { closeLayer(L); openSyncSetup(); }
      if (act === 'sync-join') { closeLayer(L); openSyncJoin(); }
      if (act === 'sync-code') { closeLayer(L); openJoinCode(false); }
      if (act === 'sync-now') { if (!Y.col) await syncStart(); else { syncDiff(); setSyncStatus('syncing'); await syncPush(); if (Y.unsub) syncListen(); } el.innerHTML = build(); }
      if (act === 'sync-off') { if (await confirmSyncOff()) el.innerHTML = build(); }
    });
  } });
}
function dropSampleData() {
  const sampleProjects = new Set(S.projects.filter((p) => p.sample).map((p) => p.id));
  S.todos = S.todos.filter((t) => !t.sample && !sampleProjects.has(t.projectId));
  S.projects = S.projects.filter((p) => !p.sample);
  S.headings = S.headings.filter((h) => !sampleProjects.has(h.projectId));
  const keepAreas = new Set(S.projects.map((p) => p.areaId).concat(S.todos.map((t) => t.areaId)));
  S.areas = S.areas.filter((a) => !a.sample || keepAreas.has(a.id));
  reindex();
}
function removeSample() {
  commit('Remove Samples', dropSampleData);
  toast('Sample to-dos removed', { undo: true });
}

/* ---- Tag manager ---- */
function openTagManager() {
  let armed = null;
  const build = () => {
    const tree = tagTree();
    const rows = tree.map(({ tag, depth }) => {
      const desc = tagDescendants(tag.id);
      const opts = tree.filter((n) => !desc.has(n.tag.id)).map((n) => `<option value="${n.tag.id}" ${tag.parentId === n.tag.id ? 'selected' : ''}>${'  '.repeat(n.depth)}${esc(n.tag.title)}</option>`).join('');
      const used = S.todos.filter((t) => t.tags.includes(tag.id) && !t.trashed).length;
      return `<div class="tm-row" style="padding-left:${depth * 18}px"><input class="field" data-tm-title="${tag.id}" value="${esc(tag.title)}" aria-label="Tag name"><select data-tm-parent="${tag.id}" aria-label="Parent tag"><option value="">No parent</option>${opts}</select><button class="ib${armed === tag.id ? ' del-armed' : ''}" data-tm-del="${tag.id}" aria-label="Delete tag" title="${plural(used, 'to-do')}">${armed === tag.id ? 'Delete' : ic('trash')}</button></div>`;
    }).join('');
    return `<div class="modal-h"><h2>Tags</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div><div class="modal-b">${rows || '<p class="note">No tags yet.</p>'}<div class="tm-row" style="margin-top:8px"><input class="field" id="tm-new" placeholder="New tag name" aria-label="New tag name"><button class="btn" data-tm-add="1">Add</button></div><p class="note">Nest a tag under a parent to filter by the whole group. Filtering by “Home” also shows to-dos tagged with its children.</p></div>`;
  };
  const L = openLayer({ modal: true, cls: 'narrow', html: build(), onMount: (el) => {
    const redraw = () => { el.innerHTML = build(); };
    const add = () => { const i = $('#tm-new', el); const v = i.value.trim(); if (!v) return; commit('New Tag', () => findOrCreateTag(v)); redraw(); $('#tm-new', el).focus(); };
    el.addEventListener('change', (e) => {
      const tId = e.target.dataset.tmTitle, pId = e.target.dataset.tmParent;
      if (tId) { const t = getTag(tId); const v = e.target.value.trim(); if (t && v) commit('Rename Tag', () => { t.title = v; }); }
      if (pId) { const t = getTag(pId); if (t) commit('Nest Tag', () => { t.parentId = e.target.value || null; }); redraw(); }
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'tm-new') { e.preventDefault(); add(); } else if (e.key === 'Enter' && e.target.dataset.tmTitle) e.target.blur(); });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-tm-add]')) { add(); return; }
      const d = e.target.closest('[data-tm-del]'); if (!d) return;
      const id = d.dataset.tmDel;
      if (armed !== id) { armed = id; redraw(); return; }
      const tag = getTag(id);
      commit('Delete Tag', () => {
        S.tags.forEach((t) => { if (t.parentId === id) t.parentId = tag.parentId || null; });
        S.tags = S.tags.filter((t) => t.id !== id);
        S.todos.concat(S.projects, S.areas).forEach((x) => { if (x.tags.includes(id)) x.tags = x.tags.filter((t) => t !== id); });
        if (ui.tagFilter === id) ui.tagFilter = null;
      });
      armed = null; redraw();
    });
  } });
}

/* ---- Keyboard shortcuts ---- */
function openShortcuts() {
  const k = (...keys) => keys.map((x) => `<kbd>${esc(x)}</kbd>`).join(' ');
  const rows = [
    ['Create', [['New to-do', k('N') + ' or ' + k('Space')], ['New heading (in a project)', k('⇧', 'N')], ['Quick Entry', k('Q')], ['Quick Find', k('/') + ' or ' + k(MODK + 'F')]]],
    ['Selected to-dos', [['Open', k('Return')], ['Complete', k('K') + ' or ' + k(MODK + 'K')], ['Cancel', k('⌥', 'K')], ['Today', k('T')], ['This Evening', k('E')], ['Anytime', k('A')], ['Someday', k('O')], ['When…', k('S')], ['Deadline…', k('D')], ['Tags…', k('#')], ['Move…', k('M')], ['Repeat…', k('R')], ['Duplicate', k(MODK + 'D')], ['Move up / down', k(MODK + '↑') + ' ' + k(MODK + '↓')], ['Delete', k('⌫')]]],
    ['Navigate', [['Next / previous to-do', k('↓') + ' ' + k('↑')], ['Extend selection', k('⇧', '↓')], ['Inbox … Trash', k('1') + '–' + k('7')], ['Undo', k(MODK + 'Z')], ['Close / deselect', k('Esc')]]],
    ['While editing', [['Save and close', k('Return') + ' or ' + k(MODK + '↩')], ['Complete', k(MODK + 'K')], ['When…', k(MODK + 'S')], ['Deadline…', k(MODK + '⇧', 'D')], ['Add checklist', k(MODK + '⇧', 'C')], ['Paste several lines', 'one to-do per line']]],
  ];
  openLayer({ modal: true, html: `<div class="modal-h"><h2>Keyboard Shortcuts</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div><div class="modal-b"><div class="sc-grid">${rows.map(([h, list]) => `<h4>${h}</h4>${list.map(([l, keys]) => `<div class="sc"><span>${l}</span><span>${keys}</span></div>`).join('')}`).join('')}</div></div>` });
}

/* ---- Backup: export / import ---- */
/*WEB-ONLY*/
function downloadText(name, text) {
  try { const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return true; } catch (e) { return false; }
}
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
      if (b.dataset.ex === 'file') { downloadText(name, json); note.textContent = 'Saved to your Downloads folder.'; }
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
      go.addEventListener('click', () => {
        if (!pending) return;
        if (pending.kind === 'backup') { const data = pending.data; commit('Import', () => { const keepFs = S.meta && S.meta.fileName; S = normalizeState(data); if (keepFs) S.meta.fileName = keepFs; S.meta.sampleLoaded = true; }); closeLayer(L); navigate('today'); toast('Backup imported', { undo: true }); }
        else { commit('Add To-Dos', () => { let o = topOrder(inboxItems()) - pending.lines.length; pending.lines.forEach((line) => { S.todos.push(makeTodo({ title: line, start: 'inbox', order: o++ })); }); }); closeLayer(L); navigate('inbox'); toast(`Added ${plural(pending.lines.length, 'to-do')}`, { undo: true }); }
      });
    } });
}
