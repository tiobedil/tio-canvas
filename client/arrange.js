import { bounds, pixelRect } from './geometry.js';
import { groupSpacing } from './spacing.js';

const alignments = {
  left: ['x', 'width', 0], 'horizontal-center': ['x', 'width', .5], right: ['x', 'width', 1],
  top: ['y', 'height', 0], 'vertical-center': ['y', 'height', .5], bottom: ['y', 'height', 1],
};
const alignmentKeys = { KeyA: 'left', KeyH: 'horizontal-center', KeyD: 'right', KeyW: 'top', KeyV: 'vertical-center', KeyS: 'bottom' };

export function arrangeShortcut(event) {
  if (!event.altKey || event.metaKey || event.shiftKey) return null;
  // Option changes event.key on macOS; physical codes keep these shortcuts usable.
  if (event.ctrlKey) return event.code === 'KeyH' ? 'distribute-x' : event.code === 'KeyV' ? 'distribute-y' : null;
  return Object.hasOwn(alignmentKeys, event.code) ? alignmentKeys[event.code] : null;
}

// Arrange within the selection's existing bounds, never resize or reorder screens.
// Distribution shares the gap fields' bands, so grid columns/rows stay together.
export function arrangeScreens(rectangles, action) {
  if (rectangles.length < 2) return null;
  const result = rectangles.map(pixelRect), box = bounds(result);
  const alignment = Object.hasOwn(alignments, action) ? alignments[action] : null;
  if (alignment) {
    const [axis, size, anchor] = alignment;
    for (const rect of result) rect[axis] = Math.round(box[axis] + (box[size] - rect[size]) * anchor);
    return result;
  }
  const axis = action === 'distribute-x' ? 'x' : action === 'distribute-y' ? 'y' : null;
  if (!axis) return null;
  const spacing = groupSpacing(result, { width: 20000, height: 11250 }, axis);
  if (!spacing || spacing.bands.length < 3) return null;
  const total = spacing.bands.reduce((sum, band) => sum + band.size, 0);
  const gap = (box[spacing.size] - total) / (spacing.bands.length - 1);
  let position = box[axis];
  for (const band of spacing.bands) {
    // Rounding cumulative positions spreads fractional pixels instead of drifting.
    for (const { index } of band.items) result[index][axis] = Math.round(Math.max(box[axis], Math.min(position, box[axis] + box[spacing.size] - band.size)));
    position += band.size + gap;
  }
  return result;
}
