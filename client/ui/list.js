import { h, cx } from './dom.js';
import { Chevron } from './icons.js';

/** A tick box with a 44px target. Its own aria-checked draws it; the caller keeps it true. */
export function Checkbox({ label, checked = false, className, ...attrs } = {}) {
  return h('button', { ...attrs, type: 'button', role: 'checkbox', class: cx('ui-checkbox', className), 'aria-label': label, 'aria-checked': String(checked) },
    h('span', { class: 'ui-checkbox-mark', 'aria-hidden': 'true' }));
}

/**
 * A group that folds, with a count beside its name.
 *   const group = Disclosure({ id: 'pages', label: 'Production', count: 3, open: true, onToggle }, ...rows)
 */
export function Disclosure({ id, label, count, open = true, onToggle, className }, ...items) {
  const toggle = h('button', { type: 'button', class: 'ui-disclosure-toggle', 'aria-controls': id },
    h('span', { class: 'ui-disclosure-label' }, label), h('span', { class: 'ui-disclosure-count' }, String(count)), Chevron());
  const panel = h('div', { id, class: 'ui-disclosure-panel' }, h('div', { class: 'ui-disclosure-list' }, ...items));
  const root = h('section', { class: cx('ui-disclosure', className) }, toggle, panel);
  root.setOpen = value => { root.dataset.open = String(value); toggle.setAttribute('aria-expanded', String(value)); panel.inert = !value; };
  root.items = panel.firstElementChild;
  toggle.addEventListener('click', () => { const value = root.dataset.open !== 'true'; root.setOpen(value); onToggle?.(value); });
  root.setOpen(open);
  return root;
}
