import assert from 'node:assert/strict';
import { ARROW_GAP, boundPoint, snapArrow, arrowGeometry, readArrows } from '../../client/arrow-geometry.js';
import { createHistory } from '../../client/history.js';
const objects = [{ id: 'screen', x: 100, y: 100, width: 400, height: 300 }];
for (const [side, expected] of [['top', { x: 300, y: 92 }], ['right', { x: 508, y: 250 }], ['bottom', { x: 300, y: 408 }], ['left', { x: 92, y: 250 }]]) {
  assert.deepEqual(boundPoint({ objectId: 'screen', side, t: .5 }, objects), expected);
  for (const scale of [.1, .8, 2]) {
    const snapped = snapArrow(expected, objects, scale);
    assert.equal(snapped.binding.side, side);assert.equal(snapped.binding.t, .5);
  }
}
assert.equal(ARROW_GAP, 8);
assert.equal(snapArrow({ x: 313, y: 100 }, objects, 1).binding.t, .5, 'Center has a stronger capture zone than the edge');
assert.equal(snapArrow({ x: 410, y: 96 }, objects, 1).binding.t, .775, 'Any position along an edge can bind');
assert.equal(snapArrow({ x: 900, y: 900 }, objects, 1).binding, undefined);
const arrow = { id: 'a', start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, bend: 50, startStyle: 'line', endStyle: 'arrow', width: 2, pattern: 'solid' };
let geometry = arrowGeometry(arrow, []);
assert.deepEqual(geometry.middle, { x: 100, y: 50 });assert.match(geometry.path, /A 125 125 0 0 0/);
assert.equal(Math.hypot(geometry.middle.x - geometry.start.x, geometry.middle.y - geometry.start.y), Math.hypot(geometry.middle.x - geometry.end.x, geometry.middle.y - geometry.end.y), 'Arc midpoint stays balanced');
assert.match(arrowGeometry({ ...arrow, bend: -150 }, []).path, /0 1 1/);
assert.match(arrowGeometry({ ...arrow, bend: 0 }, []).path, / L /);
assert.equal(readArrows([arrow, arrow, { ...arrow, id: 'bad', width: NaN }]).length, 1);
assert.equal(readArrows([{ ...arrow, start: { x: 0, y: 0, binding: { objectId: 'x', side: 'bogus', t: 0 } } }]).length, 0);
let arrows = [structuredClone(arrow)];
const history = createHistory(() => ({ models: [], arrows: structuredClone(arrows) }), snapshot => { arrows = structuredClone(snapshot.arrows); });
const before = history.checkpoint();arrows[0].bend = 90;
assert.equal(history.commit(before), true);history.undo();assert.equal(arrows[0].bend, 50);history.redo();assert.equal(arrows[0].bend, 90);
console.log('PASS arrow geometry: edge/center snapping, 8px gap, balanced circular arcs, validation, arrow-only history');

const { arrowBounds, arrowIntersects, resizeArrows } = await import('../../client/arrow-selection.js');
assert.deepEqual(arrowBounds([arrow], []), { x: 0, y: 0, width: 200, height: 50 });
assert.equal(arrowIntersects(arrow, { x: 98, y: 48, width: 4, height: 4 }, []), true);
assert.equal(arrowIntersects(arrow, { x: 98, y: 8, width: 4, height: 4 }, []), false, 'Empty arc bounding-box area is not selected');
assert.equal(arrowIntersects({ ...arrow, bend: 0 }, { x: 80, y: -1, width: 20, height: 2 }, []), true, 'Horizontal arrows can be marquee-selected');
assert.equal(arrowIntersects({ ...arrow, end: { x: 200, y: 200 }, bend: 0 }, { x: 10, y: 150, width: 20, height: 20 }, []), false, 'Diagonal bounding-box corners do not count');
for (const bend of [-150, -50, 50, 150]) {
  const curved = { ...arrow, bend }, g = arrowGeometry(curved, []), box = arrowBounds([curved], []);
  assert.equal(arrowIntersects(curved, { x: g.middle.x - .1, y: g.middle.y - .1, width: .2, height: .2 }, []), true, 'Both arc directions and major arcs intersect their midpoint');
  assert.ok(g.middle.x >= box.x && g.middle.y >= box.y && g.middle.x <= box.x + box.width && g.middle.y <= box.y + box.height + .00001);
}
assert.equal(arrowIntersects(arrow, { x: 0, y: 0, width: 0, height: 100 }, []), false);
const resized = resizeArrows([arrow], { x: 0, y: 0, width: 200, height: 50 }, 'se', { x: 400, y: 100 }, { x: 200, y: 50 });
assert.deepEqual(resized[0].start, { x: 0, y: 0 });assert.deepEqual(resized[0].end, { x: 400, y: 0 });assert.equal(resized[0].bend, 100);assert.equal(resized[0].width, 2);
assert.equal(resizeArrows([{ ...arrow, start: { ...arrow.start, binding: { objectId: 'x', side: 'top', t: .5 } } }], { x: 0, y: 0, width: 200, height: 50 }, 'se', { x: 400, y: 100 }, { x: 200, y: 50 }), null);
assert.equal(readArrows([{ ...arrow, width: 3 }])[0].width, 4);assert.equal(readArrows([{ ...arrow, width: 16 }])[0].width, 10);
console.log('PASS arrow selection: exact stroke/arc intersections, extrema, proportional resize, binding lock, legacy thickness migration');
