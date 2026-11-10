import { h, cx, step } from './dom.js';
import { Icon } from './icons.js';
import { Button } from './button.js';
import { Input } from './field.js';

/**
 * An on/off switch.
 *   const control = Switch({ label: 'Disabled', checked: false })
 *   control.addEventListener('change', event => … event.detail is the new boolean)
 * It flips itself on a press; control.setValue(boolean) sets it from outside.
 */
export function Switch({ label, checked = false, className, ...attrs } = {}) {
  const control = h('button', { ...attrs, type: 'button', role: 'switch', class: cx('ui-switch', className), 'aria-label': label, 'aria-checked': String(checked === true) },
    h('span', { class: 'ui-switch-thumb', 'aria-hidden': 'true' }));
  control.setValue = value => control.setAttribute('aria-checked', String(value === true));
  control.addEventListener('click', () => {
    const value = control.getAttribute('aria-checked') !== 'true';
    control.setValue(value);
    control.dispatchEvent(new CustomEvent('change', { detail: value }));
  });
  return control;
}

/**
 * A number between two ends, with its value beside it.
 *   const control = Slider({ label: 'Radius', min: 0, max: 24, step: 1, value: 8 })
 *   control.addEventListener('input', …)    while it moves; event.detail is the number
 *   control.addEventListener('change', …)   when it is let go
 */
export function Slider({ label, min = 0, max = 100, step: by = 1, value = min, className } = {}) {
  const range = h('input', { type: 'range', class: 'ui-slider-range', min, max, step: by, 'aria-label': label });
  const output = h('output', { class: 'ui-slider-value', 'aria-hidden': 'true' });
  const control = h('span', { class: cx('ui-slider', className) }, range, output);
  const paint = () => {
    const span = Number(range.max) - Number(range.min);
    control.style.setProperty('--fill', `${span > 0 ? (range.valueAsNumber - Number(range.min)) / span * 100 : 0}%`);
    output.textContent = String(range.valueAsNumber);
  };
  control.setValue = next => { range.value = String(next); paint(); };
  // The native events stop here; the control speaks for itself, with the number as detail.
  for (const type of ['input', 'change']) range.addEventListener(type, event => {
    event.stopPropagation(); paint();
    control.dispatchEvent(new CustomEvent(type, { detail: range.valueAsNumber }));
  });
  control.setValue(value);
  return control;
}

/**
 * One choice of several, every option in view at once and wrapping to more lines.
 * Unlike SegmentedControl it takes any number of options and keeps their real
 * values (a number stays a number).
 *   const control = OptionChips({ label: 'Variant', options: [{ value: 'primary', label: 'primary' }], value: 'primary' })
 *   control.addEventListener('change', event => … event.detail is the option's value)
 */
export function OptionChips({ label, options, value, className } = {}) {
  const chips = options.map(option => h('button', { type: 'button', role: 'radio', class: 'ui-chip', 'aria-checked': 'false' }, option.label));
  const control = h('div', { class: cx('ui-chips', className), role: 'radiogroup', 'aria-label': label }, ...chips);
  let current;
  control.setValue = next => {
    current = options.findIndex(option => option.value === next);
    chips.forEach((chip, index) => { chip.setAttribute('aria-checked', String(index === current)); chip.tabIndex = index === Math.max(0, current) ? 0 : -1; });
  };
  const choose = index => {
    if (index === current) return;
    control.setValue(options[index].value);
    control.dispatchEvent(new CustomEvent('change', { detail: options[index].value }));
  };
  control.addEventListener('click', event => { const index = chips.indexOf(event.target.closest('.ui-chip')); if (index >= 0) choose(index); });
  control.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const key = event.key === 'ArrowUp' ? 'ArrowLeft' : event.key === 'ArrowDown' ? 'ArrowRight' : event.key;
    const next = step(chips, chips[Math.max(0, current)], key, { forward: 'ArrowRight', back: 'ArrowLeft' });
    choose(chips.indexOf(next)); next.focus();
  });
  control.setValue(value);
  return control;
}

let dialCount = 0;

/**
 * The dials of one component: a titled panel with one row per control, which
 * folds away into a round floating button.
 *   const panel = DialPanel({ title: 'Button', controls, values, minimized: false })
 *   controls   from normalizeControls() in registry.js: [{ name, label, type, value, options, min, max, step }]
 *   values     { name: value } to show; a missing name shows the control's default
 * Events (bubbling, with detail):
 *   dial-input     { name, value }   a value is changing (every keystroke, every slider move)
 *   dial-change    { name, value }   a value was settled
 *   dial-reset                       Reset was pressed; the caller sets the values
 *   dial-minimize  { minimized }     the panel folded or unfolded
 * panel.setValues(values), panel.setMinimized(boolean); panel.button is the floating button.
 */
