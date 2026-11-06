/* ===================== Sync (Firebase Firestore) =====================
   No accounts. A random sync key decides where the data lives in Firestore
   (a hash of it) and encrypts every record (AES-GCM) before upload.
   Each to-do, project, area and tag is its own document (headings still arrive from a device on
   an older version, and become sub-projects here); the most
   recent edit of an item wins. Deletions leave a small marker.
   Two rules keep an old copy from coming back over a newer one:
   - When Sectis opens, the other devices' changes come in before anything here is sent. What
     looks changed here at that point (an edit made while closed, or a field this version reads
     differently) goes up as "the next version of what this device last saw", so it only wins
     if nobody changed that item since. Edits after that are stamped as they're made.
   - Sending never overwrites a copy that's as new or newer: that one comes here instead.
   After an update each device compares everything once (and Settings → Sync → Check
   Everything does it any time): anything that never arrived comes in, and anything an older
   copy overwrote goes back up. */
const SYNC_KEY = 'sectis.sync.v1';
const FB_VERSION = '10.14.1';
const SYNC_KINDS = { todo: 'todos', project: 'projects', heading: 'headings', area: 'areas', tag: 'tags', smart: 'smart', focus: 'focuses', note: 'notes' };
const Y = {
  enabled: false, cfg: null, key: null, space: null, base: {}, pending: {}, cursor: [0, 0], lastSync: 0,
  status: 'off', error: '', db: null, col: null, aes: null, unsub: null, pushing: false, again: false,
  queue: Promise.resolve(), firstPull: null, hints: {}, applying: false,
  pulled: false, // the other devices' changes are in (or can't be: offline), so edits here can be stamped
};
const SYNC_CHECK = '1.44.0'; // compare everything once after updating to this
const syncAvailable = () => SECTIS_WEB && !IN_FRAME && !!(window.crypto && crypto.subtle);

/* ---- small helpers ---- */
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
const recHash = (rec) => fnv(canon(rec));
function b64(bytes) { let s = ''; const a = new Uint8Array(bytes); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const s = atob(str); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
const utf8 = (s) => new TextEncoder().encode(s);
async function sha256hex(s) { const h = await crypto.subtle.digest('SHA-256', utf8(s)); return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join(''); }
function newSyncKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(26)), A = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(bytes, (b) => A[b % 32]).join('');
}
function syncHint(id) { Y.hints[id] = pd(T0()).getTime(); }

function syncSaveState() {
  if (!Y.enabled) { lsSet(SYNC_KEY, JSON.stringify({ enabled: false })); return; }
  lsSet(SYNC_KEY, JSON.stringify({ enabled: true, cfg: Y.cfg, key: Y.key, base: Y.base, pending: Y.pending, cursor: Y.cursor, lastSync: Y.lastSync }));
}
const syncSaveSoon = debounce(syncSaveState, 400);
window.addEventListener('pagehide', () => { if (Y.enabled) syncSaveSoon.flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && Y.enabled) syncSaveSoon.flush(); });
function syncLoadState() {
  try { const s = JSON.parse(lsGet(SYNC_KEY) || 'null'); if (s && s.enabled && s.cfg && s.key) Object.assign(Y, { enabled: true, cfg: s.cfg, key: s.key, base: s.base || {}, pending: s.pending || {}, cursor: s.cursor || [0, 0], lastSync: s.lastSync || 0 }); } catch (e) { /* ignore */ }
}

