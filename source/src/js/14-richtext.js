/* ===================== Rich Text notes =====================
   Settings → General → Notepad → Formatting: Rich Text (or ••• at the top of the Notepad).
   A note is still the same Markdown text either way, so switching never changes a note, and
   sync, Sintr, search, copy buttons and Make To-Do all work as before. What changes is typing:
   - The Markdown never shows, not even on the line you're on (the editor is .le.le-rich).
   - A toolbar under the note you're typing in: Aa (Title, Heading, Subheading, Body, Quote,
     Monospaced, Clear Formatting), bold, italic, underline, strikethrough, highlight, bulleted
     and numbered lists, checklist and link. Its buttons light up for the text you're on.
   - The shortcuts format the selection (or the word you're in), and with nothing selected they
     switch the formatting on or off for what you type next (st.pend), like in Notes.
   - Deleting, typing over a selection, Return, pasting and copying keep formatting whole: the
     line is taken apart into characters with their formatting (rLine), changed, and written back
     as Markdown (leSerChars), which is read back to check it says the same thing.
   - Pasting formatted text (a web page, Mail, Pages, Word, Google Docs) keeps its bold, italic,
     underline, strikethrough, highlight, code, links, headings, lists, checkboxes and quotes;
     copying puts formatted text on the clipboard, plain text for plain places, and the Markdown
     for another Sectis note.
   - Plain typing still goes straight in, so the keyboard, spelling and input methods work as
     usual; Sectis types it itself only where the browser would split the Markdown (a space at the
     edge of bold, straight after a link, or with formatting switched on for what's next). */
const leRich = (el) => !!el && !!el.classList && el.classList.contains('le-rich');
const noteRich = () => !!(typeof S !== 'undefined' && S && S.settings && S.settings.noteStyle === 'rich');
const rWs = (c) => /\s/.test(c || '');
const RX_ORDER = ['u', 'h', 'b', 'i', 's']; // outside to inside, when they start together
const RX_MK = { b: '**', i: '*', s: '~~', u: ['<u>', '</u>'], h: '==' };
const RX_BARE = /^(?:https?:\/\/|www\.|sintr:\/\/)/i;

/* ---- a line as characters with their formatting, and back to Markdown ---- */
function rLine(line) {
  const r = leRoles(line);
  return { pre: r.pre, chars: r.chars.map((c) => ({ c: c.c, m: c.m, code: !!c.code, href: c.href || null, url: c.url || null, md: !!c.md, lid: c.lid || 0 })) };
}
const rCopy = (c) => Object.assign({}, c);
/* what can be written: formatting doesn't start or end on a space (Markdown can't say ** x**),
   code can't hold a ` and a link's words can't hold a ] */
function rTidy(chars) {
  const out = chars.map(rCopy);
  out.forEach((c) => {
    if (c.code && c.c === '`') c.code = false;
    if (c.code && c.href) c.code = false;
    if (c.href && c.c === ']') c.href = null;
    if (!c.href) { c.url = null; c.md = false; c.lid = 0; }
  });
  for (const x of RX_ORDER) {
    for (let i = 0; i < out.length;) {
      if (!out[i].m.includes(x)) { i++; continue; }
      let j = i; while (j < out.length && out[j].m.includes(x)) j++;
      const bare = (c) => rWs(c.c) && !c.code && !c.href;
      for (let k = i; k < j && bare(out[k]); k++) out[k].m = out[k].m.replace(x, '');
      for (let k = j - 1; k >= i && bare(out[k]); k--) out[k].m = out[k].m.replace(x, '');
      i = j;
    }
  }
  return out;
}
function rSegs(chars) {
  const segs = [];
  chars.forEach((c) => {
    const k = `${c.m}|${c.code ? 1 : 0}|${c.href ? c.href + '#' + c.lid : ''}`, g = segs[segs.length - 1];
    if (g && g.k === k) g.t += c.c;
    else segs.push({ k, t: c.c, m: c.m, code: c.code, href: c.href, url: c.url, md: c.md });
  });
  return segs;
}
const rUrl = (u) => String(u).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20');
function rEmit(segs, v) {
  let out = '';
  const stack = [];
  const close = (k) => { for (let j = stack.length - 1; j >= k; j--) out += stack[j].c; stack.length = k; };
  segs.forEach((g) => {
    const k = stack.findIndex((e) => !g.m.includes(e.x));
    if (k >= 0) close(k);
    for (const x of RX_ORDER) {
      if (!g.m.includes(x) || stack.some((e) => e.x === x)) continue;
      let mk = RX_MK[x];
      if (x === 'b' && v.b) mk = v.b;
      if (x === 'i') mk = v.i === 'auto' ? (out.endsWith('*') ? '_' : '*') : v.i;
      const [o, c] = Array.isArray(mk) ? mk : [mk, mk];
      out += o; stack.push({ x, c });
    }
    if (g.code) out += '`' + g.t + '`';
    else if (g.href) out += !v.md && !g.md && g.t === g.url && RX_BARE.test(g.t) ? g.t : `[${g.t}](${rUrl(g.url || g.href)})`;
    else out += g.t;
  });
  close(0);
  return out;
}
function rSame(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.c !== y.c || x.m !== y.m || !!x.code !== !!y.code || (x.href || null) !== (y.href || null)) return false;
  }
  return true;
}
/* italic or highlight right next to a letter or digit (x*y*, x==y==: Markdown can't say that, as
   * and == there are just characters): out to the whole word */
function rSnap(chars) {
  const out = chars.map(rCopy), W = (c) => !!c && leIsW(c.c);
  let changed = false;
  for (const x of ['i', 'h']) {
    for (let i = 0; i < out.length;) {
      if (!out[i].m.includes(x)) { i++; continue; }
      let j = i; while (j < out.length && out[j].m.includes(x)) j++;
      let a = i, b = j;
      while (W(out[a - 1])) a--;
      while (W(out[b])) b++;
      for (let k = a; k < b; k++) if (!out[k].m.includes(x)) { out[k].m = leAddMark(out[k].m, x); changed = true; }
      i = Math.max(b, i + 1);
    }
  }
  return changed ? out : null;
}
const RX_TRY = [{ i: 'auto' }, { i: '*' }, { i: '_' }, { i: '_', b: '__' }, { i: '*', b: '__' }];
/* a line's characters as Markdown that reads back as the same thing (pre: the line's bullet,
   number, # or > in front of it, so that's read the same way too) */
function leSerChars(chars, pre = '', snapped) {
  const want = rTidy(chars), segs = rSegs(want);
  let first = null;
  for (const md of [false, true]) {
    for (const v of RX_TRY) {
      const out = rEmit(segs, Object.assign({ md }, v));
      if (first == null) first = out;
      const back = leRoles(pre + out);
      if (back.pre === pre && rSame(back.chars, want)) return out;
    }
  }
  if (!snapped) { const s = rSnap(want); if (s) return leSerChars(s, pre, true); }
  return first;
}

