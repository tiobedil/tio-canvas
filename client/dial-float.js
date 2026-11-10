import { claimCorner } from './corners.js';

/**
 * In a fullscreen preview the minimised dials are a floating button, like the
 * preview menu button: it sits in a corner, is dragged to another one, and never
 * shares a corner with the other floating buttons (corners.js). On the canvas the
 * button stays beside its frame and none of this runs.
 *   const float = createDialFloat(panel)     panel: a DialPanel
 *   float.setActive(true)   entering fullscreen      float.sync()   after the panel folds or unfolds
 */
export function createDialFloat(panel) {
  const button = panel.button;
  let active = false, right = true, bottom = false, drag = null, dragged = false;
  const token = name => parseFloat(getComputedStyle(panel).getPropertyValue(name));
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const floating = () => active && panel.hasAttribute('data-minimized');
  function sync() {
    if (!floating()) { panel.style.transform = ''; delete panel.dataset.floatingCorner; delete panel.dataset.dragging; drag = null; return; }
    const corner = claimCorner(panel, `${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}`);
    right = corner.endsWith('right'); bottom = corner.startsWith('bottom');
    const inset = token('--canvas-preview-inset'), size = button.offsetWidth;
    // The first placement is not a move: the button appears in its corner, it does not fly there.
    const appearing = !panel.style.transform;
    if (appearing) panel.dataset.dragging = '';
    panel.style.transform = `translate(${right ? innerWidth - inset - size : inset}px,${bottom ? innerHeight - inset - size : inset}px)`;
    if (appearing) { panel.offsetWidth; delete panel.dataset.dragging; }
  }
  button.addEventListener('pointerdown', event => {
    dragged = false;
    if (!floating() || event.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    // Interrupt a snap from where the button is painted, not where it is going.
    panel.dataset.dragging = '';
    panel.style.transform = `translate(${rect.left}px,${rect.top}px)`;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) < 4) return;
    dragged = true;
    const inset = token('--canvas-preview-inset'), size = button.offsetWidth;
    const x = clamp(drag.left + dx, inset, innerWidth - inset - size), y = clamp(drag.top + dy, inset, innerHeight - inset - size);
    panel.style.transform = `translate(${x}px,${y}px)`;
    right = x + size / 2 >= innerWidth / 2; bottom = y + size / 2 >= innerHeight / 2;
  });
  function release(event) {
    if (!drag || (event?.pointerId != null && event.pointerId !== drag.id)) return;
    drag = null; delete panel.dataset.dragging; sync();
  }
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  // The click that ends a drag must not open the panel.
  button.addEventListener('click', event => { if (dragged) { dragged = false; event.preventDefault(); } }, true);
  window.addEventListener('blur', () => release());
  window.addEventListener('resize', () => { if (floating()) { release(); sync(); } });
  return { sync, setActive(value) { active = value; sync(); } };
}
