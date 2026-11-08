import assert from 'node:assert/strict';
import { menuPosition } from '../../client/menu-position.js';

const viewport = { width: 1000, height: 800 }, margin = 10, gap = 10;
const obstacles = [
  { left: 10, right: 270, top: 10, bottom: 600 },
  { left: 10, right: 270, top: 736, bottom: 790 },
  { left: 400, right: 600, top: 736, bottom: 790 },
  { left: 700, right: 990, top: 736, bottom: 790 },
  { left: 900, right: 990, top: 10, bottom: 64 },
];
const anchor = (x, y) => ({ left: x, right: x + 80, top: y, bottom: y + 36, width: 80 });
const place = (x, y, extra = {}) => menuPosition({ anchor: anchor(x, y), width: 150, height: 254, viewport, margin, gap, obstacles, ...extra });
const validate = p => {
  assert.ok(p, 'A visible lane exists');
  assert.ok(p.x >= margin && p.y >= margin);
  assert.ok(p.x + 150 <= viewport.width - margin && p.y + p.height <= viewport.height - margin);
  for (const r of obstacles) assert.ok(p.x + 150 <= r.left - gap || p.x >= r.right + gap || p.y + p.height <= r.top - gap || p.y >= r.bottom + gap, 'Menu respects the fixed toolbar clearance');
};
const below = place(450, 300);
assert.equal(below.y, 346);
const above = place(450, 650);
assert.equal(above.y + above.height, 640);
assert.equal(place(450, 300, { aboveOnly: true, height: 54 }).y, 236);
for (const x of [-2000, -100, 0, 250, 450, 850, 1000, 2000]) {
  for (const y of [-2000, -100, 0, 300, 650, 800, 2000]) validate(place(x, y));
}
console.log('PASS menu geometry: above/below, endpoint exception, all offscreen edges and fixed toolbar clearance');
