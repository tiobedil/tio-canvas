// What the canvas knows about screens, whatever project it runs in. The project
// owns the list of screens (project.js, served from its own config file); this
// file owns the shape a screen must have and the device presets.
// The page picker groups by kind, so every page, production or prototype, must
// carry one. Fail loudly when one does not.
export const screenKinds = { production: 'Production', prototype: 'Prototypes' };
export function validateScreens(screens) {
  for (const screen of screens) {
    if (!Object.hasOwn(screenKinds, screen.kind)) throw new Error(`Canvas screen "${screen.id}" needs kind: "production" or "prototype".`);
  }
}
export const presets = {
  custom: { label: 'Custom' },
  laptop: { label: 'Laptop', group: 'Desktop', device: 'laptop', width: 1440, height: 900 },
  'macbook-air-13': { label: 'MacBook Air 13-inch', group: 'Desktop', device: 'laptop', width: 1470, height: 956 },
  'macbook-pro-14': { label: 'MacBook Pro 14-inch', group: 'Desktop', device: 'laptop', width: 1512, height: 982 },
  desktop: { label: 'Desktop', group: 'Desktop', device: 'desktop', width: 1920, height: 1080 },
  'desktop-qhd': { label: 'Desktop QHD', group: 'Desktop', device: 'desktop', width: 2560, height: 1440 },
  'iphone-se': { label: 'iPhone SE', group: 'Mobile', device: 'phone', touch: true, width: 375, height: 667 },
  'iphone-16': { label: 'iPhone 16', group: 'Mobile', device: 'phone', touch: true, width: 393, height: 852 },
  'iphone-16-pro-max': { label: 'iPhone 16 Pro Max', group: 'Mobile', device: 'phone', touch: true, width: 440, height: 956 },
  'pixel-9': { label: 'Pixel 9', group: 'Mobile', device: 'phone', touch: true, width: 412, height: 915 },
  'galaxy-s24': { label: 'Galaxy S24', group: 'Mobile', device: 'phone', touch: true, width: 360, height: 780 },
  'ipad-mini': { label: 'iPad mini', group: 'Tablet', device: 'tablet', touch: true, width: 744, height: 1133 },
  'ipad-air': { label: 'iPad Air', group: 'Tablet', device: 'tablet', touch: true, width: 820, height: 1180 },
  'ipad-pro-11': { label: 'iPad Pro 11-inch', group: 'Tablet', device: 'tablet', touch: true, width: 834, height: 1194 },
  'ipad-pro-13': { label: 'iPad Pro 13-inch', group: 'Tablet', device: 'tablet', touch: true, width: 1032, height: 1376 },
  'galaxy-z-fold-6-cover': { label: 'Galaxy Z Fold 6 (cover)', group: 'Foldable', device: 'phone', touch: true, width: 344, height: 748 },
  'galaxy-z-fold-6-open': { label: 'Galaxy Z Fold 6 (open)', group: 'Foldable', device: 'phone', touch: true, width: 673, height: 841 },
};

// ---- Components -------------------------------------------------------------
// A project may also list components (`export const components` in its config).
// Each one is shown alone in a frame, with a dial for every control beside it.
//   { id, title, group, module, export, framework, width, height, controls, render }
// `controls` maps a prop name to its dial. Short forms:
//   ['sm', 'md']   one of these (the first is the default)
//   false / true   a switch
//   'Save'         a text field
//   12             a number field
// The long form is { type: 'select' | 'boolean' | 'text' | 'number', value, label,
// options, min, max, step }. A number with both min and max is a slider.
export const componentFrameworks = ['react', 'dom'];
export const componentSourceId = id => `component:${id}`;
export const componentThumbnailId = id => `component-${id}`;
const controlTypes = ['select', 'boolean', 'text', 'number'];
const primitive = value => ['string', 'number', 'boolean'].includes(typeof value);

/** One control, written out in full. Throws when it cannot be understood. */
export function normalizeControl(name, control) {
  let full;
  if (Array.isArray(control)) full = { type: 'select', options: control };
  else if (typeof control === 'boolean') full = { type: 'boolean', value: control };
  else if (typeof control === 'string') full = { type: 'text', value: control };
  else if (typeof control === 'number') full = { type: 'number', value: control };
  else if (control && typeof control === 'object') full = { ...control, type: control.type ?? (control.options ? 'select' : undefined) };
  if (!full || !controlTypes.includes(full.type)) throw new Error(`Control "${name}" needs a type: ${controlTypes.join(', ')}.`);
  const result = { name, label: typeof full.label === 'string' ? full.label : name, type: full.type };
  if (full.type === 'select') {
    if (!Array.isArray(full.options) || !full.options.length) throw new Error(`Control "${name}" needs at least one option.`);
    result.options = full.options.map(option => {
      const entry = primitive(option) ? { value: option, label: String(option) } : { value: option?.value, label: String(option?.label ?? option?.value) };
      if (!primitive(entry.value)) throw new Error(`Control "${name}" has an option that is not a string, number or boolean.`);
      return entry;
    });
    result.value = result.options.some(option => option.value === full.value) ? full.value : result.options[0].value;
  } else if (full.type === 'boolean') result.value = full.value === true;
  else if (full.type === 'text') result.value = typeof full.value === 'string' ? full.value : '';
  else {
    for (const key of ['min', 'max', 'step']) if (Number.isFinite(full[key])) result[key] = full[key];
    result.value = Number.isFinite(full.value) ? full.value : result.min ?? 0;
  }
  return result;
}

/** Every control of a component, in the order it was written. */
export function normalizeControls(controls = {}) {
  return Object.entries(controls).map(([name, control]) => normalizeControl(name, control));
}

/**
 * The props a frame shows: each control's default, replaced by a saved value
 * when that value still fits the control (an option that still exists, the right type).
 */
export function componentProps(controls, saved = {}) {
  const props = {};
  for (const control of controls) {
    const value = saved?.[control.name];
    const fits = control.type === 'select' ? control.options.some(option => option.value === value)
      : control.type === 'boolean' ? typeof value === 'boolean'
      : control.type === 'text' ? typeof value === 'string'
      : Number.isFinite(value);
    props[control.name] = fits ? value : control.value;
  }
  return props;
}

export function validateComponents(components) {
  if (!Array.isArray(components)) throw new Error('"components" must be an array.');
  const seen = new Set();
  for (const component of components) {
    const id = component?.id;
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`Canvas component id "${id}" must use lowercase letters, digits and dashes.`);
    if (seen.has(id)) throw new Error(`Canvas component "${id}" is listed twice.`);
    seen.add(id);
    if (typeof component.title !== 'string' || !component.title.trim()) throw new Error(`Canvas component "${id}" needs a title.`);
    if (typeof component.module !== 'string' || !component.module) throw new Error(`Canvas component "${id}" needs "module": the file that exports it.`);
    if (component.framework !== undefined && !componentFrameworks.includes(component.framework)) throw new Error(`Canvas component "${id}" has framework "${component.framework}". Use "react" or "dom".`);
    try { normalizeControls(component.controls); } catch (error) { throw new Error(`Canvas component "${id}": ${error.message}`); }
  }
}
