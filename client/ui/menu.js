import { h, cx, step } from './dom.js';
import { Icon } from './icons.js';
import { Button } from './button.js';
import { Panel } from './panel.js';

/**
 * A popover panel of items. It is light-dismissed by the browser (popover="auto").
 *   Menu({ id: 'more', label: 'More' }, MenuItem({ icon: 'book', label: 'Guide' }), …)
 * variant  list (default) | options (a scrolling choice list) | icons (a row of icon choices)
 */
export function Menu({ variant = 'list', popover = 'auto', label, className, dataset, ...attrs } = {}, ...items) {
  return Panel({ ...attrs, className: cx('ui-menu', className), popover, role: 'menu', 'aria-label': label, tabIndex: -1, dataset: { variant, ...dataset } }, ...items);
}

/**
 * One row of a menu: a ghost button. With an icon and no text it is a square icon choice,
 * and `label` is its accessible name.
 *   role  menuitem (default) | menuitemradio (with `checked`)
 *   danger  tints it for a destructive action
 */
export function MenuItem({ role = 'menuitem', icon, label, danger, className, ...props } = {}, ...children) {
  return Button({ ...props, variant: 'ghost', tone: danger ? 'danger' : undefined, className: cx('ui-menu-item', className), role, icon, label }, ...children);
}

/** A small heading inside a menu, with an optional icon. */
export function MenuLabel({ icon, text }) {
  return h('div', { class: 'ui-menu-label' }, icon ? Icon(icon) : null, h('span', {}, text));
}

/** The tinted strip along the bottom of a menu. */
export function MenuFooter(...children) { return h('div', { class: 'ui-menu-footer' }, ...children); }

/**
 * Arrow-key movement through a menu's items, wrapping. Keys never reach the canvas.
 *   horizontal: true  for a row of icons (left and right instead of up and down)
 *   onEscape, onTab   called for those keys; the caller decides where focus goes
 */
export function menuKeys(menu, { horizontal = false, onEscape, onTab } = {}) {
  const forward = horizontal ? 'ArrowRight' : 'ArrowDown', back = horizontal ? 'ArrowLeft' : 'ArrowUp';
  menu.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && onEscape) { event.preventDefault(); onEscape(event); return; }
    if (event.key === 'Tab' && onTab) { onTab(event); return; }
    if (![forward, back, 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...menu.querySelectorAll('[role^="menuitem"]')].filter(item => !item.hidden && !item.disabled);
    step(items, document.activeElement, event.key, { forward, back })?.focus();
  });
}

export const isOpen = menu => menu.matches(':popover-open');
export const closeMenu = menu => { if (isOpen(menu)) menu.hidePopover(); };
