import { h, step } from './dom.js';

/**
 * One choice of a few, shown side by side.
 *   const control = SegmentedControl({ label: 'Keyboard layout', options: [{ value: 'mac', label: 'macOS' }, …], value })
 *   control.addEventListener('change', event => … event.detail is the value pressed)
 * It fires `change` on a press or an arrow key; the caller decides and calls control.setValue.
 */
export function SegmentedControl({ id, label, options, value }) {
  const buttons = options.map(option => h('button', { type: 'button', role: 'radio', class: 'ui-segment', 'aria-checked': 'false', dataset: { value: option.value } }, option.label));
  const control = h('div', { id, class: 'ui-segmented', role: 'radiogroup', 'aria-label': label }, ...buttons);
  control.setValue = next => { for (const button of buttons) button.setAttribute('aria-checked', String(button.dataset.value === next)); };
  control.addEventListener('click', event => {
    const button = event.target.closest('[data-value]');
    if (button) control.dispatchEvent(new CustomEvent('change', { detail: button.dataset.value }));
  });
  control.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const current = buttons.find(button => button.getAttribute('aria-checked') === 'true') ?? buttons[0];
    const next = step(buttons, current, event.key, { forward: 'ArrowRight', back: 'ArrowLeft' });
    control.dispatchEvent(new CustomEvent('change', { detail: next.dataset.value }));
    next.focus();
  });
  control.setValue(value);
  return control;
}
