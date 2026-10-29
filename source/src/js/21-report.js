/* ===================== Status report =====================
   What got done in a period, what's coming up and who you're waiting on, grouped by project,
   for everything or one area, project or the Board. Built as a share "doc" so the same
   text, Markdown and print output is used. */
const REPORT_PREF = 'sectis.report';
function reportPrefs() {
  let s = {}; try { s = JSON.parse(lsGet(REPORT_PREF) || '{}') || {}; } catch (e) { s = {}; }
  return Object.assign({ period: 'week', format: 'text', done: true, next: true, waiting: true, dates: true, progress: true }, s);
}
function reportRange(period) {
  const T = T0(), ws = weekStart(T);
  if (period === 'last7') return { from: addDays(T, -6), to: T, label: 'Last 7 days' };
  if (period === 'lastweek') return { from: addDays(ws, -7), to: addDays(ws, -1), label: 'Last week' };
  if (period === 'last30') return { from: addDays(T, -29), to: T, label: 'Last 30 days' };
  return { from: ws, to: T, label: 'This week' };
}
function rangeText(r) { return r.from === r.to ? fmtDate(r.from, { weekday: false }) : `${fmtDate(r.from, { weekday: false })} – ${fmtDate(r.to, { weekday: false })}`; }
function reportScope(scope) {
  if (scope.type === 'area' && getA(scope.id)) { const a = getA(scope.id); return { name: aTitle(a), level: 'area', has: (t) => (areaOf(t) || {}).id === a.id }; }
  if (scope.type === 'project' && getP(scope.id)) { const p = getP(scope.id); return { name: pTitle(p), level: 'project', has: (t) => t.projectId === p.id }; }
  if (scope.type === 'board') { const cols = boardCols(); return { name: 'Board', level: 'all', has: (t) => cols.some((c) => (c.t === 'p' ? t.projectId === c.id : (areaOf(t) || {}).id === c.id)) }; }
  return { name: '', level: 'all', has: () => true };
}
/* group to-dos by project, then by area for to-dos outside projects; in sidebar order */
function reportGroups(items) {
  const groups = new Map();
  for (const t of items) {
    const p = t.projectId && getP(t.projectId), a = areaOf(t);
    const key = p ? 'p:' + p.id : a ? 'a:' + a.id : 'o';
    if (!groups.has(key)) groups.set(key, { p, a, list: [] });
    groups.get(key).list.push(t);
  }
  const rank = (g) => [g.a ? 1 : 0, g.a ? g.a.order || 0 : 0, g.p ? 1 : 0, g.p ? g.p.order || 0 : 0];
  return [...groups.values()].sort((x, y) => { const a = rank(x), b = rank(y); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; });
}
function buildReport(scope, o) {
  const sc = reportScope(scope), r = reportRange(o.period), T = T0();
  const inRange = (ts) => { const d = stampDay(ts); return d >= r.from && d <= r.to; };
  const base = (t) => !t.trashed && !t.isTemplate && !t.isDraft && !isTplChild(t) && sc.has(t);
  let seen = new Set();
  const once = (t) => { if (!t.linkId) return true; if (seen.has(t.linkId)) return false; seen.add(t.linkId); return true; }; // a linked to-do counts once
  const done = S.todos.filter((t) => base(t) && t.status === 'done' && t.completedAt && inRange(t.completedAt)).sort((a, b) => a.completedAt - b.completedAt).filter(once);
  seen = new Set();
  const soon = addDays(T, 7), dueSoon = addDays(T, 14);
  const key = (t) => [t.when && t.when <= soon ? (t.when < T ? T : t.when) : null, t.deadline && t.deadline <= dueSoon ? t.deadline : null].filter(Boolean).sort()[0] || '9999';
  const next = S.todos.filter((t) => base(t) && t.status === 'open' && !t.waitFor && inLiveProject(t) && t.start !== 'someday' && ((t.when && t.when <= soon) || (t.deadline && t.deadline <= dueSoon)))
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : byOrder(a, b))).filter(once);
  seen = new Set();
  const waiting = S.todos.filter((t) => base(t) && isWaiting(t) && inLiveProject(t))
    .sort((a, b) => a.waitFor.localeCompare(b.waitFor) || ((a.when || '9999') < (b.when || '9999') ? -1 : 1)).filter(once);
  const B = [];
  const label = (g, progress) => {
    let s = g.p ? pTitle(g.p) : g.a ? aTitle(g.a) : 'Not in a project';
    if (g.p && sc.level === 'all' && g.a) s += ` (${aTitle(g.a)})`;
    if (progress && g.p) {
      if (g.p.status === 'done') s += ' — project completed';
      else { const pr = projectProgress(g.p); s += ` — ${pr.done} of ${pr.total} done`; }
    }
    return s;
  };
  const section = (title, items, progress) => {
    if (!items.length) return;
    B.push({ h: 2, text: title });
    if (sc.level === 'project') { items.forEach((t) => B.push({ item: t })); return; }
    reportGroups(items).forEach((g) => { B.push({ h: 3, text: label(g, progress) }); g.list.forEach((t) => B.push({ item: t })); });
  };
  if (o.done) section('Done', done, o.progress);
  if (o.next) section('Coming Up', next, false);
  if (o.waiting) section('Waiting On', waiting, false);
  const counts = [o.done ? `${done.length} done` : '', o.next ? `${next.length} coming up` : '', o.waiting ? `${waiting.length} waiting` : ''].filter(Boolean);
  let sub = `${r.label}, ${rangeText(r)}` + (counts.length ? ' · ' + counts.join(' · ') : '');
  if (sc.level === 'project' && o.progress) { const pr = projectProgress(getP(scope.id)); sub += ` · ${pr.done} of ${pr.total} done overall`; }
  return { title: sc.name ? `${sc.name} Status Report` : 'Status Report', sub, blocks: B, forceDone: true, n: done.length + next.length + waiting.length };
}
function reportText(doc, o) {
  const so = { notes: false, checklist: false, dates: o.dates, tags: false, done: true };
  return o.format === 'markdown' ? buildMarkdown(doc, so) : buildText(doc, so);
}
function openReport(scope = { type: 'all' }) {
  if (ui.editing) closeEditor({ noRender: false });
  const o = reportPrefs();
  let doc = buildReport(scope, o);
  const canPrint = SECTIS_WEB && !IN_FRAME, canShare = !IN_FRAME && typeof navigator.share === 'function';
  const per = (v, l) => `<button data-rp-period="${v}" class="${o.period === v ? 'on' : ''}">${l}</button>`;
  const opt = (k, l) => `<label class="sh-opt"><input type="checkbox" data-rp-opt="${k}" ${o[k] ? 'checked' : ''}> ${l}</label>`;
  const fmt = (v, l) => `<button data-rp-fmt="${v}" class="${o.format === v ? 'on' : ''}">${l}</button>`;
  const L = openLayer({ modal: true, cls: 'share-modal report-modal', html: `<div class="modal-h"><h2 id="rp-title"></h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div>
    <div class="modal-b">
      <div class="seg rp-period" role="group" aria-label="Period">${per('week', 'This Week')}${per('last7', 'Last 7 Days')}${per('lastweek', 'Last Week')}${per('last30', 'Last 30 Days')}</div>
      <div class="sh-opts">${opt('done', 'Done')}${opt('next', 'Coming Up')}${opt('waiting', 'Waiting On')}${opt('progress', 'Progress')}${opt('dates', 'Dates')}</div>
      <div class="seg sh-fmt" role="group" aria-label="Format">${fmt('text', 'Text')}${fmt('markdown', 'Markdown')}</div>
      <textarea class="ta" id="rp-out" readonly aria-label="Report"></textarea>
      <p class="note" id="rp-note"></p>
    </div>
    <div class="modal-f">${canPrint ? '<button class="btn" data-rp="print" style="margin-right:auto">Print or PDF…</button>' : ''}<a class="btn" data-rp="email" href="#">Email</a><button class="btn${canShare ? '' : ' primary'}" data-rp="copy">Copy</button>${canShare ? '<button class="btn primary" data-rp="share">Share…</button>' : ''}</div>`,
    onMount: (el) => {
      const ta = $('#rp-out', el), note = $('#rp-note', el), mail = $('[data-rp="email"]', el);
      const refresh = () => {
        doc = buildReport(scope, o);
        const text = reportText(doc, o);
        ta.value = text;
        $('#rp-title', el).textContent = doc.title;
        $$('[data-rp-period]', el).forEach((b) => b.classList.toggle('on', b.dataset.rpPeriod === o.period));
        $$('[data-rp-fmt]', el).forEach((b) => b.classList.toggle('on', b.dataset.rpFmt === o.format));
        note.textContent = doc.n ? '' : 'Nothing to report for this period yet.';
        mail.href = `mailto:?subject=${encodeURIComponent(`${doc.title}: ${reportRange(o.period).label.toLowerCase()}`)}&body=${encodeURIComponent(text)}`;
        lsSet(REPORT_PREF, JSON.stringify(o));
      };
      refresh();
      el.addEventListener('change', (e) => { const k = e.target.dataset.rpOpt; if (k) { o[k] = e.target.checked; refresh(); } });
      el.addEventListener('click', async (e) => {
        const p = e.target.closest('[data-rp-period]'); if (p) { o.period = p.dataset.rpPeriod; refresh(); return; }
        const f = e.target.closest('[data-rp-fmt]'); if (f) { o.format = f.dataset.rpFmt; refresh(); return; }
        const b = e.target.closest('[data-rp]'); if (!b) return;
        const text = reportText(doc, o);
        if (b.dataset.rp === 'email') return; // the link opens Mail
        if (b.dataset.rp === 'copy') { copyText(text, ta, note); return; }
        if (b.dataset.rp === 'print') { closeLayer(L); printDoc(doc, { notes: false, checklist: false, dates: o.dates, tags: false, done: true }); return; }
        if (b.dataset.rp === 'share') {
          try { await navigator.share({ title: doc.title, text }); } catch (err) { if (err && err.name !== 'AbortError') note.textContent = 'Sharing isn’t available here. Use Copy instead.'; }
        }
      });
    } });
  return L;
}
