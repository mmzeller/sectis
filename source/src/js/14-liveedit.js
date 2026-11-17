/* ===================== Live notes: Markdown that stays formatted while you type =====================
   The Notepad's editor (and a sticky's). A note is still plain Markdown text, but it shows
   formatted as you type. Bullets, numbers, checkboxes, headings and quotes always show as
   themselves (their Markdown stays hidden, like in Notes), and the line you're on shows its
   **, *, ~~, ` and link Markdown so you can see what you're changing. Checkboxes (- [ ] and
   - [x]) tick with a click. Return carries on a list (bullets, numbers, checkboxes, quotes) and
   Return on an empty item ends it; Backspace at the start of an item (or heading or quote)
   takes its bullet, checkbox or number away.
   Tab (or ⌘]) puts a list item, with the items under it, a level in, under the item above it;
   ⇧Tab (or ⌘[) takes it out a level. In Markdown a level is a tab in front of the bullet, and
   the editor reads 2 or 4 spaces the same way (listLevels, 13-notes.js). Return on an empty
   item that's in a level, or Backspace at its start, takes it out one. Tab where there's no
   list item moves on, as everywhere else, and a note you came to by Tab lets Tab go on
   through it until you type or click in it (leNav), so tabbing round the app never gets stuck.
   Typing [] and a space at the start of a line makes a checkbox.
   Keys: ⌘B bold, ⌘I italic, ⌘U underline (<u>…</u>), ⇧⌘X strikethrough, ⇧⌘H highlight
   (==…==), ⌘E code, ⌘K link, ⇧⌘L checkbox (or tick it), ⌘Z / ⇧⌘Z undo and redo. The browser's
   own Bold / Italic / Underline (iPhone's B I U menu) do the same.
   In Rich Text (.le-rich, 14-richtext.js) none of the Markdown shows, and editing that could
   split it is done there instead. Pasting a link over selected text links it; copying copies the
   Markdown.
   How: a contenteditable div (.le) with one div per line (.le-ln); the note is the lines' text
   joined with \n. Typing at the caret goes straight in, so the keyboard and input methods work
   as usual, and only a line whose formatting changed is redrawn. Everything else (deleting,
   typing over a selection, new lines, pastes, the shortcuts) changes the text here and redraws
   it: the browser's own deleting would take hidden markers next to the caret with it. Each editor keeps its
   own undo history (by its data-fkey, so it survives a redraw of the Notepad). */
const LE_ITEM = /^(\s*)(?:([-*•+])(\s+)\[[ xX]\](\s+)|([-*•+])(\s+)|(\d{1,4})([.)])(\s+)|>(\s?))/;
const LE_MARKER_ONLY = /^\s*(?:[-*•+]\s+\[[ xX]\]\s+|[-*•+]\s+|\d{1,4}[.)]\s+|>\s?|#{1,3}\s+)$/;
const LE_TASK = /^(\s*[-*•+]\s+)\[([ xX])\]/;
const leMk = (s, cls = 'lm') => `<span class="${cls}">${esc(s)}</span>`;
const leIsW = (c) => !!c && /\w/.test(c);
const leIsS = (c) => !c || /\s/.test(c);

/* ---- drawing: every character of the text is in the editor. A line's own Markdown (its
   bullet, checkbox, number, # or >) is in a hidden .lb span and drawn by the line itself; the
   inline Markdown is in .lm spans, shown on the line you're on ---- */
