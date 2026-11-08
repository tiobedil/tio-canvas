import assert from 'node:assert/strict';
import { arrangeScreens, arrangeShortcut } from '../../client/arrange.js';
const screens = [
  {id:'a',x:100,y:100,width:100,height:100},
  {id:'b',x:340,y:380,width:200,height:200},
  {id:'c',x:900,y:900,width:300,height:300},
];
const original=structuredClone(screens);
for(const [action,axis,expected] of [
  ['left','x',[100,100,100]],['horizontal-center','x',[600,550,500]],['right','x',[1100,1000,900]],
  ['top','y',[100,100,100]],['vertical-center','y',[600,550,500]],['bottom','y',[1100,1000,900]],
  ['distribute-x','x',[100,450,900]],['distribute-y','y',[100,450,900]],
]){
  const result=arrangeScreens(screens,action);
  assert.deepEqual(result.map(r=>r[axis]),expected,action);
  const other=axis==='x'?'y':'x';
  assert.deepEqual(result.map(r=>[r.id,r.width,r.height,r[other]]),screens.map(r=>[r.id,r.width,r.height,r[other]]),'Only positions on the requested axis change');
}
assert.deepEqual(screens,original,'Input models are never mutated');
assert.equal(arrangeScreens(screens.slice(0,1),'left'),null);
assert.equal(arrangeScreens(screens.slice(0,2),'distribute-x'),null,'Two bands have no intermediate gap to redistribute');
assert.equal(arrangeScreens(screens,'tidy-up'),null);
assert.equal(arrangeScreens(screens,'__proto__'),null);
const grid=[...screens,...screens.map(r=>({...r,id:r.id+'2',y:r.y+2000}))];
assert.deepEqual(arrangeScreens(grid,'distribute-x').map(r=>r.x),[100,450,900,100,450,900],'Distribution preserves shared grid columns');
const fractional=arrangeScreens([{x:0,y:0,width:100,height:100},{x:110,y:0,width:100,height:100},{x:225,y:0,width:100,height:100},{x:333,y:0,width:100,height:100}],'distribute-x');
assert.deepEqual(fractional.map(r=>r.x),[0,111,222,333]);
const overlap=arrangeScreens([{x:10,y:10,width:100,height:100},{x:20,y:20,width:100,height:100},{x:50,y:50,width:100,height:100}],'distribute-x');
assert.deepEqual(overlap.map(r=>r.x),[10,30,50],'Overlapping selections can have equal negative gaps');
for(const [code,action] of Object.entries({KeyA:'left',KeyH:'horizontal-center',KeyD:'right',KeyW:'top',KeyV:'vertical-center',KeyS:'bottom'}))assert.equal(arrangeShortcut({code,key:'å',altKey:true}),action,'Use physical keys for Option-modified letters');
assert.equal(arrangeShortcut({code:'KeyH',altKey:true,ctrlKey:true}),'distribute-x');
assert.equal(arrangeShortcut({code:'KeyV',altKey:true,ctrlKey:true}),'distribute-y');
for(const modifiers of [{},{metaKey:true,altKey:true},{shiftKey:true,altKey:true},{ctrlKey:true,altKey:true}])assert.equal(arrangeShortcut({code:'KeyA',...modifiers}),null);
assert.equal(arrangeShortcut({code:'KeyT',ctrlKey:true,altKey:true}),null,'Tidy up is not implemented');
console.log('PASS canvas arrange: six alignments, equal spacing, grids, fractional pixels, overlap, stable models and Option shortcuts');
