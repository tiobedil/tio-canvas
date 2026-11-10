export const storageKey = 'tio-canvas:demo:v1';
export const screens = [
  { id: 'home', kind: 'production', title: 'Home',
    src: '/home.html', x: 160, y: 160, width: 1440, height: 900, preset: 'laptop' },
  { id: 'sample', kind: 'prototype', title: 'Sample',
    src: '/sample.html', x: 1700, y: 160, width: 390, height: 844, preset: 'iphone-16' },
  { id: 'update-states', kind: 'prototype', title: 'Update states',
    src: '/update-states.html', x: 160, y: 1160, width: 1440, height: 900, preset: 'laptop' },
];

// The canvas's own components, listed here so this repository can try the
// component frames on itself. This file is the dev config of this repository
// only: a project that installs the package sees its own components, never these.
const ui = '../../client/ui/index.js';
const icons = ['plus', 'search', 'theme', 'refresh', 'fullscreen', 'duplicate', 'trash', 'book', 'help', 'download', 'sliders', 'component', 'cursor', 'arrow', 'text', 'undo', 'redo', 'close', 'menu', 'phone', 'tablet', 'laptop', 'desktop'];
const dom = (group, id, title, controls, render, size = {}) => ({ id, title, group, module: ui, framework: 'dom', controls, render, ...size });

export const componentPreview = {
  styles: ['/canvas/ui/tokens.css', '/canvas/ui/ui.css', '/canvas/canvas.css'],
  // The canvas chrome switches theme with [data-dark] on the root.
  theme(dark, doc) { doc.documentElement.toggleAttribute('data-dark', dark); },
};

