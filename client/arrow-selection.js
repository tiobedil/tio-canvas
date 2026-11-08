import { arrowGeometry } from './arrow-geometry.js';

function arc(arrow, objects) {
  const g = arrowGeometry(arrow, objects);
  if (Math.abs(arrow.bend) < .01 || g.length < .01) return { ...g, curved: false };
  const radius = g.length ** 2 / (8 * Math.abs(arrow.bend)) + Math.abs(arrow.bend) / 2;
  const signedRadius = Math.sign(arrow.bend) * radius;
  const center = { x: g.midpoint.x + g.normal.x * (arrow.bend - signedRadius), y: g.midpoint.y + g.normal.y * (arrow.bend - signedRadius) };
  const startAngle = Math.atan2(g.start.y - center.y, g.start.x - center.x);
  const endAngle = Math.atan2(g.end.y - center.y, g.end.x - center.x);
  const direction = arrow.bend > 0 ? -1 : 1;
  const distance = angle => ((angle - startAngle) * direction % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const sweep = distance(endAngle);
  return { ...g, curved: true, radius, center, contains: point => distance(Math.atan2(point.y - center.y, point.x - center.x)) <= sweep + 1e-8 };
}
export function arrowBounds(arrows, objects) {
  const points = [];
  for (const arrow of arrows) {
    const g = arc(arrow, objects);points.push(g.start, g.end);
    if (g.curved) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const point = { x: g.center.x + dx * g.radius, y: g.center.y + dy * g.radius };
      if (g.contains(point)) points.push(point);
    }
  }
  if (!points.length) return null;
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
}
export function arrowIntersects(arrow, box, objects) {
  if (box.width <= 0 || box.height <= 0) return false;
  const g = arc(arrow, objects), right = box.x + box.width, bottom = box.y + box.height;
  const inside = p => p.x >= box.x && p.x <= right && p.y >= box.y && p.y <= bottom;
  if (inside(g.start) || inside(g.end)) return true;
  if (!g.curved) {
    // Slab intersection rejects empty parts of a diagonal's bounding box.
    let low = 0, high = 1;
    for (const [axis, min, max] of [['x', box.x, right], ['y', box.y, bottom]]) {
      const d = g.end[axis] - g.start[axis];
      if (!d) { if (g.start[axis] < min || g.start[axis] > max) return false;continue; }
      const a = (min - g.start[axis]) / d, b = (max - g.start[axis]) / d;
      low = Math.max(low, Math.min(a, b));high = Math.min(high, Math.max(a, b));
    }
    return low <= high;
  }
  for (const x of [box.x, right]) {
    const squared = g.radius ** 2 - (x - g.center.x) ** 2;
    if (squared < 0) continue;
    for (const y of [g.center.y - Math.sqrt(squared), g.center.y + Math.sqrt(squared)]) if (y >= box.y && y <= bottom && g.contains({ x, y })) return true;
  }
  for (const y of [box.y, bottom]) {
    const squared = g.radius ** 2 - (y - g.center.y) ** 2;
    if (squared < 0) continue;
    for (const x of [g.center.x - Math.sqrt(squared), g.center.x + Math.sqrt(squared)]) if (x >= box.x && x <= right && g.contains({ x, y })) return true;
  }
  return false;
}
export function resizeArrows(originals, box, corner, point, origin) {
  if (originals.some(a => a.start.binding || a.end.binding)) return null;
  const anchor = { x: box.x + (corner.includes('w') ? box.width : 0), y: box.y + (corner.includes('n') ? box.height : 0) };
  const vector = { x: origin.x - anchor.x, y: origin.y - anchor.y };
  const length = vector.x ** 2 + vector.y ** 2;
  const scale = Math.max(.01, length ? ((point.x - anchor.x) * vector.x + (point.y - anchor.y) * vector.y) / length : 1);
  return originals.map(arrow => {
    const next = structuredClone(arrow);
    for (const name of ['start', 'end']) next[name] = { x: anchor.x + (arrow[name].x - anchor.x) * scale, y: anchor.y + (arrow[name].y - anchor.y) * scale };
    next.bend *= scale;return next;
  });
}
