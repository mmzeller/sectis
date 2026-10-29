/* ===================== Share and export =====================
   Turns a list, area, project, selection or single to-do into plain text,
   Markdown, a spreadsheet (CSV) or a printable page. */
const SHARE_PREF = 'sectis.share';
function sharePrefs() {
  const d = { format: 'text', notes: true, checklist: true, dates: true, tags: false, done: false };
  let saved = {};
  try { saved = JSON.parse(lsGet(SHARE_PREF) || '{}') || {}; } catch (e) { saved = {}; }
  if ('meta' in saved && !('dates' in saved)) saved.dates = saved.meta; // older setting
  delete saved.meta;
  return Object.assign(d, saved);
}

/* ---- collect what to export as a flat list of blocks:
   { h: level, text, proj? } headings, and { item } to-dos or projects ---- */
function projectTodos(p) {
  return S.todos.filter((t) => t.projectId === p.id && !t.trashed && !t.isTemplate && !t.isDraft && (t.status === 'open' || !t.logged));
}
function addProjectBody(B, p, level) {
  const todos = projectTodos(p);
  todos.filter((t) => !t.headingId || !getH(t.headingId) || getH(t.headingId).archived).sort(byOrder).forEach((t) => B.push({ item: t }));
  S.headings.filter((h) => h.projectId === p.id && !h.archived).sort(byOrder).forEach((h) => {
    const ts = todos.filter((t) => t.headingId === h.id).sort(byOrder);
    if (ts.length) { B.push({ h: level, text: h.title || 'Untitled heading' }); ts.forEach((t) => B.push({ item: t })); }
  });
}
function addGrouped(B, todos, extraProjects = []) {
  // loose to-dos, then each project (outside areas first), then each area with its to-dos and projects
  todos.filter((t) => !t.projectId && !t.areaId).sort(byOrder).forEach((t) => B.push({ item: t }));
  const sortT = (a, b) => { const ha = a.headingId && getH(a.headingId), hb = b.headingId && getH(b.headingId); return ((ha ? ha.order + 1 : 0) - (hb ? hb.order + 1 : 0)) || byOrder(a, b); };
  const proj = (p) => { const ts = todos.filter((t) => t.projectId === p.id).sort(sortT); if (ts.length) { B.push({ h: 2, text: pTitle(p), proj: p }); ts.forEach((t) => B.push({ item: t })); } };
  const projectsIn = (areaId) => S.projects.filter((p) => !p.trashed && !p.isTemplate && (p.areaId || null) === areaId).sort(byOrder);
  extraProjects.filter((p) => !p.areaId).forEach((p) => B.push({ item: p }));
  projectsIn(null).forEach(proj);
  S.areas.slice().sort(byOrder).forEach((a) => {
    const at = todos.filter((t) => t.areaId === a.id && !t.projectId).sort(byOrder);
    const ap = extraProjects.filter((p) => p.areaId === a.id);
    const inner = projectsIn(a.id).filter((p) => todos.some((t) => t.projectId === p.id));
    if (!at.length && !ap.length && !inner.length) return;
    B.push({ h: 2, text: aTitle(a) });
    at.forEach((t) => B.push({ item: t })); ap.forEach((p) => B.push({ item: p }));
    inner.forEach((p) => { const ts = todos.filter((t) => t.projectId === p.id).sort(sortT); B.push({ h: 3, text: pTitle(p), proj: p }); ts.forEach((t) => B.push({ item: t })); });
  });
}
function collectExport(scope) {
  const B = []; let title = '', sub = '', forceDone = false;
  if (scope.type === 'area') {
    const a = getA(scope.id); title = aTitle(a);
    S.todos.filter((t) => t.areaId === a.id && !t.projectId && liveTodo(t)).sort(byOrder).forEach((t) => B.push({ item: t }));
    S.projects.filter((p) => p.areaId === a.id && liveProject(p)).sort((x, y) => (x.start === 'someday') - (y.start === 'someday') || byOrder(x, y)).forEach((p) => { B.push({ h: 2, text: pTitle(p), proj: p }); addProjectBody(B, p, 3); });
  } else if (scope.type === 'items') {
    const items = scope.ids.map(itemById).filter(Boolean);
    if (items.length === 1 && items[0].type === 'project') {
      const p = items[0]; title = pTitle(p); sub = projectLine(p); addProjectBody(B, p, 2);
      return { title, sub, notes: p.notes, blocks: B, forceDone };
    }
    title = items.length === 1 ? (items[0].title || 'New To-Do') : `${items.length} To-Dos`;
    const groups = new Map();
    items.forEach((x) => { const k = x.type === 'project' ? 'p:' + x.id : parentLabel(x) || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
    const single = groups.size === 1;
    const ordered = [...groups].sort((x, y) => (x[0] === '' ? 0 : 1) - (y[0] === '' ? 0 : 1)); // to-dos with no list first, like the lists themselves
    for (const [k, list] of ordered) {
      if (k.startsWith('p:')) { const p = list[0]; B.push({ h: 2, text: pTitle(p), proj: p }); addProjectBody(B, p, 3); continue; }
      if (!single && k) B.push({ h: 2, text: k });
      list.forEach((x) => B.push({ item: x }));
    }
    forceDone = true;
  } else {
    const v = ui.view, f = matchesTagFilter;
    const tagNote = ui.tagFilter ? (ui.tagFilter === '__none' ? ' (no tag)' : ` (#${tagTitle(ui.tagFilter)})`) : '';
    if (v.type === 'inbox') { title = 'Inbox'; inboxItems().filter(f).sort(byOrder).forEach((t) => B.push({ item: t })); }
    else if (v.type === 'today') {
      title = 'Today'; const d = pd(T0()); sub = `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
      const items = todayItems().filter(f).sort(byToday);
      items.filter((x) => !isEveningItem(x)).forEach((x) => B.push({ item: x }));
      const eve = items.filter(isEveningItem);
      if (eve.length) { B.push({ h: 2, text: 'This Evening' }); eve.forEach((x) => B.push({ item: x })); }
    } else if (v.type === 'upcoming') {
      title = 'Upcoming'; let cur = null;
      upcomingItems().filter(f).sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : byToday(a, b))).forEach((x) => {
        if (x.when !== cur) { cur = x.when; B.push({ h: 2, text: fmtDate(x.when) }); }
        B.push({ item: x });
      });
    } else if (v.type === 'anytime') { title = 'Anytime'; addGrouped(B, S.todos.filter((t) => anytimeTodo(t) && f(t))); }
    else if (v.type === 'someday') { title = 'Someday'; addGrouped(B, S.todos.filter((t) => somedayTodo(t) && f(t)), S.projects.filter((p) => liveProject(p) && p.start === 'someday' && f(p)).sort(byOrder)); }
    else if (v.type === 'logbook') {
      title = 'Logbook'; forceDone = true; let cur = null;
      logbookItems().filter(f).slice(0, 500).forEach((x) => { const g = dayGroupLabel(stampDay(x.completedAt || Date.now())); if (g !== cur) { cur = g; B.push({ h: 2, text: g }); } B.push({ item: x }); });
    } else if (v.type === 'project') return collectExport({ type: 'items', ids: [v.id] });
    else if (v.type === 'area') return collectExport({ type: 'area', id: v.id });
    else if (v.type === 'tag') {
      const tag = getTag(v.id); title = '#' + tag.title;
      const want = tagDescendants(tag.id); const has = (x) => { for (const t of effectiveTags(x)) if (want.has(t)) return true; return false; };
      const todos = S.todos.filter((t) => liveTodo(t) && inLiveProject(t) && has(t));
      [['Today', todos.filter(isTodayItem).sort(byToday)], ['Upcoming', todos.filter((t) => t.start === 'anytime' && t.when && t.when > T0()).sort((a, b) => (a.when < b.when ? -1 : 1))],
        ['Anytime', todos.filter((t) => t.start === 'anytime' && !t.when && !isTodayItem(t)).sort(byOrder)], ['Inbox', todos.filter((t) => isInbox(t) && !isTodayItem(t)).sort(byOrder)],
        ['Someday', todos.filter((t) => t.start === 'someday' && !isTodayItem(t)).sort(byOrder)]].forEach(([label, list]) => { if (list.length) { B.push({ h: 2, text: label }); list.forEach((t) => B.push({ item: t })); } });
    }
    title += tagNote;
  }
  return { title, sub, blocks: B, forceDone };
}
function projectLine(p) {
  const bits = [];
  if (p.isTemplate && p.repeat) bits.push(ruleSummary(p.repeat));
  else if (p.start === 'someday') bits.push('Someday');
  else if (p.when) bits.push(p.when <= T0() ? 'Today' : fmtDate(p.when));
  if (p.deadline) bits.push('due ' + fmtDate(p.deadline));
  return bits.join(', ');
}

/* ---- format each item ---- */
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
function shareDates(x, o) {
  if (!o.dates) return [];
  const bits = [];
  if (x.type === 'project') { const l = projectLine(x); return l ? [l] : []; }
  if (x.status === 'done') bits.push(x.completedAt ? 'done ' + fmtDate(stampDay(x.completedAt), { weekday: false }) : 'done');
  else if (x.status === 'canceled') bits.push('canceled');
  else if (x.start === 'someday') bits.push('Someday');
  else if (isEveningItem(x)) bits.push('This Evening');
  else if (x.when && x.when <= T0()) bits.push('Today');
  else if (x.when) bits.push(fmtDate(x.when));
  if (x.deadline && x.status === 'open') bits.push('due ' + fmtDate(x.deadline));
  return bits;
}
function shareTags(x, o) { return o.tags ? x.tags.map(tagTitle).filter(Boolean).map((t) => '#' + t.replace(/\s+/g, '')) : []; }
function itemLabel(x, o, sep = ' — ') {
  const d = shareDates(x, o), t = shareTags(x, o);
  return (d.length ? sep + d.join(', ') : '') + (t.length ? '  ' + t.join(' ') : '');
}
function itemName(x) { return x.type === 'project' ? pTitle(x) : x.title || 'New To-Do'; }
function shareItems(doc, o) {
  const keep = (x) => doc.forceDone || o.done || x.status === 'open';
  const out = []; let pendingH = [];
  for (const b of doc.blocks) {
    if (b.h) { pendingH = pendingH.filter((p) => p.h < b.h); pendingH.push(b); continue; }
    if (!keep(b.item)) continue;
    pendingH.forEach((h) => out.push(h)); pendingH = [];
    out.push(b);
  }
  return out;
}
function headingLabel(b, o) { const extra = b.proj && o.dates ? projectLine(b.proj) : ''; return b.text + (extra ? ' — ' + extra : ''); }
/* Plain text: no underlines or brackets; sections are indented under their heading */
function buildText(doc, o) {
  const L = [doc.title];
  if (doc.sub) L.push(cap(doc.sub));
  if (o.notes && doc.notes && doc.notes.trim()) L.push('', ...doc.notes.trim().split('\n'));
  L.push('');
  const box = (x) => (x.type === 'project' ? '○' : x.status === 'done' ? '☑' : x.status === 'canceled' ? '☒' : '☐');
  let depth = 0, lastHeading = false;
  for (const b of shareItems(doc, o)) {
    if (b.h) {
      if (L[L.length - 1] !== '' && !lastHeading) L.push('');
      L.push('  '.repeat(b.h - 2) + headingLabel(b, o));
      depth = b.h - 1; lastHeading = true; continue;
    }
    lastHeading = false;
    const x = b.item, pad = '  '.repeat(depth);
    L.push(`${pad}${box(x)} ${itemName(x)}${itemLabel(x, o)}`);
    if (o.notes && x.notes && x.notes.trim()) x.notes.trim().split('\n').forEach((n) => L.push(`${pad}    ${n}`));
    if (o.checklist && x.type === 'todo') x.checklist.forEach((c) => L.push(`${pad}    ${c.done ? '✓' : '–'} ${c.title}`));
  }
  while (L.length && L[L.length - 1] === '') L.pop();
  return L.join('\n') + '\n';
}
function buildMarkdown(doc, o) {
  const L = [`# ${doc.title}`];
  if (doc.sub) L.push('', cap(doc.sub));
  if (o.notes && doc.notes && doc.notes.trim()) L.push('', doc.notes.trim());
  let inList = false;
  for (const b of shareItems(doc, o)) {
    if (b.h) { L.push('', `${'#'.repeat(b.h)} ${headingLabel(b, o)}`); inList = false; continue; }
    if (!inList) { L.push(''); inList = true; }
    const x = b.item;
    const name = x.type === 'project' ? `**${pTitle(x)}**` : itemName(x);
    L.push(`- [${x.status === 'open' || x.type === 'project' ? ' ' : 'x'}] ${x.status === 'canceled' ? `~~${name}~~` : name}${itemLabel(x, o)}`);
    if (o.notes && x.notes && x.notes.trim()) x.notes.trim().split('\n').forEach((n) => L.push('  ' + n));
    if (o.checklist && x.type === 'todo') x.checklist.forEach((c) => L.push(`  - [${c.done ? 'x' : ' '}] ${c.title}`));
  }
  return L.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
/* Spreadsheet: only the columns that are switched on */
function buildCSV(doc, o) {
  const q = (v) => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const items = shareItems(doc, o).filter((b) => b.item).map((b) => b.item);
  const showStatus = doc.forceDone || o.done;
  const cols = [['Title', (x) => itemName(x)]];
  if (items.some((x) => x.type === 'project')) cols.push(['Type', (x) => (x.type === 'project' ? 'Project' : 'To-Do')]);
  cols.push(['List', (x) => (x.type === 'project' ? (areaOf(x) ? aTitle(areaOf(x)) : '') : parentLabel(x).split(' › ')[0])]);
  if (items.some((x) => x.type === 'todo' && x.headingId && getH(x.headingId))) cols.push(['Heading', (x) => { const h = x.type === 'todo' && x.headingId && getH(x.headingId); return h ? h.title : ''; }]);
  if (showStatus) cols.push(['Status', (x) => ({ open: 'Open', done: 'Done', canceled: 'Canceled' }[x.status])]);
  if (o.dates) {
    cols.push(['When', (x) => (x.start === 'someday' ? 'Someday' : x.when ? fmtDate(x.when, { year: true }) : '')]);
    cols.push(['Deadline', (x) => (x.deadline ? fmtDate(x.deadline, { year: true }) : '')]);
  }
  if (o.tags) cols.push(['Tags', (x) => x.tags.map(tagTitle).filter(Boolean).join(', ')]);
  if (o.notes) cols.push(['Notes', (x) => x.notes]);
  if (o.checklist) cols.push(['Checklist', (x) => (x.type === 'todo' ? x.checklist.map((c) => `${c.done ? '✓' : '–'} ${c.title}`).join('\n') : '')]);
  const rows = [cols.map((c) => c[0]), ...items.map((x) => cols.map((c) => c[1](x)))];
  return '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n') + '\r\n';
}
function buildPrintHTML(doc, o) {
  let h = `<h1>${esc(doc.title)}</h1>${doc.sub ? `<p class="sub">${esc(cap(doc.sub))}</p>` : ''}${o.notes && doc.notes && doc.notes.trim() ? `<div class="md pnotes">${renderMarkdown(doc.notes)}</div>` : ''}`;
  for (const b of shareItems(doc, o)) {
    if (b.h) { h += `<h${b.h}>${esc(b.text)}</h${b.h}>${b.proj && o.dates && projectLine(b.proj) ? `<p class="sub">${esc(cap(projectLine(b.proj)))}</p>` : ''}`; continue; }
    const x = b.item, meta = [...shareDates(x, o), ...shareTags(x, o)];
    h += `<div class="pi ${x.type} ${x.status}"><span class="pbox">${x.status === 'done' ? '✓' : x.status === 'canceled' ? '×' : ''}</span><div class="pmain"><div class="pt">${esc(x.type === 'project' ? pTitle(x) : x.title || 'New To-Do')}${meta.length ? ` <span class="pm">${esc(meta.join(' · '))}</span>` : ''}</div>`
      + (o.notes && x.notes && x.notes.trim() ? `<div class="md pn">${renderMarkdown(x.notes)}</div>` : '')
      + (o.checklist && x.type === 'todo' && x.checklist.length ? `<ul class="pc">${x.checklist.map((c) => `<li class="${c.done ? 'done' : ''}">${esc(c.title)}</li>`).join('')}</ul>` : '') + '</div></div>';
  }
  return h;
}
const PRINT_CSS = `#print-root{font:11pt/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111;background:#fff}
#print-root h1{font-size:20pt;margin:0 0 2pt}#print-root h2{font-size:13pt;margin:16pt 0 4pt;padding-bottom:2pt;border-bottom:1px solid #ccc}
#print-root h3{font-size:11pt;margin:12pt 0 3pt;color:#2c5be0}#print-root .sub{color:#666;margin:0 0 6pt}
#print-root .pi{display:flex;gap:8pt;padding:3pt 0;break-inside:avoid}#print-root .pbox{flex:none;width:10pt;height:10pt;margin-top:2.5pt;border:1.2pt solid #888;border-radius:2.5pt;font-size:8pt;line-height:9pt;text-align:center}
#print-root .pi.project .pbox{border-radius:50%}#print-root .pi.done .pt,#print-root .pi.canceled .pt{color:#777}#print-root .pi.canceled .pt{text-decoration:line-through}
#print-root .pm{color:#777;font-size:9pt;margin-left:4pt}#print-root .pn{color:#444;font-size:10pt;margin-top:1pt}#print-root .pn p{margin:0 0 3pt}
#print-root .pc{list-style:none;margin:2pt 0 0;padding:0;font-size:10pt}#print-root .pc li::before{content:"○ ";color:#888}#print-root .pc li.done{color:#888;text-decoration:line-through}
#print-root .pc li.done::before{content:"● "}#print-root a{color:#2c5be0}#print-root code{font:9pt ui-monospace,Menlo,monospace}`;
function printDoc(doc, o) {
  let root = document.getElementById('print-root');
  if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.append(root); }
  root.innerHTML = `<style>${PRINT_CSS}</style>${buildPrintHTML(doc, o)}`;
  document.documentElement.classList.add('printing');
  const done = () => { document.documentElement.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { try { window.print(); } catch (e) { done(); } }, 50);
}

/* ---- the Share dialog ---- */
function shareFileName(doc, ext) {
  const base = doc.title.replace(/[\\/:*?"<>|#]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sectis';
  return `${base} ${T0()}.${ext}`;
}
function openShare(scope) {
  if (ui.editing) closeEditor({ noRender: false });
  const doc = collectExport(scope);
  const o = sharePrefs();
  const canSave = SECTIS_WEB && !IN_FRAME, canPrint = SECTIS_WEB && !IN_FRAME, canShare = !IN_FRAME && typeof navigator.share === 'function';
  const out = () => (o.format === 'markdown' ? buildMarkdown(doc, o) : o.format === 'csv' ? buildCSV(doc, o) : buildText(doc, o));
  const count = () => shareItems(doc, o).filter((b) => b.item).length;
  const fmtBtn = (v, l) => `<button data-sh-fmt="${v}" class="${o.format === v ? 'on' : ''}">${l}</button>`;
  const opt = (k, l) => `<label class="sh-opt"><input type="checkbox" data-sh-opt="${k}" ${o[k] ? 'checked' : ''}> ${l}</label>`;
  const L = openLayer({ modal: true, cls: 'share-modal', html: `<div class="modal-h"><h2>Share “${esc(doc.title)}”</h2><button class="ib" data-action="close-layer" aria-label="Close">${ic('x')}</button></div>
    <div class="modal-b">
      <div class="seg sh-fmt" role="group" aria-label="Format">${fmtBtn('text', 'Text')}${fmtBtn('markdown', 'Markdown')}${fmtBtn('csv', 'Spreadsheet')}</div>
      <p class="note" id="sh-desc"></p>
      <div class="sh-opts">${opt('notes', 'Notes')}${opt('checklist', 'Checklists')}${opt('dates', 'Dates')}${opt('tags', 'Tags')}${doc.forceDone ? '' : opt('done', 'Completed to-dos')}</div>
      <textarea class="ta" id="sh-out" readonly aria-label="Preview"></textarea>
      <p class="note" id="sh-note"></p>
    </div>
    <div class="modal-f">${canPrint ? '<button class="btn" data-sh="print" style="margin-right:auto">Print or PDF…</button>' : ''}${canSave ? '<button class="btn" data-sh="save">Save File</button>' : ''}<button class="btn${canShare ? '' : ' primary'}" data-sh="copy">Copy</button>${canShare ? '<button class="btn primary" data-sh="share">Share…</button>' : ''}</div>`,
    onMount: (el) => {
      const ta = $('#sh-out', el), note = $('#sh-note', el);
      const refresh = () => {
        ta.value = out(); ta.classList.toggle('csv', o.format === 'csv');
        const n = count();
        $('#sh-desc', el).textContent = (o.format === 'csv' ? 'A file that opens in Numbers, Excel or Google Sheets, one row per to-do. ' : o.format === 'markdown' ? 'Checkbox lists for Notes, Obsidian, GitHub and other Markdown apps. ' : 'Readable anywhere: Messages, Mail, Notes. ')
          + `${plural(n, 'item')}.`;
        $$('[data-sh-fmt]', el).forEach((b) => b.classList.toggle('on', b.dataset.shFmt === o.format));
        lsSet(SHARE_PREF, JSON.stringify(o)); note.textContent = '';
      };
      refresh();
      el.addEventListener('change', (e) => { const k = e.target.dataset.shOpt; if (k) { o[k] = e.target.checked; refresh(); } });
      el.addEventListener('click', async (e) => {
        const f = e.target.closest('[data-sh-fmt]'); if (f) { o.format = f.dataset.shFmt; refresh(); return; }
        const b = e.target.closest('[data-sh]'); if (!b) return;
        const text = out(), ext = o.format === 'csv' ? 'csv' : o.format === 'markdown' ? 'md' : 'txt';
        const type = o.format === 'csv' ? 'text/csv' : o.format === 'markdown' ? 'text/markdown' : 'text/plain';
        if (b.dataset.sh === 'copy') { copyText(text, ta, note); return; }
        if (b.dataset.sh === 'print') { closeLayer(L); printDoc(doc, o); return; }
        if (b.dataset.sh === 'save') {
          const name = shareFileName(doc, ext);
          note.textContent = savedNote(await saveFile(name, text, type), name);
          return;
        }
        if (b.dataset.sh === 'share') {
          try {
            const file = o.format === 'csv' && typeof File === 'function' ? new File([text], shareFileName(doc, ext), { type }) : null;
            if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: doc.title });
            else await navigator.share({ title: doc.title, text });
          } catch (err) { if (err && err.name !== 'AbortError') note.textContent = 'Sharing isn’t available here. Use Copy instead.'; }
        }
      });
    } });
}
