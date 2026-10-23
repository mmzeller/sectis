/* ===================== Formatted notes =====================
   Notes are plain text with light Markdown: **bold**, *italic*, ~~strike~~, `code`,
   # headings, - bullets, 1. numbered lists, > quotes, [text](link) and bare links. */
function safeHref(url) {
  const u = String(url || '').trim();
  if (!u || /^(javascript|data|vbscript|file):/i.test(u)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  if (/^www\./i.test(u) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return 'https://' + u;
  return null;
}
function mdInline(raw) {
  const tokens = [];
  const keep = (html) => `\u0001${tokens.push(html) - 1}\u0002`;
  const link = (href, text) => keep(`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`);
  let s = String(raw).replace(/[\u0001\u0002]/g, '');
  s = s.replace(/`([^`\n]+)`/g, (m, c) => keep(`<code>${esc(c)}</code>`));
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, text, url) => { const h = safeHref(url); return h ? link(h, esc(text)) : m; });
  s = s.replace(/\b((?:https?:\/\/|www\.)[^\s<>"'\u0001\u0002]+)/gi, (m, url) => {
    let trail = '';
    while (/[.,;:!?'")\]]$/.test(url)) {
      if (url.endsWith(')') && (url.match(/\(/g) || []).length >= (url.match(/\)/g) || []).length) break;
      trail = url.slice(-1) + trail; url = url.slice(0, -1);
    }
    const h = safeHref(url);
    return (h ? link(h, esc(url)) : esc(url)) + trail;
  });
  s = s.replace(/\b([\w.+-]+@[\w-]+(?:\.[\w-]+)+)\b/g, (m, e) => keep(`<a href="mailto:${esc(e)}">${esc(e)}</a>`));
  s = esc(s);
  s = s.replace(/\*\*(?=\S)(.+?)\*\*/g, (m, x) => (/\s$/.test(x) ? m : `<strong>${x}</strong>`));
  s = s.replace(/(^|[^\w])__(?=\S)(.+?)__(?!\w)/g, (m, pre, x) => (/\s$/.test(x) ? m : `${pre}<strong>${x}</strong>`));
  s = s.replace(/(^|[^\w*])\*(?=[^\s*])([^*]+?)\*(?![\w*])/g, (m, pre, x) => (/\s$/.test(x) ? m : `${pre}<em>${x}</em>`));
  s = s.replace(/(^|[^\w])_(?=[^\s_])([^_]+?)_(?!\w)/g, (m, pre, x) => (/\s$/.test(x) ? m : `${pre}<em>${x}</em>`));
  s = s.replace(/~~(?=\S)(.+?)~~/g, (m, x) => `<del>${x}</del>`);
  return s.replace(/\u0001(\d+)\u0002/g, (m, i) => tokens[+i]);
}
function renderMarkdown(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  let html = '', list = null, para = [];
  const flush = () => { if (para.length) { html += `<p>${para.map(mdInline).join('<br>')}</p>`; para = []; } };
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  const open = (tag, start) => { if (list !== tag) { close(); html += tag === 'ol' && start && start !== '1' ? `<ol start="${+start}">` : `<${tag}>`; list = tag; } };
  for (const line of lines) {
    let m;
    if (!line.trim()) { flush(); close(); continue; }
    if ((m = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/))) { flush(); close(); html += `<p class="md-h${m[1].length}">${mdInline(m[2])}</p>`; continue; }
    if ((m = line.match(/^\s*[-*•+]\s+\[( |x|X)\]\s+(.*)$/))) { flush(); open('ul'); html += `<li class="md-task${m[1] === ' ' ? '' : ' done'}">${mdInline(m[2])}</li>`; continue; }
    if ((m = line.match(/^\s*[-*•+]\s+(.*)$/))) { flush(); open('ul'); html += `<li>${mdInline(m[1])}</li>`; continue; }
    if ((m = line.match(/^\s*(\d{1,4})[.)]\s+(.*)$/))) { flush(); open('ol', m[1]); html += `<li>${mdInline(m[2])}</li>`; continue; }
    if ((m = line.match(/^\s*>\s?(.*)$/))) { flush(); close(); html += `<blockquote>${mdInline(m[1])}</blockquote>`; continue; }
    close(); para.push(line);
  }
  flush(); close();
  return html;
}

/* switch between the formatted view and the text box */
function showNotesEditor(fkey, fromClick) {
  const ta = document.querySelector(`textarea[data-fkey="${CSS.escape(fkey)}"]`);
  const view = document.querySelector(`.notes-view[data-notes-for="${CSS.escape(fkey)}"]`);
  if (!ta) return;
  ui.notesEdit = fkey;
  if (view) view.hidden = true;
  ta.hidden = false; autosize(ta);
  ta.focus({ preventScroll: !!fromClick });
  const end = fromClick ? ta.value.length : 0;
  try { ta.setSelectionRange(end, end); } catch (e) { /* ignore */ }
}
document.addEventListener('focusin', (e) => {
  const ta = e.target;
  if (ta && ta.tagName === 'TEXTAREA' && ta.previousElementSibling && ta.previousElementSibling.classList.contains('notes-view')) ui.notesEdit = ta.dataset.fkey;
});
document.addEventListener('focusout', (e) => {
  const ta = e.target;
  if (!ta || ta.tagName !== 'TEXTAREA' || !ta.dataset.fkey || !(ta.previousElementSibling && ta.previousElementSibling.classList.contains('notes-view'))) return;
  const fkey = ta.dataset.fkey;
  setTimeout(() => {
    const a = document.activeElement;
    if (a && a.dataset && a.dataset.fkey === fkey) return; // focus came back (a re-render)
    if (ui.notesEdit === fkey) ui.notesEdit = null;
    const cur = document.querySelector(`textarea[data-fkey="${CSS.escape(fkey)}"]`);
    const view = document.querySelector(`.notes-view[data-notes-for="${CSS.escape(fkey)}"]`);
    if (!cur || !view || !cur.value.trim()) return;
    view.innerHTML = renderMarkdown(cur.value);
    view.hidden = false; cur.hidden = true;
  }, 0);
});
