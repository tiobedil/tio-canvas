const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

// Search the free vertical lanes beside fixed chrome, nearest the field first.
export function menuPosition({ anchor, width, height, viewport, margin, gap, obstacles, aboveOnly = false }) {
  const left = margin, right = viewport.width - margin;
  const top = margin, bottom = viewport.height - margin;
  width = Math.min(width, right - left);
  const idealX = anchor.left + (anchor.width - width) / 2;
  const xs = [idealX, left, right - width];
  for (const rect of obstacles) xs.push(rect.left - gap - width, rect.right + gap);
  let best;
  for (const x of new Set(xs.map(value => clamp(value, left, right - width)))) {
    let lanes = [[top, bottom]];
    for (const rect of obstacles) {
      if (x + width <= rect.left - gap || x >= rect.right + gap) continue;
      lanes = lanes.flatMap(([start, end]) => {
        if (rect.bottom + gap <= start || rect.top - gap >= end) return [[start, end]];
        return [[start, Math.min(end, rect.top - gap)], [Math.max(start, rect.bottom + gap), end]].filter(([a, b]) => b > a);
      });
    }
    for (const side of aboveOnly ? ['above'] : ['below', 'above']) {
      for (const [start, end] of lanes) {
        const min = side === 'below' ? Math.max(start, anchor.bottom + gap) : start;
        const max = side === 'above' ? Math.min(end, anchor.top - gap) : end;
        const available = max - min;
        if (available <= 0) continue;
        const h = Math.min(height, available);
        const y = side === 'below' ? min : max - h;
        const idealY = side === 'below' ? anchor.bottom + gap : anchor.top - gap - height;
        const score = (height - h) * 10000 + Math.abs(x - idealX) + Math.abs(y - idealY) + (side === 'above' && !aboveOnly ? 0.5 : 0);
        if (!best || score < best.score) best = { x, y, height: h, score };
      }
    }
  }
  return best;
}
