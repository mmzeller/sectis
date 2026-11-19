/* ===================== Start =====================
   Sectis opens with the newer of its two copies on this device: localStorage's or IndexedDB's
   (see persistence in 02-model.js). Reading IndexedDB takes a moment; if it doesn't answer, Sectis
   opens with localStorage's copy and leaves IndexedDB's alone. */
(async () => {
  const ls = lsGet(STORE_KEY);
  let raw = ls, blocked = false;
  if (backupsSupported()) {
    try {
      const saved = await withTimeout(idbGet(IDB_STATE), 2500, 'IndexedDB didn’t answer');
      const at = (text) => { const m = /"savedAt":(\d+)/.exec(text.slice(0, 300)); if (m) return Number(m[1]); try { return JSON.parse(text).savedAt || 0; } catch (e) { return -1; } };
      if (typeof saved === 'string' && (!ls || at(saved) > at(ls))) raw = saved;
    } catch (e) { blocked = true; }
  }
  init(raw);
  storeReady(blocked);
})();
