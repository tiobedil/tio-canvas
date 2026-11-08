// One tooltip for the whole canvas, driven by attributes:
//   data-tooltip           the text
//   data-shortcut          "mod+shift+z": drawn after the text, platform-aware
//   data-tooltip-disabled  the text shown instead while the control is disabled
// A control with a native title has it moved here (the native one would double up),
// and an icon-only control falls back to its aria-label.
const DELAY = 500;    // first tooltip: what design tools use, long enough not to flicker
const LEAVE = 100;    // grace before it closes, so a neighbour can take it over instantly
const GAP = 8, MARGIN = 8;
import { platform } from './platform.js';
const symbols = {
  mac: { mod: '⌘', shift: '⇧', alt: '⌥', ctrl: '⌃', esc: 'Esc', del: '⌫' },
  win: { mod: 'Ctrl', shift: 'Shift', alt: 'Alt', ctrl: 'Ctrl', esc: 'Esc', del: 'Del' },
};

export function formatShortcut(value) {
  const kind = platform(), table = symbols[kind];
  const keys = value.toLowerCase().split('+').map(key => table[key] ?? (key.length === 1 ? key.toUpperCase() : key));
  return keys.join(kind === 'mac' ? '' : '+');
}

const tip = document.createElement('div');
tip.id = 'canvas-tooltip';
tip.className = 'canvas-tooltip';
tip.setAttribute('role', 'tooltip');
tip.popover = 'manual';
document.body.append(tip);

let target = null, suppressed = null, showTimer = 0, hideTimer = 0, described = null;
const isOpen = () => tip.matches(':popover-open');

function resolve(node) {
  if (!(node instanceof Element)) return null;
  let el = node.closest('[data-tooltip],[data-tooltip-disabled],button,[role="button"],[role="checkbox"],label');
  if (el?.matches('label') && !el.dataset.tooltip) el = el.querySelector('input[data-tooltip-disabled]:disabled');
  return el;
}

function read(el) {
  const title = el.getAttribute('title');
  if (title) {
    // Keep the accessible name, then hand the text to the custom tooltip.
    if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', title);
    el.removeAttribute('title');
    el.dataset.tooltip = title;
  }
  let text = '', shortcut = '';
  if (el.disabled && el.dataset.tooltipDisabled) text = el.dataset.tooltipDisabled;
  else {
    text = el.dataset.tooltip || (!el.textContent.trim() ? el.getAttribute('aria-label') || '' : '');
    shortcut = el.dataset.shortcut || '';
  }
  return text ? { text, shortcut } : null;
}

function describe(el, text) {
  if (described) described.removeAttribute('aria-describedby');
  described = null;
  if (el && el.getAttribute('aria-label') !== text) { el.setAttribute('aria-describedby', tip.id); described = el; }
}

function place(el, info) {
  if (!el.isConnected || !el.checkVisibility()) return;
  const text = document.createElement('span');
  text.textContent = info.text;
  tip.replaceChildren(text);
  if (info.shortcut) {
    const keys = document.createElement('span');
    keys.className = 'tooltip-shortcut';
    keys.textContent = formatShortcut(info.shortcut);
    tip.append(keys);
  }
  if (!isOpen()) tip.showPopover();
  describe(el, info.text);
  const anchor = el.getBoundingClientRect(), width = tip.offsetWidth, height = tip.offsetHeight;
  const above = anchor.top - GAP - height >= MARGIN;
  const left = Math.max(MARGIN, Math.min(anchor.left + anchor.width / 2 - width / 2, innerWidth - width - MARGIN));
  tip.style.left = `${left}px`;
  tip.style.top = `${above ? anchor.top - GAP - height : anchor.bottom + GAP}px`;
  tip.style.transformOrigin = `${anchor.left + anchor.width / 2 - left}px ${above ? '100%' : '0'}`;
  tip.dataset.side = above ? 'top' : 'bottom';
}

function hide() {
  clearTimeout(showTimer); clearTimeout(hideTimer);
  target = null;
  describe(null);
  if (isOpen()) tip.hidePopover();
}
function scheduleHide() {
  clearTimeout(showTimer);
  if (target === null && !isOpen()) return;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, LEAVE);
}

document.addEventListener('pointerover', event => {
  if (event.pointerType === 'touch') return;
  const el = resolve(event.target);
  if (el !== suppressed) suppressed = null;
  if (event.buttons) { hide(); return; }
  if (!el) { scheduleHide(); return; }
  if (el === target) { clearTimeout(hideTimer); return; }
  if (el === suppressed) return;
  const info = read(el);
  if (!info) { scheduleHide(); return; }
  clearTimeout(showTimer); clearTimeout(hideTimer);
  target = el;
  // Already showing: switch text and place at once, with no appear animation.
  if (isOpen()) place(el, info);
  else showTimer = setTimeout(() => place(el, info), DELAY);
}, true);

document.addEventListener('pointerdown', () => { suppressed = target; hide(); }, true);
document.addEventListener('keydown', event => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) hide(); }, true);
document.addEventListener('wheel', hide, { capture: true, passive: true });
document.addEventListener('scroll', hide, true);
document.documentElement.addEventListener('pointerleave', hide);
addEventListener('blur', hide);
addEventListener('resize', hide);
document.addEventListener('focusin', event => {
  if (!event.target.matches?.(':focus-visible')) return;
  const el = resolve(event.target), info = el && read(el);
  if (!info) return;
  clearTimeout(showTimer); clearTimeout(hideTimer);
  target = el; place(el, info);
});
document.addEventListener('focusout', () => hide());
