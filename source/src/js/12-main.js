/* ===================== Sample data, reminders, data file, start-up ===================== */
function seedSample() {
  const T = todayStr(); ui.today = T;
  const tag = (title) => { let t = S.tags.find((x) => x.title === title); if (!t) { t = { id: uid(), title, parentId: null, order: S.tags.length }; S.tags.push(t); } return t.id; };
  const errand = tag('Errand'), home = tag('Home'); tag('Important'); tag('Waiting');
  let o = 0;
  const td = (title, props = {}) => { const t = makeTodo(Object.assign({ title, sample: true, order: o++, todayOrder: o }, props)); S.todos.push(t); return t; };
  const meet = makeProject({ title: 'Meet Sectis', notes: 'A short tour. Complete each to-do as you try it, and watch the circle fill up.', sample: true, order: 0 });
  const homeArea = { id: uid(), title: 'Home', tags: [], order: 0, sample: true };
  const room = makeProject({ title: 'Paint the guest room', areaId: homeArea.id, sample: true, order: 1, deadline: addDays(T, 18) });
  const garden = makeProject({ title: 'Spring garden', areaId: homeArea.id, start: 'someday', sample: true, order: 2 });
  S.projects.push(meet, room, garden); S.areas.push(homeArea);
  const H = (projectId, title, order) => { const h = { id: uid(), projectId, title, order, archived: false }; S.headings.push(h); return h.id; };
  const h1 = H(meet.id, 'Make a to-do', 0), h2 = H(meet.id, 'Decide when', 1), h3 = H(meet.id, 'Stay organized', 2), h4 = H(meet.id, 'Find your way', 3);
  const m = (title, headingId, props = {}) => td(title, Object.assign({ projectId: meet.id, headingId, start: 'anytime' }, props));
  m('Click a to-do to select it, double-click to open it', null, { when: T, notes: 'On iPhone, tap once to open. An open to-do has room for notes, a checklist, tags, a date and a deadline.' });
  m('Press N, or the blue + button, to add a to-do', h1, { notes: 'New to-dos land in the list you are looking at. Drag the + button into the list to drop one exactly where you want it.' });
  m('Break a to-do into steps with a checklist', h1, { checklist: [{ id: uid(), title: 'Open this to-do', done: false }, { id: uid(), title: 'Tick this item', done: false }, { id: uid(), title: 'Press Return in an item to add another', done: false }] });
  m('Paste a list to make several to-dos at once', h1, { notes: 'Copy a few lines from anywhere and paste them into a new to-do’s title. Each line becomes its own to-do.' });
  m('Schedule a to-do with When', h2, { notes: 'Select it and press S, then type “tomorrow”, “fri”, “oct 24” or “in 2 weeks”, or pick a day.\nShortcuts: T for Today, E for This Evening, O for Someday.' });
  m('Give something a deadline', h2, { deadline: addDays(T, 5), notes: 'Press D. Deadlines count down, turn red when due, and show up in Today.' });
  m('Make a to-do repeat', h2, { notes: 'Open a to-do and choose ••• → Repeat. It can repeat on a schedule, or a set time after you finish it.' });
  m('Group projects into areas', h3, { notes: 'Areas hold the ongoing parts of your life, like Home or Work. Use New List at the bottom of the sidebar.' });
  m('Tag to-dos, then filter any list by tag', h3, { tags: [home], notes: 'Press # to tag. The tag bar at the top of each list filters it. Nest tags under each other in Settings → Manage Tags.' });
  m('Drag to-dos to reorder them, or onto the sidebar to move them', h3, { notes: 'On iPhone, press and hold a to-do, then drag. To move several at once, use ••• → Select To-Dos.' });
  m('Press / to find anything', h4);
  m('Press Q for Quick Entry', h4, { notes: 'Quick Entry reads dates and tags as you type: “Call the dentist tomorrow #Errand”.' });
  m('Press ? to see every keyboard shortcut', h4);
  m('Export a backup from Settings', h4, { notes: 'Everything stays in this browser. Export a backup now and then. When you are done exploring, remove these sample to-dos in Settings.' });
  td('Pick up dry cleaning', { start: 'inbox', tags: [errand] });
  td('Look up the library’s weekend hours', { start: 'inbox' });
  td('Plan tomorrow', { start: 'anytime', when: T, evening: true });
  td('Renew car registration', { start: 'anytime', when: addDays(T, 4), deadline: addDays(T, 10), tags: [errand] });
  td('Learn to make sourdough', { start: 'someday' });
  td('Replace the furnace filter', { start: 'anytime', areaId: homeArea.id, tags: [home] });
  const rp1 = H(room.id, 'Prep', 0), rp2 = H(room.id, 'Paint', 1);
  td('Pick a paint color', { start: 'anytime', projectId: room.id, headingId: rp1, when: addDays(T, 2) });
  td('Buy rollers and painter’s tape', { start: 'anytime', projectId: room.id, headingId: rp1, tags: [errand] });
  td('Move the furniture out', { start: 'anytime', projectId: room.id, headingId: rp2 });
  td('Two coats on the walls', { start: 'anytime', projectId: room.id, headingId: rp2 });
  td('Order seeds', { start: 'anytime', projectId: garden.id });
  td('Turn the compost', { start: 'anytime', projectId: garden.id });
  const done = td('Install Sectis', { start: 'anytime', status: 'done', completedAt: Date.now() - 864e5, logged: true });
  done.when = addDays(T, -1);
  const water = td('Water the plants', { start: 'anytime', areaId: homeArea.id, isTemplate: true });
  water.repeat = Object.assign(defaultRule(T), { freq: 'weekly', weekdays: [dow(T), (dow(T) + 3) % 7] });
  water.next = firstOccurrence(water.repeat);
  S.meta.sampleLoaded = true;
  reindex();
}

