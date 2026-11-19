import assert from 'node:assert/strict';
import { normalizeControls, componentProps, validateComponents, componentSourceId, componentThumbnailId } from '../../client/registry.js';

const controls = normalizeControls({
  variant: ['primary', 'ghost'],
  disabled: false,
  label: 'Save',
  count: 3,
  radius: { type: 'number', min: 0, max: 24, step: 2, value: 8 },
  size: { options: [{ value: 1, label: 'Small' }, 2], value: 2, label: 'Size' },
});
assert.deepEqual(controls.map(control => [control.name, control.type]), [['variant', 'select'], ['disabled', 'boolean'], ['label', 'text'], ['count', 'number'], ['radius', 'number'], ['size', 'select']], 'short forms become full controls, in written order');
assert.equal(controls[0].value, 'primary', 'the first option is the default');
assert.deepEqual(controls[0].options[1], { value: 'ghost', label: 'ghost' });
assert.deepEqual([controls[4].min, controls[4].max, controls[4].step, controls[4].value], [0, 24, 2, 8]);
assert.deepEqual(controls[5].options, [{ value: 1, label: 'Small' }, { value: 2, label: '2' }], 'an option keeps its real value');
assert.equal(controls[5].value, 2);
assert.equal(controls[5].label, 'Size');
assert.deepEqual(normalizeControls(undefined), [], 'a component may have no controls');
assert.throws(() => normalizeControls({ bad: null }), /needs a type/);
assert.throws(() => normalizeControls({ bad: [] }), /at least one option/);
assert.throws(() => normalizeControls({ bad: [{}] }), /not a string, number or boolean/);

assert.deepEqual(componentProps(controls), { variant: 'primary', disabled: false, label: 'Save', count: 3, radius: 8, size: 2 }, 'no saved values gives the defaults');
assert.deepEqual(componentProps(controls, { variant: 'ghost', disabled: true, label: '', count: 0, radius: 4, size: 1, gone: 'x' }),
  { variant: 'ghost', disabled: true, label: '', count: 0, radius: 4, size: 1 }, 'saved values win, an empty text and a zero included; an unknown name is dropped');
assert.deepEqual(componentProps(controls, { variant: 'removed', disabled: 'yes', label: 4, count: 'many', size: '2' }),
  { variant: 'primary', disabled: false, label: 'Save', count: 3, radius: 8, size: 2 }, 'a saved value that no longer fits falls back to the default');

const component = { id: 'button', title: 'Button', module: './Button.jsx', controls: { disabled: false } };
validateComponents([component]);
assert.throws(() => validateComponents({}), /must be an array/);
assert.throws(() => validateComponents([{ ...component, id: 'My Button' }]), /lowercase letters, digits and dashes/);
assert.throws(() => validateComponents([component, component]), /listed twice/);
assert.throws(() => validateComponents([{ ...component, title: '' }]), /needs a title/);
assert.throws(() => validateComponents([{ ...component, module: undefined }]), /needs "module"/);
assert.throws(() => validateComponents([{ ...component, framework: 'vue' }]), /Use "react" or "dom"/);
assert.throws(() => validateComponents([{ ...component, controls: { x: null } }]), /Canvas component "button": Control "x"/);
assert.equal(componentSourceId('button'), 'component:button');
assert.equal(componentThumbnailId('button'), 'component-button');
console.log('PASS components: controls, saved props, validation');
