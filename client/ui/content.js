import { h, cx } from './dom.js';
import { Button } from './button.js';

/** A key cap. Kbd({}, '⌘'); a gesture (an icon and a word) is Kbd({ gesture: true }, Icon('mouse'), 'Drag'). */
export function Kbd({ gesture, className, dataset, ...attrs } = {}, ...children) {
  return h('kbd', { ...attrs, class: cx('ui-kbd', className), dataset: { gesture: gesture || undefined, ...dataset } }, ...children);
}

/** A short coloured label. `hue` is an OKLCH hue angle. */
export function Tag({ hue, className, ...attrs } = {}, ...children) {
  return h('span', { ...attrs, class: cx('ui-tag', className), style: hue === undefined ? undefined : { '--tag-hue': hue } }, ...children);
}

/** A quiet fact about a row: "2 on canvas". */
export function Pill({ className, ...attrs } = {}, ...children) { return h('span', { ...attrs, class: cx('ui-pill', className) }, ...children); }

/** A dot that says something changed. */
export function Badge({ className, ...attrs } = {}) { return h('span', { ...attrs, class: cx('ui-badge', className) }); }

/** A block of a dialog under its own heading; a hairline separates neighbours. tone: 'muted' quiets the heading. */
export function Section({ title, titleId, tone, className, dataset, ...attrs } = {}, ...children) {
  return h('section', { ...attrs, class: cx('ui-section', className), dataset: { tone, ...dataset } }, title ? h('h3', { id: titleId }, title) : null, ...children);
}

/** A sentence worth noticing. */
export function Callout({ className, ...attrs } = {}, ...children) { return h('p', { ...attrs, class: cx('ui-callout', className) }, ...children); }

/** Text to copy: a block of it, and a one-line command with a Copy button. */
export function CodeBlock(code) { return h('pre', { class: 'ui-code' }, h('code', {}, code)); }

export function CopyButton(label, text) {
  const button = Button({ size: 'xs' }, label);
  button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); button.textContent = 'Copied'; } catch { button.textContent = 'Copy failed'; }
    setTimeout(() => { button.textContent = label; }, 1600);
  });
  return button;
}

export function CommandRow(command) { return h('div', { class: 'ui-command' }, h('code', {}, command), CopyButton('Copy', command)); }