/* ---- theme ---- */
function applyTheme() {
  const t = S.settings.theme, r = document.documentElement;
  if (t === 'light' || t === 'dark') r.setAttribute('data-app-theme', t); else r.removeAttribute('data-app-theme');
}

/* ---- clock: day rollover, repeats, reminders ---- */
function tick() {
  const d = todayStr();
  if (d !== ui.today) { ui.today = d; generateRepeats(); if (!ui.editing) render(); else renderSidebar(); }
  checkReminders();
  dailyBackup();
}
function checkReminders() {
  const T = T0(), now = new Date(), hm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const fired = S.meta.fired || (S.meta.fired = {});
  let changed = false;
  for (const t of S.todos) {
    if (t.status !== 'open' || t.trashed || t.isTemplate || t.isDraft || !t.reminder || t.when !== T || t.reminder > hm) continue;
    const key = `${t.id}@${T}@${t.reminder}`;
    if (fired[key]) continue;
    fired[key] = Date.now(); changed = true;
    toast(`Reminder: ${t.title || 'New To-Do'}`, { action: 'Open', fn: () => revealTodo(t.id), ms: 15000 });
    if (S.settings.notify && 'Notification' in window && Notification.permission === 'granted') {
      try { const n = new Notification('Sectis', { body: t.title || 'To-do', tag: t.id }); n.onclick = () => { window.focus(); revealTodo(t.id); }; }
      catch (e) { if (navigator.serviceWorker) navigator.serviceWorker.ready.then((r) => r.showNotification('Sectis', { body: t.title || 'To-do', tag: t.id })).catch(() => {}); }
    }
  }
  const cutoff = Date.now() - 4 * 864e5;
  for (const k in fired) if (fired[k] < cutoff) { delete fired[k]; changed = true; }
  if (changed) saveSoon();
}

