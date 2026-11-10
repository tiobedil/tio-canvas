import { platform, setPlatform } from './platform.js';
import { h, Kbd, Icon, Section } from './ui/index.js';

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
const el = (tag, className, text) => h(tag, { class: className || undefined }, text ?? null);

// The four arrow keys laid out as on a keyboard: one above, three below.
const arrowKeys = [['↑', 'Up arrow', 'up'], ['←', 'Left arrow', 'left'], ['↓', 'Down arrow', 'down'], ['→', 'Right arrow', 'right']];
function key(token, kind) {
  if (typeof token === 'object' && token.arrows) {
    const cluster = el('span', 'shortcut-arrows');
    cluster.setAttribute('role', 'group');
    cluster.setAttribute('aria-label', 'Arrow keys');
    for (const [glyph, name, place] of arrowKeys) cluster.append(Kbd({ 'aria-label': name, dataset: { arrow: place } }, glyph));
    return cluster;
  }
  if (typeof token === 'object') {
    return Kbd({ gesture: true }, Icon('mouse'), token.g);
  }
  const named = names[kind][token];
  return Kbd({ 'aria-label': named && named[0] !== named[1] ? named[1] : undefined }, named ? named[0] : token);
}

function render(body, kind) {
  body.replaceChildren();
  sections.forEach(([title, rows], index) => {
    const titleId = `shortcut-group-${index}`;
    const section = Section({ title, titleId, tone: 'muted', 'aria-labelledby': titleId });
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
    section.append(list);
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
  toggle.setValue(kind);
}
toggle.addEventListener('change', event => setPlatform(event.detail));
window.addEventListener('tio-canvas:platform', sync);
sync();
