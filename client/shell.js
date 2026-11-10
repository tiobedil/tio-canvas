// The canvas's own interface, assembled from the component library. Nothing here
// styles anything: it names parts and puts them in order. Ids are the hooks the
// rest of the canvas finds them by.
import { h, Button, Toolbar, Divider, Field, Input, Panel, Header, Badge, Icon, SelectField, IconSelect, Menu, MenuItem, MenuFooter,
  Dialog, DialogBody, SegmentedControl } from './ui/index.js';

const moreButton = () => document.querySelector('#layers-more');

function arrowInspector() {
  const endings = start => [
    { value: 'line', icon: 'end-line', label: 'Line' },
    { value: 'arrow', icon: start ? 'end-start' : 'end-finish', label: start ? 'Left arrow' : 'Right arrow' },
  ];
  return Toolbar({ as: 'form', id: 'arrow-inspector', label: 'Arrow settings', hidden: true, enter: true },
    IconSelect({ id: 'arrow-start', label: 'Start style', dataset: { arrowField: 'startStyle' }, options: endings(true) }),
    IconSelect({ id: 'arrow-end', label: 'End style', dataset: { arrowField: 'endStyle' }, options: endings(false) }),
    Divider(),
    SelectField({ id: 'arrow-pattern', label: 'Arrow line pattern', mixed: true, dataset: { arrowField: 'pattern' }, options: [{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }] }),
    SelectField({ id: 'arrow-width', label: 'Arrow line thickness', mixed: true, dataset: { arrowField: 'width' }, options: [2, 4, 6, 8, 10].map(n => ({ value: String(n), label: `${n}px` })) }),
    Divider({ hidden: true, 'data-curved-only': '' }),
    Button({ id: 'arrow-straight', hidden: true, 'data-curved-only': '' }, 'Reset to straight'));
}

function textInspector() {
  const format = (id, icon, label, shortcut) => Button({ id, icon, label, tooltip: true, shortcut, pressed: false, dataset: { textFormat: true } });
  return Toolbar({ as: 'form', id: 'text-inspector', label: 'Text settings', hidden: true, enter: true },
    SelectField({ id: 'text-size', label: 'Text size', mixed: true, dataset: { textField: 'size' }, options: [{ value: 'sm', label: '16 px' }, { value: 'md', label: '24 px' }, { value: 'lg', label: '40 px' }, { value: 'xl', label: '64 px' }] }),
    Divider(),
    format('text-bold', 'bold', 'Bold', 'mod+b'),
    format('text-italic', 'italic', 'Italic', 'mod+i'));
}

function selection() {
  const size = (id, label, tip) => Field({ label }, Input({ id, type: 'number', min: 160, max: 3840, required: true, 'data-tooltip-disabled': tip }));
  return h('div', { id: 'selection', hidden: true },
    h('div', { id: 'handles' }),
    Toolbar({ as: 'form', id: 'inspector', enter: true, centered: true },
      Field({ label: 'Preset', id: 'preset-field' }, SelectField({ id: 'preset', label: 'Preset' })),
      Divider({ id: 'preset-divider' }),
      size('width', 'W', 'Select Custom in Preset to edit the width'),
      size('height', 'H', 'Select Custom in Preset to edit the height')),
    Toolbar({ as: 'form', id: 'group-inspector', hidden: true, enter: true, centered: true },
      Field({ label: h('span', { id: 'gap-label' }, 'Gap X') }, Input({ id: 'gap', type: 'number', min: 0, step: 1, required: true, 'aria-label': 'Gap between selected screens' })),
      Field({ hidden: true, label: h('span', {}, 'Gap Y') }, Input({ id: 'gap-y', type: 'number', min: 0, step: 1, required: true, 'aria-label': 'Vertical gap between selected screens' }))));
}

function tools() {
  const tool = (id, icon, label, tooltip, shortcut, pressed) => Button({ id, icon, label, tooltip, shortcut, pressed });
  return [
    Toolbar({ as: 'nav', id: 'edit-tools', label: 'Canvas controls' },
      tool('tool-cursor', 'cursor', 'Cursor tool', 'Cursor', 'v', true),
      tool('tool-arrow', 'arrow', 'Arrow tool', 'Arrow', 'a', false),
      tool('tool-text', 'text', 'Text tool', 'Text', 't', false),
      Divider(),
      Button({ id: 'add', variant: 'primary', icon: 'plus', label: 'Add pages and components', tooltip: true, shortcut: 'mod+k' })),
    Toolbar({ as: 'nav', id: 'history-tools', label: 'History controls' },
      Button({ id: 'undo', icon: 'undo', label: 'Undo', tooltip: true, shortcut: 'mod+z', disabled: true }),
      Button({ id: 'redo', icon: 'redo', label: 'Redo', tooltip: true, shortcut: 'shift+mod+z', disabled: true })),
    Toolbar({ as: 'nav', id: 'zoom-tools', label: 'Canvas zoom controls' },
      Button({ id: 'zoom-out', icon: 'zoom-out', label: 'Zoom out', tooltip: true }),
      Field({ className: 'zoom-field' }, Input({ id: 'zoom', inputmode: 'decimal', 'aria-label': 'Zoom percentage', value: '80%' })),
      Button({ id: 'zoom-in', icon: 'zoom-in', label: 'Zoom in', tooltip: true }),
      Divider(),
      Button({ id: 'zoom-reset', label: 'Zoom to 100%', tooltip: true }, '100%'),
      Button({ id: 'fit', tooltip: 'Fit all screens', shortcut: 'shift+1', 'aria-keyshortcuts': 'Shift+1' }, 'Fit all'),
      Button({ id: 'fit-screen', tooltip: 'Fit selected screens', shortcut: 'shift+2', 'aria-keyshortcuts': 'Shift+2', hidden: true }, 'Fit to screen')),
  ];
}

