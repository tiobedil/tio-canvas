import { h, cx } from './dom.js';
import { Icon } from './icons.js';

/**
 * A button, in every shape the canvas uses.
 *   Button({ icon: 'plus', label: 'Add pages', tooltip: true })          icon only, square
 *   Button({ variant: 'primary' }, 'Add 3 pages')                        text
 *   Button({ icon: 'theme' }, 'Dark mode')                               icon and text
 * variant  secondary (default) | primary | accent | ghost | bare
 * size     md (default) | sm            tone  muted | danger (ghost only)
 * label    the accessible name (and the tooltip when `tooltip` is true)
 * pressed / checked   a toggle's state, written as aria-pressed / aria-checked
 * as: 'a' makes a link that looks like a button (pass href, download).
 * Anything else (id, hidden, disabled, aria-*, data-*) is passed through.
 */
export function Button({ variant = 'secondary', size, tone, icon, iconOnly, label, tooltip, shortcut, pressed, checked, type = 'button', as = 'button', className, dataset, ...attrs } = {}, ...children) {
  const square = iconOnly ?? (Boolean(icon) && children.length === 0);
  const text = typeof tooltip === 'string' ? tooltip : tooltip ? label : undefined;
  return h(as, {
    ...attrs,
    type: as === 'button' ? type : undefined,
    class: cx('ui-button', className),
    dataset: { variant, size, tone, iconOnly: square || undefined, tooltip: text, shortcut, ...dataset },
    'aria-label': label,
    'aria-pressed': pressed === undefined ? undefined : String(pressed),
    'aria-checked': checked === undefined ? undefined : String(checked),
  }, icon ? Icon(icon) : null, ...children);
}

/** Set a toggle button's state. */
export function setPressed(button, value) { button.setAttribute('aria-pressed', String(value)); }