/* ---- places: a line and how many of its shown characters come before ---- */
function rLineAt(text, raw) {
  const ls = text.lastIndexOf('\n', raw - 1) + 1;
  let le = text.indexOf('\n', ls); if (le < 0) le = text.length;
  return { ln: leLineAt(text, raw), ls, line: text.slice(ls, le) };
}
function rAt(text, raw) {
  const { ln, ls, line } = rLineAt(text, raw), p = raw - ls;
  let v = 0; for (const c of leRoles(line).chars) { if (c.at < p) v++; else break; }
  return { ln, v };
}
/* back to a place in the text: right after the shown character before it ('in': typing there
   carries on its formatting), or right before the next one ('next') */
function rRaw(text, at) {
  const lines = text.split('\n'), ln = clamp(at.ln, 0, lines.length - 1);
  let base = 0; for (let k = 0; k < ln; k++) base += lines[k].length + 1;
  const R = leRoles(lines[ln]), ch = R.chars, v = clamp(at.v, 0, ch.length);
  if (v > 0 && (at.bias !== 'next' || v === ch.length)) return base + ch[v - 1].at + 1;
  if (v < ch.length) return base + ch[v].at;
  return base + R.pre.length;
}
/* the formatting at a place in a line (p): the shown character it's right after, or right before;
   between Markdown marks, after closing ones it goes with the character before */
function rAttrsAt(R, p) {
  let prev = null, next = null;
  for (const c of R.chars) { if (c.at < p) prev = c; else { next = c; break; } }
  if (prev && prev.at === p - 1) return prev;
  if (next && next.at === p) return next;
  let q = p - 1; while (q >= 0 && R.role[q] === 'c') q--;
  return (q >= 0 && R.role[q] === 'v' ? prev : next) || prev || { m: '' };
}
/* where the caret goes in the editor for a place in the text: always in shown text, never in the
   hidden Markdown, so what you type lands where it looks like it does */
function rPoint(el, off) {
  const groups = leGroups(el);
  let base = 0, gi = 0;
  for (; gi < groups.length - 1; gi++) { const len = leGText(groups[gi]).length; if (off <= base + len) break; base += len + 1; }
  const g = groups[gi]; if (!g || !g.div) return null;
  const line = leGText(g), R = leRoles(line), p = clamp(off - base, 0, line.length);
  let v = 0; for (const c of R.chars) { if (c.at < p) v++; else break; }
  let q = p - 1; while (q >= 0 && R.role[q] === 'c') q--;
  const after = v === 0 || !(q >= 0 && R.role[q] === 'v'); // with the next shown character
  const texts = [];
  const walk = (x) => { if (x.nodeType === 3) { if (!(x.parentElement && x.parentElement.closest('.lm'))) texts.push(x); } else if (x.nodeType === 1 && x.tagName !== 'BR') x.childNodes.forEach(walk); };
  g.div.childNodes.forEach(walk);
  if (!texts.length) return [g.div, g.div.childNodes.length && g.div.lastChild.nodeName === 'BR' ? g.div.childNodes.length - 1 : g.div.childNodes.length];
  let n = 0;
  for (const t of texts) {
    const L = t.data.length;
    if (after ? v < n + L : v <= n + L) return [t, v - n];
    n += L;
  }
  const last = texts[texts.length - 1];
  return [last, last.data.length];
}

