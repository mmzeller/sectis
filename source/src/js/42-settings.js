/* ===================== Settings =====================
   One window with a pane per subject: the list on the left picks the pane on the right. In a
   narrow window, and on iPhone, the list comes first and each pane opens over it.
   - Search finds a setting by any word in its name or description, across every pane.
   - Windows opened from here (Manage Tags, Backups, a focus, sync set-up) open over Settings
     and come back to the same pane when they close.
   - openSettings('sync') (or any pane's id) opens straight to that pane. */
const SET_PANES = [
  { id: 'general', title: 'General', icon: 'sliders' },
  { id: 'lists', title: 'Lists', icon: 'checklist' },
  { id: 'tags', title: 'Tags', icon: 'tag' },
  { id: 'focus', title: 'Focus', icon: 'focus' },
  { id: 'sync', title: 'Sync', icon: 'cloud' },
  { id: 'data', title: 'Your Data', icon: 'archive' },
  { id: 'about', title: 'About', icon: 'info' },
];
ui.setPane = 'general'; // the pane you were last in, while Sectis stays open

/* one setting: its name and a line about it on the left, its control on the right */
function setRow(label, desc, ctl, cls = '') {
  return `<div class="set-row${cls ? ' ' + cls : ''}"><div class="lbl"><span>${label}</span>${desc ? `<small>${desc}</small>` : ''}</div>${ctl ? `<div class="set-ctl">${ctl}</div>` : ''}</div>`;
}
/* settings that belong together, in one outlined box under a small heading */
function setGroup(title, rows, note = '') {
  const list = rows.filter(Boolean);
  if (!list.length) return '';
  return `<section class="set-grp">${title ? `<h3>${title}</h3>` : ''}<div class="set-card">${list.join('')}</div>${note ? `<p class="note">${note}</p>` : ''}</section>`;
}