/* ---- Firebase config & join codes ---- */
function parseFirebaseConfig(text) {
  const t = String(text || '').trim(); if (!t) return null;
  let cfg = null;
  try { const j = JSON.parse(t); if (j && typeof j === 'object') cfg = j; } catch (e) { /* not JSON */ }
  if (!cfg) { cfg = {}; t.replace(/["']?(\w+)["']?\s*:\s*["']([^"']+)["']/g, (m, k, v) => { cfg[k] = v; return m; }); }
  if (!cfg.apiKey || !cfg.projectId) return null;
  const out = { apiKey: cfg.apiKey, projectId: cfg.projectId };
  if (cfg.appId) out.appId = cfg.appId;
  out.authDomain = cfg.authDomain || `${cfg.projectId}.firebaseapp.com`;
  return out;
}
function makeJoinCode() {
  const json = JSON.stringify({ c: Y.cfg, k: Y.key });
  return 'SECTIS-' + btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function readJoinCode(code) {
  try {
    const raw = String(code || '').replace(/\s+/g, '').replace(/^SECTIS-/i, '').replace(/-/g, '+').replace(/_/g, '/');
    const j = JSON.parse(decodeURIComponent(escape(atob(raw + '==='.slice((raw.length + 3) % 4)))));
    if (j && j.c && j.c.apiKey && j.c.projectId && j.k && j.k.length >= 20) return { cfg: j.c, key: j.k };
  } catch (e) { /* fall through */ }
  return null;
}

/* ---- connection ---- */
function loadScript(src) {
  return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('Couldn’t download the sync library. Check your internet connection.')); document.head.append(s); });
}
async function loadFirebase() {
  if (window.firebase && window.firebase.firestore) return window.firebase;
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;
  await loadScript(`${base}/firebase-app-compat.js`);
  await loadScript(`${base}/firebase-firestore-compat.js`);
  return window.firebase;
}
async function syncConnect(cfg, key) {
  const fb = await loadFirebase();
  try { const old = fb.apps && fb.apps.find((a) => a.name === 'sectis'); if (old) await old.delete(); } catch (e) { /* ignore */ }
  const app = fb.initializeApp(cfg, 'sectis');
  const db = app.firestore();
  const space = (await sha256hex('sectis-space|' + key)).slice(0, 40);
  const material = await crypto.subtle.importKey('raw', utf8(key), 'PBKDF2', false, ['deriveKey']);
  const aes = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: utf8('sectis-sync-v1|' + space), iterations: 150000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { fb, db, space, aes, col: db.collection('sectis').doc(space).collection('items') };
}
async function encryptRec(rec) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, Y.aes, utf8(JSON.stringify(rec)));
  return { c: b64(ct), iv: b64(iv) };
}
async function decryptRec(doc) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(doc.iv) }, Y.aes, unb64(doc.c));
  return JSON.parse(new TextDecoder().decode(pt));
}
function friendlySyncError(e) {
  const code = (e && (e.code || e.name)) || '';
  if (/permission/i.test(code)) return 'Your Firestore rules don’t allow Sectis yet. Add the Sectis rules in the Firebase console (Settings → Sync → How to set up).';
  if (/unavailable|network|timeout/i.test(code) || /network|timed out|internet/i.test((e && e.message) || '')) return 'Can’t reach Firebase right now. Changes are kept and will sync when you’re back online.';
  if (/not-found/i.test(code)) return 'This Firebase project has no Firestore database yet. Create one in the Firebase console.';
  if (/invalid-api-key|api-key/i.test(code + ((e && e.message) || ''))) return 'Firebase didn’t accept that config. Copy it again from Project settings → Your apps.';
  return (e && e.message) || 'Sync stopped because of an unexpected error.';
}
function setSyncStatus(status, error = '') {
  Y.status = status; Y.error = error;
  renderSyncIndicator();
  const el = document.getElementById('sync-status'); if (el) el.innerHTML = syncStatusText();
}
function syncStatusText() {
  if (!Y.enabled) return 'Off';
  if (Y.status === 'error') return `<span class="warn">${esc(Y.error)}</span>`;
  if (Y.status === 'offline') return 'Offline. Changes will sync when you reconnect.';
  if (Y.status === 'connecting') return 'Connecting…';
  if (Y.status === 'syncing') return 'Syncing…';
  const pend = Object.keys(Y.pending).length;
  return `On${Y.lastSync ? ` · last synced ${esc(relTime(Y.lastSync))}` : ''}${pend ? ` · ${plural(pend, 'change')} waiting` : ''}`;
}
function relTime(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`;
  return new Date(ms).toLocaleDateString();
}
function renderSyncIndicator() {
  const el = document.getElementById('sync-ind'); if (!el) return;
  el.hidden = !Y.enabled;
  el.className = `ib sync-ind ${Y.status}`;
  el.title = Y.enabled ? `Sync Now\n${syncStatusText().replace(/<[^>]+>/g, '')}` : '';
}

/* ---- pushing local changes ---- */
function syncRecords() {
  const out = new Map();
  for (const [kind, list] of Object.entries(SYNC_KINDS)) for (const r of S[list]) if (r && r.id && !r.isDraft) out.set(r.id, { k: kind, rec: r });
  return out;
}
/* startup: what changed here before the other devices' changes came in is only the next version
   of what this device last saw (it loses to anything newer), not an edit made now */
function syncDiff(startup = false) {
  const recs = syncRecords(), now = Date.now(); let changed = false;
  for (const [id, { k, rec }] of recs) {
    const h = recHash(rec), b = Y.base[id];
    if (b && !b.d && b.h === h) continue;
    const bm = (b && b.m) || 0;
    const m = Y.hints[id] ? Math.max(Y.hints[id], bm + 1) : startup && b ? Math.max(bm + 1, (Y.pending[id] && Y.pending[id].m) || 0) : Math.max(now, bm + 1);
    Y.pending[id] = { k, m }; Y.base[id] = { h, m, k }; changed = true;
  }
  for (const id of Object.keys(Y.base)) {
    const b = Y.base[id];
    if (recs.has(id) || b.d) continue;
    const m = startup ? (b.m || 0) + 1 : Math.max(now, (b.m || 0) + 1);
    Y.pending[id] = { k: b.k, m, d: true }; Y.base[id] = { h: '', m, k: b.k, d: true }; changed = true;
  }
  Y.hints = {};
  if (changed) syncSaveSoon();
  return changed;
}
function syncLocalSaved() {
  if (!Y.enabled || Y.applying || !Y.pulled) return; // until then, syncReady picks the changes up
  if (syncDiff() && Y.col) pushSoon(); // offline, they wait (stamped when made) for the connection
}
/* the other devices' changes are in, or can't come in yet: from now on edits are stamped as made */
function syncReady() {
  if (Y.pulled || !Y.enabled) return;
  Y.pulled = true;
  if (syncDiff(true) && Y.col) pushSoon();
}
const pushSoon = debounce(() => syncPush(), 600);
function withTimeout(p, ms, msg) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(msg), { code: 'timeout' })), ms))]); }
async function syncPush() {
  if (!Y.enabled || !Y.col) return;
  if (Y.pushing) { Y.again = true; return; }
  const ids = Object.keys(Y.pending);
  if (!ids.length) { if (Y.status === 'syncing') setSyncStatus('synced'); return; }
  Y.pushing = true; setSyncStatus('syncing');
  try {
    const recs = syncRecords(), newer = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200), pend = {}, enc = {};
      for (const id of chunk) {
        const p = Y.pending[id]; if (!p) continue;
        pend[id] = p; const r = recs.get(id);
        if (r && !p.d) enc[id] = await encryptRec(r.rec);
      }
      const want = Object.keys(pend); if (!want.length) continue;
      let sent = {}, kept = [];
      // in one transaction: read what's there, and write only over older copies
      await withTimeout(Y.db.runTransaction(async (tx) => {
        sent = {}; kept = [];
        const refs = want.map((id) => Y.col.doc(id)), snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
        want.forEach((id, j) => {
          const p = pend[id], cur = snaps[j].exists ? snaps[j].data() : null;
          if (cur && typeof cur.m === 'number' && cur.m >= p.m) { kept.push(Object.assign({ id }, cur)); return; } // as new or newer: theirs stays
          const ts = Y.fb.firestore.FieldValue.serverTimestamp();
          if (enc[id] && !p.d) tx.set(refs[j], Object.assign({ k: p.k, m: p.m, d: false, t: ts }, enc[id]));
          else tx.set(refs[j], { k: p.k, m: p.m, d: true, c: '', iv: '', t: ts });
          sent[id] = p.m;
        });
      }), 20000, 'Sync timed out');
      for (const id of Object.keys(sent)) if (Y.pending[id] && Y.pending[id].m === sent[id]) delete Y.pending[id];
      newer.push(...kept);
    }
    if (newer.length) await syncApplyRemote(newer, { theirs: true }); // the newer copies replace ours here
    Y.lastSync = Date.now(); syncSaveState();
    setSyncStatus('synced');
  } catch (e) {
    setSyncStatus(navigator.onLine === false || (e && e.code === 'timeout') ? 'offline' : 'error', friendlySyncError(e));
  } finally {
    Y.pushing = false;
    if (Y.again) { Y.again = false; setTimeout(syncPush, 50); }
  }
}

/* ---- pulling remote changes ---- */
function normalizeRecord(kind, rec) {
  if (kind === 'todo') return Object.assign(newTodoShape(), rec, { tags: rec.tags || [], checklist: rec.checklist || [] });
  if (kind === 'project') return Object.assign(newProjectShape(), rec, { tags: rec.tags || [] });
  if (kind === 'area') return Object.assign({ title: '', tags: [], order: 0 }, rec, { tags: rec.tags || [] });
  if (kind === 'focus') return normalizeFocus(rec);
  if (kind === 'note') return normalizeNote(rec);
  return rec;
}
function tsAfter(t, cur) { return t.seconds > cur[0] || (t.seconds === cur[0] && t.nanoseconds > cur[1]); }
/* opts.theirs: copies the server kept over ours (as new or newer): they win even on a tie */
async function syncApplyRemote(docs, opts = {}) {
  const updates = [];
  let converted = false;
  let cursor = Y.cursor;
  for (const d of docs) {
    if (d.t && typeof d.t.seconds === 'number' && tsAfter(d.t, cursor)) cursor = [d.t.seconds, d.t.nanoseconds];
    if (!SYNC_KINDS[d.k]) continue;
    const b = Y.base[d.id];
    if (b && (opts.theirs ? d.m < b.m : d.m <= b.m)) { if (Y.pending[d.id] && Y.pending[d.id].m === d.m) delete Y.pending[d.id]; continue; }
    let rec = null;
    if (!d.d) { try { rec = await decryptRec(d); } catch (e) { continue; } }
    updates.push({ id: d.id, k: d.k, m: d.m, d: !!d.d, rec });
  }
  if (updates.length) {
    Y.applying = true;
    try {
      for (const u of updates) {
        const list = S[SYNC_KINDS[u.k]];
        const i = list.findIndex((x) => x.id === u.id);
        if (u.d) { if (i >= 0) list.splice(i, 1); Y.base[u.id] = { h: '', m: u.m, k: u.k, d: true }; }
        else { const rec = normalizeRecord(u.k, u.rec); if (i >= 0) list[i] = rec; else list.push(rec); Y.base[u.id] = { h: recHash(rec), m: u.m, k: u.k }; }
        delete Y.pending[u.id];
      }
      converted = convertHeadings(); // a heading from a device on an older version becomes a sub-project
      reindex();
      for (const id of [...ui.sel]) if (!itemById(id)) ui.sel.delete(id);
      if (ui.editing && !getT(ui.editing)) ui.editing = null;
      undoStack.length = 0; // undo would otherwise roll back changes made on the other device
      S.savedAt = Date.now(); lsSet(STORE_KEY, JSON.stringify(S));
      if (typeof fileSyncWrite === 'function') fileSyncWrite(JSON.stringify(S));
    } finally { Y.applying = false; }
    if (!opts.theirs) Y.cursor = cursor; // (copies read while sending don't move it: changes before them may still be on the way)
    syncSaveState();
    if (converted) saveSoon(); // send the sub-projects back out
    render();
  } else if (!opts.theirs) Y.cursor = cursor;
  Y.lastSync = Date.now(); syncSaveSoon();
  if (Y.status !== 'error' && !Y.pushing) setSyncStatus('synced'); else renderSyncIndicator();
}
function syncListen() {
  if (Y.unsub) { try { Y.unsub(); } catch (e) { /* ignore */ } }
  let resolveFirst; Y.firstPull = new Promise((r) => { resolveFirst = r; });
  const since = new Y.fb.firestore.Timestamp(Y.cursor[0], Y.cursor[1]);
  Y.unsub = Y.col.where('t', '>', since).orderBy('t').onSnapshot((snap) => {
    const docs = snap.docChanges().filter((c) => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites).map((c) => Object.assign({ id: c.doc.id }, c.doc.data()));
    Y.queue = Y.queue.then(() => syncApplyRemote(docs)).catch(() => {}).then(() => resolveFirst());
  }, (err) => { setSyncStatus('error', friendlySyncError(err)); resolveFirst(); });
  return Y.firstPull;
}

/* ---- start, set up, join, stop ---- */
async function syncStart() {
  if (!Y.enabled || !syncAvailable()) return;
  setSyncStatus('connecting');
  if (navigator.onLine === false) syncReady(); // nothing can come in: stamp edits as they're made
  try {
    const c = await syncConnect(Y.cfg, Y.key);
    Object.assign(Y, c);
    const first = syncListen();
    // the other devices' changes first (a slow connection gets 20 seconds); then what changed here goes up
    const came = await Promise.race([first.then(() => true), new Promise((r) => setTimeout(() => r(false), 20000))]);
    syncReady(); pushSoon();
    if (came && lsGet('sectis.sync.check') !== SYNC_CHECK) syncCheckAll().then((r) => { if (r) lsSet('sectis.sync.check', SYNC_CHECK); }).catch(() => {});
  } catch (e) {
    syncReady();
    setSyncStatus(navigator.onLine === false ? 'offline' : 'error', friendlySyncError(e));
  }
}
/* compare everything with what's in Firebase: what another device changed that never arrived
   comes in, and what's newer here than there (an older copy overwrote it) goes back up */
async function syncCheckAll() {
  if (!Y.enabled || !Y.col) return null;
  setSyncStatus('syncing');
  const snap = await withTimeout(Y.col.get(), 60000, 'Timed out');
  const recs = syncRecords(), seen = new Set(), theirs = [];
  let up = 0;
  snap.forEach((doc) => {
    const d = Object.assign({ id: doc.id }, doc.data()); seen.add(d.id);
    if (!SYNC_KINDS[d.k] || typeof d.m !== 'number' || Y.pending[d.id]) return;
    const b = Y.base[d.id];
    if (!b || d.m > b.m) theirs.push(d);
    else if (d.m < b.m && (b.d || recs.has(d.id))) { Y.pending[d.id] = b.d ? { k: b.k, m: b.m, d: true } : { k: b.k, m: b.m }; up++; }
  });
  for (const [id, b] of Object.entries(Y.base)) if (!seen.has(id) && !Y.pending[id] && (b.d || recs.has(id))) { Y.pending[id] = b.d ? { k: b.k, m: b.m, d: true } : { k: b.k, m: b.m }; up++; }
  const down = theirs.length;
  if (down) await syncApplyRemote(theirs);
  if (up) { syncSaveState(); await syncPush(); }
  if (Y.status === 'syncing') setSyncStatus('synced');
  return { up, down };
}
async function syncSetup(cfg) {
  const key = newSyncKey();
  const c = await syncConnect(cfg, key);
  Object.assign(Y, c, { enabled: true, cfg, key, base: {}, pending: {}, cursor: [0, 0], lastSync: 0, hints: {}, pulled: true });
  syncDiff();
  setSyncStatus('syncing');
  await syncPushOrThrow();
  syncSaveState(); syncListen();
  setSyncStatus('synced');
}
async function syncPushOrThrow() {
  await syncPush();
  if (Y.status === 'error' || Y.status === 'offline') { const msg = Y.error; syncStopLocal(); throw new Error(msg); }
}
async function syncJoin(code) {
  const j = readJoinCode(code);
  if (!j) throw new Error('That doesn’t look like a Sectis join code. Copy the whole code from Settings → Sync on your other device.');
  const c = await syncConnect(j.cfg, j.key);
  let hasRemote = false;
  try { const snap = await withTimeout(c.col.limit(1).get(), 15000, 'Timed out'); hasRemote = !snap.empty; }
  catch (e) { throw new Error(friendlySyncError(e)); }
  let mode = 'merge';
  if (hasRemote) {
    const localReal = S.todos.some((t) => !t.sample && !t.isDraft) || S.projects.some((p) => !p.sample) || S.areas.some((a) => !a.sample);
    if (localReal) {
      const r = await choiceDialog({ title: 'This device already has to-dos', body: 'Keep them and add them to the synced list, or replace them with what’s already synced?', choices: [{ id: 'replace', label: 'Use Synced To-Dos' }, { id: 'merge', label: 'Keep Both', primary: true }] });
      if (!r) throw Object.assign(new Error(''), { quiet: true });
      mode = r;
    } else mode = 'replace';
  }
  if (mode === 'replace' && hasRealData()) await makeBackup('join');
  snapshot('Join Sync');
  if (mode === 'replace') { for (const list of Object.values(SYNC_KINDS)) S[list] = []; reindex(); }
  else if (hasRemote) dropSampleData(); // the other device already has the tour
  Object.assign(Y, c, { enabled: true, cfg: j.cfg, key: j.key, base: {}, pending: {}, cursor: [0, 0], lastSync: 0, hints: {}, pulled: true });
  setSyncStatus('syncing');
  await Promise.race([syncListen(), new Promise((r) => setTimeout(r, 15000))]);
  if (mode === 'merge') dedupeTags();
  syncDiff(); syncSaveState();
  await syncPush();
  generateRepeats();
  saveNow(); render();
  if (Y.status !== 'error') setSyncStatus('synced');
  return mode;
}
function dedupeTags() {
  const seen = new Map(), remap = {};
  for (const t of S.tags.slice().sort((a, b) => ((Y.base[a.id] && !Y.pending[a.id]) ? 0 : 1) - ((Y.base[b.id] && !Y.pending[b.id]) ? 0 : 1))) {
    const k = t.title.trim().toLowerCase();
    if (seen.has(k)) remap[t.id] = seen.get(k); else seen.set(k, t.id);
  }
  if (!Object.keys(remap).length) return;
  S.tags = S.tags.filter((t) => !remap[t.id]);
  S.tags.forEach((t) => { if (remap[t.parentId]) t.parentId = remap[t.parentId]; });
  S.todos.concat(S.projects, S.areas).forEach((x) => { if (x.tags.some((id) => remap[id])) x.tags = Array.from(new Set(x.tags.map((id) => remap[id] || id))); });
  reindex();
}
/* Sync Now (the cloud in the sidebar, and Settings → Sync): send what changed here, then ask
   for anything new from the other devices. A second click while one runs waits for that one. */
let syncNowRun = null;
function syncNow() {
  if (syncNowRun) return syncNowRun;
  syncNowRun = (async () => {
    if (!Y.enabled) return;
    if (navigator.onLine === false) { setSyncStatus('offline'); return; }
    if (Y.status === 'connecting' || (Y.col && !Y.pulled)) return; // Sectis is still bringing in the other devices' changes
    if (!Y.col) { await syncStart(); if (Y.col && Y.pulled) await syncPush(); return; } // never connected (or couldn't): start over
    syncDiff(); setSyncStatus('syncing');
    await syncPush();
    if (Y.status !== 'error') setSyncStatus('syncing'); // keep the cloud busy until the other devices' changes are in
    await Promise.race([syncListen(), new Promise((r) => setTimeout(r, 15000))]);
    if (Y.status === 'syncing') setSyncStatus('synced');
  })().catch((e) => setSyncStatus(navigator.onLine === false ? 'offline' : 'error', friendlySyncError(e))).finally(() => { syncNowRun = null; });
  return syncNowRun;
}
/* the cloud: sync, then say how it went (there's no tooltip on iPhone) */
async function syncNowFromCloud() {
  if (!Y.enabled) return;
  const starting = Y.status === 'connecting' || (Y.col && !Y.pulled);
  await syncNow();
  if (starting || Y.status === 'connecting') toast('Still connecting. Your changes will sync in a moment.');
  else if (Y.status === 'error') toast(Y.error || 'Sync didn’t work.', { action: 'Settings', fn: openSettings, ms: 7000 });
  else if (Y.status === 'offline') toast('You’re offline. Changes will sync when you reconnect.');
  else { const pend = Object.keys(Y.pending).length; toast(pend ? `Synced. ${plural(pend, 'change')} still waiting.` : 'Synced.'); }
}
function syncStopLocal() {
  if (Y.unsub) { try { Y.unsub(); } catch (e) { /* ignore */ } }
  Object.assign(Y, { enabled: false, cfg: null, key: null, space: null, base: {}, pending: {}, cursor: [0, 0], lastSync: 0, db: null, col: null, aes: null, unsub: null });
  syncSaveState(); setSyncStatus('off');
}
window.addEventListener('online', () => { if (Y.enabled) { if (!Y.col) syncStart(); else { setSyncStatus('syncing'); syncPush(); } } });
window.addEventListener('offline', () => { if (Y.enabled) setSyncStatus('offline'); });

/* ---- settings UI ---- */
const SYNC_RULES = `match /sectis/{space}/items/{item} {
  allow read: if space.size() >= 40;
  allow create, update: if space.size() >= 40
    && request.resource.data.keys().hasOnly(['k', 'm', 'd', 'c', 'iv', 't'])
    && request.resource.data.c is string
    && request.resource.data.c.size() < 500000;
}`;
function syncSettingsHTML() {
  if (!syncAvailable()) return `<p class="note" style="margin:0">Sync works in the installed Sectis app (from GitHub Pages), not in this preview.</p>`;
  if (!Y.enabled) return `<div class="set-row"><span class="lbl">Keep your Mac and iPhone in step through your own Firebase project. To-dos are encrypted before they leave this device.</span></div>
    <div class="set-btns"><button class="btn primary" data-s="sync-setup">Set Up Sync…</button><button class="btn" data-s="sync-join">Join with a Code…</button></div>`;
  return `<div class="set-row"><span class="lbl">Status<small id="sync-status">${syncStatusText()}</small></span></div>
    <div class="set-btns"><button class="btn" data-s="sync-code">Add Another Device…</button><button class="btn" data-s="sync-now">Sync Now</button><button class="btn" data-s="sync-check" title="Compare everything on this device with what’s synced, and fix anything that’s out of step">Check Everything</button><button class="btn" data-s="sync-off">Turn Off on This Device…</button></div>`;
}
function copyText(text, el, note) {
  const done = (msg) => { if (note) note.textContent = msg; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done('Copied.'), () => { if (el) { el.focus(); el.select(); } done('Press ' + MODK + 'C to copy the selected text.'); });
  else { if (el) { el.focus(); el.select(); } done('Press ' + MODK + 'C to copy the selected text.'); }
}
function openSyncSetup() {
  const L = openLayer({ modal: true, html: `<div class="modal-h"><h2>Set Up Sync</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div><div class="modal-b">
    <ol class="steps">
      <li>Open <b>console.firebase.google.com</b> and pick your budget ledger project (or create a new one).</li>
      <li>Click the gear → <b>Project settings</b>. Under <b>Your apps</b>, copy the <code>firebaseConfig</code> block. If there’s no web app yet, click <b>&lt;/&gt;</b> to add one first.</li>
      <li>Open <b>Firestore Database → Rules</b>. Paste the Sectis rules below inside the line <code>match /databases/{database}/documents {</code>, then click <b>Publish</b>.</li>
      <li>Paste the config here and turn sync on.</li>
    </ol>
    <div class="rules-box"><pre id="sy-rules">${esc(SYNC_RULES)}</pre><button class="btn" data-sy="copy-rules">Copy Rules</button></div>
    <label class="note" for="sy-cfg" style="display:block;margin:14px 0 6px">Firebase config</label>
    <textarea class="ta" id="sy-cfg" placeholder="const firebaseConfig = { apiKey: &quot;…&quot;, projectId: &quot;…&quot;, … };" aria-label="Firebase config" style="min-height:110px"></textarea>
    <p class="note" id="sy-note"></p></div>
    <div class="modal-f"><button class="btn" data-action="close-layer">Cancel</button><button class="btn primary" id="sy-go">Turn On Sync</button></div>`,
    onMount: (el) => {
      const note = $('#sy-note', el), go = $('#sy-go', el);
      el.addEventListener('click', async (e) => {
        if (e.target.closest('[data-sy="copy-rules"]')) { copyText(SYNC_RULES, null, note); return; }
        if (e.target !== go) return;
        const cfg = parseFirebaseConfig($('#sy-cfg', el).value);
        note.classList.remove('warn');
        if (!cfg) { note.textContent = 'Paste the whole config block. It needs at least apiKey and projectId.'; note.classList.add('warn'); return; }
        go.disabled = true; note.textContent = 'Connecting and uploading your to-dos…';
        try { await syncSetup(cfg); closeLayer(L); openJoinCode(true); }
        catch (err) { note.textContent = err.message || 'Sync couldn’t start.'; note.classList.add('warn'); go.disabled = false; }
      });
    } });
}
function openJoinCode(fresh) {
  const code = makeJoinCode();
  openLayer({ modal: true, html: `<div class="modal-h"><h2>${fresh ? 'Sync Is On' : 'Add Another Device'}</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div><div class="modal-b">
    <p style="margin-top:0">On your iPhone (or another Mac), open Sectis, go to <b>Settings → Sync → Join with a Code</b>, and paste this code. With Universal Clipboard, copying here lets you paste straight onto your iPhone.</p>
    <textarea class="ta" id="jc-ta" readonly aria-label="Join code" style="min-height:90px">${esc(code)}</textarea>
    <p class="note" id="jc-note">The code also unlocks your encrypted to-dos, so keep it private. Anyone with it can read and change your list.</p></div>
    <div class="modal-f"><button class="btn" data-action="close-layer">Done</button><button class="btn primary" data-jc="copy">Copy Code</button></div>`,
    onMount: (el) => el.addEventListener('click', (e) => { if (e.target.closest('[data-jc]')) copyText(code, $('#jc-ta', el), $('#jc-note', el)); }) });
}
function openSyncJoin() {
  const L = openLayer({ modal: true, html: `<div class="modal-h"><h2>Join Sync</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div><div class="modal-b">
    <p style="margin-top:0">On the device that already syncs, open <b>Settings → Sync → Add Another Device</b> and copy the code. Paste it here.</p>
    <textarea class="ta" id="jn-ta" placeholder="SECTIS-…" aria-label="Join code" style="min-height:90px"></textarea><p class="note" id="jn-note"></p></div>
    <div class="modal-f"><button class="btn" data-action="close-layer">Cancel</button><button class="btn primary" id="jn-go">Join</button></div>`,
    onMount: (el) => {
      const note = $('#jn-note', el), go = $('#jn-go', el);
      go.addEventListener('click', async () => {
        note.classList.remove('warn'); go.disabled = true; note.textContent = 'Connecting…';
        try { const mode = await syncJoin($('#jn-ta', el).value); closeLayer(L); navigate('today'); toast(mode === 'replace' ? 'Synced. Your to-dos are here.' : 'Synced. Both lists are combined.'); }
        catch (err) { if (Y.enabled && !Y.col) syncStopLocal(); note.textContent = err.quiet ? '' : (err.message || 'Couldn’t join.'); note.classList.add('warn'); go.disabled = false; }
      });
    } });
}
async function confirmSyncOff() {
  const ok = await confirmDialog({ title: 'Turn off sync on this device?', body: 'This device keeps its to-dos but stops sending and receiving changes. Your other devices and the copy in Firebase are untouched. To sync again later, join with a code.', ok: 'Turn Off' });
  if (ok) { syncStopLocal(); toast('Sync turned off on this device'); }
  return ok;
}