/* ---- changes, as text in and text out (res: the new text and where the caret goes) ---- */
const rVis = (L) => L.chars.map((c) => c.c).join('');
const RW = /[\p{L}\p{N}'’-]/u;
function rWord(L, v) {
  const vis = rVis(L); let a = v, b = v;
  while (a > 0 && RW.test(vis[a - 1])) a--;
  while (b < vis.length && RW.test(vis[b])) b++;
  return a < v && b > v ? [a, b] : null;
}
function rInRange(A, B) { return (k, i) => (k > A.ln || i >= A.v) && (k < B.ln || i < B.v); }
function rSel(text, s, e) { if (s > e) [s, e] = [e, s]; return [rAt(text, s), rAt(text, e)]; }
/* replace s..e with typed text; it takes the formatting of the first character it replaces */
function rtReplace(text, s, e, ins) {
  const [A, B] = rSel(text, s, e), lines = text.split('\n');
  const LA = rLine(lines[A.ln]), LB = A.ln === B.ln ? LA : rLine(lines[B.ln]);
  const first = (A.ln < B.ln || A.v < B.v) && LA.chars[A.v] ? LA.chars[A.v] : LA.chars[A.v - 1] || null;
  const add = String(ins || '').split('').map((c) => ({ c, m: first ? first.m : '', code: !!(first && first.code), href: (first && first.href) || null, url: first && first.url, md: true, lid: (first && first.lid) || 0 }));
  const chars = LA.chars.slice(0, A.v).concat(add, LB.chars.slice(B.v));
  lines.splice(A.ln, B.ln - A.ln + 1, LA.pre + leSerChars(chars, LA.pre));
  const v = A.v + add.length;
  return { text: lines.join('\n'), at: { ln: A.ln, v, bias: v ? 'in' : 'next' } };
}
/* typing at raw: o.pend switches formatting on or off for it; o.noLink keeps it out of a link
   it's right after */
function rtInsert(text, raw, data, o = {}) {
  const { ln, ls, line } = rLineAt(text, raw), R = leRoles(line), L = rLine(line), lines = text.split('\n');
  let v = 0; for (const c of R.chars) { if (c.at < raw - ls) v++; else break; }
  const base = rAttrsAt(R, raw - ls), pend = (o.pend && o.pend.m) || {};
  let m = base.m || '', code = !!base.code, link = base.href && !o.noLink ? base : null;
  Object.keys(pend).forEach((x) => { if (x === 'c') code = pend.c; else if (x === 'a') { if (!pend.a) link = null; } else m = pend[x] ? leAddMark(m, x) : m.replace(x, ''); });
  if (code) link = null;
  // carrying on bold after a space typed at its end (the space couldn't be bold): the space is again
  if (o.pend && o.pend.gap && !rWs(data[0])) {
    for (const x of m) {
      let k = v - 1; while (k >= 0 && rWs(L.chars[k].c) && !L.chars[k].m.includes(x)) k--;
      if (k >= 0 && k < v - 1 && L.chars[k].m.includes(x)) for (let q = k + 1; q < v; q++) L.chars[q].m = leAddMark(L.chars[q].m, x);
    }
  }
  const add = data.split('').map((c) => ({ c, m, code, href: link ? link.href : null, url: link ? link.url : null, md: true, lid: link ? link.lid : 0 }));
  lines[ln] = L.pre + leSerChars(L.chars.slice(0, v).concat(add, L.chars.slice(v)), L.pre);
  const out = lines.join('\n'), after = v + add.length, got = rLine(lines[ln]).chars[after - 1], keep = {};
  // what it was meant to have but couldn't (a space at the end of bold): the next thing typed has it
  if (got) for (const x of m) if (!got.m.includes(x)) keep[x] = true;
  if (!got || got.code !== code) { if (code) keep.c = true; }
  return { text: out, at: { ln, v: after, bias: 'in' }, pend: Object.keys(keep).length ? { m: keep, gap: true } : null };
}
/* Backspace and Delete with nothing selected */
function rtDelete(text, raw, type) {
  const at = rAt(text, raw), lines = text.split('\n'), L = rLine(lines[at.ln]), n = L.chars.length, back = type.includes('Backward');
  if (back && at.v === 0) {
    if (L.pre) { lines[at.ln] = lines[at.ln].slice(L.pre.length); return { text: lines.join('\n'), at: { ln: at.ln, v: 0, bias: 'next' } }; } // its bullet, checkbox, number, # or > goes
    if (at.ln === 0) return null;
    const P = rLine(lines[at.ln - 1]);
    lines.splice(at.ln - 1, 2, P.pre + leSerChars(P.chars.concat(L.chars), P.pre));
    return { text: lines.join('\n'), at: { ln: at.ln - 1, v: P.chars.length, bias: P.chars.length ? 'in' : 'next' } };
  }
  if (!back && at.v === n) {
    if (at.ln >= lines.length - 1) return null;
    const N = rLine(lines[at.ln + 1]);
    lines.splice(at.ln, 2, L.pre + leSerChars(L.chars.concat(N.chars), L.pre));
    return { text: lines.join('\n'), at: { ln: at.ln, v: at.v, bias: at.v ? 'in' : 'next' } };
  }
  const [a, b] = leDelRange(rVis(L), at.v, type);
  if (b <= a) return null;
  lines[at.ln] = L.pre + leSerChars(L.chars.slice(0, a).concat(L.chars.slice(b)), L.pre);
  return { text: lines.join('\n'), at: { ln: at.ln, v: a, bias: a ? 'in' : 'next' } };
}
/* Return: the line splits, its formatting with it; lists carry on, and Return on an empty item
   ends the list */
function rtNewline(text, s, e, carry) {
  let t = text, raw = Math.min(s, e);
  if (s !== e) { const r = rtReplace(text, s, e, ''); t = r.text; raw = rRaw(t, r.at); }
  const at = rAt(t, raw), lines = t.split('\n'), line = lines[at.ln], L = rLine(line);
  const left = L.chars.slice(0, at.v), right = L.chars.slice(at.v), m = carry ? line.match(LE_ITEM) : null;
  if (m && !L.chars.some((c) => !rWs(c.c))) { lines[at.ln] = ''; return { text: lines.join('\n'), at: { ln: at.ln, v: 0 } }; }
  const heading = /^\s{0,3}#/.test(L.pre);
  if (heading && carry && at.v === 0 && right.length) { lines.splice(at.ln, 0, ''); return { text: lines.join('\n'), at: { ln: at.ln + 1, v: 0, bias: 'next' } }; } // Return at the start of a heading: a line above it
  let next = '';
  if (m) {
    if (m[2]) next = m[1] + m[2] + m[3] + '[ ] ';
    else if (m[5]) next = m[1] + m[5] + m[6];
    else if (m[7]) next = m[1] + (+m[7] + 1) + m[8] + m[9];
    else next = m[1] + '>' + (m[10] || ' ');
  } else if (heading && carry && right.length) next = L.pre; // a heading split in two: both halves are headings
  lines.splice(at.ln, 1, L.pre + leSerChars(left, L.pre), next + leSerChars(right, next));
  return { text: lines.join('\n'), at: { ln: at.ln + 1, v: 0, bias: 'next' } };
}
/* Markdown put in at s..e (a paste): it goes in whole, and the formatting around it is closed
   off before it and opened again after it */
function rtInsertMd(text, s, e, md) {
  let t = text, raw = Math.min(s, e);
  if (s !== e) { const r = rtReplace(text, s, e, ''); t = r.text; raw = rRaw(t, r.at); }
  const at = rAt(t, raw), lines = t.split('\n'), L = rLine(lines[at.ln]);
  const left = L.chars.slice(0, at.v), right = L.chars.slice(at.v);
  let pre = L.pre;
  if (!left.length && leBlock(md.split('\n')[0]).pre) pre = ''; // the pasted line's own bullet or heading wins
  const head = pre + leSerChars(left, pre), tail = leSerChars(right);
  lines[at.ln] = head + md + tail;
  let base = 0; for (let k = 0; k < at.ln; k++) base += lines[k].length + 1;
  return { text: lines.join('\n'), raw: base + head.length + md.length };
}
/* bold, italic, underline, strikethrough, highlight (x: b i u s h) or code (c) on s..e, or on the
   word the caret is in; null: there's nothing to do it to (the caller switches it for what's next) */
function rtToggle(text, s, e, x) {
  const [A, B] = rSel(text, s, e), lines = text.split('\n');
  if (s === e) {
    const w = rWord(rLine(lines[A.ln]), A.v);
    if (!w) return null;
    const r = rtMarks(lines, { ln: A.ln, v: w[0] }, { ln: A.ln, v: w[1] }, x);
    return r && { text: r, at: { ln: A.ln, v: A.v, bias: 'in' } };
  }
  const r = rtMarks(lines, A, B, x);
  return r && { text: r, at: { ln: A.ln, v: A.v, bias: 'next' }, at2: { ln: B.ln, v: B.v, bias: 'in' } };
}
function rtMarks(lines, A, B, x) {
  const Ls = [], inR = rInRange(A, B);
  for (let k = A.ln; k <= B.ln; k++) Ls.push(rLine(lines[k]));
  const has = (c) => (x === 'c' ? c.code : c.m.includes(x));
  let all = true, any = false;
  Ls.forEach((L, j) => L.chars.forEach((c, i) => { if (!inR(A.ln + j, i) || (rWs(c.c) && x !== 'c')) return; any = true; if (!has(c)) all = false; }));
  if (!any) return null;
  Ls.forEach((L, j) => L.chars.forEach((c, i) => {
    if (!inR(A.ln + j, i)) return;
    if (x === 'c') { c.code = !all; if (c.code) c.href = null; } else c.m = all ? c.m.replace(x, '') : leAddMark(c.m, x);
  }));
  Ls.forEach((L, j) => { lines[A.ln + j] = L.pre + leSerChars(L.chars, L.pre); });
  return lines.join('\n');
}
/* Clear Formatting: the selection (or word) back to plain text; links stay */
function rtClear(text, s, e) {
  let [A, B] = rSel(text, s, e);
  const lines = text.split('\n');
  if (s === e) { const w = rWord(rLine(lines[A.ln]), A.v); if (!w) return null; A = { ln: A.ln, v: w[0] }; B = { ln: A.ln, v: w[1] }; }
  const inR = rInRange(A, B);
  for (let k = A.ln; k <= B.ln; k++) {
    const L = rLine(lines[k]);
    L.chars.forEach((c, i) => { if (inR(k, i)) { c.m = ''; c.code = false; } });
    lines[k] = L.pre + leSerChars(L.chars, L.pre);
  }
  const out = lines.join('\n');
  return s === e ? { text: out, at: rAt(text, s) } : { text: out, at: { ln: A.ln, v: A.v, bias: 'next' }, at2: { ln: B.ln, v: B.v, bias: 'in' } };
}
/* what kind of line it is: h1 h2 h3 (Title, Heading, Subheading), ul, ol, task, q, or p (Body) */
function rKind(line) {
  const c = leBlock(line).cls;
  return c === 'le-h1' ? 'h1' : c === 'le-h2' ? 'h2' : c === 'le-h3' ? 'h3' : c.startsWith('le-task') ? 'task' : c === 'le-li' ? 'ul' : c === 'le-ol' ? 'ol' : c === 'le-q' ? 'q' : 'p';
}
const RB_PRE = { h1: '# ', h2: '## ', h3: '### ', q: '> ', ul: '- ', task: '- [ ] ', p: '' };
/* the lines s..e made a kind of line; lists, checklists and quotes go back to Body when they all
   are one already */
function rtBlock(text, s, e, kind) {
  const [A, B] = rSel(text, s, e), lines = text.split('\n');
  let lb = B.ln; if (lb > A.ln && B.v === 0 && s !== e) lb--; // a selection that ends at the start of a line leaves that line out
  const idx = []; for (let k = A.ln; k <= lb; k++) if (A.ln === lb || lines[k].trim()) idx.push(k);
  if (!idx.length) return null;
  if (['ul', 'ol', 'task', 'q'].includes(kind) && idx.every((k) => rKind(lines[k]) === kind)) kind = 'p';
  let n = 1;
  if (kind === 'ol' && A.ln > 0) { const pm = lines[A.ln - 1].match(/^\s*(\d{1,4})[.)]\s/); if (pm) n = +pm[1] + 1; }
  idx.forEach((k) => {
    const line = lines[k], pre = leBlock(line).pre;
    if (kind !== 'ol' && rKind(line) === kind) return;
    const ind = ['ul', 'ol', 'task'].includes(kind) ? (pre.match(/^\s*/) || [''])[0] : '';
    lines[k] = ind + (kind === 'ol' ? `${n++}. ` : RB_PRE[kind]) + line.slice(pre.length);
  });
  const out = lines.join('\n');
  return s === e ? { text: out, at: { ln: A.ln, v: A.v, bias: A.v ? 'in' : 'next' } } : { text: out, at: { ln: A.ln, v: A.v, bias: 'next' }, at2: { ln: B.ln, v: B.v, bias: 'in' } };
}
/* the link at s..e (the caret's in it or right next to it), as its line and shown characters */
function rLinkAt(text, s, e) {
  const [A, B] = rSel(text, s, e); if (A.ln !== B.ln) return null;
  const L = rLine(text.split('\n')[A.ln]), ch = L.chars;
  const c = (ch[A.v] && ch[A.v].href) ? ch[A.v] : (s === e && ch[A.v - 1] && ch[A.v - 1].href) ? ch[A.v - 1] : null;
  if (!c) return null;
  let a = ch.indexOf(c), b = a + 1;
  while (a > 0 && ch[a - 1].href === c.href && ch[a - 1].lid === c.lid) a--;
  while (b < ch.length && ch[b].href === c.href && ch[b].lid === c.lid) b++;
  if (s !== e && B.v > b) return null; // the selection goes past it
  return { ln: A.ln, a, b, href: c.href, url: c.url || c.href, md: c.md, text: ch.slice(a, b).map((x) => x.c).join('') };
}
/* shown characters a..b of line ln linked to href (null: not a link any more) */
function rtSetLink(text, ln, a, b, href, url) {
  const lines = text.split('\n'), L = rLine(lines[ln]), lid = 900000 + Math.floor(Math.random() * 99999);
  for (let i = a; i < b; i++) Object.assign(L.chars[i], href ? { href, url, md: true, lid, code: false } : { href: null, url: null, md: false, lid: 0 });
  lines[ln] = L.pre + leSerChars(L.chars, L.pre);
  return { text: lines.join('\n'), at: { ln, v: a, bias: 'next' }, at2: { ln, v: b, bias: 'in' } };
}
/* new words for a..b of line ln (a bare link's address changed), as a link; or put in at raw */
function rtLinkWords(text, ln, a, b, words, href) {
  const lines = text.split('\n'), L = rLine(lines[ln]), bare = RX_BARE.test(words), lid = 900000 + Math.floor(Math.random() * 99999);
  const base = L.chars[a] || L.chars[a - 1] || { m: '' };
  const add = words.split('').map((c) => ({ c, m: base.m || '', code: false, href, url: words, md: !bare, lid }));
  lines[ln] = L.pre + leSerChars(L.chars.slice(0, a).concat(add, L.chars.slice(b)), L.pre);
  return { text: lines.join('\n'), at: { ln, v: a + add.length, bias: 'in' }, pend: { m: { a: false } } };
}
/* s..e as Markdown of its own (copying): formatting closed off at its ends; a line's bullet or
   heading comes along when the selection starts at its beginning */
