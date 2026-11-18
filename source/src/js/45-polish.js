/* ===================== Polish: the + in the header, the slim title bar, motion ===================== */

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- the + in a list's header (Mac) ----
   Click it for a new to-do in this list, or drag it into place, onto a day or onto a list,
   like the floating + on iPhone (both match MAGIC_SEL). */
function headerPlus() {
  // a Board has a + on every column (and Add Column beside it), so it does without one
  if (isMobile() || magicHidden() || ui.view.type === 'board') return;
  const lh = $('#content .lh'); if (!lh || $('.lh-add', lh)) return;
  const b = document.createElement('button');
  b.className = 'ib lh-add'; b.title = 'New To-Do (N)'; b.setAttribute('aria-label', 'New To-Do');
  b.innerHTML = ic('plus');
  // before the share and ••• buttons, after anything that belongs to the title (like a Board's switcher)
  const firstTool = $(':scope > .lh-share', lh) || $(':scope > .ib[data-action="view-menu"]', lh) || [...lh.children].reverse().find((x) => x.matches('.ib'));
  if (firstTool) lh.insertBefore(b, firstTool); else lh.append(b);
}

/* ---- the slim title bar ----
   Once a list's header scrolls out of sight, a bar with its name and its buttons slides in at the top
   of the window, so + and ••• are never more than a click away. Click the name to go back to the top. */
let miniObs = null;
function miniBarSync() {
  const main = $('#main'), content = $('#content'); if (!main || !content) return;
  let bar = $('#lh-mini');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'lh-mini'; bar.className = 'lh-mini';
    main.insertBefore(bar, content);
    bar.addEventListener('click', (e) => { if (e.target.closest('[data-mini-top]')) main.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); });
  }
  if (miniObs) { miniObs.disconnect(); miniObs = null; }
  const lh = $('.lh', content);
  // the Board and the Timeline keep their own headers on screen; the iPhone has its own bar
  if (isMobile() || !lh || content.classList.contains('board-view')) { bar.classList.remove('on'); bar.innerHTML = ''; return; }
  const t = $('.lh-title', lh);
  const name = t ? (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' ? t.value || t.placeholder : t.textContent) : '';
  const icon = $(':scope > .lh-ic', lh);
  const tools = $$(':scope > .ib, :scope > .lh-np', lh).map((x) => { const c = x.cloneNode(true); c.removeAttribute('id'); return c.outerHTML; }).join('');
  bar.innerHTML = `<div class="lh-mini-bar"><div class="lh-mini-in"><button class="lh-mini-t" data-mini-top title="Back to the top">${icon ? icon.outerHTML : ''}<span>${esc(name)}</span></button><span class="spacer"></span>${tools}</div></div>`;
  miniObs = new IntersectionObserver(([en]) => {
    bar.classList.toggle('on', !en.isIntersecting && en.boundingClientRect.top < en.rootBounds.top + 10);
  }, { root: main, threshold: 0, rootMargin: '-6px 0px 0px 0px' });
  miniObs.observe($('.lh-title', lh) || lh);
}

/* ---- rows glide to where they go ----
   Before the list is redrawn, note where each row was (and whether it was checked); afterwards, the
   rows that moved slide from there to their new place: a checked to-do sinking to the bottom, a
   dropped one settling in, the ones below an opened to-do making room. A to-do just checked off gets
   its check drawn in. */
let flipView = '';
// rows by id, and the headings between them by their text, so they move together
const FLIP_SEL = '#content .row[data-id], #content .sec-h, #content .day-h, #content .grp-h, #content .lb-h';
function flipKey(el, seen) {
  const id = el.dataset.id ? el.dataset.id : 'h:' + el.className + ':' + el.textContent.trim().slice(0, 60);
  const k = id + (el.closest('[data-col]') ? '@' + el.closest('[data-col]').dataset.col : '');
  const n = (seen.get(k) || 0) + 1; seen.set(k, n);
  return k + '#' + n;
}
function flipCapture() {
  const view = JSON.stringify(ui.view);
  const same = view === flipView; flipView = view;
  if (!same || reducedMotion() || (typeof D !== 'undefined' && D.st && D.st.active)) return null;
  const rows = $$(FLIP_SEL);
  if (!rows.length || rows.length > 500) return null;
  const seen = new Map(), at = new Map();
  rows.forEach((el) => { const r = el.getBoundingClientRect(); at.set(flipKey(el, seen), { top: r.top, left: r.left, done: !!el.querySelector(':scope > .cb.done') }); });
  return at;
}
function flipPlay(at) {
  if (!at || !at.size) return;
  const seen = new Map(), moves = [];
  $$(FLIP_SEL).forEach((el) => {
    const was = at.get(flipKey(el, seen)); if (!was) return;
    const r = el.getBoundingClientRect();
    const dx = was.left - r.left, dy = was.top - r.top;
    const cb = el.querySelector(':scope > .cb');
    if (cb && cb.classList.contains('done') && !was.done) { cb.classList.add('just-done'); el.classList.add('just-done'); }
    if ((Math.abs(dy) > 1 || Math.abs(dx) > 1) && Math.abs(dy) < innerHeight * 1.5) moves.push([el, dx, dy]);
  });
  moves.forEach(([el, dx, dy]) => {
    try { el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2, .8, .2, 1)' }); } catch (e) { /* no Web Animations */ }
  });
}

/* ---- the title bar (Mac) and status bar (iPhone) match the page, in the theme you picked ---- */
function syncTitleBar(theme) {
  const metas = $$('meta[name="theme-color"]'); if (!metas.length) return;
  if (theme === 'light' || theme === 'dark') {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || (theme === 'dark' ? '#18191c' : '#ffffff');
    metas.forEach((m) => m.setAttribute('content', bg));
  } else metas.forEach((m) => m.setAttribute('content', /dark/.test(m.getAttribute('media') || '') ? '#18191c' : '#ffffff'));
}
