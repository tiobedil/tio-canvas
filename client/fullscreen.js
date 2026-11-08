import { claimCorner } from './corners.js';

// Full-page preview keeps the existing iframe mounted, including its page state.
export function createFullscreen({ onEnter, onExit }) {
  const root = document.querySelector('#fullscreen-tools');
  const button = document.querySelector('#fullscreen-toggle');
  const menu = document.querySelector('#fullscreen-menu');
  let entry = null, right = false, bottom = false, drag = null, suppressClick = false;
  const token = name => parseFloat(getComputedStyle(root).getPropertyValue(name));
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  function close(focus = false) {
    menu.hidden = true; button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus({ preventScroll: true });
  }
  // Interface Kit lives inside the previewed page. While its panel is open it
  // takes the corner over, so the control steps aside until the panel closes.
  // The kit marks a collapsed button with data-floating-corner and removes the
  // mark when it opens (build/interface-kit-bundle.mjs).
  let kitObserver = null, kitFrame = null;
  const syncKit = doc => {
    const mount = doc.querySelector('[data-interface-kit]');
    const open = Boolean(mount) && !mount.hasAttribute('data-floating-corner');
    root.toggleAttribute('data-kit-open', open);
    if (open) close();
  };
  function attachKit() {
    kitObserver?.disconnect();
    try {
      const doc = kitFrame?.contentDocument;
      if (!doc) return;
      kitObserver = new MutationObserver(() => syncKit(doc));
      kitObserver.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-floating-corner'] });
      syncKit(doc);
    } catch { /* A cross-origin frame has no kit to watch. */ }
  }
  function watchKit(frame) {
    unwatchKit();
    kitFrame = frame ?? null;
    if (!kitFrame) return;
    kitFrame.addEventListener('load', attachKit);
    attachKit();
  }
  function unwatchKit() {
    kitFrame?.removeEventListener('load', attachKit);
    kitObserver?.disconnect(); kitObserver = null; kitFrame = null;
    root.removeAttribute('data-kit-open');
  }
  function positionMenu() {
    menu.style.left = right ? 'auto' : '0'; menu.style.right = right ? '0' : 'auto';
    menu.style.top = bottom ? 'auto' : 'calc(var(--canvas-float-size) + var(--canvas-preview-gap))';
    menu.style.bottom = bottom ? 'calc(var(--canvas-float-size) + var(--canvas-preview-gap))' : 'auto';
  }
  function snap() {
    const corner = claimCorner(root, `${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}`);
    right = corner.endsWith('right'); bottom = corner.startsWith('bottom');
    const inset = token('--canvas-preview-inset'), size = button.offsetWidth;
    root.style.transform = `translate(${right ? innerWidth - inset - size : inset}px,${bottom ? innerHeight - inset - size : inset}px)`;
    positionMenu();
  }
  function exit() {
    if (!entry) return;
    close(); unwatchKit(); const previous = entry; entry = null;
    previous.element.removeAttribute('data-fullscreen');
    document.body.removeAttribute('data-fullscreen'); root.hidden = true; delete root.dataset.floatingCorner;
    onExit(previous); previous.fullscreen.focus({ preventScroll: true });
  }
  button.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (!menu.hidden) { close(); return; }
    menu.hidden = false; positionMenu(); button.setAttribute('aria-expanded', 'true');
  });
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = root.getBoundingClientRect();
    // Interrupt a snap from its current painted position, not its destination.
    root.dataset.dragging = '';
    root.style.transform = `translate(${rect.left}px,${rect.top}px)`;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
    suppressClick = false; button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true; close();
    const inset = token('--canvas-preview-inset'), size = button.offsetWidth;
    const x = clamp(drag.left + dx, inset, innerWidth - inset - size);
    const y = clamp(drag.top + dy, inset, innerHeight - inset - size);
    root.style.transform = `translate(${x}px,${y}px)`;
    right = x + size / 2 >= innerWidth / 2; bottom = y + size / 2 >= innerHeight / 2;
  });
  function release(event) {
    if (!drag || (event?.pointerId != null && event.pointerId !== drag.id)) return;
    suppressClick = drag.moved; drag = null; delete root.dataset.dragging; snap();
  }
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  window.addEventListener('blur', () => release());
  // The onboarding card floats over the preview; pressing it is not pressing outside the menu.
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target) && !event.target.closest?.('.onboarding-card')) close(); }, true);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!menu.hidden) close(true); else exit(); }
  });
  document.querySelector('#fullscreen-back').addEventListener('click', exit);
  window.addEventListener('resize', () => { if (entry) { release(); snap(); } });
  return {
    get entry() { return entry; }, close, exit,
    enter(next) {
      if (entry) exit();
      entry = next; onEnter(next);
      next.element.setAttribute('data-fullscreen', ''); document.body.dataset.fullscreen = '';
      root.hidden = false; snap(); watchKit(next.iframe);
      next.iframe?.contentWindow.dispatchEvent(new Event('canvas-corners-changed'));
      button.focus({ preventScroll: true });
    },
  };
}
