// First-run tour for the canvas. It watches the page and never drives it: each
// step ends when the user does the thing the step is about, so there is no
// Back, and no Next except where there is nothing to do (a tip, or the finish).
// While it is up, every press and key outside what is highlighted is swallowed.
import { h, Button } from './ui/index.js';

const KEY = 'tio-canvas:onboarding';
const PAD = 6, GAP = 12, MARGIN = 12, RADIUS = 14;
const $ = selector => document.querySelector(selector);
const visible = element => !!element && element.checkVisibility();

const inspectorReady = () => visible($('#inspector'));
const selectScreen = {
  targets: () => [$('#layers')],
  title: 'Select one screen',
  body: 'Click a single screen in this list to edit its size.',
};

// pan: the target lives on the canvas, so it can end up off screen; the tour pans to it.
const steps = [
  {
    targets: () => [$('#add')],
    title: 'Add a page',
    body: 'Click here to open the page list.',
  },
  {
    targets: () => [$('#page-options .page-option')],
    deny: '.ui-checkbox', modal: true,
    title: 'Pick a page',
    body: 'Click a page to add it to the canvas.',
  },
  {
    // The screen that was just added, clipped to what is on screen.
    targets: () => [$('.screen[data-selected]') || $('.screen')],
    clip: true,
    title: 'Select a screen',
    body: 'Click a screen to select it. Only the selected screen reacts to your clicks, scrolling and keys.',
    action: 'Next',
  },
  {
    targets: () => [$('#inspector .ui-select')],
    ready: inspectorReady, fallback: selectScreen, pan: true,
    title: 'Change the size',
    body: 'Open Preset and pick a device. The screen resizes to match.',
    action: 'Next',
  },
  {
    targets: () => [$('#width')?.closest('label'), $('#height')?.closest('label')],
    ready: inspectorReady, fallback: selectScreen, pan: true,
    title: 'Or set your own',
    body: 'Choose Custom in Preset to type an exact width and height.',
    action: 'Next',
  },
  {
    targets: () => [$('.screen[data-selected] .screen-fullscreen')],
    ready: () => visible($('.screen[data-selected] .screen-fullscreen')), fallback: selectScreen, pan: true,
    title: 'Preview full screen',
    body: 'Open the screen at its real size, without the canvas around it.',
  },
  {
    // The preview's menu is closed until pressed; then the way back is what is pointed at.
    targets: () => [$('#fullscreen-back')],
    ready: () => visible($('#fullscreen-back')),
    fallback: {
      targets: () => [$('#fullscreen-toggle')],
      title: 'Back to canvas',
      body: 'Open this menu to return to the canvas.',
      action: 'Finish',
    },
    title: 'Back to canvas',
    body: 'Choose Back to canvas to leave the preview.',
    action: 'Finish',
  },
];
const LAST = steps.length - 1;
const PICK = 1, SELECT = 2, PRESET = 3, FULLSCREEN = 5, BACK = 6;

let dim, card, titleEl, bodyEl, dotsEl, skipEl, actionEl;
let active = false, paused = false, index = 0, shownKey = '', frame = 0, motionTimer = 0, placed = false;
let countBefore = 0, activeTargets = [], activeDeny = '', offSince = 0, lastPan = 0;

function build() {
  dim = document.createElement('div');
  dim.className = 'onboarding-dim';
  dim.setAttribute('aria-hidden', 'true');
  dim.popover = 'manual';
  card = document.createElement('div');
  card.className = 'onboarding-card';
  card.popover = 'manual';
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', 'Canvas tour');
  skipEl = Button({ size: 'sm', tooltip: 'Skip the tour', shortcut: 'esc' }, 'Skip');
  actionEl = Button({ size: 'sm', variant: 'primary', hidden: true });
  titleEl = h('h2'); bodyEl = h('p'); dotsEl = h('div', { class: 'onboarding-dots', role: 'img' });
  card.append(
    h('div', { class: 'onboarding-copy', 'aria-live': 'polite' }, titleEl, bodyEl),
    h('div', { class: 'onboarding-footer' }, dotsEl, h('div', { class: 'onboarding-actions' }, skipEl, actionEl)));
  for (let n = 0; n < steps.length; n++) dotsEl.append(document.createElement('span'));
  skipEl.addEventListener('click', end);
  actionEl.addEventListener('click', () => (index === LAST ? end() : go(index + 1)));
  document.body.append(dim, card);
}