const LE_BLOCK = [
  [/^(\s{0,3}(#{1,3})\s+)(.*)$/, (m) => ({ cls: 'le-h' + m[2].length, pre: m[1], rest: m[3] })], // "# " alone is an empty heading, like "- " is an empty bullet
  [/^(\s*[-*•+]\s+\[([ xX])\]\s+)(.*)$/, (m) => ({ cls: 'le-task' + (m[2] === ' ' ? '' : ' le-done'), pre: m[1], rest: m[3] })],
  [/^(\s*[-*•+]\s+)(.*)$/, (m) => ({ cls: 'le-li', pre: m[1], rest: m[2] })],
  [/^(\s*(\d{1,4}[.)])\s+)(.*)$/, (m) => ({ cls: 'le-ol', pre: m[1], rest: m[3], n: m[2] })],
  [/^(\s*>\s?)(.*)$/, (m) => ({ cls: 'le-q', pre: m[1], rest: m[2] })],
];
function leBlock(line) {
  for (const [re, f] of LE_BLOCK) { const m = line.match(re); if (m) return f(m); }
  return { cls: '', pre: '', rest: line };
}
function leLine(line) {
  const b = leBlock(line), inner = leInline(b.rest);
  return { cls: 'le-ln' + (b.cls ? ' ' + b.cls : ''), n: b.n || null, html: (b.pre ? leMk(b.pre, 'lm lb') : '') + (inner || (b.pre ? '<br>' : '')) };
}
/* where an emphasis run that opens at i closes, or -1 (the same rules the formatted view uses) */
function leClose(s, i, d) {
  const L = d.length, prev = s[i - 1], first = s[i + L];
  if (leIsS(first)) return -1;
  if (d[0] === '_' && leIsW(prev)) return -1;
  if (L === 1 && (leIsW(prev) || prev === d || first === d)) return -1;
  for (let j = s.indexOf(d, i + L + 1); j > 0; j = s.indexOf(d, j + 1)) {
    const before = s[j - 1], after = s[j + L];
    if (leIsS(before)) continue;
    if (L === 1 && (before === d || after === d || leIsW(after))) continue;
    if (d === '__' && leIsW(after)) continue;
    return j;
  }
  return -1;
}
/* where a ==highlight== that opens at i closes, or -1. Not inside a word (x==y isn't one) */
function leCloseHi(s, i) {
  const prev = s[i - 1], first = s[i + 2];
  if (leIsS(first) || first === '=' || prev === '=' || leIsW(prev)) return -1;
  for (let j = s.indexOf('==', i + 3); j > 0; j = s.indexOf('==', j + 1)) {
    const before = s[j - 1], after = s[j + 2];
    if (leIsS(before) || before === '=' || after === '=' || leIsW(after)) continue;
    return j;
  }
  return -1;
}
/* a line's inline Markdown as a tree: text (t), code, links (a), and runs of formatting
   (strong, em, del, u, mark) with what's inside them. a..b is where each is in the string.
   The editor draws it (leInline), and Rich Text works on it character by character (leRoles) */
const LE_TAG_MARK = { strong: 'b', em: 'i', del: 's', u: 'u', mark: 'h' };
function leTree(s, base = 0) {
  const out = [];
  let plain = '', at = 0, i = 0;
  const flush = () => { if (plain) { out.push({ k: 't', s: plain, a: base + at, b: base + at + plain.length }); plain = ''; } };
  const put = (str) => { if (!plain) at = i; plain += str; };
  while (i < s.length) {
    const c = s[i], rest = s.slice(i);
    let m;
    if (c === '`' && (m = rest.match(/^`([^`]+)`/))) { flush(); out.push({ k: 'code', s: m[1], a: base + i, b: base + i + m[0].length }); i += m[0].length; continue; }
    if (c === '[' && (m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      const h = safeHref(m[2]);
      if (h) { flush(); out.push({ k: 'a', s: m[1], href: h, url: m[2], md: true, a: base + i, b: base + i + m[0].length }); i += m[0].length; continue; }
    }
    if (/[hws]/i.test(c) && !leIsW(s[i - 1]) && (m = rest.match(/^(?:https?:\/\/|www\.|sintr:\/\/)[^\s<>"']+/i))) {
      let url = m[0];
      while (/[.,;:!?'")\]]$/.test(url)) {
        if (url.endsWith(')') && (url.match(/\(/g) || []).length >= (url.match(/\)/g) || []).length) break;
        url = url.slice(0, -1);
      }
      const h = safeHref(url);
      if (h) { flush(); out.push({ k: 'a', s: url, href: h, url, md: false, a: base + i, b: base + i + url.length }); i += url.length; continue; }
    }
    if (c === '<' && rest.startsWith('<u>')) {
      const j = s.indexOf('</u>', i + 3);
      if (j > i + 3) { flush(); out.push({ k: 'u', o: '<u>', c: '</u>', a: base + i, b: base + j + 4, kids: leTree(s.slice(i + 3, j), base + i + 3) }); i = j + 4; continue; }
    }
    if (c === '=' && s[i + 1] === '=') {
      const j = leCloseHi(s, i);
      if (j > 0) { flush(); out.push({ k: 'mark', o: '==', c: '==', a: base + i, b: base + j + 2, kids: leTree(s.slice(i + 2, j), base + i + 2) }); i = j + 2; continue; }
      put('=='); i += 2; continue;
    }
    if (c === '*' || c === '_' || c === '~') {
      const d = rest.startsWith('**') ? '**' : rest.startsWith('__') ? '__' : rest.startsWith('~~') ? '~~' : c === '~' ? '' : c;
      const j = d ? leClose(s, i, d) : -1;
      if (j > 0) {
        const tag = d === '~~' ? 'del' : d.length === 2 ? 'strong' : 'em';
        flush(); out.push({ k: tag, o: d, c: d, a: base + i, b: base + j + d.length, kids: leTree(s.slice(i + d.length, j), base + i + d.length) });
        i = j + d.length; continue;
      }
      if (d.length === 2) { put(d); i += 2; continue; } // an unclosed ** isn't two single *s
    }
    put(c); i++;
  }
  flush();
  return out;
}
function leDraw(nodes) {
  let out = '';
  for (const n of nodes) {
    if (n.k === 't') out += esc(n.s);
    else if (n.k === 'code') out += leMk('`') + `<code>${esc(n.s)}</code>` + leMk('`');
    else if (n.k === 'a') out += (n.md ? leMk('[') : '') + `<span class="le-a" data-href="${esc(n.href)}">${esc(n.s)}</span>` + (n.md ? leMk(`](${n.url})`) : '');
    else out += leMk(n.o) + `<${n.k}>${leDraw(n.kids)}</${n.k}>` + leMk(n.c);
  }
  return out;
}
const leInline = (s) => leDraw(leTree(s));
/* each character of a line as Rich Text sees it: role p (its bullet, number, # or >), o / c (the
   Markdown that opens or closes a run, a link or code), v (shown). chars: the shown ones, with
   their formatting (m: b bold, i italic, s strikethrough, u underline, h highlight), code, and the
   link they're part of (href, url as written, md: written [like](this) rather than bare) */
const leAddMark = (m, x) => (m.includes(x) ? m : [...m, x].sort().join(''));
function leRoles(line) {
  const blk = leBlock(line), P = blk.pre.length, role = new Array(line.length).fill('p'), chars = [];
  let lid = 0;
  const vis = (s, from, m, extra) => { for (let i = 0; i < s.length; i++) { role[from + i] = 'v'; chars.push(Object.assign({ c: s[i], at: from + i, m }, extra)); } };
  const mark = (from, len, r) => { for (let k = 0; k < len; k++) role[from + k] = r; };
  const walk = (nodes, m) => nodes.forEach((n) => {
    const a = P + n.a, b = P + n.b;
    if (n.k === 't') { vis(n.s, a, m); return; }
    if (n.k === 'code') { mark(a, 1, 'o'); mark(b - 1, 1, 'c'); vis(n.s, a + 1, m, { code: true }); return; }
    if (n.k === 'a') {
      const o = n.md ? 1 : 0; lid++;
      if (n.md) { mark(a, 1, 'o'); mark(a + 1 + n.s.length, b - (a + 1 + n.s.length), 'c'); }
      vis(n.s, a + o, m, { href: n.href, url: n.url, md: n.md, lid });
      return;
    }
    mark(a, n.o.length, 'o'); mark(b - n.c.length, n.c.length, 'c');
    walk(n.kids, leAddMark(m, LE_TAG_MARK[n.k]));
  });
  walk(leTree(blk.rest), '');
  return { pre: blk.pre, role, chars };
}
/* the editor's inside for some text; lines a..b show their Markdown. A list item that's in a
   level (Tab) has data-lv and --lv, which push it in */
function leHTML(text, a = -1, b = -1) {
  const lines = String(text || '').split('\n'), lv = listLevels(lines);
  return lines.map((l, i) => { const r = leLine(l); return `<div class="${r.cls}${i >= a && i <= b ? ' le-on' : ''}"${r.n ? ` data-n="${esc(r.n)}"` : ''}${lv[i] > 0 ? ` data-lv="${lv[i]}" style="--lv:${lv[i]}"` : ''}>${r.html || '<br>'}</div>`; }).join('');
}
/* after a line changed: the levels of the lines it could have moved (the ones after it, too) */
function leLevelsTo(divs, lines) {
  const lv = listLevels(lines);
  divs.forEach((d, i) => {
    if (!d) return;
    const want = lv[i] > 0 ? String(lv[i]) : null;
    if ((d.dataset.lv || null) === want) return;
    if (want) { d.dataset.lv = want; d.style.setProperty('--lv', want); } else { delete d.dataset.lv; d.style.removeProperty('--lv'); if (!d.getAttribute('style')) d.removeAttribute('style'); }
  });
}

/* ---- reading it back ---- */
const leHost = (n) => { const x = n && (n.nodeType === 1 ? n : n.parentElement); return x && x.closest ? x.closest('.le') : null; };
function leNodeText(n) {
  if (n.nodeType === 3) return n.data.replace(/ /g, ' ');
  if (n.nodeType !== 1 || n.tagName === 'BR') return '';
  let s = ''; for (const c of n.childNodes) s += leNodeText(c);
  return s;
}
/* the editor's lines: its line divs, or whatever the browser left loose between them */
function leGroups(el) {
  const g = []; let cur = null;
  for (const n of el.childNodes) {
    if (n.nodeType === 1 && n.tagName === 'DIV') { g.push({ div: n, nodes: [n] }); cur = null; continue; }
    if (n.nodeType === 1 && n.tagName === 'BR') { if (cur) cur = null; else g.push({ nodes: [] }); continue; }
    if (!cur) { cur = { nodes: [] }; g.push(cur); }
    cur.nodes.push(n);
  }
  if (!g.length) g.push({ nodes: [] });
  return g;
}
const leGText = (g) => g.nodes.map(leNodeText).join('');
const leText = (el) => leGroups(el).map(leGText).join('\n');
function leCount(x, node, off, st) {
  if (x === node) {
    if (x.nodeType === 3) st.n += Math.min(off, x.data.length);
    else for (let i = 0; i < off && i < x.childNodes.length; i++) st.n += leNodeText(x.childNodes[i]).length;
    st.done = true; return;
  }
  if (x.nodeType === 3) { st.n += x.data.length; return; }
  if (x.nodeType !== 1 || x.tagName === 'BR') return;
  for (const c of x.childNodes) { leCount(c, node, off, st); if (st.done) return; }
}
/* a spot in the editor (node, offset) as a place in the text */
function leOffset(el, node, off) {
  const groups = leGroups(el);
  let base = 0;
  if (node === el) {
    const child = el.childNodes[off];
    for (const g of groups) { if (child && g.nodes.includes(child)) return base; base += leGText(g).length + 1; }
    return Math.max(0, base - 1);
  }
  for (const g of groups) {
    const st = { n: 0, done: false };
    for (const x of g.nodes) { leCount(x, node, off, st); if (st.done) return base + st.n; }
    base += leGText(g).length + 1;
  }
  return Math.max(0, base - 1);
}
/* a place in the text as a spot in the editor (in Rich Text, always in shown text: rPoint) */
function lePoint(el, off) {
  if (leRich(el)) { const p = rPoint(el, off); if (p) return p; }
  const groups = leGroups(el);
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi], len = leGText(g).length;
    if (off <= len || gi === groups.length - 1) {
      off = Math.max(0, Math.min(off, len));
      let n = 0;
      const texts = [];
      const walk = (x) => { if (x.nodeType === 3) texts.push(x); else if (x.nodeType === 1 && x.tagName !== 'BR') x.childNodes.forEach(walk); };
      g.nodes.forEach(walk);
      for (const t of texts) {
        const L = t.data.length, hid = t.parentElement && t.parentElement.closest('.lb');
        if (off < n + L || (off === n + L && !hid)) return [t, off - n];
        n += L;
      }
      if (g.div) return [g.div, g.div.childNodes.length && g.div.lastChild.nodeName === 'BR' ? g.div.childNodes.length - 1 : g.div.childNodes.length];
      const i = g.nodes.length ? [...el.childNodes].indexOf(g.nodes[0]) : el.childNodes.length;
      return [el, Math.max(0, i)];
    }
    off -= len + 1;
  }
  return [el, 0];
}
function leGetSel(el) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) return null;
  const a = leOffset(el, sel.anchorNode, sel.anchorOffset), f = leOffset(el, sel.focusNode, sel.focusOffset);
  return { s: Math.min(a, f), e: Math.max(a, f), back: f < a };
}
function leSetSel(el, s, e = s, back = false) {
  const sel = window.getSelection(); if (!sel) return;
  const [an, ao] = lePoint(el, back ? e : s), [fn, fo] = lePoint(el, back ? s : e);
  try { sel.setBaseAndExtent(an, ao, fn, fo); } catch (err) { /* ignore */ }
}
function lePointAt(x, y) {
  if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); return p && { node: p.offsetNode, offset: p.offset }; }
  if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); return r && { node: r.startContainer, offset: r.startOffset }; }
  return null;
}
const leLineAt = (t, off) => { let n = 0; for (let i = t.indexOf('\n'); i >= 0 && i < off; i = t.indexOf('\n', i + 1)) n++; return n; };
/* which characters of a line are Markdown (hidden or muted when it isn't the line you're on) */
const leMask = (line) => leRoles(line).role.map((r) => r !== 'v');
/* the place in a line after `vis` of its shown characters, past any Markdown that follows them
   (so a click at the start of a heading types into the heading, and one at the end of a bold
   line types after the bold) */
function leVisToOff(line, vis, mask = leMask(line)) {
  let seen = 0, p = 0;
  while (p < mask.length && (mask[p] || seen < vis)) { if (!mask[p]) seen++; p++; }
  return p;
}
/* put the caret in a note's line where it was clicked in the formatted note */
function leCaretAtShown(el, ln, vis) {
  const t = leText(el), lines = t.split('\n');
  if (lines[ln] == null) { leSetSel(el, t.length); return; }
  if (leRich(el)) { leSetSel(el, rRaw(t, { ln, v: vis, bias: 'in' })); return; }
  let base = 0; for (let k = 0; k < ln; k++) base += lines[k].length + 1;
  leSetSel(el, base + leVisToOff(lines[ln], vis));
}

/* ---- each editor's undo history ---- */
const leStates = new WeakMap(), leByKey = new Map();
function leState(el) {
  const k = el.dataset.fkey;
  let st = leStates.get(el) || (k && leByKey.get(k));
  if (!st) st = { text: null, lines: null, hist: null, hi: 0, kind: null, at: 0, composing: false };
  leStates.set(el, st); if (k) leByKey.set(k, st);
  return st;
}
/* start from what's in it now, unless the history already ends there */
function leFresh(el) {
  const st = leState(el), text = leText(el);
  if (st.text !== text || !st.hist) { st.hist = [{ t: text, s: text.length, e: text.length }]; st.hi = 0; st.kind = null; }
  st.text = text; st.lines = text.split('\n');
  return st;
}
function lePush(el, text, s, e, kind, fresh) {
  const st = leState(el), now = Date.now();
  if (!st.hist) { st.hist = [{ t: text, s, e }]; st.hi = 0; st.kind = kind; st.at = now; return; }
  const top = st.hist[st.hi];
  if (top && top.t === text) { top.s = s; top.e = e; return; }
  st.hist.length = st.hi + 1;
  // typing joins up into one step until a pause, or a few seconds of it
  if (!fresh && (kind === 'type' || kind === 'del') && st.kind === kind && st.hi > 0 && now - st.at < 1500 && now - st.since < 4000) st.hist[st.hi] = { t: text, s, e };
  else { st.hist.push({ t: text, s, e }); st.hi++; st.since = now; if (st.hist.length > 300) { st.hist.shift(); st.hi--; } }
  st.kind = kind; st.at = now;
}
function leUndo(el, redo) {
  const st = leState(el); if (!st.hist) leFresh(el);
  const i = st.hi + (redo ? 1 : -1); if (i < 0 || i >= st.hist.length) return;
  const from = leText(el), to = st.hist[i].t;
  // the caret goes where the change was
  let p = 0; while (p < from.length && p < to.length && from[p] === to[p]) p++;
  let q = 0; while (q < from.length - p && q < to.length - p && from[from.length - 1 - q] === to[to.length - 1 - q]) q++;
  st.hi = i; st.kind = null;
  leRender(el, to, to.length - q, to.length - q);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ---- changing it ---- */
function leRender(el, text, s = -1, e = s, back = false) {
  const st = leState(el), on = s >= 0 && document.activeElement === el;
  el.innerHTML = leHTML(text, on ? leLineAt(text, s) : -1, on ? leLineAt(text, e) : -1);
  el.classList.toggle('le-empty', !text);
  st.text = text; st.lines = text.split('\n');
  if (on) leSetSel(el, s, e, back);
}
/* replace s..e with ins; the caret ends after it unless o.s / o.e say where */
function leEdit(el, s, e, ins, o = {}) {
  const t = leText(el), text = t.slice(0, s) + ins + t.slice(e);
  const cs = o.s != null ? o.s : s + ins.length, ce = o.e != null ? o.e : cs;
  leRender(el, text, cs, ce);
  lePush(el, text, cs, ce, o.kind || 'edit', o.fresh);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
/* after the browser typed something: redraw the lines whose formatting changed */
const leTmp = document.createElement('div');
function leSync(el) {
  const st = leState(el), groups = leGroups(el), lines = groups.map(leGText), text = lines.join('\n');
  const sel = leGetSel(el) || { s: text.length, e: text.length, back: false };
  const tidy = st.lines && st.lines.length === lines.length && groups.every((g) => g.div && g.div.parentNode === el);
  if (!tidy) leRender(el, text, sel.s, sel.e, sel.back);
  else {
    let moved = false;
    lines.forEach((ln, i) => {
      if (ln === st.lines[i]) return;
      const r = leLine(ln), d = groups[i].div, on = d.classList.contains('le-on');
      leTmp.innerHTML = r.html || '<br>';
      if (d.innerHTML !== leTmp.innerHTML) { d.innerHTML = leTmp.innerHTML; moved = true; }
      const cls = r.cls + (on ? ' le-on' : '');
      if (d.className !== cls) d.className = cls;
      if ((d.dataset.n || null) !== r.n) { if (r.n) d.dataset.n = r.n; else delete d.dataset.n; }
    });
    if (moved) leSetSel(el, sel.s, sel.e, sel.back);
    if (lines.some((ln, i) => ln !== st.lines[i])) leLevelsTo(groups.map((g) => g.div), lines);
    st.text = text; st.lines = lines;
    el.classList.toggle('le-empty', !text);
  }
  lePush(el, text, sel.s, sel.e, 'type');
  if (leRich(el)) { st.pend = null; if (sel.s === sel.e) rAfterType(el, text, sel.s); }
  // [] and a space at the start of a line: a checkbox
  if (sel.s === sel.e) {
    const ls = text.lastIndexOf('\n', sel.s - 1) + 1, m = text.slice(ls, sel.s).match(/^(\s*)\[ ?\] $/);
    if (m) leEdit(el, ls, sel.s, m[1] + '- [ ] ', { kind: 'type' });
  }
}
/* Return: a new line, carrying on the list you're in */
function leNewline(el, s, e, carry) {
  const text = leText(el), ls = text.lastIndexOf('\n', s - 1) + 1;
  let lend = text.indexOf('\n', ls); if (lend < 0) lend = text.length;
  const line = text.slice(ls, lend), m = carry && s === e ? line.match(LE_ITEM) : null;
  if (!m || s - ls < m[0].length) { leEdit(el, s, e, '\n', { kind: 'line' }); return; }
  if (!line.slice(m[0].length).trim()) { // Return on an empty item ends the list, or takes it out a level when it's in one
    if ((m[2] || m[5] || m[7]) && leLevelAt(text, leLineAt(text, s)) > 0) { leIndent(el, -1, { s, e: s }); return; }
    leEdit(el, ls, lend, '', { kind: 'line' }); return;
  }
  let next;
  if (m[2]) next = m[1] + m[2] + m[3] + '[ ] ';
  else if (m[5]) next = m[1] + m[5] + m[6];
  else if (m[7]) next = m[1] + (+m[7] + 1) + m[8] + m[9];
  else next = m[1] + '>' + (m[10] || ' ');
  leEdit(el, s, e, '\n' + next, { kind: 'line' });
}
/* ⌘B ⌘I ⌘E ⇧⌘X: wrap the selection (or the word you're in) in Markdown, or unwrap it */
function leWrap(el, kind) {
  const sel = leGetSel(el); if (!sel) return;
  const t = leText(el);
  let a = sel.s, b = sel.e;
  if (a === b) {
    // inside a word: the word; otherwise a pair to type into (or out of, when it's empty)
    let wa = a, wb = a;
    while (wa > 0 && /[\p{L}\p{N}'’-]/u.test(t[wa - 1])) wa--;
    while (wb < t.length && /[\p{L}\p{N}'’-]/u.test(t[wb])) wb++;
    if (wa < a && wb > a) { a = wa; b = wb; } else {
      const [o, c] = leMarkFor(t, a, a, kind);
      if (t.slice(a - o.length, a) === o && t.slice(a, a + c.length) === c) { leEdit(el, a - o.length, a + c.length, '', { s: a - o.length }); return; }
      leEdit(el, a, a, o + c, { s: a + o.length }); return;
    }
  }
  while (a < b && /\s/.test(t[a])) a++;
  while (b > a && /\s/.test(t[b - 1])) b--;
  if (a === b) return;
  if (t.slice(a, b).includes('\n')) { leWrapLines(el, t, a, b, kind); return; }
  // already like that: take it off (the marks just outside the selection, or at its ends)
  const off = leMarkAround(t, a, b, kind);
  if (off) { const O = off.o.length, C = off.c.length; leEdit(el, off.a, off.b, t.slice(off.a + O, off.b - C), { s: off.a, e: off.b - O - C }); return; }
  const [o, c] = leMarkFor(t, a, b, kind);
  leEdit(el, a, b, o + t.slice(a, b) + c, { s: a + o.length, e: b + o.length });
}
const leRun = (t, i, dir, c) => { let n = 0; while (t[i + (dir < 0 ? -1 - n : n)] === c) n++; return n; };
/* the marks (opening, closing) for a kind of formatting at a..b: bold right inside italic uses
   __, italic right inside bold uses _, so the two don't run together into *** */
function leMarkFor(t, a, b, kind) {
  if (kind === 'c') return ['`', '`'];
  if (kind === 's') return ['~~', '~~'];
  if (kind === 'u') return ['<u>', '</u>'];
  if (kind === 'h') return ['==', '=='];
  const sa = leRun(t, a, -1, '*'), sb = leRun(t, b, 1, '*');
  if (kind === 'b') return sa === 1 && sb === 1 ? ['__', '__'] : ['**', '**'];
  return sa === 2 && sb === 2 ? ['_', '_'] : ['*', '*'];
}
/* the marks of that kind around a..b (just outside it or at its ends), if there are any */
function leMarkAround(t, a, b, kind) {
  const marks = kind === 'c' ? ['`'] : kind === 's' ? ['~~'] : kind === 'u' ? [['<u>', '</u>']] : kind === 'h' ? ['=='] : kind === 'b' ? ['**', '__'] : ['*', '_'];
  for (const pair of marks) {
    const [o, c] = Array.isArray(pair) ? pair : [pair, pair], mk = o, L = o.length, C = c.length;
    const fits = (x, y) => {
      if (t.slice(x, x + L) !== o || t.slice(y - C, y) !== c || y - x < L + C + 1) return false;
      if (L === 1 && mk === '*') { const r1 = leRun(t, x, 1, '*'), r2 = leRun(t, y, -1, '*'); return r1 % 2 === 1 && r2 % 2 === 1; } // * of ***, not of **
      if (L === 1) return t[x + 1] !== mk && t[y - 2] !== mk;
      return true;
    };
    if (fits(a - L, b + C)) return { a: a - L, b: b + C, o, c };
    if (fits(a, b)) return { a, b, o, c };
  }
  return null;
}
/* across lines: each line's text, inside its list marker */
function leWrapLines(el, t, a, b, kind) {
  const ls = t.lastIndexOf('\n', a - 1) + 1;
  let le = t.indexOf('\n', b); if (le < 0) le = t.length;
  const lines = t.slice(ls, le).split('\n');
  let pos = ls;
  const parts = lines.map((line) => {
    const start = pos; pos += line.length + 1;
    const pre = (line.match(LE_ITEM) || line.match(/^\s*#{1,3}\s+/) || [''])[0];
    const x = Math.max(start + pre.length, a) - start, y = Math.min(start + line.length, b) - start;
    if (y <= x) return line;
    let i = x, j = y;
    while (i < j && /\s/.test(line[i])) i++;
    while (j > i && /\s/.test(line[j - 1])) j--;
    if (i === j) return line;
    const [o, c] = leMarkFor(line, i, j, kind);
    return line.slice(0, i) + o + line.slice(i, j) + c + line.slice(j);
  });
  const out = parts.join('\n');
  leEdit(el, ls, le, out, { s: ls, e: ls + out.length });
}
/* ⌘K: a link of the selection (or a link to type) */
function leLink(el) {
  const sel = leGetSel(el); if (!sel) return;
  const t = leText(el), picked = t.slice(sel.s, sel.e);
  if (picked.includes('\n')) return;
  if (!picked) { leEdit(el, sel.s, sel.e, '[]()', { s: sel.s + 1 }); return; }
  if (/^(?:https?:\/\/|www\.)\S+$/i.test(picked.trim())) { leEdit(el, sel.s, sel.e, `[](${picked.trim()})`, { s: sel.s + 1 }); return; }
  const ins = `[${picked}]()`; leEdit(el, sel.s, sel.e, ins, { s: sel.s + ins.length - 1 });
}
/* ⇧⌘L: the line a checkbox, or tick the one it is (several lines: all of them) */
function leTask(el) {
  const sel = leGetSel(el); if (!sel) return;
  const t = leText(el), lines = t.split('\n'), la = leLineAt(t, sel.s), lb = leLineAt(t, sel.e);
  const idx = []; for (let i = la; i <= lb; i++) if (la === lb || lines[i].trim()) idx.push(i);
  if (!idx.length) return;
  const tasks = idx.filter((i) => LE_TASK.test(lines[i]));
  const allTasks = tasks.length === idx.length, tick = allTasks && tasks.some((i) => lines[i].match(LE_TASK)[2] === ' ');
  const shift = new Map(); // line → [old prefix length, new prefix length]
  idx.forEach((i) => {
    const line = lines[i], m = line.match(LE_TASK);
    if (allTasks) { lines[i] = m[1] + (tick ? '[x]' : '[ ]') + line.slice(m[0].length); return; }
    if (m) return;
    const pm = line.match(/^(\s*)(?:[-*•+]\s+|\d{1,4}[.)]\s+|#{1,3}\s+|>\s?)?/);
    lines[i] = pm[1] + '- [ ] ' + line.slice(pm[0].length);
    shift.set(i, [pm[0].length, pm[1].length + 6]);
  });
  const starts = []; let o = 0; t.split('\n').forEach((l) => { starts.push(o); o += l.length + 1; });
  const map = (off) => {
    const i = leLineAt(t, off), p = off - starts[i];
    let base = 0; for (let k = 0; k < i; k++) base += lines[k].length + 1;
    const sh = shift.get(i); if (!sh) return base + p;
    return base + (p < sh[0] ? sh[1] : p - sh[0] + sh[1]);
  };
  const text = lines.join('\n'), s = map(sel.s), e = map(sel.e);
  leRender(el, text, s, e, sel.back);
  lePush(el, text, s, e, 'edit');
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
/* tick or untick the checkbox on line i */
function leTick(el, i) {
  const t = leText(el), lines = t.split('\n'), m = lines[i] != null && lines[i].match(LE_TASK); if (!m) return;
  lines[i] = m[1] + (m[2] === ' ' ? '[x]' : '[ ]') + lines[i].slice(m[0].length);
  const sel = document.activeElement === el ? leGetSel(el) : null, text = lines.join('\n');
  leRender(el, text, sel ? sel.s : -1, sel ? sel.e : -1, sel && sel.back);
  lePush(el, text, sel ? sel.s : 0, sel ? sel.e : 0, 'edit');
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
/* ---- Tab and ⇧Tab: list items in and out a level ---- */
const LE_OL_HEAD = /^(\s*)(\d{1,4})([.)]\s)/;
const leLevelAt = (t, ln) => listLevels(t.split('\n'))[ln];
/* lines la..lb's list items, each with the items under it, one level in (dir 1) or out (-1).
   An item goes in only under the one above it (so not the first of a list), and out only when
   it's in. In the lists that change, every indent is written as tabs, one a level, and the
   numbers go in order (a numbered list inside an item starts at 1).
   null: no list items there; else { text, map, moved }, map taking a place in the old text to
   where it is in the new */
function leIndentText(text, la, lb, dir) {
  const lines = text.split('\n'), n = lines.length, lv = listLevels(lines), tgt = lv.slice(), moved = new Set();
  let items = false;
  for (let i = Math.max(0, la); i <= lb && i < n; i++) {
    if (lv[i] < 0) continue;
    items = true;
    if (moved.has(i)) continue; // it went along with an item above it
    let j = i + 1; while (j < n && lv[j] > lv[i]) j++; // i and what's under it
    if (dir > 0 ? !(i > 0 && lv[i - 1] >= 0 && tgt[i] <= tgt[i - 1]) : tgt[i] <= 0) continue;
    for (let k = i; k < j; k++) { tgt[k] += dir; moved.add(k); }
  }
  if (!items) return null;
  const heads = new Map(), done = new Set(); // line → [old length, new length] of its indent (and number)
  moved.forEach((i) => {
    let a = i; while (a > 0 && lv[a - 1] >= 0) a--; // the list it's in
    if (done.has(a)) return; done.add(a);
    const cnt = []; // the last number at each level of the item we're under (null: a bullet came between)
    for (let k = a; k < n && lv[k] >= 0; k++) {
      const L = tgt[k], line = lines[k], om = line.match(LE_OL_HEAD);
      cnt.length = L + 1; // lists inside the item before end here
      let head = '\t'.repeat(L), old = line.match(/^\s*/)[0].length;
      if (om) {
        const num = cnt[L] != null ? cnt[L] + 1 : L > 0 || moved.has(k) ? 1 : +om[2];
        cnt[L] = num; head += num; old += om[2].length;
      } else cnt[L] = null;
      if (line.slice(0, old) === head) continue;
      lines[k] = head + line.slice(old);
      heads.set(k, [old, head.length]);
    }
  });
  const was = text.split('\n'), starts = [], now = [];
  let o = 0; was.forEach((l) => { starts.push(o); o += l.length + 1; });
  o = 0; lines.forEach((l) => { now.push(o); o += l.length + 1; });
  const map = (off) => {
    const i = leLineAt(text, off), p = off - starts[i], h = heads.get(i);
    return now[i] + (!h || p === 0 ? p : p >= h[0] ? p - h[0] + h[1] : h[1]); // the start of a line stays its start
  };
  return { text: lines.join('\n'), map, moved: moved.size > 0 };
}
function leApply(el, text, s, e, back) {
  leRender(el, text, s, e, back);
  lePush(el, text, s, e, 'edit');
  if (leRich(el)) leState(el).pend = null;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  if (leRich(el)) rTools(el);
}
/* the list item the caret's on (or the ones you've selected) in or out a level; false when
   there's no list item there */
function leIndent(el, dir, at) {
  const sel = at || leGetSel(el); if (!sel) return false;
  const t = leText(el), la = leLineAt(t, sel.s);
  let lb = leLineAt(t, sel.e);
  if (lb > la && t[sel.e - 1] === '\n') lb--; // a selection that ends at the start of a line leaves that line out
  const r = leIndentText(t, la, lb, dir); if (!r) return false;
  if (r.moved) leApply(el, r.text, r.map(sel.s), r.map(sel.e), sel.back);
  return true;
}
/* a note you came to by pressing Tab (going through the app with the keyboard) lets Tab carry
   on through it, until you type in it, click in it or press another key there */
const leNav = new WeakSet();
let leTabAt = 0;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { leTabAt = Date.now(); return; }
  const el = leHost(e.target);
  if (el && !/^(Shift|Meta|Control|Alt|CapsLock|Fn)$/.test(e.key)) leNav.delete(el);
}, true);
document.addEventListener('focusin', (e) => { const el = leHost(e.target); if (el && e.target === el && Date.now() - leTabAt < 300) leNav.add(el); }, true);
document.addEventListener('focusout', (e) => { const el = leHost(e.target); if (el && e.target === el) leNav.delete(el); }, true);
document.addEventListener('pointerdown', (e) => { const el = leHost(e.target); if (el) leNav.delete(el); }, true);
document.addEventListener('beforeinput', (e) => { const el = leHost(e.target); if (el) leNav.delete(el); }, true);
function leOpenLink(href) {
  const web = /^(https?|mailto):/i.test(href), a = document.createElement('a');
  a.href = web ? href : appLinkHref(href);
  if (web) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } else a.className = 'app-link';
  a.hidden = true; document.body.appendChild(a); a.click(); a.remove();
}
const leNorm = (s) => String(s || '').replace(/\r\n?/g, '\n');
/* what a delete key takes when the browser doesn't say: a character (a whole emoji or accented
   letter), a word, or to the start or end of the line */
const leSeg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
function leDelRange(t, at, type) {
  const back = type.includes('Backward');
  const ls = t.lastIndexOf('\n', at - 1) + 1; let le = t.indexOf('\n', at); if (le < 0) le = t.length;
  if (/Line/.test(type)) return back ? [at > ls ? ls : Math.max(0, at - 1), at] : [at, at < le ? le : Math.min(t.length, at + 1)];
  if (/Word/.test(type)) {
    if (back) { let i = at; while (i > 0 && /\s/.test(t[i - 1]) && t[i - 1] !== '\n') i--; while (i > 0 && /[\p{L}\p{N}_]/u.test(t[i - 1])) i--; if (i === at && at > 0) i--; return [i, at]; }
    let j = at; while (j < t.length && /\s/.test(t[j]) && t[j] !== '\n') j++; while (j < t.length && /[\p{L}\p{N}_]/u.test(t[j])) j++; if (j === at && at < t.length) j++; return [at, j];
  }
  if (back) {
    if (at <= 0) return [0, 0];
    if (leSeg) { let prev = 0; const from = Math.max(0, at - 32); for (const g of leSeg.segment(t.slice(from, at))) prev = g.index; return [from + prev, at]; }
    return [at - (/[\uDC00-\uDFFF]/.test(t[at - 1]) && at > 1 ? 2 : 1), at];
  }
  if (at >= t.length) return [at, at];
  if (leSeg) { const g = leSeg.segment(t.slice(at, at + 32))[Symbol.iterator]().next().value; return [at, at + (g ? g.segment.length : 1)]; }
  return [at, at + (/[\uD800-\uDBFF]/.test(t[at]) ? 2 : 1)];
}

/* ---- the browser's edits: plain typing goes in; the rest is done here ---- */
const LE_FMT_INPUT = { formatBold: 'b', formatItalic: 'i', formatUnderline: 'u', formatStrikeThrough: 's' };
document.addEventListener('beforeinput', (e) => {
  const el = leHost(e.target); if (!el) return;
  const t = e.inputType || '';
  if (e.isComposing || t === 'insertCompositionText' || t === 'insertFromComposition' || t === 'deleteCompositionText') return; // input methods type as usual
  if (t === 'historyUndo' || t === 'historyRedo') { e.preventDefault(); leUndo(el, t === 'historyRedo'); return; }
  const fmt = LE_FMT_INPUT[t];
  if (fmt) { e.preventDefault(); if (leRich(el)) rToggle(el, fmt); else leWrap(el, fmt); return; } // Bold, Italic, Underline from the browser's own menus (on iPhone, the B I U one)
  if (t === 'formatIndent' || t === 'formatOutdent') { e.preventDefault(); leIndent(el, t === 'formatIndent' ? 1 : -1); return; } // the browser's own Indent / Outdent
  const sel = leGetSel(el); if (!sel) return;
  const text = leText(el);
  let r = null;
  const tr = e.getTargetRanges ? e.getTargetRanges() : [];
  if (tr && tr.length && el.contains(tr[0].startContainer) && el.contains(tr[0].endContainer)) {
    const x = leOffset(el, tr[0].startContainer, tr[0].startOffset), y = leOffset(el, tr[0].endContainer, tr[0].endOffset);
    r = { s: Math.min(x, y), e: Math.max(x, y) };
  }
  if (leRich(el) && rBeforeInput(e, el, t, sel, r, text)) return;
  if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); leNewline(el, sel.s, sel.e, t === 'insertParagraph'); return; }
  if (t === 'insertText' || t === 'insertReplacementText') {
    const data = leNorm(e.data != null ? e.data : e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
    const a = r ? r.s : sel.s, b = r ? r.e : sel.e;
    if (a !== b || data.includes('\n')) { e.preventDefault(); leEdit(el, a, b, data, { kind: 'type', fresh: a !== b }); } // typing over a selection starts a step of its own
    return;
  }
  if (t.startsWith('insertFrom')) { // pastes and drops normally come through their own events
    e.preventDefault();
    const data = leNorm(e.dataTransfer ? e.dataTransfer.getData('text/plain') : e.data);
    if (data) leEdit(el, r ? r.s : sel.s, r ? r.e : sel.e, data, { kind: 'paste' });
    return;
  }
  if (t.startsWith('delete')) {
    if (t === 'deleteContentBackward' && sel.s === sel.e && sel.s > 0) {
      // right after a list marker, Backspace takes the whole marker away (an item that's in a level goes out one first)
      const ls = text.lastIndexOf('\n', sel.s - 1) + 1;
      if (sel.s > ls && LE_MARKER_ONLY.test(text.slice(ls, sel.s))) {
        e.preventDefault();
        if (leLevelAt(text, leLineAt(text, sel.s)) > 0) { leIndent(el, -1, sel); return; }
        leEdit(el, ls, sel.s, ''); return;
      }
    }
    e.preventDefault();
    let a = r ? r.s : sel.s, b = r ? r.e : sel.e;
    if (a === b) [a, b] = leDelRange(text, a, t);
    // deleting back to the start of a line stops at its bullet, checkbox or number
    const ls = text.lastIndexOf('\n', sel.s - 1) + 1, pre = leBlock(text.slice(ls, text.indexOf('\n', ls) < 0 ? text.length : text.indexOf('\n', ls))).pre.length;
    if (t.includes('Backward') && a < ls + pre && a >= ls && sel.s > ls + pre) a = ls + pre;
    if (b > a) leEdit(el, a, b, '', { kind: t === 'deleteContentBackward' || t === 'deleteContentForward' ? 'del' : 'edit' });
    return;
  }
  e.preventDefault(); // bold, lists and the like from the browser itself: the Markdown keys do these
}, true);
document.addEventListener('input', (e) => {
  const el = leHost(e.target); if (!el || !e.isTrusted) return;
  if (e.isComposing || leState(el).composing) return;
  leSync(el);
}, true);
document.addEventListener('compositionstart', (e) => { const el = leHost(e.target); if (el) leState(el).composing = true; }, true);
document.addEventListener('compositionend', (e) => {
  const el = leHost(e.target); if (!el) return;
  leState(el).composing = false;
  setTimeout(() => { if (el.isConnected && !leState(el).composing) leSync(el); }, 0);
}, true);
document.addEventListener('focusin', (e) => { const el = leHost(e.target); if (el && e.target === el) leFresh(el); }, true);
document.addEventListener('keydown', (e) => {
  const el = leHost(e.target); if (!el || e.isComposing) return;
  // Tab and ⇧Tab, while you're writing a list: its item in or out a level (staying in the note
  // even when it can't go). Anywhere else, or passing through by Tab, Tab moves on as usual
  if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (leNav.has(el) || !leIndent(el, e.shiftKey ? -1 : 1)) return;
    e.preventDefault(); e.stopPropagation();
    return;
  }
  const mod = e.metaKey || e.ctrlKey; if (!mod || e.altKey) return;
  const k = (e.key || '').toLowerCase(), sh = e.shiftKey, rich = leRich(el);
  const wrap = (x) => () => (rich ? rToggle(el, x) : leWrap(el, x));
  const act = k === 'z' ? () => leUndo(el, sh)
    : k === 'y' && !sh ? () => leUndo(el, true)
    : k === 'b' && !sh ? wrap('b')
    : k === 'i' && !sh ? wrap('i')
    : k === 'u' && !sh ? wrap('u')
    : k === 'e' && !sh ? wrap('c')
    : k === 'x' && sh ? wrap('s')
    : k === 'h' && sh ? wrap('h')
    : k === 'k' && !sh ? () => (rich ? rOpenLink(el) : leLink(el))
    : k === 'l' && sh ? () => leTask(el)
    : k === ']' && !sh ? () => leIndent(el, 1)
    : k === '[' && !sh ? () => leIndent(el, -1)
    : null;
  if (!act) return;
  e.preventDefault(); e.stopPropagation(); act();
}, true);
/* copying copies the Markdown; pasting pastes plain text (a link over selected text links it).
   In Rich Text, copying puts formatted text on the clipboard (and plain text, and the Markdown for
   another note), and pasting formatted text keeps its formatting */
const LE_MD_TYPE = 'text/x-sectis-markdown';
['copy', 'cut'].forEach((type) => document.addEventListener(type, (e) => {
  const el = leHost(e.target); if (!el || !e.clipboardData) return;
  const sel = leGetSel(el); if (!sel || sel.s === sel.e) return;
  e.preventDefault();
  const t = leText(el);
  if (leRich(el)) {
    const md = rtFragment(t, sel.s, sel.e);
    e.clipboardData.setData('text/plain', rPlain(md));
    e.clipboardData.setData('text/html', `<meta charset="utf-8">${renderMarkdown(md)}`);
    try { e.clipboardData.setData(LE_MD_TYPE, md); } catch (err) { /* this browser only takes the usual kinds */ }
    if (type === 'cut') rDo(el, rtReplace(t, sel.s, sel.e, ''), 'edit');
    return;
  }
  e.clipboardData.setData('text/plain', t.slice(sel.s, sel.e));
  if (type === 'cut') leEdit(el, sel.s, sel.e, '');
}, true));
const leIsUrl = (s) => /^(?:https?:\/\/|www\.)\S+$/i.test(s);
/* what's on the clipboard (or being dropped), as Markdown: md when it came from a note or kept
   its formatting, else the plain text */
function leClipMd(dt, rich) {
  if (!dt) return { md: '', plain: '' };
  let md = ''; try { md = leNorm(dt.getData(LE_MD_TYPE)); } catch (err) { /* ignore */ }
  const plain = leNorm(dt.getData('text/plain'));
  if (!md && rich) { const html = dt.getData('text/html'); if (html) md = htmlToMd(html); }
  return { md, plain };
}
document.addEventListener('paste', (e) => {
  const el = leHost(e.target); if (!el) return;
  e.preventDefault(); e.stopPropagation();
  const sel = leGetSel(el); if (!sel) return;
  const rich = leRich(el), { md, plain } = leClipMd(e.clipboardData, rich);
  const t = leText(el), picked = t.slice(sel.s, sel.e), url = plain.trim();
  if (rich) {
    // a link pasted over words links them
    if (sel.s !== sel.e && leIsUrl(url)) { const [A, B] = rSel(t, sel.s, sel.e), words = rtFragment(t, sel.s, sel.e); if (A.ln === B.ln && !leIsUrl(rPlain(words).trim())) { rDo(el, rtSetLink(t, A.ln, A.v, B.v, safeHref(url), url), 'paste'); return; } }
    if (md) rDo(el, rtInsertMd(t, sel.s, sel.e, md), 'paste');
    else if (!plain) return;
    else if (!plain.includes('\n')) rDo(el, rtReplace(t, sel.s, sel.e, plain), 'paste', true);
    else rDo(el, rtInsertMd(t, sel.s, sel.e, plain), 'paste');
    return;
  }
  const data = md || plain; if (!data) return;
  if (!md && picked.trim() && !picked.includes('\n') && leIsUrl(url) && !/^(?:https?:\/\/|www\.)/i.test(picked.trim())) {
    leEdit(el, sel.s, sel.e, `[${picked}](${url})`, { kind: 'paste' }); return;
  }
  leEdit(el, sel.s, sel.e, data, { kind: 'paste' });
}, true);
document.addEventListener('drop', (e) => {
  const el = leHost(e.target); if (!el) return;
  e.preventDefault(); e.stopPropagation();
  const rich = leRich(el), { md, plain } = leClipMd(e.dataTransfer, rich), data = md || plain; if (!data) return;
  const p = lePointAt(e.clientX, e.clientY), off = p && el.contains(p.node) ? leOffset(el, p.node, p.offset) : leText(el).length;
  el.focus({ preventScroll: true });
  if (rich) { rDo(el, rtInsertMd(leText(el), off, off, data), 'paste'); return; }
  leEdit(el, off, off, data, { kind: 'paste' });
}, true);
/* a checkbox ticks; a link opens (on the line you're typing in, with ⌘ held) */
let leClick = null, leMouse = false;
document.addEventListener('mouseup', () => { leMouse = false; }, true);
document.addEventListener('mousedown', (e) => {
  leClick = null; leMouse = e.button === 0 && !!leHost(e.target);
  if (e.button !== 0) return;
  const el = leHost(e.target); if (!el || el.hidden) return;
  const link = e.target.closest('.le-a'), line = e.target.closest('.le-ln');
  const on = !!line && line.classList.contains('le-on') && document.activeElement === el;
  if (line && line.classList.contains('le-task') && e.target === line) {
    // the box (an item that's in a level has room to its left that isn't the box)
    const cs = getComputedStyle(line), pl = parseFloat(cs.paddingLeft), x = e.clientX - line.getBoundingClientRect().left;
    if (x < pl && x > pl - 1.5 * parseFloat(cs.fontSize)) { e.preventDefault(); leTick(el, [...el.children].indexOf(line)); return; }
  }
  if (link && (e.metaKey || e.ctrlKey || (!on && !leRich(el)))) { e.preventDefault(); leOpenLink(link.dataset.href); return; }
  if (!e.shiftKey && e.detail < 2) leClick = { el, was: on };
}, true);
/* a click lands past Markdown it couldn't see (on a line that was showing formatted), and never
   inside a line's bullet, checkbox or number */
document.addEventListener('mouseup', () => {
  const c = leClick; leClick = null; if (!c) return;
  setTimeout(() => {
    const el = c.el; if (document.activeElement !== el) return;
    const sel = leGetSel(el); if (!sel || sel.s !== sel.e) return;
    const t = leText(el), ls = t.lastIndexOf('\n', sel.s - 1) + 1;
    let lend = t.indexOf('\n', sel.s); if (lend < 0) lend = t.length;
    const line = t.slice(ls, lend), pre = leBlock(line).pre.length;
    let p = sel.s;
    if (!c.was && !leRich(el)) { const mask = leMask(line); let vis = 0; for (let k = 0; k < sel.s - ls; k++) if (!mask[k]) vis++; p = ls + leVisToOff(line, vis, mask); }
    if (p - ls < pre) p = ls + pre;
    if (p !== sel.s) leSetSel(el, p);
  }, 0);
}, true);
/* the line you're on (or the lines you've selected) show their Markdown */
let leOnEl = null;
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection(), el = sel && sel.rangeCount ? leHost(sel.anchorNode) : null;
  if (leOnEl && leOnEl !== el) { $$('.le-on', leOnEl).forEach((d) => d.classList.remove('le-on')); leOnEl = null; }
  if (!el || !el.contains(sel.focusNode)) return;
  const kids = [...el.children];
  const at = (node, off) => {
    if (node === el) return Math.min(off, kids.length - 1);
    let x = node; while (x && x.parentNode !== el) x = x.parentNode;
    return Math.max(0, kids.indexOf(x));
  };
  const a = at(sel.anchorNode, sel.anchorOffset), b = at(sel.focusNode, sel.focusOffset), lo = Math.min(a, b), hi = Math.max(a, b);
  if (sel.isCollapsed && !leMouse && kids[a]) {
    // the caret never sits inside a bullet, checkbox, number, # or > (they show as themselves)
    const pre = leBlock(leNodeText(kids[a])).pre.length;
    if (pre) { const r = leGetSel(el), t = leText(el), ls = t.lastIndexOf('\n', r.s - 1) + 1; if (r.s - ls < pre) { leSetSel(el, ls + pre); return; } }
  }
  kids.forEach((d, i) => { const on = i >= lo && i <= hi; if (d.classList.contains('le-on') !== on) d.classList.toggle('le-on', on); });
  leOnEl = el;
});
