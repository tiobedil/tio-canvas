// Pure canvas geometry, in world coordinates. Tolerance is supplied in world
// units so the magnetic distance remains constant on the visitor's screen.
// Quantize document geometry, never the screen-space camera or pointer input.
export function pixelRect(rect) {
  return { ...rect, ...Object.fromEntries(['x','y','width','height'].map(axis => [axis, Math.round(rect[axis])])) };
}
export const intersects = (a, b) => a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
export function bounds(rectangles) {
  const x = Math.min(...rectangles.map(r => r.x)), y = Math.min(...rectangles.map(r => r.y));
  return { x, y, width: Math.max(...rectangles.map(r => r.x + r.width)) - x, height: Math.max(...rectangles.map(r => r.y + r.height)) - y };
}
export function snapRect(moving, others, tolerance) {
  const result = { x: moving.x, y: moving.y, guides: [] };
  for (const [axis, size, cross, crossSize] of [['x','width','y','height'],['y','height','x','width']]) {
    let best = tolerance + Number.EPSILON, match = null;
    const offer = (value, guide) => {
      const distance = Math.abs(value - moving[axis]);
      if (distance <= tolerance && distance < best) { best = distance; match = { value, guide }; }
    };
    for (const other of others) {
      for (const anchor of [0,.5,1]) for (const target of [0,.5,1]) {
        const line = other[axis] + other[size] * target;
        offer(line - moving[size] * anchor, { axis, value: line, from: Math.min(moving[cross], other[cross]), to: Math.max(moving[cross]+moving[crossSize], other[cross]+other[crossSize]), kind:'align' });
      }
    }
    // Derive spacing from adjacent frames in the same row/column, not from a
    // fixed grid. Offer that same gap beside any member of the row/column.
    const row = others.filter(r => moving[cross] < r[cross]+r[crossSize] && moving[cross]+moving[crossSize] > r[cross]).sort((a,b)=>a[axis]-b[axis]);
    for (let i=1;i<row.length;i++) {
      const gap = row[i][axis] - row[i-1][axis] - row[i-1][size];
      if (gap <= 0) continue;
      for (const other of row) {
        for (const before of [false,true]) {
          const value = before ? other[axis]-gap-moving[size] : other[axis]+other[size]+gap;
          const from = before ? value+moving[size] : other[axis]+other[size];
          offer(value, { axis:cross, value:moving[cross]+moving[crossSize]/2, from, to:from+gap, kind:'gap', gap, references:[{axis:cross,value:row[i-1][cross]+row[i-1][crossSize]/2,from:row[i-1][axis]+row[i-1][size],to:row[i][axis],kind:'gap',gap,reference:true}] });
        }
      }
      // Equal spacing when inserting between two existing frames.
      const available = row[i][axis] - row[i-1][axis] - row[i-1][size] - moving[size];
      if (available >= 0) {
        const value = row[i-1][axis]+row[i-1][size]+available/2;
        offer(value, {axis:cross,value:moving[cross]+moving[crossSize]/2,from:row[i-1][axis]+row[i-1][size],to:value,kind:'gap',gap:available/2,
          references:[{axis:cross,value:moving[cross]+moving[crossSize]/2,from:value+moving[size],to:row[i][axis],kind:'gap',gap:available/2,reference:true}]});
      }
    }
    if (match) { result[axis] = match.value; result.guides.push(match.guide,...(match.guide.references??[])); }
  }
  return result;
}

// Keep appending to the current row until its right edge is full. Then search
// free rows below, followed by earlier rows, without enlarging the workspace.
// A workspace is a number (square) or { width, height }.
export const workspace = extent => typeof extent === 'number' ? { width: extent, height: extent } : extent;
export function duplicateOffset(box, others, extent, gap=80) {
  const space=workspace(extent);
  const fits=(x,y)=>x>=0 && y>=0 && x+box.width<=space.width && y+box.height<=space.height && !others.some(r=>intersects({x:x-gap,y:y-gap,width:box.width+2*gap,height:box.height+2*gap},r));
  const right=others.reduce((edge,r)=>r.y<box.y+box.height && r.y+r.height>box.y?Math.max(edge,r.x+r.width):edge,box.x+box.width);
  if(fits(right+gap,box.y))return{x:right+gap-box.x,y:0};
  const rows=[...new Set([0,...others.map(r=>r.y+r.height+gap)])].sort((a,b)=>a-b);
  const columns=[...new Set([Math.min(box.x,...others.map(r=>r.x)),...others.map(r=>r.x+r.width+gap).sort((a,b)=>a-b),0])];
  for(const y of [...rows.filter(y=>y>=box.y+box.height+gap),...rows.filter(y=>y<box.y+box.height+gap)])for(const x of columns)if(fits(x,y))return{x:x-box.x,y:y-box.y};
  return null;
}

// Add pages has its own placement rule; duplication keeps its row wrapping.
// Plan the whole batch first so a workspace boundary never leaves a partial add.
export function addedPagePositions(pages, others, extent, gap=100) {
  const space=workspace(extent),occupied=[...others],positions=[];
  for(const page of pages){
    const rightmost=occupied.reduce((right,item)=>!right || item.x+item.width>right.x+right.width?item:right,null);
    const x=rightmost?rightmost.x+rightmost.width+gap:Math.round((space.width-page.width)/2);
    const y=rightmost?rightmost.y:Math.round((space.height-page.height)/2);
    if(x<0 || y<0 || x+page.width>space.width || y+page.height>space.height)return null;
    positions.push({x,y});occupied.push({...page,x,y});
  }
  return positions;
}