/* ---- data file (Chrome/Edge): keep to-dos in a JSON file, e.g. on a thumb drive ---- */
const fileSync = { handle: null, name: null, needsPermission: false, writing: false, pending: null };
function fileSyncSupported() { return !IN_FRAME && typeof window.showSaveFilePicker === 'function' && 'indexedDB' in window; }
function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sectis', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { const db = req.result; const tx = db.transaction('kv', mode); const st = tx.objectStore('kv'); const r = fn(st); tx.oncomplete = () => { resolve(r && 'result' in r ? r.result : undefined); db.close(); }; tx.onerror = () => reject(tx.error); };
  });
}
const idbGet = (k) => idb('readonly', (s) => s.get(k));
const idbSet = (k, v) => idb('readwrite', (s) => s.put(v, k));
const idbDel = (k) => idb('readwrite', (s) => s.delete(k));
async function fileSyncInit() {
  if (!fileSyncSupported()) return;
  try {
    const h = await idbGet('dataFile'); if (!h) return;
    fileSync.handle = h; fileSync.name = h.name;
    const p = await h.queryPermission({ mode: 'readwrite' });
    if (p === 'granted') await fileSyncLoad(); else { fileSync.needsPermission = true; showFileBanner(); }
  } catch (e) { /* no stored file */ }
}
async function fileSyncLoad() {
  const text = await (await fileSync.handle.getFile()).text();
  if (text.trim()) {
    const data = JSON.parse(text);
    if (Array.isArray(data.todos) && (data.savedAt || 0) > (S.savedAt || 0)) { S = normalizeState(data); reindex(); generateRepeats(); lsSet(STORE_KEY, JSON.stringify(S)); render(); toast(`Loaded ${fileSync.name}`); return; }
  }
  fileSyncWrite(JSON.stringify(S));
}
function fileSyncWrite(json) {
  if (!fileSync.handle || fileSync.needsPermission) return;
  fileSync.pending = json;
  if (fileSync.writing) return;
  fileSync.writing = true;
  (async () => {
    while (fileSync.pending) {
      const data = fileSync.pending; fileSync.pending = null;
      try { const w = await fileSync.handle.createWritable(); await w.write(data); await w.close(); }
      catch (e) { fileSync.needsPermission = true; showFileBanner(); break; }
    }
    fileSync.writing = false;
  })();
}
const FILE_TYPES = [{ description: 'Sectis data', accept: { 'application/json': ['.json'] } }];
async function fileSyncCreate() {
  try {
    const h = await window.showSaveFilePicker({ suggestedName: 'sectis-data.json', types: FILE_TYPES });
    Object.assign(fileSync, { handle: h, name: h.name, needsPermission: false });
    await idbSet('dataFile', h); saveNow(); toast(`Now saving to ${h.name}`);
  } catch (e) { if (e.name !== 'AbortError') toast('That file can’t be used. Try another folder.'); }
}
async function fileSyncOpen() {
  try {
    const [h] = await window.showOpenFilePicker({ types: FILE_TYPES });
    const text = await (await h.getFile()).text();
    let data = null;
    if (text.trim()) { data = JSON.parse(text); if (!data || !Array.isArray(data.todos)) throw new Error('not sectis'); }
    if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') { toast('Sectis needs permission to save to that file'); return; }
    Object.assign(fileSync, { handle: h, name: h.name, needsPermission: false });
    await idbSet('dataFile', h);
    if (data) {
      const ok = await confirmDialog({ title: 'Use the to-dos in this file?', body: `${esc(h.name)} has ${plural(data.todos.filter((t) => !t.trashed && !t.isTemplate).length, 'to-do')}. They’ll replace what’s in this browser right now (you can undo).`, ok: 'Use File' });
      if (ok) { commit('Open Data File', () => { S = normalizeState(data); }); navigate('today'); } else saveNow();
    } else saveNow();
    toast(`Now saving to ${h.name}`);
  } catch (e) { if (e.name !== 'AbortError') toast('That file couldn’t be read as Sectis data'); }
}
async function fileSyncReconnect() {
  if (!fileSync.handle) return;
  try { if ((await fileSync.handle.requestPermission({ mode: 'readwrite' })) === 'granted') { fileSync.needsPermission = false; hideFileBanner(); await fileSyncLoad(); } }
  catch (e) { toast('Couldn’t reconnect the file. Is the drive plugged in?'); }
}
async function fileSyncUnlink() {
  Object.assign(fileSync, { handle: null, name: null, needsPermission: false });
  try { await idbDel('dataFile'); } catch (e) { /* ignore */ }
  hideFileBanner(); toast('Disconnected. Your to-dos stay in this browser.');
}
function showFileBanner() {
  const b = $('#banner'); if (!b) return;
  b.innerHTML = `<div class="banner">${ic('file')}<span>Allow Sectis to keep saving to <b>${esc(fileSync.name || 'your data file')}</b>.</span><button class="btn primary" data-fs="reconnect">Reconnect</button><button class="btn" data-fs="unlink">Disconnect</button></div>`;
  b.hidden = false;
  b.onclick = (e) => { const x = e.target.closest('[data-fs]'); if (!x) return; if (x.dataset.fs === 'reconnect') fileSyncReconnect(); else fileSyncUnlink(); };
}
function hideFileBanner() { const b = $('#banner'); if (b) { b.hidden = true; b.innerHTML = ''; } }