function layersDrawer() {
  return Panel({ as: 'aside', id: 'layers', className: 'layers-drawer', 'aria-label': 'Screens' },
    Header({ title: [h('span', { class: 'layers-logo', role: 'img', 'aria-label': 'Tio' }), h('span', { id: 'screens-count', hidden: true }, '0')], titleId: 'layers-title' },
      Button({ id: 'layers-more', icon: 'dots', iconOnly: true, label: 'More', tooltip: true, 'aria-haspopup': 'menu', 'aria-controls': 'layers-menu', popovertarget: 'layers-menu' }, Badge({ hidden: true })),
      Button({ id: 'layers-toggle', icon: 'chevron-up', label: 'Minimize Layers', 'aria-controls': 'layers-list', 'aria-expanded': 'true' })),
    h('ol', { id: 'layers-list', 'aria-label': 'Layers, top layer first' }));
}

function previewControls() {
  return h('div', { id: 'fullscreen-tools', class: 'ui-enter', hidden: true },
    Button({ id: 'fullscreen-toggle', variant: 'bare', icon: 'menu', label: 'Preview controls', 'aria-expanded': 'false', 'aria-controls': 'fullscreen-menu' }),
    Panel({ as: 'section', id: 'fullscreen-menu', 'aria-label': 'Preview controls', hidden: true, enter: true },
      Button({ id: 'fullscreen-back', variant: 'ghost', className: 'ui-menu-item' }, 'Back to canvas')));
}

function dialogs() {
  const back = () => moreButton();
  return [
    Dialog({ id: 'shortcuts', title: 'Guide & hotkeys', returnFocus: back,
      headerEnd: [SegmentedControl({ id: 'shortcuts-platform', label: 'Keyboard layout', options: [{ value: 'mac', label: 'macOS' }, { value: 'win', label: 'Windows' }] })] },
      DialogBody({ padded: true, className: 'shortcuts-body' })),
    Dialog({ id: 'changelog', title: 'Change log', size: 'fit', returnFocus: back }, DialogBody({ padded: true, className: 'changelog-body' })),
    Dialog({ id: 'install', title: 'Install in a project', size: 'fit', returnFocus: back }, DialogBody({ padded: true, className: 'install-body' })),
    Dialog({ id: 'update', title: 'Update', size: 'fit', returnFocus: back }, DialogBody({ padded: true, className: 'update-body', 'aria-live': 'polite' })),
  ];
}

function menus() {
  return [
    Menu({ id: 'layers-menu', label: 'More' },
      MenuItem({ id: 'theme', icon: 'theme' }, h('span', { id: 'theme-label' }, 'Dark mode')),
      MenuItem({ id: 'shortcuts-open', icon: 'book' }, 'Guide & hotkeys'),
      MenuItem({ id: 'onboarding-open', icon: 'help' }, 'Onboarding'),
      Divider({ orientation: 'horizontal' }),
      MenuItem({ id: 'changelog-open', icon: 'document' }, 'Change log'),
      MenuItem({ id: 'install-open', icon: 'download' }, 'Install in a project'),
      Divider({ orientation: 'horizontal' }),
      MenuFooter(h('span', { id: 'version-label' }), Button({ id: 'update-open', role: 'menuitem' }, 'Check for update'))),
    Menu({ id: 'screen-context', label: 'Screen actions' },
      MenuItem({ icon: 'duplicate', dataset: { action: 'duplicate' } }, 'Duplicate'),
      MenuItem({ icon: 'trash', danger: true, dataset: { action: 'delete' } }, 'Delete')),
  ];
}

function deviceGate() {
  return h('div', { id: 'device-gate', popover: 'manual', role: 'alert' },
    h('div', { class: 'device-gate-icons', 'aria-hidden': 'true' }, Icon('desktop'), Icon('tablet')),
    h('p', {}, 'The canvas works best on a desktop or tablet. Open it on a larger screen.'));
}

export function buildShell() {
  return [
    h('main', { id: 'viewport', 'aria-label': 'Exploration canvas', tabIndex: 0 }, h('div', { id: 'world' }), arrowInspector(), textInspector(), selection()),
    ...tools(), layersDrawer(), previewControls(), ...dialogs(), ...menus(), deviceGate(),
    h('p', { id: 'canvas-status', role: 'status', class: 'ui-enter' }),
  ];
}
