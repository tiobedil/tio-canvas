import { h, cx } from './dom.js';

/**
 * Panel: the floating surface under toolbars, menus and the layers drawer.
 *   enter: true      scales in whenever its [hidden] goes (data-centered if it is centred with a transform)
 */
export function Panel({ as = 'div', className, enter, centered, dataset, ...attrs } = {}, ...children) {
  return h(as, { ...attrs, class: cx('ui-panel', enter && 'ui-enter', className), dataset: { centered: centered || undefined, ...dataset } }, ...children);
}

/** A row of controls on a Panel. `label` names it for assistive technology. */
export function Toolbar({ label, className, ...props } = {}, ...children) {
  return Panel({ ...props, 'aria-label': label, className: cx('ui-toolbar', className) }, ...children);
}

/** A hairline between groups of controls (vertical) or items (horizontal, in a menu). */
export function Divider({ orientation = 'vertical', ...attrs } = {}) {
  return orientation === 'horizontal'
    ? h('hr', { ...attrs, class: 'ui-divider', role: 'separator', dataset: { orientation } })
    : h('span', { ...attrs, class: 'ui-divider', 'aria-hidden': 'true' });
}

/** The title bar of a dialog or drawer: a heading, then whatever goes at the end. */
export function Header({ title, titleId, className, ...attrs } = {}, ...end) {
  return h('header', { ...attrs, class: cx('ui-header', className) }, h('h2', { id: titleId }, title), ...end);
}