export const components = [
  dom('Actions', 'button', 'Button', {
    text: 'Add pages',
    variant: ['secondary', 'primary', 'accent', 'ghost', 'bare'],
    size: ['md', 'sm', 'xs'],
    tone: ['none', 'muted', 'danger'],
    icon: ['none', ...icons],
    pressed: false,
    disabled: false,
  }, (m, p) => m.Button({ variant: p.variant, size: p.size === 'md' ? undefined : p.size, tone: p.tone === 'none' ? undefined : p.tone, icon: p.icon === 'none' ? undefined : p.icon,
    label: p.text || 'Button', pressed: p.pressed || undefined, disabled: p.disabled }, ...(p.text ? [p.text] : []))),
  dom('Actions', 'copy-button', 'CopyButton', { label: 'Copy prompt', text: 'Text that lands on the clipboard' }, (m, p) => m.CopyButton(p.label, p.text)),
  dom('Actions', 'icon', 'Icon', { name: icons, size: { type: 'number', min: 12, max: 96, step: 2, value: 20 } },
    (m, p) => { const icon = m.Icon(p.name); icon.style.width = icon.style.height = `${p.size}px`; return icon; }, { width: 320, height: 240 }),

  dom('Forms', 'input', 'Input', { type: ['text', 'number'], value: '1440', placeholder: 'Width', disabled: false },
    (m, p) => m.Input({ type: p.type, value: p.value, placeholder: p.placeholder, disabled: p.disabled })),
  dom('Forms', 'field', 'Field', { label: 'W', value: '1440', disabled: false },
    (m, p) => m.Field({ label: p.label }, m.Input({ type: 'number', value: p.value, disabled: p.disabled }))),
  dom('Forms', 'checkbox', 'Checkbox', { checked: true }, (m, p) => {
    const box = m.Checkbox({ label: 'Select', checked: p.checked });
    box.addEventListener('click', () => box.setAttribute('aria-checked', String(box.getAttribute('aria-checked') !== 'true')));
    return box;
  }, { width: 320, height: 240 }),
  dom('Forms', 'switch', 'Switch', { checked: true, disabled: false }, (m, p) => m.Switch({ label: 'Switch', checked: p.checked, disabled: p.disabled }), { width: 320, height: 240 }),
  dom('Forms', 'slider', 'Slider', { value: { type: 'number', min: 0, max: 100, step: 1, value: 40 }, max: [100, 10, 1000], step: [1, 5, 10] },
    (m, p) => { const slider = m.Slider({ label: 'Slider', min: 0, max: p.max, step: p.step, value: Math.min(p.value, p.max) }); slider.style.width = '240px'; return slider; }),
  dom('Forms', 'option-chips', 'OptionChips', { options: { type: 'number', min: 2, max: 12, step: 1, value: 5 }, chosen: { type: 'number', min: 1, max: 12, step: 1, value: 2 } }, (m, p) => {
    const names = ['secondary', 'primary', 'accent', 'ghost', 'bare', 'muted', 'danger', 'sm', 'md', 'lg', 'xl', 'none'].slice(0, p.options);
    const chips = m.OptionChips({ label: 'Variant', options: names.map(value => ({ value, label: value })), value: names[Math.min(p.chosen, names.length) - 1] });
    chips.style.width = '248px'; return chips;
  }),
  dom('Forms', 'segmented-control', 'SegmentedControl', { options: { type: 'number', min: 2, max: 4, step: 1, value: 2 }, value: ['mac', 'win', 'linux', 'web'] }, (m, p) => {
    const all = [{ value: 'mac', label: 'macOS' }, { value: 'win', label: 'Windows' }, { value: 'linux', label: 'Linux' }, { value: 'web', label: 'Web' }].slice(0, p.options);
    const control = m.SegmentedControl({ label: 'Keyboard layout', options: all, value: p.value });
    control.addEventListener('change', event => control.setValue(event.detail));
    return control;
  }),
  dom('Forms', 'icon-select', 'IconSelect', { value: ['line', 'arrow', 'mixed'] }, (m, p) => {
    for (const old of document.querySelectorAll('body > .ui-menu')) old.remove();
    const field = m.IconSelect({ id: 'demo-ending', label: 'End style', options: [{ value: 'line', icon: 'end-line', label: 'Line' }, { value: 'arrow', icon: 'end-finish', label: 'Right arrow' }] });
    field.trigger.value = p.value === 'mixed' ? '' : p.value; field.sync();
    return field;
  }, { width: 420, height: 300 }),
  dom('Forms', 'select-field', 'SelectField', { mixed: false }, (m, p) => {
    for (const old of document.querySelectorAll('body > .ui-menu')) old.remove();
    const field = m.SelectField({ id: 'demo-size', label: 'Text size', mixed: p.mixed, options: [{ value: 'sm', label: '16 px' }, { value: 'md', label: '24 px' }, { value: 'lg', label: '40 px' }, { value: 'xl', label: '64 px' }] });
    if (p.mixed) field.select.value = '';
    field.sync();
    return field;
  }, { width: 420, height: 360 }),

  dom('Content', 'kbd', 'Kbd', { text: '⌘', gesture: false }, (m, p) => (p.gesture ? m.Kbd({ gesture: true }, m.Icon('mouse'), p.text) : m.Kbd({}, p.text)), { width: 320, height: 240 }),
  dom('Content', 'tag', 'Tag', { text: 'New', hue: { type: 'number', min: 0, max: 360, step: 5, value: 265 } }, (m, p) => m.Tag({ hue: p.hue }, p.text), { width: 320, height: 240 }),
  dom('Content', 'pill', 'Pill', { text: '2 on canvas' }, (m, p) => m.Pill({}, p.text), { width: 320, height: 240 }),
  dom('Content', 'badge', 'Badge', {}, m => m.Badge(), { width: 320, height: 240 }),
  dom('Content', 'callout', 'Callout', { strong: 'Heads up.', text: 'Restart the dev server after you change the config.' },
    (m, p) => { const callout = m.Callout({}, m.h('strong', {}, p.strong), ` ${p.text}`); callout.style.margin = '0'; callout.style.maxWidth = '360px'; return callout; }),
  dom('Content', 'code-block', 'CodeBlock', { code: 'pnpm add -D @tio-canvas/canvas\npnpm dev' }, (m, p) => m.CodeBlock(p.code)),
  dom('Content', 'command-row', 'CommandRow', { command: 'npx tio-canvas thumbnails' }, (m, p) => { const row = m.CommandRow(p.command); row.style.margin = '0'; return row; }),
  dom('Content', 'section', 'Section', { title: 'Shortcuts', tone: ['default', 'muted'], text: 'A block of a dialog under its own heading.' },
    (m, p) => m.Section({ title: p.title, tone: p.tone === 'muted' ? 'muted' : undefined }, m.h('p', { style: { margin: '0' } }, p.text))),

  dom('Surfaces', 'toolbar', 'Toolbar', { divider: true, buttons: { type: 'number', min: 1, max: 6, step: 1, value: 3 } }, (m, p) => {
    const tools = ['cursor', 'arrow', 'text', 'undo', 'redo', 'theme'].slice(0, p.buttons).map((icon, index) => m.Button({ icon, label: icon, pressed: index === 0 }));
    return m.Toolbar({ label: 'Canvas controls', style: { position: 'static' } }, ...tools, ...(p.divider ? [m.Divider(), m.Button({ variant: 'primary', icon: 'plus', label: 'Add' })] : []));
  }),
  dom('Surfaces', 'disclosure', 'Disclosure', { label: 'Production', open: true, rows: { type: 'number', min: 1, max: 6, step: 1, value: 3 } }, (m, p) => {
    const group = m.Disclosure({ id: 'demo-pages', label: p.label, count: p.rows, open: p.open },
      ...Array.from({ length: p.rows }, (_, index) => m.h('div', { class: 'ui-row', style: { height: '32px', padding: '0 8px' } }, `Page ${index + 1}`)));
    group.style.width = '260px'; return group;
  }, { width: 480, height: 400 }),
  dom('Surfaces', 'menu', 'Menu', { danger: true, footer: false }, (m, p) => {
    const menu = m.Menu({ id: 'demo-menu', label: 'Screen actions', popover: false, style: { position: 'static', display: 'flex', opacity: '1', scale: '1' } },
      m.MenuItem({ icon: 'duplicate' }, 'Duplicate'), m.MenuItem({ icon: 'book' }, 'Guide & hotkeys'),
      ...(p.danger ? [m.Divider({ orientation: 'horizontal' }), m.MenuItem({ icon: 'trash', danger: true }, 'Delete')] : []),
      ...(p.footer ? [m.Divider({ orientation: 'horizontal' }), m.MenuFooter(m.h('span', {}, 'v0.3.0'), m.Button({}, 'Check for update'))] : []));
    return menu;
  }, { width: 480, height: 400 }),
  dom('Surfaces', 'panel', 'Panel', { header: true, title: 'Layers', text: 'The floating surface under toolbars, menus and the layers drawer.' }, (m, p) =>
    m.Panel({ style: { position: 'static', flexDirection: 'column', alignItems: 'stretch', width: '260px', padding: '0', gap: '0' } },
      ...(p.header ? [m.Header({ title: p.title }, m.Button({ icon: 'dots', iconOnly: true, label: 'More' }))] : []),
      m.h('p', { style: { margin: '0', padding: '12px 18px', fontWeight: '400' } }, p.text)), { width: 480, height: 360 }),
  dom('Surfaces', 'dialog', 'Dialog', { title: 'Change log', size: ['fit', 'fixed'], footer: true, text: 'Press the backdrop, the Close button or Escape to close it.' }, (m, p) => {
    const dialog = m.Dialog({ id: 'demo-dialog', title: p.title, size: p.size === 'fit' ? 'fit' : undefined, style: { position: 'static', width: '360px', height: p.size === 'fit' ? 'auto' : '320px' } },
      m.DialogBody({ padded: true }, m.h('p', { style: { margin: '0' } }, p.text)),
      ...(p.footer ? [m.DialogFooter({}, m.Button({}, 'Cancel'), m.Button({ variant: 'primary', 'data-align': 'end' }, 'Done'))] : []));
    // Shown in place, not as a modal: the frame is its stage.
    queueMicrotask(() => dialog.show());
    return dialog;
  }, { width: 560, height: 480 }),
  dom('Surfaces', 'spotlight', 'Spotlight', { tabs: true, pages: { type: 'number', min: 0, max: 12, step: 1, value: 5 } }, (m, p) => {
    for (const old of document.querySelectorAll('#component-root .ui-spotlight')) old.close?.();
    const list = (noun, count) => Array.from({ length: count }, (_, index) => ({ id: `${noun}-${index}`, group: index % 2 ? 'b' : 'a', title: `${noun} ${index + 1}` }));
    const groups = [{ id: 'a', label: 'Production' }, { id: 'b', label: 'Prototypes' }];
    const spotlight = m.Spotlight({ id: 'demo-spotlight', label: 'Add pages', onAdd: () => false,
      ...(p.tabs ? { tabs: [{ id: 'pages', label: 'Pages', groups, items: list('Page', p.pages) }, { id: 'components', label: 'Components', noun: ['component', 'components'], groups, items: list('Component', 7) }] }
        : { groups, items: list('Page', p.pages) }) });
    spotlight.style.setProperty('--spotlight-bottom', '24px');
    queueMicrotask(() => spotlight.open());
    return spotlight;
  }, { width: 640, height: 520 }),
  dom('Surfaces', 'dial-panel', 'DialPanel', { title: 'Button', minimized: false }, (m, p) => m.DialPanel({ title: p.title, minimized: p.minimized, controls: [
    { name: 'variant', label: 'variant', type: 'select', value: 'primary', options: ['secondary', 'primary', 'accent', 'ghost'].map(value => ({ value, label: value })) },
    { name: 'disabled', label: 'disabled', type: 'boolean', value: false },
    { name: 'text', label: 'text', type: 'text', value: 'Add pages' },
    { name: 'radius', label: 'radius', type: 'number', min: 0, max: 24, step: 1, value: 8 },
  ] }), { width: 480, height: 420 }),
];
