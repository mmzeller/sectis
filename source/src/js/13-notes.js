/* ===================== Formatted notes =====================
   Notes are plain text with light Markdown: **bold**, *italic*, ~~strike~~, `code`,
   # headings, - bullets, 1. numbered lists, > quotes, [text](link) and bare links.
   Web links open in a new tab; app links (sintr://…) open the app, so they get no target. */
function safeHref(url) {
  const u = String(url || '').trim();
  if (!u || /^(javascript|data|vbscript|file):/i.test(u)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return u;
  if (/^www\./i.test(u) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return 'https://' + u;
  return null;
}
/* In the Notepad (opts.values), the things you keep notes for become one-click copy chips:
   serial numbers and other labelled values (Serial: …, S/N …, Ticket #…, Key: …), MAC and IP
   addresses, GUIDs, license keys, code-like tokens (C02XK1JHJG5J) and long numbers; `code`
   spans too. Phone numbers become call links with a copy button. */
const VAL_LABELS = /(^|[^\w])((?:serial|model|part|account|acct|order|invoice|tracking|confirmation|reference|ref)(?:\s*(?:no\.?|number|num|#))?|s\/n|sn|p\/n|service\s*tag|asset(?:\s*tag)?|license(?:\s*key)?|product\s*key|activation\s*key|key|ticket|case|po|imei|uuid|vin|rma|claim|policy|warranty|pin|passcode|code|ext(?:ension)?|id)(\s*(?:#|:|=|-|–)?\s*)([A-Za-z0-9][A-Za-z0-9._\/-]*)/gi;
function copyChip(v, shown) { return `<button type="button" class="np-val" data-copy="${esc(v)}" title="Click to copy">${shown == null ? esc(v) : shown}<span class="np-cp" aria-hidden="true">${I.copy}</span></button>`; }
function noteValues(s, keep) {
  const chip = (v) => keep(copyChip(v));
  s = s.replace(VAL_LABELS, (m, pre, label, sep, v) => {
    const val = v.replace(/[._\/-]+$/, ''), tail = v.slice(val.length);
    if (val.length < 3 || !/\d/.test(val)) return m;
    return pre + label + sep + chip(val) + tail;
  });
  s = s.replace(/\b[0-9A-Fa-f]{2}([:-])(?:[0-9A-Fa-f]{2}\1){4}[0-9A-Fa-f]{2}\b|\b[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\b/g, (m) => chip(m)); // MAC
  s = s.replace(/\b[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\b/g, (m) => chip(m)); // GUID
  s = s.replace(/(^|[^\w.])((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(?:\/\d{1,2}|:\d{1,5})?)(?![\w.]*\d)/g, (m, pre, ip) => pre + chip(ip)); // IPv4
  s = s.replace(/(^|[^\w:])((?:[0-9A-Fa-f]{1,4}:){1,7}(?::?[0-9A-Fa-f]{1,4}){1,7})(?![\w:])/g, (m, pre, ip) => {
    const full = ip.split(':').length >= 6 && !ip.includes('::'), short = ip.includes('::') && /[a-f]/i.test(ip);
    return full || short ? pre + chip(ip) : m;
  }); // IPv6
  s = s.replace(/(^|[^\w+\/.-])((?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d{1,6})?|\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4})(?![\w-])/g, (m, pre, ph) => {
    const digits = ph.replace(/\s*(?:x|ext\.?|extension)\s*(\d+)$/i, ',$1').replace(/[^\d+,]/g, '');
    if (digits.replace(/\D/g, '').length < 10) return m;
    return pre + keep(`<a href="tel:${esc(digits)}" class="np-tel">${esc(ph)}</a><button type="button" class="np-cpb" data-copy="${esc(ph)}" title="Copy" aria-label="Copy ${esc(ph)}">${I.copy}</button>`);
  }); // phone
  s = s.replace(/\b[A-Z0-9]{4,8}(?:-[A-Z0-9]{4,8}){2,}\b/g, (m) => (/\d/.test(m) && /[A-Z]/.test(m) ? chip(m) : m)); // license keys
  s = s.replace(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,}\b|\b\d{8,}\b/g, (m) => chip(m)); // serial-like tokens, long numbers
  return s;
}
function mdInline(raw, opts) {
  const tokens = [];
  const keep = (html) => `\u0001${tokens.push(html) - 1}\u0002`;
  const link = (href, text) => keep(/^(https?|mailto):/i.test(href)
    ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`
    : `<a href="${esc(appLinkHref(href))}" class="app-link">${text}</a>`);
  const values = opts && opts.values;
  let s = String(raw).replace(/[\u0001\u0002]/g, '');
  s = s.replace(/`([^`\n]+)`/g, (m, c) => keep(values ? copyChip(c, `<code>${esc(c)}</code>`) : `<code>${esc(c)}</code>`));
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, text, url) => { const h = safeHref(url); return h ? link(h, esc(text)) : m; });
  s = s.replace(/\b((?:https?:\/\/|www\.|sintr:\/\/)[^\s<>"'\u0001\u0002]+)/gi, (m, url) => {
    let trail = '';
    while (/[.,;:!?'")\]]$/.test(url)) {
      if (url.endsWith(')') && (url.match(/\(/g) || []).length >= (url.match(/\)/g) || []).length) break;
      trail = url.slice(-1) + trail; url = url.slice(0, -1);
    }
    const h = safeHref(url);
    return (h ? link(h, esc(url)) : esc(url)) + trail;
  });
  s = s.replace(/\b([\w.+-]+@[\w-]+(?:\.[\w-]+)+)\b/g, (m, e) => keep(`<a href="mailto:${esc(e)}">${esc(e)}</a>`));
  if (values) s = noteValues(s, keep);
  s = esc(s);
  s = s.replace(/\*\*(?=\S)(.+?)\*\*/g, (m, x) => (/\s$/.test(x) ? m : `<strong>${x}</strong>`));
  s = s.replace(/(^|[^\w])__(?=\S)(.+?)__(?!\w)/g, (m, pre, x) => (/\s$/.test(x) ? m : `${pre}<strong>${x}</strong>`));
  s = s.replace(/(^|[^\w*])\*(?=[^\s*])([^*]+?)\*(?![\w*])/g, (m, pre, x) => (/\s$/.test(x) ? m : `${pre}<em>${x}</em>`));
  s = s.replace(/(^|[^\w])_(?=[^\s_])([^_]+?)_(?!\w)/g, (m, pre, x) => (/\s$/.test(x) ? m : `${pre}<em>${x}</em>`));
  s = s.replace(/~~(?=\S)(.+?)~~/g, (m, x) => `<del>${x}</del>`);
  return s.replace(/\u0001(\d+)\u0002/g, (m, i) => tokens[+i]);
}
function renderMarkdown(text, opts) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  let html = '', list = null, para = [];
  const flush = () => { if (para.length) { html += `<p>${para.map((l) => mdInline(l, opts)).join('<br>')}</p>`; para = []; } };
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  const open = (tag, start) => { if (list !== tag) { close(); html += tag === 'ol' && start && start !== '1' ? `<ol start="${+start}">` : `<${tag}>`; list = tag; } };
  for (const line of lines) {
    let m;
    if (!line.trim()) { flush(); close(); continue; }
    if ((m = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/))) { flush(); close(); html += `<p class="md-h${m[1].length}">${mdInline(m[2], opts)}</p>`; continue; }
    if ((m = line.match(/^\s*[-*•+]\s+\[( |x|X)\]\s+(.*)$/))) { flush(); open('ul'); html += `<li class="md-task${m[1] === ' ' ? '' : ' done'}">${mdInline(m[2], opts)}</li>`; continue; }
    if ((m = line.match(/^\s*[-*•+]\s+(.*)$/))) { flush(); open('ul'); html += `<li>${mdInline(m[1], opts)}</li>`; continue; }
    if ((m = line.match(/^\s*(\d{1,4})[.)]\s+(.*)$/))) { flush(); open('ol', m[1]); html += `<li>${mdInline(m[2], opts)}</li>`; continue; }
    if ((m = line.match(/^\s*>\s?(.*)$/))) { flush(); close(); html += `<blockquote>${mdInline(m[1], opts)}</blockquote>`; continue; }
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
