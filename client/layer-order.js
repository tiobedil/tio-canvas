// Layer order is bottom-to-top; the drawer displays that order in reverse.
export function layerShortcut(event){
  if(!event.metaKey || event.altKey)return null;
  const left=event.code==='BracketLeft' || ['[','{'].includes(event.key);
  const right=event.code==='BracketRight' || [']','}'].includes(event.key);
  return left?(event.shiftKey?'bottom':'below'):right?(event.shiftKey?'top':'above'):null;
}
export function reorderLayers(items,ids,action){
  const chosen=new Set(ids),result=[...items];
  if(action==='top')return [...items.filter(i=>!chosen.has(i)),...items.filter(i=>chosen.has(i))];
  if(action==='bottom')return [...items.filter(i=>chosen.has(i)),...items.filter(i=>!chosen.has(i))];
  if(action==='above')for(let i=result.length-2;i>=0;i--)if(chosen.has(result[i])&&!chosen.has(result[i+1]))[result[i],result[i+1]]=[result[i+1],result[i]];
  if(action==='below')for(let i=1;i<result.length;i++)if(chosen.has(result[i])&&!chosen.has(result[i-1]))[result[i],result[i-1]]=[result[i-1],result[i]];
  return result;
}
export function dropLayers(items,ids,target,before){
  const chosen=new Set(ids);if(chosen.has(target) || !items.includes(target))return [...items];
  const rest=items.filter(i=>!chosen.has(i)),index=rest.indexOf(target)+(before?1:0);
  rest.splice(index,0,...items.filter(i=>chosen.has(i)));return rest;
}