function remember() { try { localStorage.setItem(KEY, 'seen'); } catch { /* storage blocked: the tour may show again */ } }
function seen() { try { return localStorage.getItem(KEY) !== null; } catch { return true; } }

function bounds(elements) {
  const rects = elements.filter(visible).map(element => element.getBoundingClientRect());
  if (!rects.length) return null;
  const left = Math.min(...rects.map(r => r.left)), top = Math.min(...rects.map(r => r.top));
  const right = Math.max(...rects.map(r => r.right)), bottom = Math.max(...rects.map(r => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

// A full-screen rectangle with a rounded hole. Every hole has the same path
// structure, so the browser can interpolate from one step's hole to the next.
function holePath(r) {
  const W = innerWidth, H = innerHeight, x = r.left - PAD, y = r.top - PAD, w = r.width + 2 * PAD, h = r.height + 2 * PAD, k = Math.min(RADIUS, w / 2, h / 2);
  return `path(evenodd, "M0 0H${W}V${H}H0Z M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z")`;
}

function render(step, key) {
  titleEl.textContent = step.title;
  bodyEl.textContent = step.body;
  skipEl.hidden = index === LAST;
  actionEl.hidden = !step.action;
  actionEl.textContent = step.action || '';
  [...dotsEl.children].forEach((dot, n) => { dot.dataset.on = String(n === index); });
  dotsEl.setAttribute('aria-label', `Step ${index + 1} of ${steps.length}`);
  if (placed) {
    dim.dataset.motion = ''; card.dataset.motion = '';
    clearTimeout(motionTimer);
    motionTimer = setTimeout(() => { delete dim.dataset.motion; delete card.dataset.motion; }, 300);
  }
  card.classList.remove('is-swapping'); void card.offsetWidth; card.classList.add('is-swapping');
  shownKey = key;
}

// Top-layer elements stack in the order they were shown, so lift the tour above
// a dialog that opened after it.
function raise() {
  for (const element of [dim, card]) { if (element.matches(':popover-open')) element.hidePopover(); element.showPopover(); }
}
// A modal dialog makes everything outside its own subtree inert, the card
// included. Inside the dialog it stays pressable, and Skip stays reachable.
function dock(modal) {
  const home = modal ? $('#add-pages') : document.body;
  if (home && card.parentElement !== home) { home.append(card); raise(); }
}

// Pan the canvas by the least distance that brings an on-canvas target fully into view.
function reveal(rect) {
  const left = visible($('#layers')) ? $('#layers').getBoundingClientRect().right + 16 : 16;
  const right = innerWidth - 16, top = 150, bottom = innerHeight - 88;
  let dx = 0, dy = 0;
  if (rect.left < left) dx = left - rect.left; else if (rect.right > right) dx = right - rect.right;
  if (rect.bottom > bottom) dy = bottom - rect.bottom; else if (rect.top < top) dy = top - rect.top;
  if (!dx && !dy) { offSince = 0; return; }
  const now = performance.now();
  if (!offSince) offSince = now;
  // Let any camera move that is already running (a refit after a resize) finish first.
  if (now - offSince < 300 || now - lastPan < 700) return;
  lastPan = now;
  document.dispatchEvent(new CustomEvent('tio-canvas:pan-by', { detail: { dx, dy } }));
}

function layout() {
  const step = steps[index];
  const resolved = step.ready && !step.ready() ? step.fallback : step;
  const key = `${index}:${resolved === step ? 'main' : 'fallback'}`;
  dock(!!step.modal && !!$('#add-pages')?.open);
  if (key !== shownKey) render(resolved, key);
  activeTargets = resolved.targets();
  activeDeny = resolved.deny || '';
  const rect = bounds(activeTargets);
  if (rect && resolved.clip) {
    // A screen can be bigger than the window: point at the part that is visible.
    const left = visible($('#layers')) ? Math.max(0, $('#layers').getBoundingClientRect().right) : 0;
    rect.left = Math.max(rect.left, left + PAD); rect.top = Math.max(rect.top, PAD);
    rect.right = Math.min(rect.right, innerWidth - PAD); rect.bottom = Math.min(rect.bottom, innerHeight - PAD);
    rect.width = rect.right - rect.left; rect.height = rect.bottom - rect.top;
  }
  if (!rect) { dim.dataset.on = 'false'; card.dataset.on = 'false'; return; }
  if (resolved.pan) reveal(rect);
  dim.dataset.on = 'true'; card.dataset.on = 'true';
  dim.style.clipPath = holePath(rect);
  const w = card.offsetWidth, h = card.offsetHeight;
  const padded = { top: rect.top - PAD, bottom: rect.bottom + PAD, cx: (rect.left + rect.right) / 2 };
  const above = padded.top - GAP - h >= MARGIN;
  const x = Math.max(MARGIN, Math.min(padded.cx - w / 2, innerWidth - w - MARGIN));
  const y = above ? padded.top - GAP - h : Math.min(padded.bottom + GAP, innerHeight - h - MARGIN);
  card.style.translate = `${x}px ${y}px`;
  placed = true;
}

function loop() {
  frame = 0;
  if (!active || paused) return;
  layout();
  frame = requestAnimationFrame(loop);
}
function run() { if (!frame && active && !paused) frame = requestAnimationFrame(loop); }

function hideUi() {
  cancelAnimationFrame(frame); frame = 0;
  dim.dataset.on = 'false'; card.dataset.on = 'false';
  activeTargets = [];
}
function go(next) { index = next; shownKey = ''; offSince = 0; run(); }
function start() {
  if (!dim) build();
  active = true; paused = false; placed = false; shownKey = ''; index = 0;
  dock(false);
  raise();
  dim.style.transition = 'none'; card.style.transition = 'none';
  layout();
  void dim.offsetWidth;
  dim.style.transition = ''; card.style.transition = '';
  run();
}
function end() {
  if (!active) return;
  active = false; paused = false;
  hideUi();
  setTimeout(() => { if (!active) for (const element of [dim, card]) if (element.matches(':popover-open')) element.hidePopover(); }, 250);
}

function syncDialogs() {
  if (!active) return;
  const adding = $('#add-pages')?.open, shortcuts = $('#shortcuts')?.open;
  if (shortcuts) {
    if (!paused) { paused = true; hideUi(); }
    return;
  }
  if (adding) {
    if (index === 0) { countBefore = Number($('#screens-count')?.textContent) || 0; go(PICK); raise(); }
    else if (index !== 1 && !paused) { paused = true; hideUi(); }
    return;
  }
  paused = false;
  setTimeout(() => {
    if (!active) return;
    if (index === PICK) go((Number($('#screens-count')?.textContent) || 0) > countBefore ? SELECT : 0);
    else run();
  }, 0);
}

// Everything outside what is highlighted is dead while the tour is up.
const POINTER = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'wheel', 'dragstart'];
function blocking() { return active && !paused && dim?.dataset.on === 'true'; }
function allowed(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return true;
  if (card.contains(target) || target.closest('.ui-tooltip, .ui-menu:is([data-variant="options"], [data-variant="icons"]):popover-open')) return true;
  if (activeDeny && target.closest(activeDeny)) return false;
  return activeTargets.some(element => element?.contains(target));
}
function guard(event) {
  if (!blocking() || allowed(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}
function guardKey(event) {
  if (!blocking()) return;
  if (event.key === 'Escape') {
    if (document.body.hasAttribute('data-fullscreen')) return;
    // Dialogs and menus close themselves; otherwise Escape skips the tour.
    if ($('dialog[open], .ui-menu:popover-open:not(#layers-menu)')) return;
    event.preventDefault(); event.stopImmediatePropagation(); end();
    return;
  }
  if (event.key === 'Tab' || allowed(event)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

function init() {
  for (const dialog of [$('#add-pages'), $('#shortcuts')]) {
    if (dialog) new MutationObserver(syncDialogs).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }
  for (const type of POINTER) window.addEventListener(type, guard, { capture: true, passive: false });
  window.addEventListener('keydown', guardKey, true);
  document.addEventListener('change', event => { if (active && index === PRESET && event.target.id === 'preset') go(PRESET + 1); }, true);
  // Entering the preview moves the tour on; leaving it ends the tour.
  new MutationObserver(() => {
    if (!active) return;
    const inPreview = document.body.hasAttribute('data-fullscreen');
    if (inPreview && index === FULLSCREEN) go(BACK);
    else if (!inPreview && index === BACK) end();
  }).observe(document.body, { attributes: true, attributeFilter: ['data-fullscreen'] });
  $('#onboarding-open')?.addEventListener('click', () => { end(); start(); });
  addEventListener('resize', run);
  if (!seen()) {
    // Not on a phone-sized screen, where the canvas is blocked: the tour waits for a visit that can use it.
    setTimeout(() => {
      if (document.documentElement.hasAttribute('data-device-blocked') || !visible($('#add'))) return;
      remember(); start();
    }, 900);
  }
}
init();
