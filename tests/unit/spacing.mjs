import assert from 'node:assert/strict';
import { groupSpacing, spaceGroup } from '../../client/spacing.js';
const row = [
  { x: 100, y: 80, width: 300, height: 200 },
  { x: 480, y: 80, width: 200, height: 200 },
  { x: 800, y: 80, width: 100, height: 200 },
];
assert.equal(groupSpacing(row).axis, 'x');
assert.equal(groupSpacing(row).gap, null);
const spaced = spaceGroup(row, 24);
assert.deepEqual(spaced.map(r => r.x), [100, 424, 648]);
assert.equal(groupSpacing(spaced).gap, 24);
assert.deepEqual(spaced.map(r => r.y), row.map(r => r.y));
assert.equal(row[1].x, 480, 'Input snapshots stay unchanged');
const reversed = spaceGroup([...row].reverse(), 0);
assert.deepEqual(reversed.map(r => r.x), [600, 400, 100], 'Spatial order is independent of selection or stacking order');
const column = row.map(r => ({ x: r.y, y: r.x, width: r.height, height: r.width }));
assert.equal(groupSpacing(column).axis, 'y');
assert.deepEqual(spaceGroup(column, 24).map(r => r.y), [100, 424, 648]);
assert.equal(groupSpacing(spaceGroup(row, 1e6, 1000), 1000).gap, 150);
assert.equal(spaceGroup(row, NaN), null);
assert.equal(spaceGroup(row, -1), null);
assert.equal(spaceGroup(row.slice(0, 1), 20), null);
assert.equal(spaceGroup(row, 20, 500), null, 'An impossible row must not leave the workspace');
const fractional = spaceGroup([
  { x: 485 / 7, y: 160.4, width: 393, height: 852 },
  { x: 485 / 7 + 500, y: 160.4, width: 393, height: 852 },
], 50);
assert.equal(groupSpacing(fractional).gap, 50, 'An integer edit must not return a floating-point gap');
assert.ok(fractional.every(r => ['x','y','width','height'].every(axis => Number.isInteger(r[axis]))));
console.log('PASS group spacing: row, column, mixed gaps, zero, spatial order, immutable snapshots and bounds');

const grid = [
  {x:100,y:100,width:100,height:100},
  {x:300,y:100,width:100,height:100},
  {x:100,y:400,width:100,height:100},
  {x:300,y:400,width:100,height:100},
];
assert.equal(groupSpacing(grid,20000,'x').gap,100);
assert.equal(groupSpacing(grid,20000,'y').gap,200);
const columns = spaceGroup(grid,40,20000,'x');
assert.deepEqual(columns.map(r=>[r.x,r.y]),[[100,100],[240,100],[100,400],[240,400]]);
const rows = spaceGroup(columns,60,20000,'y');
assert.deepEqual(rows.map(r=>[r.x,r.y]),[[100,100],[240,100],[100,260],[240,260]]);
assert.equal(groupSpacing(row,20000,'y'),null,'A horizontal row has no vertical spacing control');
console.log('PASS independent grid column and row gaps');
