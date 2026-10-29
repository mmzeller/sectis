/* ===================== Utilities, dates, icons ===================== */
const APP_VERSION = '1.15.0';
const STORE_KEY = 'sectis.data.v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const uid = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mq = window.matchMedia('(max-width: 760px)');
const isMobile = () => mq.matches;
const isCoarse = () => window.matchMedia('(pointer: coarse)').matches;
const IS_MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
const MODK = IS_MAC ? '⌘' : 'Ctrl+';
const IN_FRAME = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
function debounce(fn, ms) { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.flush = () => { clearTimeout(t); fn(); }; return f; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function plural(n, w, p) { return `${n} ${n === 1 ? w : (p || w + 's')}`; }

/* ---- dates: every calendar date is a local 'YYYY-MM-DD' string ---- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WD = WEEKDAYS.map((d) => d.slice(0, 3));
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function pd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
const todayStr = () => ymd(new Date());
function addDays(s, n) { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); }
function diffDays(a, b) { return Math.round((pd(b) - pd(a)) / 864e5); }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
const dow = (s) => pd(s).getDay();
function monthIndex(s) { const d = pd(s); return d.getFullYear() * 12 + d.getMonth(); }
function dateFromParts(y, m, d) { return ymd(new Date(y, m, d)); }
function stampDay(ts) { return ymd(new Date(ts)); }
function fmtDate(s, opts = {}) {
  const d = pd(s); let out = `${MON[d.getMonth()]} ${d.getDate()}`;
  if (opts.weekday !== false) out = `${WD[d.getDay()]}, ${out}`;
  if (d.getFullYear() !== new Date().getFullYear() || opts.year) out += `, ${d.getFullYear()}`;
  return out;
}
function fmtRel(s) {
  const n = diffDays(ui.today, s);
  if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return WEEKDAYS[dow(s)];
  return fmtDate(s, { weekday: false });
}
function fmtTime(hm) { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${pad2(m)} ${h >= 12 ? 'PM' : 'AM'}`; }
function deadlineInfo(s) {
  const n = diffDays(ui.today, s);
  if (n < 0) return { text: n === -1 ? '1 day ago' : `${-n} days ago`, due: true };
  if (n === 0) return { text: 'Today', due: true };
  if (n === 1) return { text: 'Tomorrow', due: false };
  if (n < 15) return { text: `${n} days left`, due: false };
  return { text: fmtDate(s, { weekday: false }), due: false };
}
function weekStart(s) { const ws = (S && S.settings.weekStart) || 0; return addDays(s, -((dow(s) - ws + 7) % 7)); }

/* ---- natural-language dates: "tom", "fri", "next week", "in 3 days", "oct 24", "10/24" ---- */
const WD_FULL = WEEKDAYS.map((w) => w.toLowerCase());
const MON_FULL = MONTHS.map((m) => m.toLowerCase());
function matchWeekday(w) {
  if (!w || w.length < 2) return -1;
  const alias = { tues: 2, weds: 3, thur: 4, thurs: 4 };
  if (alias[w] != null) return alias[w];
  const hits = WD_FULL.map((n, i) => (n.startsWith(w) ? i : -1)).filter((i) => i >= 0);
  return hits.length === 1 ? hits[0] : -1;
}
function matchMonth(w) {
  if (!w || w.length < 3) return -1;
  if (w === 'sept') return 8;
  const hits = MON_FULL.map((n, i) => (n.startsWith(w) ? i : -1)).filter((i) => i >= 0);
  return hits.length === 1 ? hits[0] : -1;
}
function nextWeekday(from, wd, includeToday) { let n = (wd - dow(from) + 7) % 7; if (n === 0 && !includeToday) n = 7; return addDays(from, n); }
function parseDateText(raw) {
  const T = ui.today;
  const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]+$/, '');
  if (!s) return null;
  const specials = { today: 'today', tod: 'today', now: 'today', tonight: 'evening', 'this evening': 'evening', evening: 'evening', eve: 'evening', someday: 'someday', anytime: 'anytime' };
  if (specials[s]) return { special: specials[s] };
  if (['tomorrow', 'tom', 'tmr', 'tmrw', 'tmw', 'tomor', 'tomorr', 'tomorro'].includes(s)) return { date: addDays(T, 1) };
  if (s === 'yesterday') return { date: addDays(T, -1) };
  if (s === 'weekend' || s === 'this weekend') return { date: dow(T) === 6 || dow(T) === 0 ? T : nextWeekday(T, 6) };
  if (s === 'next weekend') return { date: addDays(dow(T) === 0 ? addDays(T, -1) : nextWeekday(T, 6, true), 7) };
  if (s === 'next week') { const ws = S.settings.weekStart || 0; return { date: nextWeekday(T, ws === 0 ? 1 : ws) }; }
  if (s === 'next month') { const d = pd(T); return { date: dateFromParts(d.getFullYear(), d.getMonth() + 1, 1) }; }
  if (s === 'next year') return { date: `${pd(T).getFullYear() + 1}-01-01` };
  if (s === 'end of month' || s === 'eom') { const d = pd(T); let e = dateFromParts(d.getFullYear(), d.getMonth(), daysInMonth(d.getFullYear(), d.getMonth())); if (e === T) e = dateFromParts(d.getFullYear(), d.getMonth() + 1, daysInMonth(d.getFullYear(), d.getMonth() + 1)); return { date: e }; }
  if (s === 'end of week' || s === 'eow') return { date: nextWeekday(T, 5, true) };
  let m;
  if ((m = s.match(/^(?:in\s+)?(\d{1,3})\s*(d|days?|w|wks?|weeks?|m|mos?|months?|y|yrs?|years?)$/))) {
    const n = +m[1], u = m[2][0];
    if (u === 'd') return { date: addDays(T, n) };
    if (u === 'w') return { date: addDays(T, n * 7) };
    const d = pd(T);
    if (u === 'm') { const y = d.getFullYear(), mo = d.getMonth() + n; const ny = y + Math.floor(mo / 12), nm = mo % 12; return { date: dateFromParts(ny, nm, Math.min(d.getDate(), daysInMonth(ny, nm))) }; }
    if (u === 'y') return { date: dateFromParts(d.getFullYear() + n, d.getMonth(), Math.min(d.getDate(), daysInMonth(d.getFullYear() + n, d.getMonth()))) };
  }
  if ((m = s.match(/^\+(\d{1,3})$/))) return { date: addDays(T, +m[1]) };
  if ((m = s.match(/^(next |this |on )?([a-z]+)$/))) {
    const wd = matchWeekday(m[2]);
    if (wd >= 0) { let d = nextWeekday(T, wd, m[1] === 'this '); if (m[1] === 'next ') d = addDays(d, 7); return { date: d }; }
    const mo = matchMonth(m[2]);
    if (mo >= 0 && !m[1]) { const y = pd(T).getFullYear(); let d = dateFromParts(y, mo, 1); if (d < T) d = dateFromParts(y + 1, mo, 1); if (pd(T).getMonth() === mo) d = T; return { date: d }; }
  }
  const mkDate = (y, mo, d, explicitYear) => {
    if (mo < 0 || mo > 11 || d < 1) return null;
    if (y != null && y < 100) y += 2000;
    const yy = y != null ? y : pd(T).getFullYear();
    if (d > daysInMonth(yy, mo)) return null;
    let out = dateFromParts(yy, mo, d);
    if (!explicitYear && out < T) out = dateFromParts(yy + 1, mo, Math.min(d, daysInMonth(yy + 1, mo)));
    return out;
  };
  if ((m = s.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{2,4}))?$/))) { const mo = matchMonth(m[1]); if (mo >= 0) { const d = mkDate(m[3] ? +m[3] : null, mo, +m[2], !!m[3]); if (d) return { date: d }; } }
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]+)(?:,? (\d{2,4}))?$/))) { const mo = matchMonth(m[2]); if (mo >= 0) { const d = mkDate(m[3] ? +m[3] : null, mo, +m[1], !!m[3]); if (d) return { date: d }; } }
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { const d = mkDate(+m[1], +m[2] - 1, +m[3], true); if (d) return { date: d }; }
  if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/))) { const d = mkDate(m[3] ? +m[3] : null, +m[1] - 1, +m[2], !!m[3]); if (d) return { date: d }; }
  if ((m = s.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?$/))) {
    const n = +m[1]; if (n < 1 || n > 31) return null;
    const d0 = pd(T); let y = d0.getFullYear(), mo = d0.getMonth();
    for (let i = 0; i < 14; i++) { if (n <= daysInMonth(y, mo)) { const c = dateFromParts(y, mo, n); if (c >= T) return { date: c }; } mo++; if (mo > 11) { mo = 0; y++; } }
  }
  return null;
}
function describeParsed(p) {
  if (!p) return '';
  if (p.special === 'today') return 'Today';
  if (p.special === 'evening') return 'This Evening';
  if (p.special === 'someday') return 'Someday';
  if (p.special === 'anytime') return 'Anytime';
  return fmtDate(p.date);
}

