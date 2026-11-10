import { h, cx } from './dom.js';
import { Button } from './button.js';
import { Header } from './panel.js';

/**
 * A modal dialog: a title bar with a Close button, then a body and optional footer.
 *   const dialog = Dialog({ id: 'changelog', title: 'Change log', size: 'fit', returnFocus: () => moreButton },
 *     DialogBody({ padded: true }, …))
 *   openDialog(dialog)
 * size  fixed (default, the picker's size) | fit (as tall as its content)
 * headerEnd   nodes shown before the Close button (a segmented control, say)
 * returnFocus   the element that gets focus back when it closes
 * Its Close button is `${id}-close`, its heading `${id}-title`. Pressing the
 * backdrop closes it, like Escape does.
 */
export function Dialog({ id, title, size, headerEnd = [], returnFocus, className, dataset, ...attrs } = {}, ...parts) {
  const close = Button({ id: `${id}-close`, icon: 'close', label: `Close ${title}`, tooltip: 'Close', shortcut: 'esc' });
  const dialog = h('dialog', { ...attrs, id, class: cx('ui-dialog', className), 'aria-labelledby': `${id}-title`, dataset: { size, ...dataset } },
    Header({ title, titleId: `${id}-title` }, ...headerEnd, close), ...parts);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  if (returnFocus) dialog.addEventListener('close', () => returnFocus()?.focus({ preventScroll: true }));
  return dialog;
}

/** The scrolling middle of a dialog. `padded` gives text room; leave it off when rows bring their own. */
export function DialogBody({ padded, as = 'div', className, dataset, ...attrs } = {}, ...children) {
  return h(as, { ...attrs, class: cx('ui-dialog-body', className), dataset: { padded: padded || undefined, ...dataset } }, ...children);
}

/** The bar of actions under a body. Mark one child data-align="end" to push it to the far side. */
export function DialogFooter({ className, ...attrs } = {}, ...children) {
  return h('footer', { ...attrs, class: cx('ui-dialog-footer', className) }, ...children);
}

/** Open a dialog scrolled to the top. Resetting on open, not on close, keeps a closing dialog where it was while it fades. */
export function openDialog(dialog) {
  dialog.showModal();
  for (const node of [dialog, ...dialog.querySelectorAll('*')]) if (node.scrollTop) node.scrollTop = 0;
}
