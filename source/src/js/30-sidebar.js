/* ===================== Sidebar width (Mac) =====================
   Drag the sidebar's right edge to make it wider or narrower; double-click it to go back to
   the usual width. Each device keeps its own. */
const SB_MIN = 200, SB_MAX = 440, SB_DEF = 268;
function applySidebarWidth(w) {
  const app = $('#app'); if (!app) return;
  if (w) app.style.setProperty('--sbw', Math.round(clamp(w, SB_MIN, SB_MAX)) + 'px'); else app.style.removeProperty('--sbw');
}
applySidebarWidth(+lsGet('sectis.sbw') || 0);
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest && e.target.closest('#sidebar .sb-resize');
  if (!h || e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  const x0 = e.clientX, w0 = $('#sidebar').getBoundingClientRect().width;
  let w = w0;
  try { h.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  document.body.classList.add('col-resizing'); h.classList.add('on');
  const move = (ev) => { w = clamp(w0 + ev.clientX - x0, SB_MIN, SB_MAX); applySidebarWidth(w); };
  const up = () => {
    h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
    document.body.classList.remove('col-resizing'); h.classList.remove('on');
    if (Math.abs(w - w0) > 1) lsSet('sectis.sbw', String(Math.round(w)));
    $$('textarea[data-autosize]').forEach(autosize); // titles rewrap at the new width
  };
  h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
}, true);
document.addEventListener('dblclick', (e) => {
  if (!(e.target.closest && e.target.closest('#sidebar .sb-resize'))) return;
  e.preventDefault(); lsSet('sectis.sbw', ''); applySidebarWidth(0); $$('textarea[data-autosize]').forEach(autosize);
});
