import assert from 'node:assert/strict';
import { matchRange, searchGroups, between, createSpotlightState } from '../../client/ui/spotlight-model.js';

const groups = [{ id: 'production', label: 'Production' }, { id: 'prototype', label: 'Prototypes' }, { id: 'empty', label: 'Nothing' }];
const items = [
  { id: 'home', group: 'production', title: 'Home' },
  { id: 'page-test', group: 'production', title: 'page test' },
  { id: 'lab', group: 'prototype', title: 'Lab' },
];
const ids = results => results.flatMap(group => group.items.map(entry => entry.item.id));

assert.deepEqual(matchRange('page test', 'TEST'), [5, 9], 'case does not matter');
assert.equal(matchRange('Home', '  '), null, 'a blank query matches nothing to highlight');
assert.deepEqual(ids(searchGroups(groups, items, '')), ['home', 'page-test', 'lab'], 'a blank query lists everything, empty groups left out');
assert.deepEqual(ids(searchGroups(groups, items, 'TEST')), ['page-test'], 'an uppercase word finds a lowercase title');
assert.deepEqual(ids(searchGroups(groups, items, 'h')), ['home'], 'one letter is enough');
assert.deepEqual(ids(searchGroups(groups, items, 'production')), ['home', 'page-test'], 'a group name brings its whole group');
assert.deepEqual(searchGroups(groups, items, 'prototy').map(group => group.group.id), ['prototype'], 'a partial group name works');
for (const [text, query, found] of [['update', 'updte', true], ['update', 'updaa', false], ['run', 'r', true], ['run', 'rn', true], ['run', 'ru', true], ['run', 'rum', false], ['run', 'ra', false], ['run', 'rnu', false], ['Home', 'hoe', true]])
  assert.equal(matchRange(text, query) !== null, found, `"${query}" ${found ? 'finds' : 'misses'} "${text}": letters in order, skips allowed`);
assert.deepEqual(ids(searchGroups(groups, items, 'zzz')), [], 'no match gives nothing');
assert.deepEqual(between(['a', 'b', 'c', 'd'], 'c', 'a'), ['a', 'b', 'c'], 'a range runs either way');

const list = ['a', 'b', 'c', 'd'];
let state = createSpotlightState();
state.reset(list);
assert.equal(state.active, 'a');
state.move(list, 1); state.move(list, 1);
assert.equal(state.active, 'c');
state.move(list, 1); state.move(list, 1);
assert.equal(state.active, 'd', 'the highlight stops at the end');
state.move(list, 'home');
assert.equal(state.active, 'a');

state.move(list, 1, true); state.move(list, 1, true);
assert.deepEqual([...state.selected], ['a', 'b', 'c'], 'shift+arrow grows a range from where it began');
state.move(list, -1, true);
assert.deepEqual([...state.selected], ['a', 'b'], 'shift+arrow back shrinks it');
state.move(list, -1, true); state.move(list, -1, true);
assert.deepEqual([...state.selected], ['a'], 'at the start the range is just the anchor');
state.move(list, 1);
assert.equal(state.size, 0, 'a plain arrow ends the selection');

state = createSpotlightState(); state.reset(list);
state.toggle('b'); state.toggle('d');
assert.deepEqual([...state.selected], ['b', 'd']);
state.toggle('b');
assert.deepEqual([...state.selected], ['d']);
state.rangeTo(list, 'a');
assert.deepEqual([...state.selected].sort(), ['a', 'b', 'd'], 'shift-click ranges from the last clicked row and keeps the rest');

state = createSpotlightState(); state.reset(list);
state.toggle('a'); state.toggle('d');
const visible = ['b', 'c'];
assert.deepEqual(state.hidden(visible), ['a', 'd'], 'selected rows a query hides are reported');
state.move(visible, 1);
assert.deepEqual([...state.selected].sort(), ['a', 'd'], 'a plain arrow only clears what is on screen');
state.unselectHidden(visible);
assert.equal(state.size, 0, 'unselecting the hidden ones leaves the visible selection alone');
state.selectAll(visible);
assert.deepEqual([...state.selected], ['b', 'c']);
state.remove('b');
assert.deepEqual([...state.selected], ['c'], 'one selected row can be unselected on its own');
state.highlight('c'); state.keep(['b', 'c']);
assert.equal(state.active, 'c', 'keep leaves a surviving highlight');
state.keep(['x', 'y']);
assert.equal(state.active, 'x', 'keep resets when the highlighted row is gone');
import { addPagesPrompt } from '../../client/pages-empty.js';
assert.match(addPagesPrompt, /screens\.js/);
assert.match(addPagesPrompt, /docs\/integration\.md/);
assert.match(addPagesPrompt, /do not show/);
console.log('PASS spotlight model: search by title or group, range selection, hidden selection');