function rtFragment(text, s, e) {
  const [A, B] = rSel(text, s, e), lines = text.split('\n'), out = [];
  for (let k = A.ln; k <= B.ln; k++) {
    const L = rLine(lines[k]), a = k === A.ln ? A.v : 0, b = k === B.ln ? B.v : L.chars.length;
    const pre = a === 0 ? L.pre : '';
    out.push(pre + leSerChars(L.chars.slice(a, b), pre));
  }
  return out.join('\n');
}
/* Markdown as plain text, for places that don't take formatting: lists keep their bullets and
   checkboxes; a link with words of its own gets its address after them */
function rPlain(md) {
  return String(md || '').split('\n').map((line) => {
    const R = leRoles(line);
    let out = /^\s{0,3}#|^\s*>/.test(R.pre) ? '' : R.pre;
    R.chars.forEach((c, i) => {
      out += c.c;
      const nx = R.chars[i + 1];
      if (c.href && c.md && (!nx || nx.lid !== c.lid)) {
        const words = R.chars.filter((x) => x.lid === c.lid).map((x) => x.c).join('');
        if (words !== c.url && words !== c.href) out += ` (${c.href})`;
      }
    });
    return out;
  }).join('\n');
}

/* ---- formatted text from other apps, as Markdown ---- */
function htmlToMd(html) {
  let doc;
  try { doc = new DOMParser().parseFromString(String(html || ''), 'text/html'); } catch (e) { return ''; }
  const lines = [];
  let cur = null;
  const start = (pre) => { cur = { pre: pre || '', chars: [] }; lines.push(cur); };
  const brk = () => { cur = null; };
  const SKIP = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|HEAD|META|LINK|TITLE|SVG|IMG|PICTURE|VIDEO|AUDIO|IFRAME|OBJECT|CANVAS|BUTTON|SELECT|OPTION)$/;
  const BLOCK = /^(P|DIV|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|NAV|FIGURE|FIGCAPTION|ADDRESS|DL|DT|DD|UL|OL|LI|BLOCKQUOTE|PRE|TABLE|THEAD|TBODY|TFOOT|TR|H1|H2|H3|H4|H5|H6|HR|FORM|FIELDSET|DETAILS|SUMMARY)$/;
  const styleOf = (n) => (n.getAttribute && n.getAttribute('style')) || '';
  const put = (text, ctx) => {
    for (const c of text) {
      if (!cur) { if (rWs(c) && !ctx.pre) continue; start(ctx.linePre()); }
      const last = cur.chars[cur.chars.length - 1];
      if (!ctx.pre && rWs(c) && (!last || last.c === ' ')) continue; // white space runs together, like on the page
      cur.chars.push({ c: ctx.pre || !rWs(c) ? c : ' ', m: ctx.m, code: ctx.code, href: ctx.href, url: ctx.href, md: true, lid: ctx.lid });
    }
  };
  let lid = 1;
  const walk = (node, ctx) => {
    if (node.nodeType === 3) { put(ctx.pre ? node.data.replace(/\r\n?/g, '\n').split('\n').join('\u0000') : node.data, ctx); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toUpperCase(), st = styleOf(node);
    if (SKIP.test(tag)) {
      if (tag === 'BUTTON' && node.classList.contains('np-val')) node.childNodes.forEach((k) => { if (k.nodeType === 3) put(k.data, ctx); }); // a copy chip from another note: its value
      return;
    }
    if (/mso-list:\s*ignore/i.test(st) || node.getAttribute('aria-hidden') === 'true') return;
    if (tag === 'BR') { if (!cur) start(ctx.linePre()); brk(); return; }
    if (tag === 'INPUT') { if ((node.getAttribute('type') || '').toLowerCase() === 'checkbox' && ctx.li) ctx.li.task = node.checked || node.hasAttribute('checked') ? 'x' : ' '; return; }
    const c = Object.assign({}, ctx);
    if (/^(B|STRONG)$/.test(tag) && !/font-weight:\s*(normal|[1-5]00)\b/i.test(st)) c.m = leAddMark(c.m, 'b');
    if (/^(I|EM|CITE|DFN|VAR)$/.test(tag) && !/font-style:\s*normal/i.test(st)) c.m = leAddMark(c.m, 'i');
    if (/^(U|INS)$/.test(tag)) c.m = leAddMark(c.m, 'u');
    if (/^(S|STRIKE|DEL)$/.test(tag)) c.m = leAddMark(c.m, 's');
    if (tag === 'MARK') c.m = leAddMark(c.m, 'h');
    if (/^(CODE|KBD|SAMP|TT)$/.test(tag) && !ctx.pre) c.code = true;
    if (/font-weight:\s*(bold|[6-9]00)\b/i.test(st)) c.m = leAddMark(c.m, 'b');
    if (/font-weight:\s*(normal|[1-5]00)\b/i.test(st) && tag !== 'B' && tag !== 'STRONG') c.m = c.m.replace('b', '');
    if (/font-style:\s*italic/i.test(st)) c.m = leAddMark(c.m, 'i');
    if (/text-decoration[^;]*underline/i.test(st) && tag !== 'A') c.m = leAddMark(c.m, 'u');
    if (/text-decoration[^;]*line-through/i.test(st)) c.m = leAddMark(c.m, 's');
    if (/(^|;)\s*background(-color)?:\s*(?!transparent|none|inherit|initial|rgba\([^)]*,\s*0\)|#fff\b|#ffffff\b|white\b|rgb\(255,\s*255,\s*255\))[#a-z]/i.test(st) && !BLOCK.test(tag) && !ctx.pre && !c.code) c.m = leAddMark(c.m, 'h');
    if (/font-family:[^;]*(mono|courier|menlo|consolas|monaco)/i.test(st) && !BLOCK.test(tag) && !ctx.pre) c.code = true;
    if (tag === 'A' && node.getAttribute('href')) { const h = safeHref(node.getAttribute('href')); if (h && !/^#/.test(node.getAttribute('href'))) { c.href = h; c.lid = lid++; } }
    if (tag === 'PRE') c.pre = true;
    if (tag === 'TD' || tag === 'TH') { if (cur && cur.chars.length) put('\t', Object.assign({}, c, { pre: true })); node.childNodes.forEach((k) => walk(k, c)); return; } // a table's cells, a tab apart
    if (!BLOCK.test(tag)) { node.childNodes.forEach((k) => walk(k, c)); return; }
    // a block: its own line(s), with a bullet, number, # or > in front when it's one
    brk();
    let first = null;
    const hm = tag === 'P' && String(node.className).match(/\bmd-h([123])\b/);
    if (/^H[1-6]$/.test(tag)) first = ['', '# ', '## ', '### ', '### ', '### ', '### '][+tag[1]];
    else if (hm) first = '#'.repeat(+hm[1]) + ' ';
    if (tag === 'UL' || tag === 'OL') { c.list = { ol: tag === 'OL', n: +(node.getAttribute('start') || 1) || 1 }; c.depth = (ctx.depth || 0) + (ctx.list ? 1 : 0); }
    if (tag === 'LI' || (tag === 'P' && /MsoListParagraph/.test(node.className))) {
      const ind = '  '.repeat(c.depth || 0);
      const task = /\b(md-task|checked|unchecked|task-list-item|todo)\b/.test(node.className) || node.getAttribute('role') === 'checkbox' || node.hasAttribute('aria-checked') ? (/\b(done|checked)\b/.test(node.className) && !/\bunchecked\b/.test(node.className)) || node.getAttribute('aria-checked') === 'true' ? 'x' : ' ' : null;
      c.li = { task };
      const L = c.list && c.list.ol ? `${c.list.n++}. ` : '- ';
      first = { get pre() { return c.li.task != null && !(c.list && c.list.ol) ? `${ind}- [${c.li.task}] ` : ind + L; } };
    }
    if (tag === 'BLOCKQUOTE') c.quote = true;
    let used = false;
    const up = ctx.linePre;
    // a block with nothing of its own in front (a <p> in a <li>): its first line takes the bullet the item hasn't used yet
    if (first == null) c.linePre = tag === 'BLOCKQUOTE' && !ctx.quote ? () => '> ' + up() : up;
    else c.linePre = () => {
      const q = c.quote ? '> ' : '';
      if (used) return q;
      used = true;
      return q + (typeof first === 'string' ? first : first.pre);
    };
    const n0 = lines.length;
    node.childNodes.forEach((k) => walk(k, c));
    if (first != null && !used && lines.length === n0) start(c.linePre()); // an empty heading or item still makes its line
    brk();
  };
  walk(doc.body || doc.documentElement, { m: '', code: false, href: null, lid: 0, pre: false, linePre: () => '' });
  // a <pre>'s line breaks, kept while walking as \0, become lines of their own
  const out = [];
  lines.forEach((L) => {
    const parts = [[]];
    L.chars.forEach((c) => { if (c.c === '\u0000') parts.push([]); else parts[parts.length - 1].push(c); });
    parts.forEach((p, i) => {
      while (p.length && rWs(p[p.length - 1].c) && !p[p.length - 1].code) p.pop();
      const pre = i ? '' : L.pre;
      out.push(pre + leSerChars(p, pre));
    });
  });
  // no more than one empty line in a row, and none at the ends
  const tidy = [];
  out.forEach((l) => { if (!l.trim() && (!tidy.length || !tidy[tidy.length - 1].trim())) return; tidy.push(l); });
  while (tidy.length && !tidy[tidy.length - 1].trim()) tidy.pop();
  return tidy.join('\n');
}

/* ---- the editor: doing it ---- */
function rDo(el, res, kind = 'edit', fresh) {
  if (!res || res.text == null) return;
  const s = res.raw != null ? res.raw : rRaw(res.text, res.at || { ln: 0, v: 0 }), e2 = res.at2 ? rRaw(res.text, res.at2) : s;
  leRender(el, res.text, s, e2);
  const sel = leGetSel(el) || { s, e: e2 };
  lePush(el, res.text, sel.s, sel.e, kind, fresh);
  leState(el).pend = res.pend ? Object.assign({ at: sel.s, text: res.text }, res.pend) : null;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  rTools(el);
}
/* formatting switched on or off for what's typed next, while the caret stays put */
function rPend(el, raw, text) {
  const p = leState(el).pend;
  return p && p.at === raw && p.text === text ? p : null;
}
/* where the browser would type, and whether to leave it to the browser */
function rDomCaret(el) {
  const out = { odd: true, edge: false, linkEnd: false }, sel = window.getSelection();
  if (!sel || !sel.rangeCount) return out;
  const n = sel.anchorNode, o = sel.anchorOffset;
  if (!n || !el.contains(n)) return out;
  if (n.nodeType === 1) { // an empty line (or an empty note): nothing there to split
    const ln = n === el ? null : n.closest('.le-ln');
    if (n === el ? !leText(el) : ln && ln.parentNode === el && !rTexts(ln).length) out.odd = false;
    return out;
  }
  if (n.nodeType !== 3 || !n.parentElement || n.parentElement.closest('.lm')) return out;
  out.odd = false;
  const p = n.parentElement, a = p.closest('.le-a');
  if (a && o === n.data.length && rTexts(a).pop() === n) out.linkEnd = true;
  const run = p.closest('strong, em, del, u, mark');
  if (run && ((o === 0 && rTexts(run)[0] === n) || (o === n.data.length && rTexts(run).pop() === n))) out.edge = true;
  return out;
}
function rTexts(root) {
  const out = [], walk = (x) => { if (x.nodeType === 3) { if (x.data && !(x.parentElement && x.parentElement.closest('.lm'))) out.push(x); } else if (x.nodeType === 1) x.childNodes.forEach(walk); };
  walk(root); return out;
}
/* the editor's beforeinput, in Rich Text (true: handled here) */
function rBeforeInput(e, el, t, sel, r, text) {
  if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); rDo(el, rtNewline(text, sel.s, sel.e, t === 'insertParagraph'), 'line'); return true; }
  if (t === 'insertText' || t === 'insertReplacementText') {
    const data = leNorm(e.data != null ? e.data : e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
    const a = r ? r.s : sel.s, b = r ? r.e : sel.e;
    if (!data && a === b) return true;
    if (data.includes('\n')) { e.preventDefault(); rDo(el, rtInsertMd(text, a, b, data), 'paste'); return true; }
    if (a !== b) { e.preventDefault(); rDo(el, rtReplace(text, a, b, data), 'type', true); return true; } // typing over a selection starts a step of its own
    const pend = rPend(el, a, text), d = rDomCaret(el);
    if (pend || d.odd || d.linkEnd || (d.edge && /\s/.test(data))) { e.preventDefault(); rDo(el, rtInsert(text, a, data, { pend, noLink: d.linkEnd }), 'type'); }
    return true; // otherwise the browser types it, and leSync redraws the line
  }
  if (t.startsWith('insertFrom')) {
    e.preventDefault();
    const data = leNorm(e.dataTransfer ? e.dataTransfer.getData('text/plain') : e.data);
    if (data) rDo(el, rtInsertMd(text, r ? r.s : sel.s, r ? r.e : sel.e, data), 'paste');
    return true;
  }
  if (t.startsWith('delete')) {
    e.preventDefault();
    let res;
    if (sel.s !== sel.e) res = rtReplace(text, sel.s, sel.e, '');
    else if (r && r.s !== r.e && t !== 'deleteContentBackward' && t !== 'deleteContentForward') res = rtReplace(text, r.s, r.e, '');
    else res = rtDelete(text, sel.s, t);
    if (res && res.text !== text) rDo(el, res, t === 'deleteContentBackward' || t === 'deleteContentForward' ? 'del' : 'edit');
    return true;
  }
  return false;
}
/* after the browser typed: Markdown you typed yourself that closed a run (the last * of *this*)
   leaves what comes next outside it */
function rAfterType(el, text, raw) {
  const { ls, line } = rLineAt(text, raw), R = leRoles(line), p = raw - ls;
  if (R.role[p - 1] !== 'c') return;
  let q = p - 1; while (q >= 0 && R.role[q] === 'c') q--;
  if (q < 0 || R.role[q] !== 'v') return;
  const prev = R.chars.find((c) => c.at === q), next = R.chars.find((c) => c.at === p), off = {};
  for (const x of prev.m) if (!(next && next.m.includes(x))) off[x] = false;
  if (prev.code && !(next && next.code)) off.c = false;
  if (prev.href && !(next && next.lid === prev.lid)) off.a = false;
  if (!Object.keys(off).length) return;
  const sel = leGetSel(el); if (!sel || sel.s !== sel.e) return;
  leState(el).pend = { at: sel.s, text, m: off };
}
function rToggle(el, x) {
  const sel = leGetSel(el); if (!sel) return;
  const text = leText(el), res = rtToggle(text, sel.s, sel.e, x);
  if (res) { rDo(el, res, 'edit'); return; }
  if (sel.s !== sel.e) return;
  // nothing to format yet: it's for what you type next
  const st = leState(el), cur = rCaret(el, sel.s, text), p = rPend(el, sel.s, text), m = Object.assign({}, p ? p.m : {});
  const now = x in m ? m[x] : x === 'c' ? !!cur.code : (cur.m || '').includes(x);
  m[x] = !now;
  st.pend = { at: sel.s, text, m };
  rTools(el);
}
function rBlockDo(el, kind) {
  const sel = leGetSel(el) || { s: leText(el).length, e: leText(el).length };
  rDo(el, rtBlock(leText(el), sel.s, sel.e, kind), 'edit');
}
function rClear(el) {
  const sel = leGetSel(el); if (!sel) return;
  const text = leText(el), res = rtClear(text, sel.s, sel.e);
  if (res) rDo(el, res, 'edit');
  else { leState(el).pend = { at: sel.s, text, m: { b: false, i: false, u: false, s: false, h: false, c: false } }; rTools(el); }
}
/* the formatting at the caret, or what all of the selection has */
function rCaret(el, raw, text) { const { ls, line } = rLineAt(text, raw); return rAttrsAt(leRoles(line), raw - ls); }
function rState(el) {
  const sel = leGetSel(el), text = leText(el);
  if (!sel) return { m: '', code: false, href: null, block: 'p' };
  const [A, B] = rSel(text, sel.s, sel.e), lines = text.split('\n'), block = rKind(lines[A.ln] || '');
  if (sel.s === sel.e) {
    const c = rCaret(el, sel.s, text), p = rPend(el, sel.s, text);
    let m = c.m || '', code = !!c.code;
    if (p) Object.entries(p.m).forEach(([x, on]) => { if (x === 'c') code = on; else if (x !== 'a') m = on ? leAddMark(m, x) : m.replace(x, ''); });
    return { m, code, href: c.href || null, block };
  }
  let m = null, code = true, href;
  const inR = rInRange(A, B);
  for (let k = A.ln; k <= B.ln; k++) rLine(lines[k]).chars.forEach((c, i) => {
    if (!inR(k, i) || rWs(c.c)) return;
    m = m == null ? c.m : [...m].filter((x) => c.m.includes(x)).join('');
    code = code && c.code; href = href === undefined ? c.href : href === c.href ? href : null;
  });
  return { m: m || '', code: m != null && code, href: href || null, block };
}

/* ---- the toolbar under the note you're typing in ---- */
const RT_MOD = IS_MAC ? '⌘' : 'Ctrl+', RT_SH = IS_MAC ? '⇧' : 'Shift+';
const RT_BTNS = [
  ['style', '<span class="np-aa-l">Aa</span>', 'Text style'], '|',
  ['b', '<b>B</b>', 'Bold', RT_MOD + 'B'], ['i', '<i>I</i>', 'Italic', RT_MOD + 'I'], ['u', '<u>U</u>', 'Underline', RT_MOD + 'U'], ['s', '<s>S</s>', 'Strikethrough', RT_SH + RT_MOD + 'X'], ['h', 'highlight', 'Highlight', RT_SH + RT_MOD + 'H'], '|',
  ['ul', 'listUl', 'Bulleted list'], ['ol', 'listOl', 'Numbered list'], ['task', 'checkbox', 'Checklist', RT_SH + RT_MOD + 'L'], '|',
  ['link', 'link', 'Link', RT_MOD + 'K'],
];
function npFmtHTML() {
  return `<div class="np-fmt" role="toolbar" aria-label="Formatting">${RT_BTNS.map((b) => (b === '|' ? '<span class="np-fs" aria-hidden="true"></span>'
    : `<button type="button" class="np-fb" data-fmt="${b[0]}" title="${esc(b[2] + (b[3] ? ` (${b[3]})` : ''))}" aria-label="${esc(b[2])}" ${b[0] === 'style' ? 'aria-haspopup="menu" aria-expanded="false"' : 'aria-pressed="false"'}>${b[1].startsWith('<') ? `<span class="np-fl">${b[1]}</span>` : ic(b[1])}</button>`)).join('')}</div>`;
}
const rBox = (el) => el && el.closest && el.closest('.np-card, .np-sticky');
const rEd = (box) => box && [...box.querySelectorAll('.le')].find((x) => !x.hidden);
let rToolsRaf = 0;
function rTools(el) {
  const bar = rBox(el) && $('.np-fmt', rBox(el)); if (!bar) return;
  const st = rState(el);
  $$('[data-fmt]', bar).forEach((b) => {
    const k = b.dataset.fmt;
    const on = k === 'link' ? !!st.href : k === 'ul' || k === 'ol' || k === 'task' ? st.block === k : k.length === 1 ? st.m.includes(k) : false;
    b.classList.toggle('on', on); if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', String(on));
  });
  const aa = $('.np-aa', bar); if (aa) aa.outerHTML = npAaHTML(st);
}
function npAaHTML(st) {
  const it = (k, label, on) => `<button type="button" class="np-aa-i np-aa-${k}" data-fmt-set="${k}" role="menuitemradio" aria-checked="${!!on}">${on ? ic('check', 'np-aa-ck') : '<span class="np-aa-ck"></span>'}<span>${label}</span></button>`;
  const b = st.block;
  return `<div class="np-aa" role="menu">${it('h1', 'Title', b === 'h1')}${it('h2', 'Heading', b === 'h2')}${it('h3', 'Subheading', b === 'h3')}${it('p', 'Body', b === 'p' || b === 'ul' || b === 'ol' || b === 'task')}<div class="np-aa-sep"></div>${it('q', 'Quote', b === 'q')}${it('c', 'Monospaced', st.code)}<div class="np-aa-sep"></div><button type="button" class="np-aa-i" data-fmt-set="clear"><span class="np-aa-ck"></span><span>Clear Formatting</span></button></div>`;
}
function rCloseAa(bar) {
  const aa = bar && $('.np-aa', bar); if (aa) aa.remove();
  const b = bar && $('[data-fmt="style"]', bar); if (b) { b.setAttribute('aria-expanded', 'false'); b.classList.remove('open'); }
}
function rOpenAa(el, bar) {
  if ($('.np-aa', bar)) { rCloseAa(bar); return; }
  rCloseLink(bar, false);
  bar.insertAdjacentHTML('beforeend', npAaHTML(rState(el)));
  const b = $('[data-fmt="style"]', bar); b.setAttribute('aria-expanded', 'true'); b.classList.add('open');
  const aa = $('.np-aa', bar), scroller = bar.closest('.np-list');
  // below the button, or above it when there's no room below and there is above
  const r = aa.getBoundingClientRect(), box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  const above = bar.getBoundingClientRect().top - box.top;
  if (r.bottom > box.bottom - 6 && above > r.height + 8) aa.classList.add('up');
}
/* the link box: the address of the link you're on (Save, Open, Remove), or one for the selected
   words (or the word you're in), or one to put in where the caret is */
let rLk = null;
function rOpenLink(el) {
  const box = rBox(el), bar = box && $('.np-fmt', box), sel = leGetSel(el); if (!bar || !sel) return;
  rCloseAa(bar); rCloseLink(bar, false);
  const text = leText(el), cur = rLinkAt(text, sel.s, sel.e);
  let range = null;
  if (!cur) {
    const [A, B] = rSel(text, sel.s, sel.e);
    if (sel.s !== sel.e) range = { ln: A.ln, a: A.v, b: A.ln === B.ln ? B.v : rLine(text.split('\n')[A.ln]).chars.length };
    else { const w = rWord(rLine(text.split('\n')[A.ln]), A.v); if (w) range = { ln: A.ln, a: w[0], b: w[1] }; }
  }
  rLk = { el, bar, sel, text, cur, range };
  bar.insertAdjacentHTML('beforeend', `<div class="np-lk"><input class="np-lk-in" type="url" inputmode="url" enterkeyhint="done" placeholder="${range || cur ? 'Paste or type a link' : 'Link to put in'}" value="${esc(cur ? cur.url : '')}" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Link address"><button type="button" class="np-lk-b primary" data-lk="ok">${cur ? 'Save' : 'Link'}</button>${cur ? `<button type="button" class="np-lk-b" data-lk="open" title="Open ${esc(cur.href)}">Open</button>${cur.md ? '<button type="button" class="np-lk-b" data-lk="rm" title="Not a link any more (the words stay)">Remove</button>' : ''}` : ''}</div>`);
  const inp = $('.np-lk-in', bar); inp.focus({ preventScroll: true }); inp.select();
  const lk = $('.np-lk', bar); if (lk) lk.scrollIntoView({ block: 'nearest' });
}
/* back: the note again, with what was selected (refocus: false when the click went somewhere else) */
function rCloseLink(bar, refocus = true) {
  const lk = bar && $('.np-lk', bar); if (!lk) return;
  const ctx = rLk; rLk = null; lk.remove();
  if (refocus && ctx && ctx.el.isConnected) { ctx.el.focus({ preventScroll: true }); leSetSel(ctx.el, ctx.sel.s, ctx.sel.e, ctx.sel.back); rTools(ctx.el); }
}
function rLinkGo(act) {
  const ctx = rLk; if (!ctx) return;
  const inp = $('.np-lk-in', ctx.bar), val = inp ? inp.value.trim() : '', el = ctx.el;
  if (act === 'open') { if (ctx.cur) leOpenLink(ctx.cur.href); return; }
  const text = leText(el);
  let res = null;
  if (act === 'rm') { if (ctx.cur) res = rtSetLink(text, ctx.cur.ln, ctx.cur.a, ctx.cur.b, null, null); }
  else {
    const href = safeHref(val);
    if (!href) { if (inp) { inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad'); inp.focus(); } toast(val ? 'That doesn’t look like a link' : 'Type or paste a link'); return; }
    if (ctx.cur) res = ctx.cur.md ? rtSetLink(text, ctx.cur.ln, ctx.cur.a, ctx.cur.b, href, val) : rtLinkWords(text, ctx.cur.ln, ctx.cur.a, ctx.cur.b, val, href);
    else if (ctx.range) res = rtSetLink(text, ctx.range.ln, ctx.range.a, ctx.range.b, href, val);
    else { const at = rAt(text, ctx.sel.s); res = rtLinkWords(text, at.ln, at.v, at.v, val, href); }
  }
  rCloseLink(ctx.bar);
  if (res) rDo(el, res, 'edit');
}
document.addEventListener('pointerdown', (e) => {
  const t = e.target;
  // the toolbar's buttons keep the caret (and the selection) in the note
  if (t.closest && t.closest('.np-fmt button, .np-aa')) e.preventDefault();
  // a click anywhere else closes the Aa menu
  $$('.np-aa').forEach((aa) => { if (!aa.parentElement.contains(t)) rCloseAa(aa.parentElement); });
}, true);
document.addEventListener('mousedown', (e) => { if (e.target.closest && e.target.closest('.np-fmt button, .np-aa')) e.preventDefault(); }, true);
document.addEventListener('click', (e) => {
  const t = e.target.closest && e.target.closest('.np-fmt [data-fmt], .np-fmt [data-fmt-set], .np-fmt [data-lk]'); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  const bar = t.closest('.np-fmt'), el = rEd(rBox(bar)); if (!el) return;
  if (t.dataset.lk) { rLinkGo(t.dataset.lk); return; }
  if (document.activeElement !== el) { const c = rLk; rCloseLink(bar, !!c); if (!c) el.focus({ preventScroll: true }); }
  const k = t.dataset.fmt || t.dataset.fmtSet;
  if (k === 'style') { rOpenAa(el, bar); return; }
  rCloseAa(bar);
  if (k === 'link') { rOpenLink(el); return; }
  if (k === 'ul' || k === 'ol' || k === 'task' || k === 'q' || /^h[123]$/.test(k) || k === 'p') { rBlockDo(el, k); return; }
  if (k === 'clear') { rClear(el); return; }
  rToggle(el, k);
}, true);
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t.classList && t.classList.contains('np-lk-in')) {
    if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); rLinkGo('ok'); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); rCloseLink(t.closest('.np-fmt')); return; }
    return;
  }
  const el = leHost(t);
  if (e.key === 'Escape' && el) { const aa = rBox(el) && $('.np-aa', rBox(el)); if (aa) { e.preventDefault(); e.stopImmediatePropagation(); rCloseAa(aa.parentElement); } }
}, true);
/* the link box loses the keyboard to something outside the note: put it away, and the note too */
document.addEventListener('focusout', (e) => {
  const t = e.target; if (!t.classList || !t.classList.contains('np-lk-in')) return;
  const bar = t.closest('.np-fmt'), box = rBox(bar);
  setTimeout(() => {
    const a = document.activeElement;
    if (a && box && box.contains(a)) return;
    const ctx = rLk, lk = $('.np-lk', bar); if (lk) lk.remove(); rLk = null;
    if (ctx && ctx.el.isConnected) npEditDone(ctx.el);
  }, 0);
});
/* the toolbar follows the caret */
document.addEventListener('selectionchange', () => {
  if (rToolsRaf) return;
  rToolsRaf = requestAnimationFrame(() => {
    rToolsRaf = 0;
    const sel = window.getSelection(), el = sel && sel.rangeCount ? leHost(sel.anchorNode) : null;
    if (!el || !leRich(el)) return;
    const st = leState(el);
    if (st.pend) { const r = leGetSel(el); if (!r || r.s !== r.e || r.s !== st.pend.at || leText(el) !== st.pend.text) st.pend = null; }
    rTools(el);
  });
});
