import { pixelRect, workspace } from './geometry.js';

// Group spacing changes positions only. Dimensions and stacking stay untouched.
export function groupSpacing(rectangles, extent = 20000, requestedAxis = null) {
  if (rectangles.length < 2) return null;
  const spread = axis => {
    const positions = rectangles.map(r => r[axis]);
    return Math.max(...positions) - Math.min(...positions);
  };
  const axis = requestedAxis ?? (spread('x') >= spread('y') ? 'x' : 'y');
  const size = axis === 'x' ? 'width' : 'height';
  const ordered = rectangles.map((rect, index) => ({ rect, index })).sort((a, b) => a.rect[axis] - b.rect[axis]);
  // Screens sharing an axis position form one band. Moving a grid's columns
  // must not turn every screen into a separate column (likewise for rows).
  const bands = [];
  for (const item of ordered) {
    let band = bands.at(-1);
    if (!band || band.position !== item.rect[axis]) {
      band = { position: item.rect[axis], size: 0, items: [] };
      bands.push(band);
    }
    band.size = Math.max(band.size, item.rect[size]);
    band.items.push(item);
  }
  if (bands.length < 2) return null;
  const gaps = bands.slice(1).map((band, i) => band.position - bands[i].position - bands[i].size);
  const gap = gaps.every(value => value === gaps[0]) ? gaps[0] : null;
  const total = bands.reduce((sum, band) => sum + band.size, 0);
  const max = Math.floor((workspace(extent)[size] - ordered[0].rect[axis] - total) / (bands.length - 1));
  return { axis, size, ordered, bands, gap, max };
}

export function spaceGroup(rectangles, value, extent = 20000, requestedAxis = null) {
  rectangles = rectangles.map(pixelRect);
  const spacing = groupSpacing(rectangles, extent, requestedAxis);
  if (!spacing || !Number.isFinite(value) || value < 0 || spacing.max < 0) return null;
  const gap = Math.min(Math.round(value), spacing.max);
  let position = spacing.ordered[0].rect[spacing.axis];
  const result = rectangles.map(rect => ({ ...rect }));
  for (const band of spacing.bands) {
    for (const { index } of band.items) result[index][spacing.axis] = position;
    position += band.size + gap;
  }
  return result;
}
