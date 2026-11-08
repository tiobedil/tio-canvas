import { platform, setPlatform } from './platform.js';

// One table, written once. A key is a name resolved for the chosen keyboard
// (mod, alt, shift, backspace), a plain label, or a mouse gesture {g}. A row is
// a list of alternatives; an alternative is a list of keys pressed together.
const drag = { g: 'drag' }, click = { g: 'click' }, arrows = { arrows: true };
const sections = [
  ['Editing', [
    ['Duplicate selection', [['mod', 'D']]],
    ['Duplicate before or during drag', [['alt', drag]]],
    ['Delete selection', [['backspace'], ['Delete']]],
    ['Undo', [['mod', 'Z']]],
    ['Redo', { mac: [['mod', 'shift', 'Z']], win: [['mod', 'shift', 'Z'], ['mod', 'Y']] }],
    ['Rename screen', [[{ g: 'Double-click title or layer name' }]]],
  ]],
  ['Navigation and selection', [
    ['Nudge selected screens by 10 px', [[arrows]]],
    ['Nudge selected screens by 20 px', [['shift', arrows]]],
    ['Select all', [['mod', 'A']]],
    ['Fit all screens', [['shift', '1']]],
    ['Fit selected screens', [['shift', '2']]],
    ['Toggle screen selection', [['shift', click]]],
    ['Constrain drag to one axis', [['shift', drag]]],
    ['Pan canvas', [['Space', drag]]],
    ['Pan with mouse', [[{ g: 'Middle-button drag' }]]],
    ['Zoom at pointer', [['mod', { g: 'wheel' }]]],
    ['Close menu, dialog or preview', [['Esc']]],
    ['Release pan', [['Esc']]],
  ]],
  ['Tools', [
    ['Cursor tool', [['V']]],
    ['Arrow tool', [['A']]],
    ['Text tool', [['T']]],
    ['Edit selected text', [['Enter']]],
    ['Bold or italic: selected words, or the whole text', [['mod', 'B'], ['mod', 'I']]],
    ['Back to cursor tool and clear arrow selection', [['Esc']]],
    ['Select arrow', [['Enter'], ['Space']]],
    ['Add arrow to selection', [['shift', click]]],
  ]],
  ['Arrange · select two or more screens', [
    ['Align left', [['alt', 'A']]],
    ['Align horizontal centers', [['alt', 'H']]],
    ['Align right', [['alt', 'D']]],
    ['Align top', [['alt', 'W']]],
    ['Align vertical centers', [['alt', 'V']]],
    ['Align bottom', [['alt', 'S']]],
    ['Distribute horizontal spacing', [['ctrl', 'alt', 'H']]],
    ['Distribute vertical spacing', [['ctrl', 'alt', 'V']]],
  ]],
  ['Reorder · select a row, column or grid', [
    ['Reorder screens', [[{ g: 'Drag a center dot' }]]],
    ['Cancel reorder drag', [['Esc']]],
  ]],
  ['Layers', [
    ['Bring forward', [['mod', ']']]],
    ['Send backward', [['mod', '[']]],
    ['Bring to front', [['mod', 'shift', ']']]],
    ['Send to back', [['mod', 'shift', '[']]],
    ['Select a range', [['shift', click]]],
    ['Toggle individual layers', [['mod', { g: 'click' }]]],
  ]],
  ['Fields and menus', [
    ['Save screen name / apply zoom', [['Enter']]],
    ['Cancel rename / reset zoom', [['Esc']]],
    ['Move through context menu', [['↑'], ['↓']]],
    ['First / last menu item', [['Home'], ['End']]],
    ['Activate menu item', [['Enter'], ['Space']]],
  ]],
];

const names = {
  mac: { mod: ['⌘', 'Command'], alt: ['⌥', 'Option'], shift: ['⇧', 'Shift'], ctrl: ['Ctrl', 'Control'], backspace: ['⌫', 'Backspace'] },
  win: { mod: ['Ctrl', 'Control'], alt: ['Alt', 'Alt'], shift: ['Shift', 'Shift'], ctrl: ['Ctrl', 'Control'], backspace: ['Backspace', 'Backspace'] },
};
const mouse = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="2" width="10" height="16" rx="5"/><path d="M10 2v6"/></svg>';
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

// The four arrow keys laid out as on a keyboard: one above, three below.
const arrowKeys = [['↑', 'Up arrow', 'up'], ['←', 'Left arrow', 'left'], ['↓', 'Down arrow', 'down'], ['→', 'Right arrow', 'right']];
function key(token, kind) {
  if (typeof token === 'object' && token.arrows) {
    const cluster = el('span', 'shortcut-arrows');
    cluster.setAttribute('role', 'group');
    cluster.setAttribute('aria-label', 'Arrow keys');
    for (const [glyph, name, place] of arrowKeys) {
      const cap = el('kbd', '', glyph);
      cap.dataset.arrow = place;
      cap.setAttribute('aria-label', name);
      cluster.append(cap);
    }
    return cluster;
  }
  if (typeof token === 'object') {
    const gesture = el('span', 'shortcut-gesture');
    gesture.innerHTML = mouse;
    gesture.append(token.g);
    return gesture;
  }
  const named = names[kind][token];
  const cap = el('kbd', '', named ? named[0] : token);
  if (named && named[0] !== named[1]) cap.setAttribute('aria-label', named[1]);
  return cap;
}

function render(body, kind) {
  body.replaceChildren();
  sections.forEach(([title, rows], index) => {
    const section = el('section', 'shortcut-section');
    const heading = el('h3', '', title);
    heading.id = `shortcut-group-${index}`;
    section.setAttribute('aria-labelledby', heading.id);
    const list = el('dl');
    for (const [label, spec] of rows) {
      const options = Array.isArray(spec) ? spec : spec[kind];
      const row = el('div', 'shortcut-row');
      const keys = el('dd');
      options.forEach((chord, n) => {
        if (n) keys.append(el('span', 'shortcut-or', 'or'));
        const pad = chord.some(token => token.arrows);
        const group = el('span', pad ? 'shortcut-chord shortcut-keypad' : 'shortcut-chord');
        chord.forEach((token, i) => {
          if (pad && i) group.append(el('span', 'shortcut-plus', '+'));
          group.append(key(token, kind));
        });
        if (pad) row.classList.add('shortcut-row-stack');
        keys.append(group);
      });
      row.append(el('dt', '', label), keys);
      list.append(row);
    }
    section.append(heading, list);
    body.append(section);
  });
}

const dialog = document.querySelector('#shortcuts');
const body = dialog.querySelector('.shortcuts-body');
const toggle = dialog.querySelector('#shortcuts-platform');
function sync() {
  const kind = platform();
  const scroll = body.scrollTop;
  render(body, kind);
  body.scrollTop = scroll;
  for (const option of toggle.querySelectorAll('[data-platform]')) option.setAttribute('aria-checked', String(option.dataset.platform === kind));
}
toggle.addEventListener('click', event => {
  const option = event.target.closest('[data-platform]');
  if (option) setPlatform(option.dataset.platform);
});
toggle.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault(); event.stopPropagation();
  const next = platform() === 'mac' ? 'win' : 'mac';
  setPlatform(next);
  toggle.querySelector(`[data-platform="${next}"]`).focus();
});
window.addEventListener('tio-canvas:platform', sync);
sync();
