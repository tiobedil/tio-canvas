import { h, cx } from './dom.js';

/** A text or number input. Number inputs lose their spinners; the wheel nudges them (see canvas.js). */
export function Input({ type = 'text', className, ...attrs } = {}) {
  return h('input', { ...attrs, type, class: cx('ui-input', className) });
}

/** A muted label beside a control: Field({ label: 'W' }, Input({ id: 'width', type: 'number' })). */
export function Field({ label, className, ...attrs } = {}, ...control) {
  return h('label', { ...attrs, class: cx('ui-field', className) }, label ?? null, ...control);
}
