/* ===================== Automatic backups =====================
   Once a day each device keeps a copy of everything in its own storage (IndexedDB),
   plus a copy before big changes such as importing or restoring. */
const BK_INDEX = 'backups:index';
const bk = { lastDay: null, running: false };
const BK_LABELS = { daily: 'Daily', import: 'Before import', erase: 'Before erasing', restore: 'Before restoring a backup', join: 'Before joining sync' };
function backupsSupported() { return 'indexedDB' in window; }
function hasRealData() { return S.todos.some((t) => !t.sample && !t.isDraft) || S.projects.some((p) => !p.sample) || S.areas.some((a) => !a.sample); }
function backupCounts(data) {
  return {
    todos: (data.todos || []).filter((t) => !t.trashed && !t.isTemplate && !t.isDraft && t.status === 'open').length,
    projects: (data.projects || []).filter((p) => !p.trashed && !p.isTemplate && p.status === 'open').length,
  };
}
async function makeBackup(reason = 'daily') {
  if (!backupsSupported()) return false;
  try {
    const list = (await idbGet(BK_INDEX)) || [];
    const snap = { schema: S.schema, savedAt: S.savedAt, todos: S.todos.filter((t) => !t.isDraft), projects: S.projects, headings: S.headings, areas: S.areas, tags: S.tags };
    const data = JSON.stringify(snap);
    const key = 'backup:' + Date.now();
    await idbSet(key, data);
    list.unshift({ key, at: Date.now(), day: T0(), reason, counts: backupCounts(snap), size: data.length });
    const daily = list.filter((b) => b.reason === 'daily'), other = list.filter((b) => b.reason !== 'daily');
    const keep = new Set([...daily.slice(0, 14), ...other.slice(0, 10)].map((b) => b.key));
    for (const b of list) if (!keep.has(b.key)) { try { await idbDel(b.key); } catch (e) { /* ignore */ } }
    await idbSet(BK_INDEX, list.filter((b) => keep.has(b.key)));
    if (reason === 'daily') bk.lastDay = T0();
    return true;
  } catch (e) { return false; }
}
async function dailyBackup() {
  if (bk.running || bk.lastDay === T0() || !backupsSupported() || !S || !hasRealData()) return;
  bk.running = true;
  try {
    const list = (await idbGet(BK_INDEX)) || [];
    if (list.some((b) => b.reason === 'daily' && b.day === T0())) { bk.lastDay = T0(); return; }
    await makeBackup('daily');
  } catch (e) { /* storage unavailable here */ } finally { bk.running = false; }
}
function restoreSnapshot(data) {
  commit('Restore Backup', () => {
    for (const k of ['todos', 'projects', 'headings', 'areas', 'tags']) S[k] = Array.isArray(data[k]) ? data[k] : [];
    S = normalizeState(S);
  });
}
async function openBackups() {
  let list = null;
  try { list = backupsSupported() ? (await idbGet(BK_INDEX)) || [] : null; } catch (e) { list = null; }
  const when = (b) => { const d = new Date(b.at); return `${fmtDate(ymd(d), { weekday: true })}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`; };
  const rows = () => (list || []).map((b) => `<div class="bk-row"><div class="bk-main"><b>${esc(when(b))}</b><small>${esc(BK_LABELS[b.reason] || b.reason)} · ${plural(b.counts.todos, 'open to-do')}, ${plural(b.counts.projects, 'project')}</small></div><button class="btn" data-bk="copy" data-key="${b.key}">Copy</button><button class="btn" data-bk="restore" data-key="${b.key}">Restore</button></div>`).join('');
  const body = list === null ? '<p class="note" style="margin:0">Backups aren’t available in this browser.</p>'
    : list.length ? rows() : '<p class="note" style="margin:0">No backups yet. The first one is saved later today.</p>';
  const L = openLayer({ modal: true, html: `<div class="modal-h"><h2>Backups</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div>
    <div class="modal-b"><p style="margin-top:0">Sectis keeps a copy of your to-dos on this device once a day for the last 14 days, plus a copy before big changes like importing or restoring. Each device keeps its own.</p><div class="bk-list">${body}</div><p class="note" id="bk-note"></p></div>
    <div class="modal-f">${list ? '<button class="btn" data-bk="now">Back Up Now</button>' : ''}<button class="btn primary" data-action="close-layer">Done</button></div>`,
    onMount: (el) => el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-bk]'); if (!b) return;
      const note = $('#bk-note', el);
      if (b.dataset.bk === 'now') { b.disabled = true; const ok = await makeBackup('daily'); list = (await idbGet(BK_INDEX)) || []; $('.bk-list', el).innerHTML = rows(); b.disabled = false; note.textContent = ok ? 'Backed up.' : 'Couldn’t save a backup in this browser.'; return; }
      const raw = await idbGet(b.dataset.key).catch(() => null);
      if (!raw) { note.textContent = 'That backup couldn’t be read.'; return; }
      const meta = (list || []).find((x) => x.key === b.dataset.key);
      if (b.dataset.bk === 'copy') { copyText(JSON.stringify(Object.assign({ app: 'Sectis', version: APP_VERSION, exportedAt: new Date().toISOString() }, JSON.parse(raw))), null, note); return; }
      const ok = await confirmDialog({ title: 'Restore this backup?', body: `Your lists will go back to how they were on ${esc(when(meta))}.${Y.enabled ? ' Your other synced devices will change too.' : ''} A copy of what you have now is saved first, and you can undo right after.`, ok: 'Restore' });
      if (!ok) return;
      await makeBackup('restore');
      restoreSnapshot(JSON.parse(raw));
      closeLayer(L); navigate('today');
      toast(`Restored the backup from ${when(meta)}`, { undo: true });
    }) });
}