function openSettings(pane) {
  if (ui.editing) closeEditor({ noRender: false });
  const known = (id) => typeof id === 'string' && SET_PANES.some((p) => p.id === id);
  let cur = known(pane) ? pane : known(ui.setPane) ? ui.setPane : 'general';
  let atNav = !known(pane); // a narrow window starts at the list, unless a pane was asked for
  let q = '';
  const seg = (key, opts, label) => `<div class="seg" role="group" aria-label="${esc(label)}">${opts.map(([v, l]) => { const on = String(S.settings[key]) === String(v); return `<button data-set="${key}" data-val="${v}" class="${on ? 'on' : ''}" aria-pressed="${on}">${l}</button>`; }).join('')}</div>`;
  const sw = (key, label) => `<button class="switch${S.settings[key] ? ' on' : ''}" data-switch="${key}" role="switch" aria-checked="${!!S.settings[key]}" aria-label="${esc(label)}"></button>`;
  const segRow = (label, desc, key, opts) => setRow(label, desc, seg(key, opts, label), 'has-seg');
  const swRow = (label, desc, key) => setRow(label, desc, sw(key, label), 'tog');
  const PANE = {
    general: () => {
      const notif = !('Notification' in window) || IN_FRAME ? 'unavailable' : Notification.permission;
      return setGroup('Appearance', [
        segRow('Theme', '', 'theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]),
        segRow('Row spacing', 'Compact fits more to-dos on screen. Each device keeps its own.', 'density', [['comfortable', 'Comfortable'], ['compact', 'Compact']]),
        segRow('Color projects by', 'Area & Project uses the colors you pick (they flow down to what’s inside). Progress goes from red, with nothing done, to green when it’s all done. Priority colors High, Medium and Low like their ! marks.', 'colorBy', COLOR_BY),
        setRow('Colors of areas and projects', 'See and change them all in one place, several at once.', '<button class="btn" data-s="colors">Manage Colors…</button>'),
        swRow('Shade sub-projects', 'A sub-project without its own color takes a lighter or deeper shade of its project’s, taking turns, so they’re one family but easy to tell apart.', 'shadeSubs'),
      ]) + setGroup('Dates and typing', [
        segRow('Week starts on', '', 'weekStart', [[0, 'Sunday'], [1, 'Monday']]),
        swRow('Quick Entry reads dates, tags and places', '“Pay rent friday @Home #Bills !oct 31” sets When, the area, a tag and a deadline.', 'parseEntry'),
      ]) + setGroup('Reminders', [
        notif === 'unavailable' ? setRow('System notifications', 'Not available here. Reminders still show inside Sectis while it is open.')
          : notif === 'denied' ? setRow('System notifications', 'Blocked in your browser’s settings. Reminders still show inside Sectis.')
            : swRow('System notifications', 'Show reminders as banners while Sectis is open, in a tab or as an installed app.', 'notify'),
      ]);
    },
    lists: () => setGroup('Order', [
      swRow('Keep higher priorities on top', 'High, then Medium, then Low, in every list you haven’t sorted another way. You can still arrange to-dos within each priority.', 'prioTop'),
      swRow('Group Today by project and area', '', 'groupToday'),
    ]) + setGroup('Completed to-dos', [
      segRow('When you check one off', 'Move to Bottom puts it below the rest of its list. Unchecking it puts it back where it was.', 'doneSink', [['bottom', 'Move to Bottom'], ['stay', 'Stay in Place']]),
      segRow('Move completed items to the Logbook', 'Until then they stay in their list, checked.', 'logMode', [['immediate', 'Immediately'], ['daily', 'Daily'], ['manual', 'Manually']]),
      segRow('Logged to-dos in projects and areas', 'At the Bottom keeps them at the end, behind Show logged items. Where They Were lists each one in its project or sub-project, with the day it was done.', 'loggedPlace', [['bottom', 'At the Bottom'], ['inline', 'Where They Were']]),
    ]),
    tags: () => {
      const n = S.tags.filter((t) => !t.group).length;
      return setGroup('', [
        setRow('Your tags', n ? `${plural(n, 'tag')}. Rename, color, group and reorder them.` : 'No tags yet. Make some here, or press # on a to-do.', '<button class="btn" data-s="tags">Manage Tags…</button>'),
      ]) + setGroup('In lists', [
        segRow('Tags shown in lists', 'Own Only leaves out the tags a to-do gets from its project or area. Open a to-do to see them all.', 'rowTags', [['own', 'Own Only'], ['all', 'All'], ['none', 'None']]),
      ]) + setGroup('Projects and areas', [
        swRow('To-dos take on the tags of their project and area', 'Adding or moving a to-do into a project or area gives it that place’s tags. Moving it elsewhere swaps them.', 'inheritTags'),
        setRow('Tag to-dos already in projects and areas', 'Adds each project’s and area’s tags to the to-dos inside it now. You can undo it.', '<button class="btn" data-s="retag-all">Tag Them Now</button>'),
      ]);
    },
    focus: () => focusSettingsHTML(),
    sync: () => syncSettingsHTML(),
    data: () => {
      const hasSample = S.todos.some((t) => t.sample) || S.projects.some((p) => p.sample) || S.areas.some((a) => a.sample);
      const file = !fileSyncSupported() ? '' : fileSync.name
        ? setRow('Data file', `Saving to <b>${esc(fileSync.name)}</b>${fileSync.needsPermission ? '. Click Reconnect to allow access.' : '.'}`, `${fileSync.needsPermission ? '<button class="btn primary" data-s="fs-reconnect">Reconnect</button>' : ''}<button class="btn" data-s="fs-unlink">Disconnect</button>`)
        : setRow('Data file', 'Keep your to-dos in a file, for example on a thumb drive next to Sectis.', '<button class="btn" data-s="fs-new">Create File…</button><button class="btn" data-s="fs-open">Open File…</button>');
      return `<p class="set-lead">${Y.enabled ? 'Your to-dos are saved in this browser on this device, and synced, encrypted, through your own Firebase project.' : 'Your to-dos are saved in this browser on this device. Nothing is sent anywhere.'}</p>`
        + setGroup('Backups', [
          setRow('Automatic backups', 'A copy every day for 14 days, and one before big changes.', '<button class="btn" data-s="backups">Backups…</button>'),
          setRow('Export', 'Save everything as a file you can keep somewhere safe.', '<button class="btn" data-s="export">Export Backup…</button>'),
          setRow('Import', 'Bring in a backup file, or paste a list to add as to-dos.', '<button class="btn" data-s="import">Import…</button>'),
          file,
        ]) + setGroup('Start over', [
          hasSample ? setRow('Sample to-dos', 'The tour and examples Sectis started with.', '<button class="btn" data-s="sample-remove">Remove Sample To-Dos</button>')
            : setRow('Sample to-dos', 'Bring back the tour and examples Sectis started with.', '<button class="btn" data-s="sample-add">Add Sample To-Dos</button>'),
          setRow('Erase all data', Y.enabled ? 'Deletes every to-do, project, area and tag here and on every device that syncs with this one.' : 'Deletes every to-do, project, area and tag in this browser.', '<button class="btn danger-quiet" data-s="erase">Erase All Data…</button>'),
        ]);
    },
    about: () => {
      const canUpdate = updatesAvailable(), newer = canUpdate && upd.latest && newerVersion(upd.latest, APP_VERSION);
      return setGroup('', [
        setRow('Sectis', `Version ${APP_VERSION}${canUpdate ? '. Sectis checks for updates when you bring it to the front.' : ''}`, canUpdate ? `<button class="btn${newer ? ' primary' : ''}" data-s="update-check" id="upd-btn">${newer ? `Update to ${esc(upd.latest)}` : 'Check for Updates'}</button>` : ''),
        setRow('Keyboard shortcuts', `Press <kbd>?</kbd> on any list to see them all.`, '<button class="btn" data-s="shortcuts">Show Shortcuts</button>'),
      ]) + `<p class="set-lead set-fine">A private to-do app. No account, and nothing leaves this device unless you turn on sync.</p>`;
    },
  };
  const title = (id) => (SET_PANES.find((p) => p.id === id) || SET_PANES[0]).title;
  const words = () => q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  /* every pane, cut down to the settings whose text has all the words */
  const searchHTML = () => {
    const ws = words(), tmp = document.createElement('div');
    const has = (text) => ws.every((w) => text.toLowerCase().includes(w));
    let out = '';
    SET_PANES.forEach((p) => {
      tmp.innerHTML = PANE[p.id]();
      if (!has(p.title)) {
        $$('.set-lead, .set-btns', tmp).forEach((n) => n.remove());
        $$('.set-grp', tmp).forEach((g) => {
          const h = $('h3', g);
          if (h && has(h.textContent)) return;
          $$('.set-row', g).forEach((r) => { if (!has(r.textContent)) r.remove(); });
          if (!$('.set-row', g)) g.remove(); else { const n = $('.note', g); if (n) n.remove(); }
        });
      }
      if ($('.set-grp', tmp)) out += `<div class="set-found"><button class="set-found-h" data-pane="${p.id}" title="Open ${esc(p.title)}">${ic(p.icon)}<span>${esc(p.title)}</span>${ic('chevR', 'chev')}</button>${tmp.innerHTML}</div>`;
    });
    return out || `<p class="set-none">No settings match “${esc(q.trim())}”.</p>`;
  };
  const shell = `<div class="st">
    <div class="st-side">
      <div class="st-side-h"><h2>Settings</h2><button class="ib st-x" data-action="close-layer" aria-label="Close">${ic('x')}</button></div>
      <label class="st-search">${ic('search')}<input id="st-q" type="text" placeholder="Search settings" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search settings" enterkeyhint="search"><button class="st-clear" data-st="clear" aria-label="Clear search" hidden>${ic('x')}</button></label>
      <nav class="st-tabs" aria-label="Settings sections">${SET_PANES.map((p) => `<button class="st-tab" data-pane="${p.id}">${ic(p.icon)}<span>${p.title}</span>${ic('chevR', 'chev')}</button>`).join('')}</nav>
      <div class="st-ver">Sectis ${APP_VERSION}</div>
    </div>
    <div class="st-main">
      <div class="st-head"><button class="st-back" data-st="back" aria-label="Back to Settings">${ic('chevL')}<span>Settings</span></button><h2 id="st-title"></h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div>
      <div class="st-body" id="st-body"></div>
    </div></div>`;
  const L = openLayer({ modal: true, cls: 'settings', html: shell, onMount: (el, layer) => {
    const root = $('.st', el), body = $('#st-body', el), inp = $('#st-q', el);
    el.setAttribute('aria-label', 'Settings');
    /* the control that had the keyboard keeps it when the pane is redrawn */
    const focusKey = (a) => {
      if (!a || !a.dataset || !body.contains(a)) return null;
      if (a.dataset.set) return `[data-set="${a.dataset.set}"][data-val="${a.dataset.val}"]`;
      if (a.dataset.switch) return `[data-switch="${a.dataset.switch}"]`;
      if (a.dataset.s) return `[data-s="${a.dataset.s}"]${a.dataset.id ? `[data-id="${a.dataset.id}"]` : ''}`;
      return null;
    };
    const paint = (keep) => {
      if (!el.isConnected) return;
      const searching = !!q.trim(), top = keep ? body.scrollTop : 0, fk = keep ? focusKey(document.activeElement) : null;
      root.classList.toggle('at-nav', atNav);
      root.classList.toggle('searching', searching);
      $('.st-clear', el).hidden = !q;
      $$('.st-tab', el).forEach((b) => { const on = !searching && b.dataset.pane === cur; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
      $('#st-title', el).textContent = searching ? 'Search' : title(cur);
      body.innerHTML = searching ? searchHTML() : PANE[cur]();
      body.scrollTop = top;
      if (fk) { const f = $(fk, body); if (f) f.focus({ preventScroll: true }); }
    };
    const show = (id) => { cur = id; ui.setPane = id; atNav = false; q = ''; inp.value = ''; paint(false); };
    layer.onReveal = () => paint(true); // a window opened from here has closed
    paint(false);
    inp.addEventListener('input', () => { q = inp.value; paint(false); });
    el.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape' && q) { e.preventDefault(); e.stopPropagation(); q = ''; inp.value = ''; paint(false); return; }
      if ((mod && e.key.toLowerCase() === 'f') || (e.key === '/' && e.target !== inp && !mod)) { e.preventDefault(); e.stopPropagation(); inp.focus(); inp.select(); return; }
      // ↑ ↓ walk the panes while the list has the keyboard
      const tab = e.target.closest && e.target.closest('.st-tab');
      if (tab && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const tabs = $$('.st-tab', el), i = tabs.indexOf(tab), n = tabs[clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, tabs.length - 1)];
        if (n && n !== tab) { show(n.dataset.pane); n.focus(); }
      }
    });
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-pane]');
      if (t) { show(t.dataset.pane); return; }
      const st = e.target.closest('[data-st]');
      if (st) { if (st.dataset.st === 'back') { atNav = true; paint(false); } else { q = ''; inp.value = ''; paint(false); inp.focus(); } return; }
      const s = e.target.closest('[data-set]');
      if (s) { const key = s.dataset.set; let v = s.dataset.val; if (key === 'weekStart') v = +v; S.settings[key] = v; saveSoon(); if (key === 'logMode') autoLog(); render(); paint(true); return; }
      // a switch, or anywhere on its row
      const togRow = e.target.closest('.set-row.tog');
      const w = e.target.closest('[data-switch]') || (togRow && !e.target.closest('button, a, input') ? $('[data-switch]', togRow) : null);
      if (w) {
        const key = w.dataset.switch;
        if (key === 'notify' && !S.settings.notify) { try { const r = await Notification.requestPermission(); if (r !== 'granted') { toast('Notifications were not allowed'); paint(true); return; } } catch (err) { toast('Notifications aren’t available here'); return; } }
        S.settings[key] = !S.settings[key]; saveSoon(); render(); paint(true);
        return;
      }
      const b = e.target.closest('[data-s]'); if (!b) return;
      const act = b.dataset.s;
      if (act === 'tags') { openTagManager(); return; }
      if (act === 'colors') { openColorManager(); return; }
      if (act === 'shortcuts') { openShortcuts(); return; }
      if (act === 'focus-new') { openFocusEditor(); return; }
      if (act === 'focus-edit') { const f = getFocus(b.dataset.id); if (f) openFocusEditor(f); return; }
      if (act === 'retag-all') {
        let n = 0;
        commit('Tag To-Dos', () => S.todos.forEach((t) => {
          if (t.trashed || t.isTemplate || t.isDraft || (!t.projectId && !t.areaId)) return;
          const before = t.tags.join(); const keep = S.settings.inheritTags; S.settings.inheritTags = true; retag(t, new Set()); S.settings.inheritTags = keep;
          if (t.tags.join() !== before) { touch(t); n++; }
        }));
        toast(n ? `Tagged ${plural(n, 'to-do')}` : 'Every to-do already has its project’s and area’s tags', n ? { undo: true } : {});
        return;
      }
      if (act === 'backups') { openBackups(); return; }
      if (act === 'export') { openExport(); return; }
      if (act === 'import') { openImport(); return; }
      if (act === 'update-check') {
        if (upd.latest && newerVersion(upd.latest, APP_VERSION)) { applyUpdate(); return; }
        b.textContent = 'Checking…'; b.disabled = true;
        const v = await checkForUpdate(true);
        if (!b.isConnected) return;
        b.disabled = false;
        if (v) { b.textContent = `Update to ${v}`; b.classList.add('primary'); }
        else b.textContent = v === false ? 'You have the latest version' : 'Couldn’t check. Are you online?';
        return;
      }
      if (act === 'sample-remove') { removeSample(); paint(true); return; }
      if (act === 'sample-add') { commit('Sample To-Dos', () => seedSample()); paint(true); return; }
      if (act === 'erase') {
        const ok = await confirmDialog({ title: 'Erase all data?', body: Y.enabled ? 'Every to-do, project, area and tag will be deleted here and on every device that syncs with this one. Export a backup first if you might want them back.' : 'Every to-do, project, area and tag in this browser will be deleted. Export a backup first if you might want them back.', ok: 'Erase Everything', danger: true });
        if (ok) { await makeBackup('erase'); commit('Erase All', () => { const keep = S.settings; S = emptyState(); S.settings = keep; S.meta.sampleLoaded = true; }); navigate('inbox'); closeLayer(L); }
        return;
      }
      if (act === 'fs-new') { await fileSyncCreate(); paint(true); return; }
      if (act === 'fs-open') { await fileSyncOpen(); paint(true); return; }
      if (act === 'fs-reconnect') { await fileSyncReconnect(); paint(true); return; }
      if (act === 'fs-unlink') { await fileSyncUnlink(); paint(true); return; }
      if (act === 'sync-setup') { openSyncSetup(); return; }
      if (act === 'sync-join') { openSyncJoin(); return; }
      if (act === 'sync-code') { openJoinCode(false); return; }
      if (act === 'sync-check') {
        b.disabled = true; b.textContent = 'Checking…';
        try {
          if (!Y.col) await syncStart();
          const r = await syncCheckAll();
          toast(!r ? 'Couldn’t reach Firebase. Try again when you’re online.' : !r.up && !r.down ? 'Everything matches your other devices.' : [r.down ? `${plural(r.down, 'change')} brought in` : '', r.up ? `${plural(r.up, 'item')} sent back up` : ''].filter(Boolean).join(', ') + '.');
        } catch (err) { toast(friendlySyncError(err)); }
        paint(true); return;
      }
      if (act === 'sync-now') { b.disabled = true; b.textContent = 'Syncing…'; await syncNow(); paint(true); return; }
      if (act === 'sync-off') { if (await confirmSyncOff()) paint(true); }
    });
  } });
  return L;
}