/* ---- icons (drawn for Sectis; all stroke-based, currentColor) ---- */
const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const I = {
  inbox: svg('<path d="M3.5 13.5 6.2 5.5h11.6l2.7 8v4.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18z"/><path d="M3.5 13.5h4.8l1.3 2.4h4.8l1.3-2.4h4.8"/>'),
  star: svg('<path class="fill" d="m12 3.2 2.65 5.6 6.1.75-4.5 4.2 1.15 6.05L12 16.85 6.6 19.8l1.15-6.05-4.5-4.2 6.1-.75z"/>'),
  moon: svg('<path class="fill" d="M19.6 14.9A8 8 0 0 1 9.1 4.4a8 8 0 1 0 10.5 10.5z"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  layers: svg('<path d="m12 3.8 8.5 4.4-8.5 4.4-8.5-4.4z"/><path d="m3.5 12.2 8.5 4.4 8.5-4.4M3.5 16.2l8.5 4.4 8.5-4.4"/>'),
  box: svg('<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M4.8 9v9.5a1.5 1.5 0 0 0 1.5 1.5h11.4a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>'),
  logbook: svg('<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>'),
  trash: svg('<path d="M4.5 6.5h15M9.5 6.5v-2h5v2M6.4 6.5l.9 12.6a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.9-12.6M10 10.5v6M14 10.5v6"/>'),
  area: svg('<path d="m12 3.4 7.6 4.3v8.6L12 20.6l-7.6-4.3V7.7z"/><path d="M4.7 7.9 12 12l7.3-4.1M12 12v8.4"/>'),
  flag: svg('<path d="M6 21V4M6 4.6h10.8l-2.3 4.1 2.3 4.1H6"/>'),
  tag: svg('<path d="M3.5 12.3V5a1.5 1.5 0 0 1 1.5-1.5h7.3l8.4 8.4a1.4 1.4 0 0 1 0 2l-6.8 6.8a1.4 1.4 0 0 1-2 0z"/><circle class="fill" cx="8.2" cy="8.2" r="1.5"/>'),
  checklist: svg('<path d="m3.8 6.4 1.7 1.7 2.9-3.1M3.8 12.4l1.7 1.7 2.9-3.1M3.8 18.4l1.7 1.7 2.9-3.1M11.5 7h9M11.5 13h9M11.5 19h9"/>'),
  notes: svg('<path d="M5 6h14M5 10.3h14M5 14.6h14M5 18.9h8.5"/>'),
  repeat: svg('<path d="m17 3.2 3 3-3 3"/><path d="M4 11.3v-.8a4.3 4.3 0 0 1 4.3-4.3H20M7 20.8l-3-3 3-3"/><path d="M20 12.7v.8a4.3 4.3 0 0 1-4.3 4.3H4"/>'),
  bell: svg('<path d="M6.2 16.8V11a5.8 5.8 0 0 1 11.6 0v5.8l1.7 1.7H4.5z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>'),
  search: svg('<circle cx="10.6" cy="10.6" r="6.4"/><path d="m15.4 15.4 5 5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  more: svg('<circle class="fill" cx="5.5" cy="12" r="1.7"/><circle class="fill" cx="12" cy="12" r="1.7"/><circle class="fill" cx="18.5" cy="12" r="1.7"/>'),
  report: svg('<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 15.5v-3M12 15.5v-6M15.5 15.5v-4.5"/>'),
  hourglass: svg('<path d="M6.5 3.5h11M6.5 20.5h11M8 3.5v2.4c0 2.3 1.7 3.7 4 6.1-2.3 2.4-4 3.8-4 6.1v2.4M16 3.5v2.4c0 2.3-1.7 3.7-4 6.1 2.3 2.4 4 3.8 4 6.1v2.4"/>'),
  template: svg('<rect x="4.5" y="3.5" width="15" height="17" rx="2.5" stroke-dasharray="3.2 2.4"/><path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4"/>'),
  columns: svg('<rect x="3.5" y="4" width="7" height="16" rx="2"/><rect x="13.5" y="4" width="7" height="10.5" rx="2"/>'),
  chevL: svg('<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>'),
  chevR: svg('<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>'),
  chevD: svg('<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'),
  x: svg('<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>'),
  check: svg('<path d="m5 12.5 4.3 4.3L19 7"/>'),
  move: svg('<path d="M4 12h13M13 7l5 5-5 5"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  heading: svg('<path d="M5 6h14M5 12h9M5 18h11"/>'),
  project: svg('<circle cx="12" cy="12" r="8.5"/><path class="fill" d="M12 12V3.5a8.5 8.5 0 0 1 8.5 8.5z"/>'),
  cancel: svg('<circle cx="12" cy="12" r="8.5"/><path d="m8.5 8.5 7 7M15.5 8.5l-7 7"/>'),
  reopen: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9M4.5 4.5V9H9"/>'),
  select: svg('<circle cx="12" cy="12" r="8.5"/><path d="m8 12.2 2.8 2.8 5.2-5.6"/>'),
  download: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
  upload: svg('<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>'),
  key: svg('<rect x="3" y="6.5" width="18" height="11" rx="2.5"/><path d="M7 10h.01M11 10h.01M15 10h.01M7.5 14h9"/>'),
  file: svg('<path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5"/>'),
  convert: svg('<path d="M4 7h11l-3-3M20 17H9l3 3"/>'),
  archive: svg('<rect x="3.5" y="4" width="17" height="5" rx="1.5"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>'),
  edit: svg('<path d="M4 20h4.5L19.3 9.2a2 2 0 0 0 0-2.8l-1.7-1.7a2 2 0 0 0-2.8 0L4 15.5z"/>'),
  cloud: svg('<path d="M7.2 18.5h10.1a4 4 0 0 0 .5-7.97A5.6 5.6 0 0 0 7 9.6a4.45 4.45 0 0 0 .2 8.9z"/>'),
  grip: svg('<circle class="fill" cx="9" cy="6.5" r="1.5"/><circle class="fill" cx="15" cy="6.5" r="1.5"/><circle class="fill" cx="9" cy="12" r="1.5"/><circle class="fill" cx="15" cy="12" r="1.5"/><circle class="fill" cx="9" cy="17.5" r="1.5"/><circle class="fill" cx="15" cy="17.5" r="1.5"/>'),
  share: svg('<path d="M12 3.5v11M8 7.2 12 3.5l4 3.7"/><path d="M8.5 10H7a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2h-1.5"/>'),
  link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1.1 1.1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1"/>'),
  bolt: svg('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'),
};
const ic = (name, cls = '') => `<span class="ic ${cls}">${I[name] || ''}</span>`;
function pieSVG(frac) {
  const r = 7.2; let wedge = '';
  if (frac >= 0.999) wedge = `<circle class="fill" cx="12" cy="12" r="${r}"/>`;
  else if (frac > 0.001) {
    const a = frac * Math.PI * 2, x = 12 + r * Math.sin(a), y = 12 - r * Math.cos(a);
    wedge = `<path class="fill" d="M12 12V${(12 - r).toFixed(2)}A${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z"/>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="pie-ring" cx="12" cy="12" r="9.6"/>${wedge}</svg>`;
}
const pieIc = (frac, cls = '') => `<span class="ic ${cls}">${pieSVG(frac)}</span>`;
