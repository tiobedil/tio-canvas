import assert from 'node:assert/strict';
const store = new Map();
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) };
const { componentChanges, changesText, createSeen } = await import('../../client/component-refresh.js');

assert.deepEqual(componentChanges(['a', 'b'], ['b', 'c', 'd']), { added: ['c', 'd'], removed: ['a'] });
assert.equal(changesText({ added: ['c'], removed: [] }), '1 new component since this page opened.');
assert.equal(changesText({ added: ['c', 'd'], removed: ['a'] }), '2 new components, 1 removed since this page opened.');

const first = createSeen('k', ['component:a']);
assert.equal(first.isNew('component:a'), false, 'a first visit marks nothing new');
const later = createSeen('k', ['component:a', 'component:b']);
assert.equal(later.isNew('component:b'), true, 'a component found since the last visit is new');
later.markAll();
assert.equal(createSeen('k', ['component:a', 'component:b']).isNew('component:b'), false, 'once the picker showed it, it is no longer new');
console.log('PASS component refresh: changes, banner text, new since last visit');
