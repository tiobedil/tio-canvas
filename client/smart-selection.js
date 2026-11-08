import { pixelRect, workspace } from './geometry.js';

// Capture spatial slots, not layer order. Only non-overlapping rows, columns,
// and complete aligned grids have an unambiguous order to rearrange.
export function smartLayout(rectangles) {
  if (rectangles.length < 2) return null;
  const models = rectangles.map(pixelRect), rows = [];
  const ordered = models.map((rect, index) => ({ rect, index })).sort((a,b) => a.rect.y-b.rect.y || a.rect.x-b.rect.x);
  for (const item of ordered) {
    let row = rows.at(-1);
    if (!row || row.y !== item.rect.y) { row = { y:item.rect.y, items:[] }; rows.push(row); }
    row.items.push(item);
  }
  const columns = rows[0].items.length;
  // Every row is full, except that the last may stop short (three screens in a two-by-two).
  if (rows.some((row, i) => i < rows.length-1 ? row.items.length !== columns : row.items.length > columns)) return null;
  const xs = rows[0].items.map(item => item.rect.x);
  if (rows.some(row => row.items.some((item, i) => item.rect.x !== xs[i]))) return null;
  const widths = xs.map((_, i) => Math.max(...rows.filter(row => row.items[i]).map(row => row.items[i].rect.width)));
  const heights = rows.map(row => Math.max(...row.items.map(item => item.rect.height)));
  const gapsX = xs.slice(1).map((x,i) => x-xs[i]-widths[i]);
  const gapsY = rows.slice(1).map((row,i) => row.y-rows[i].y-heights[i]);
  if ([...gapsX,...gapsY].some(gap => gap < 0)) return null;
  return { models, columns, rows:rows.length, x:xs[0], y:rows[0].y, gapsX, gapsY, order:ordered.map(item => item.index) };
}

// Insert shifts intervening screens.
// Repack with the captured gaps and each screen's own dimensions.
export function reorderSmartLayout(layout, source, target, extent = 20000) {
  if (!layout || !Number.isInteger(source) || !Number.isInteger(target) || source < 0 || target < 0 || source >= layout.order.length || target >= layout.order.length) return null;
  const order = [...layout.order];
  order.splice(target,0,order.splice(source,1)[0]);
  const widths = Array.from({length:layout.columns},(_,col) => Math.max(...Array.from({length:layout.rows},(_,row) => order[row*layout.columns+col]).filter(i => i !== undefined).map(i => layout.models[i].width)));
  const heights = Array.from({length:layout.rows},(_,row) => Math.max(...order.slice(row*layout.columns,(row+1)*layout.columns).map(i => layout.models[i].height)));
  const xs = [layout.x], ys = [layout.y];
  for (let col=1;col<layout.columns;col++) xs.push(xs[col-1]+widths[col-1]+layout.gapsX[col-1]);
  for (let row=1;row<layout.rows;row++) ys.push(ys[row-1]+heights[row-1]+layout.gapsY[row-1]);
  const result = layout.models.map(rect => ({...rect}));
  order.forEach((index,slot) => Object.assign(result[index],{x:xs[slot%layout.columns],y:ys[Math.floor(slot/layout.columns)]}));
  const space = workspace(extent);
  if (result.some(rect => rect.x<0 || rect.y<0 || rect.x+rect.width>space.width || rect.y+rect.height>space.height)) return null;
  return result;
}

export function nearestSmartSlot(layout, x, y) {
  let nearest = 0, distance = Infinity;
  layout.order.forEach((index,slot) => {
    const rect = layout.models[index], next = Math.hypot(x-rect.x-rect.width/2,y-rect.y-rect.height/2);
    if (next < distance) { nearest = slot; distance = next; }
  });
  return nearest;
}