export function DialPanel({ title, controls = [], values = {}, minimized = false, className } = {}) {
  const key = `ui-dial-${++dialCount}`;
  const setters = new Map();
  const emit = (target, type, detail) => target.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
  const rows = controls.map((control, index) => {
    const id = `${key}-${index}`;
    const name = h('span', { class: 'ui-dial-name', id: `${id}-name`, title: control.label }, control.label);
    let field, layout = 'inline';
    if (control.type === 'boolean') {
      field = Switch({ label: control.label });
      field.addEventListener('change', event => { emit(row, 'dial-input', { name: control.name, value: event.detail }); emit(row, 'dial-change', { name: control.name, value: event.detail }); });
      setters.set(control.name, value => field.setValue(value));
    } else if (control.type === 'select') {
      layout = 'stacked';
      field = OptionChips({ label: control.label, options: control.options });
      field.addEventListener('change', event => { emit(row, 'dial-input', { name: control.name, value: event.detail }); emit(row, 'dial-change', { name: control.name, value: event.detail }); });
      setters.set(control.name, value => field.setValue(value));
    } else if (control.type === 'number' && control.min !== undefined && control.max !== undefined) {
      field = Slider({ label: control.label, min: control.min, max: control.max, step: control.step ?? 1 });
      for (const type of ['input', 'change']) field.addEventListener(type, event => emit(row, `dial-${type}`, { name: control.name, value: event.detail }));
      setters.set(control.name, value => field.setValue(value));
    } else {
      const number = control.type === 'number';
      field = Input({ type: number ? 'number' : 'text', className: 'ui-dial-input', 'aria-labelledby': `${id}-name`, min: control.min, max: control.max, step: control.step, autocomplete: 'off', spellcheck: 'false' });
      const read = () => (number ? (Number.isFinite(field.valueAsNumber) ? field.valueAsNumber : control.value) : field.value);
      for (const type of ['input', 'change']) field.addEventListener(type, event => { event.stopPropagation(); emit(row, `dial-${type}`, { name: control.name, value: read() }); });
      field.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); field.blur(); } });
      setters.set(control.name, value => { if (document.activeElement !== field || read() !== value) field.value = String(value); });
    }
    const row = h('div', { class: 'ui-dial-row', dataset: { layout, type: control.type } }, name, field);
    return row;
  });
  const reset = Button({ variant: 'ghost', tone: 'muted', size: 'sm', icon: 'undo', iconOnly: true, label: `Reset ${title}`, tooltip: 'Reset' });
  const minimize = Button({ variant: 'ghost', tone: 'muted', size: 'sm', icon: 'minus', iconOnly: true, label: `Minimize the controls of ${title}`, tooltip: 'Minimize' });
  const body = h('div', { class: 'ui-dial-body' }, ...(rows.length ? rows : [h('p', { class: 'ui-dial-empty' }, 'This component has no controls.')]));
  const card = h('div', { class: 'ui-dial-card', role: 'group', 'aria-label': `Controls of ${title}` },
    h('header', { class: 'ui-dial-header' }, h('span', { class: 'ui-dial-title' }, title), rows.length ? reset : null, minimize), body);
  const button = h('button', { type: 'button', class: 'ui-dial-button', 'aria-label': `Show the controls of ${title}`, 'aria-expanded': 'true', hidden: true }, Icon('sliders'));
  const panel = h('div', { class: cx('ui-dial-panel', className) }, card, button);

  panel.setValues = next => { for (const control of controls) setters.get(control.name)?.(next?.[control.name] ?? control.value); };
  panel.setMinimized = value => {
    card.hidden = value; button.hidden = !value;
    panel.toggleAttribute('data-minimized', value);
    button.setAttribute('aria-expanded', String(!value));
  };
  Object.assign(panel, { button, card });
  reset.addEventListener('click', () => emit(panel, 'dial-reset'));
  minimize.addEventListener('click', () => { panel.setMinimized(true); emit(panel, 'dial-minimize', { minimized: true }); button.focus({ preventScroll: true }); });
  // A drag of the floating button ends in a click too; the owner cancels that click (see dial-float.js).
  button.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    panel.setMinimized(false); emit(panel, 'dial-minimize', { minimized: false }); minimize.focus({ preventScroll: true });
  });
  panel.setValues(values);
  panel.setMinimized(minimized);
  return panel;
}
