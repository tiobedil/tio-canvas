const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const SIDES = ['top', 'right', 'bottom', 'left'];
export const ARROW_GAP = 8;

// Bindings use object IDs and a fraction along an edge, not screen-specific data.
export function boundPoint(binding, objects) {
  const object = objects.find(item => item.id === binding.objectId);
  if (!object) return null;
  const { x, y, width, height } = object, t = binding.t;
  if (binding.side === 'top') return { x: x + width * t, y: y - ARROW_GAP };
  if (binding.side === 'bottom') return { x: x + width * t, y: y + height + ARROW_GAP };
  if (binding.side === 'left') return { x: x - ARROW_GAP, y: y + height * t };
  return { x: x + width + ARROW_GAP, y: y + height * t };
}
export function resolvePoint(point, objects) {
  return point.binding ? boundPoint(point.binding, objects) ?? point : point;
}
export function snapArrow(point, objects, scale) {
  let center = null, edge = null;
  for (const object of objects) for (const side of SIDES) {
    const binding = { objectId: object.id, side, t: .5 };
    const middle = boundPoint(binding, objects);
    const distance = Math.hypot(point.x - middle.x, point.y - middle.y) * scale;
    if (distance <= 20 && (!center || distance < center.distance)) center = { ...middle, binding: { ...binding }, distance };
    const horizontal = side === 'top' || side === 'bottom';
    binding.t = clamp((point[horizontal ? 'x' : 'y'] - object[horizontal ? 'x' : 'y']) / object[horizontal ? 'width' : 'height'], 0, 1);
    const projected = boundPoint(binding, objects);
    const edgeDistance = Math.hypot(point.x - projected.x, point.y - projected.y) * scale;
    if (edgeDistance <= 12 && (!edge || edgeDistance < edge.distance)) edge = { ...projected, binding: { ...binding }, distance: edgeDistance };
  }
  const result = center ?? edge;
  return result ? { x: result.x, y: result.y, binding: result.binding } : { x: point.x, y: point.y };
}
export function arrowGeometry(arrow, objects) {
  const start = resolvePoint(arrow.start, objects), end = resolvePoint(arrow.end, objects);
  const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
  const normal = length ? { x: -dy / length, y: dx / length } : { x: 0, y: 1 };
  const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const middle = { x: midpoint.x + normal.x * arrow.bend, y: midpoint.y + normal.y * arrow.bend };
  const h = Math.abs(arrow.bend);
  const radius = h ? length * length / (8 * h) + h / 2 : 0;
  const path = h > .01 && length > .01
    ? `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${h > length / 2 ? 1 : 0} ${arrow.bend > 0 ? 0 : 1} ${end.x} ${end.y}`
    : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  return { start, end, middle, midpoint, normal, length, path };
}
export function readArrows(value) {
  if (!Array.isArray(value)) return [];
  const number = n => Number.isFinite(n) && Math.abs(n) <= 40000;
  const point = p => p && number(p.x) && number(p.y) && (!p.binding || (typeof p.binding.objectId === 'string' && SIDES.includes(p.binding.side) && Number.isFinite(p.binding.t) && p.binding.t >= 0 && p.binding.t <= 1));
  const ids = new Set();
  return value.slice(0, 1000).filter(a => {
    if (!a || typeof a.id !== 'string' || a.id.length > 100 || ids.has(a.id) || !point(a.start) || !point(a.end) || !number(a.bend) || !['arrow', 'line'].includes(a.startStyle) || !['arrow', 'line'].includes(a.endStyle) || !Number.isFinite(a.width) || a.width < 1 || a.width > 16 || !['solid', 'dashed', 'dotted'].includes(a.pattern)) return false;
    ids.add(a.id);return true;
  }).map(a => ({ ...structuredClone(a), width: Math.max(2, Math.min(10, Math.round(a.width / 2) * 2)) }));
}