/* ---- start ---- */
function restoreView() {
  const fromHash = (location.hash || '').replace('#', '');
  const key = (LISTS[fromHash] && fromHash) || lsGet('sectis.view') || 'today';
  const [type, id] = key.split(':');
  if (LISTS[type]) ui.view = { type };
  else if (type === 'project' && id && getP(id) && !getP(id).trashed) ui.view = { type, id };
  else if (type === 'area' && id && getA(id)) ui.view = { type, id };
  else ui.view = { type: 'today' };
}
function init() {
  loadState();
  loadExpanded();
  syncLoadState();
  restoreView();
  ui.mobile = isMobile() && !LISTS[(location.hash || '').slice(1)] ? 'home' : 'list';
  dragInit();
  if (Y.enabled && syncAvailable()) {
    // pull the other devices' changes before making today's repeating copies
    render();
    syncStart().then(() => { generateRepeats(); render(); });
  } else { generateRepeats(); render(); }
  setInterval(tick, 20000);
  setTimeout(checkReminders, 1500);
  setTimeout(dailyBackup, 6000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  mq.addEventListener && mq.addEventListener('change', () => { if (!isMobile()) ui.mobile = 'list'; render(); });
  window.addEventListener('resize', debounce(() => { if (layers.length) layers.forEach((L) => L.el.classList.contains('pop') && placePop(L.el, L.anchor)); }, 120));
  fileSyncInit();
  if (typeof SECTIS_WEB !== 'undefined' && SECTIS_WEB && !IN_FRAME && 'serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (updatesAvailable()) {
    setTimeout(() => checkForUpdate(), 4000);
    setInterval(() => checkForUpdate(), 3 * 3600e3);
    const onFront = () => { if (document.visibilityState === 'visible' && Date.now() - upd.checkedAt > 15 * 60e3) checkForUpdate(); };
    document.addEventListener('visibilitychange', onFront);
    window.addEventListener('focus', onFront);
  }
}

/* ---- updates: an installed copy (Dock or Home Screen) can stay open for days,
   so it checks for a newer version and offers to load it ---- */
const upd = { checkedAt: 0, latest: null, offered: null };
function updatesAvailable() { return typeof SECTIS_WEB !== 'undefined' && SECTIS_WEB && !IN_FRAME && /^https?:/.test(location.protocol); }
function newerVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}
async function checkForUpdate(manual) {
  if (!updatesAvailable()) return null;
  upd.checkedAt = Date.now();
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('bad response');
    const v = (await r.json()).version;
    upd.latest = v;
    if (v && newerVersion(v, APP_VERSION)) {
      const msg = `Sectis ${v} is available`;
      if (manual || !$$('#toasts .t-msg').some((m) => m.textContent === msg)) {
        upd.offered = v;
        toast(msg, { action: 'Update Now', fn: applyUpdate, ms: 30 * 60e3 });
      }
      return v;
    }
    return false;
  } catch (e) { return null; }
}
async function applyUpdate() {
  toast('Updating…', { ms: 8000 });
  try { saveNow(); } catch (e) { /* ignore */ }
  try { if (typeof syncSaveState === 'function' && Y.enabled) syncSaveState(); } catch (e) { /* ignore */ }
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) await Promise.race([reg.update(), new Promise((res) => setTimeout(res, 5000))]);
  } catch (e) { /* ignore */ }
  try { // drop the old version's saved files so the reload can't fall back to them
    const keep = `sectis-${upd.latest}`;
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('sectis-') && k !== keep).map((k) => caches.delete(k)));
  } catch (e) { /* ignore */ }
  try { await fetch(location.pathname, { cache: 'reload' }); } catch (e) { /* refresh the browser's copy of the page */ }
  location.reload();
}
