/* ===================== Narrow Mac windows =====================
   A Mac window keeps the Mac layout at any width down to phone size (see PHONE_MQ), so the
   Board and the sidebar stay put when Sectis shares the screen with another app.
   - The sidebar can be hidden: the button at the bottom of the sidebar, or ⌃⌘S. Each device
     remembers. The button at the top left brings it back.
   - In a window 640px wide or less the sidebar starts hidden and slides in over the list when
     you want it, then gets out of the way once you pick a list or click elsewhere.
   - While dragging, hold over the sidebar button for a moment and the sidebar slides in, so
     to-dos can still be dropped on lists, projects and areas.
   - Lists use less padding when the main pane is narrow. */
const SB_FLOAT_AT = 640;
ui.sbHidden = lsGet('sectis.sbHidden') === '1';
ui.sbFloat = false;
const sbNarrow = () => !isMobile() && window.innerWidth <= SB_FLOAT_AT;
const sbOff = () => !isMobile() && (ui.sbHidden || sbNarrow());
function applySidebarMode() {
  const app = $('#app'); if (!app) return;
  const off = sbOff();
  if (!off) ui.sbFloat = false;
  app.classList.toggle('sb-off', off);
  app.classList.toggle('sb-float', off && ui.sbFloat);
  const show = $('#sb-show');
  if (show) { show.hidden = !off || ui.sbFloat; show.title = `Show Sidebar (${IS_MAC ? '⌃⌘S' : 'Ctrl+Alt+S'})`; }
  const main = $('#main');
  if (main && !isMobile()) app.classList.toggle('main-narrow', main.clientWidth > 0 && main.clientWidth < 600);
  else app.classList.remove('main-narrow');
}
function toggleSidebar(force) {
  if (isMobile()) return;
  if (sbNarrow()) ui.sbFloat = force != null ? force : !ui.sbFloat;
  else { ui.sbHidden = force != null ? !force : !ui.sbHidden; ui.sbFloat = false; lsSet('sectis.sbHidden', ui.sbHidden ? '1' : ''); }
  applySidebarMode();
  $$('textarea[data-autosize]').forEach(autosize); // titles rewrap at the new width
}
function closeSidebarFloat() { if (ui.sbFloat) { ui.sbFloat = false; applySidebarMode(); } }

window.addEventListener('resize', () => { applySidebarMode(); });
if (window.ResizeObserver) { try { new ResizeObserver(() => applySidebarMode()).observe($('#main')); } catch (e) { /* older browsers: the resize event covers it */ } }

// the floating sidebar steps aside once you've picked a list, or click outside it
document.addEventListener('click', (e) => {
  if (!ui.sbFloat || D.suppressClick) return;
  const nav = e.target.closest && e.target.closest('#sidebar [data-nav], #sidebar [data-action="find"], #sidebar [data-action="new-list"], #sidebar [data-action="settings"], #sidebar [data-action="quick-entry"]');
  if (nav) setTimeout(closeSidebarFloat, 0);
}, true); // before the click re-renders the sidebar
document.addEventListener('pointerdown', (e) => {
  if (!ui.sbFloat || (D.st && D.st.active)) return;
  const t = e.target;
  if (t.closest && (t.closest('#sidebar') || t.closest('#sb-show') || t.closest('#layer'))) return;
  closeSidebarFloat();
}, true);
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyS' && ((e.metaKey && e.ctrlKey) || (!IS_MAC && e.ctrlKey && e.altKey)) && !e.shiftKey && !layers.length) { e.preventDefault(); e.stopImmediatePropagation(); toggleSidebar(); return; }
  if (e.key === 'Escape' && ui.sbFloat && !layers.length && !(D.st && D.st.active)) { e.preventDefault(); e.stopImmediatePropagation(); closeSidebarFloat(); }
}, true);

/* while dragging, rest on the sidebar button to slide the sidebar in */
function springSidebar(el) {
  const st = D.st; if (!st) return;
  const over = el && el.closest && el.closest('#sb-show');
  if (!over) { clearTimeout(st.spring); st.spring = null; return; }
  if (st.spring || ui.sbFloat) return;
  st.spring = setTimeout(() => { if (D.st === st && st.active) { st.sprung = true; ui.sbFloat = true; applySidebarMode(); dragTrack(); } }, 450);
}
function unspringSidebar(st) { if (!st) return; clearTimeout(st.spring); if (st.sprung) closeSidebarFloat(); }
