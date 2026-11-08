import './tooltip.js';
import './shortcuts.js';
import {renderChangelog} from './changelog.js';
import {renderInstallGuide} from './install-guide.js';
import './device-gate.js';
import './onboarding.js';
import { setupSelectFields, closeSelectMenus, positionSelectMenus } from './select-field.js';
import { smartLayout, reorderSmartLayout, nearestSmartSlot } from './smart-selection.js';
import { createSmartHandles } from './smart-handles.js';
import { arrangeScreens, arrangeShortcut } from './arrange.js';
import { createPagePicker } from './page-picker.js';
import { groupSpacing, spaceGroup } from './spacing.js';
import { createFullscreen } from './fullscreen.js';
import { createLayerDrawer } from './layers.js';
import { layerShortcut, reorderLayers, dropLayers } from './layer-order.js';
import { createScreenLoader } from './screen-loader.js';
import { screens, presets, screenKinds, storageKey } from './screens.js';
import { bounds, intersects, snapRect, duplicateOffset, addedPagePositions, pixelRect } from './geometry.js';
import { createHistory, historyShortcut } from './history.js';
import { createArrows } from './arrows.js';
import { createTexts } from './text.js';

const $ = selector => document.querySelector(selector);
const viewport = $('#viewport'), world = $('#world'), selection = $('#selection');
const key = storageKey, extent = { width: 20000, height: 11250 }, MIN_ZOOM_FLOOR = .01;
// Zoom out stops where the whole workspace fills the viewport.
const minScale = () => Math.max(MIN_ZOOM_FLOOR, Math.min(innerWidth / extent.width, innerHeight / extent.height));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const finite = (n, fallback, min, max) => Number.isFinite(n) ? clamp(n, min, max) : fallback;
let saved = {};
try { const raw = localStorage.getItem(key); if (raw?.length < 1000000) { const value = JSON.parse(raw); if (value.version === 1) saved = value; } } catch {}
const initialInset=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--canvas-panel-inset'));
const initialX=$('#layers').getBoundingClientRect().right+initialInset-(screens[0]?.x??0)*.8;
const camera = { x: finite(saved.camera?.x, initialX, -extent.width * 2, extent.width), y: finite(saved.camera?.y, 60, -extent.height * 2, extent.height), scale: finite(saved.camera?.scale, .8, MIN_ZOOM_FLOOR, 2) };
let objectOrder=Array.isArray(saved.objectOrder)?saved.objectOrder.filter(id=>typeof id==='string'):[],objectRanks=new Map();
let selected = null, gesture = null, frameRequest = 0, saveTimer, pendingMove = null;
let cachedWorkArea = null, cameraMotion = null, arrowTool, textTool;
const selectedEntries = new Set();
const groupGrab = document.createElement('div');groupGrab.id='group-grab';groupGrab.hidden=true;selection.prepend(groupGrab);
const marquee = document.createElement('div');marquee.id='marquee';marquee.hidden=true;viewport.append(marquee);
const guides = document.createElement('div');guides.id='guides';viewport.append(guides);
const smartHandles=createSmartHandles({selection,viewport,onDrag:startReorder});
// A host overlay paints above every iframe layer, including native popovers.
const contact=document.createElement('div');contact.id='canvas-contact';contact.hidden=true;contact.setAttribute('aria-hidden','true');document.body.append(contact);
let contactState=null;
// A screen's theme is its own: it sets the frame's colour scheme, which is what the page inside sees as prefers-color-scheme. It is not saved.
function applyScreenTheme(entry){if(entry.iframe)entry.iframe.style.colorScheme=entry.dark?'dark':'light';}
function clearContact(){contactState=null;contact.hidden=true;}
window.addEventListener('pointermove',clearContact);
function renderContact(){
  const state=contactState,entry=state?.entry;
  if(document.body.dataset.gesture || document.body.hasAttribute('data-space') || !entry || !entries.includes(entry) || !entry.visible || !presets[entry.model.preset].touch || state.x<0 || state.y<0 || state.x>entry.model.width || state.y>entry.model.height){contact.hidden=true;return;}
  contact.hidden=false;contact.style.setProperty('--contact-scale',camera.scale);
  contact.style.transform=`translate(${camera.x+(entry.model.x+state.x)*camera.scale}px,${camera.y+(entry.model.y+state.y)*camera.scale}px) translate(-50%,-50%)`;
}
function createEntry(definition, loadSaved = true) {
  const value = loadSaved ? saved.screens?.[definition.id] : null;
  const preset = Object.hasOwn(presets, value?.preset) ? value.preset : definition.preset;
  const model = { ...definition, preset, x: finite(value?.x, definition.x, 0, extent.width - 3840), y: finite(value?.y, definition.y, 0, extent.height - 3840), width: finite(value?.width, definition.width, 160, 3840), height: finite(value?.height, definition.height, 160, 3840) };
  if (preset !== 'custom') {
    const size = presets[preset];
    const rotated = ['phone','tablet'].includes(size.device) && value?.width === size.height && value?.height === size.width;
    Object.assign(model, { width: rotated ? size.height : size.width, height: rotated ? size.width : size.height });
  }
  Object.assign(model,pixelRect(model));
  model.x = Math.round(finite(value?.x, model.x, 0, extent.width-model.width));
  model.y = Math.round(finite(value?.y, model.y, 0, extent.height-model.height));
  if (typeof value?.name === 'string' && value.name.trim()) {model.name=value.name.trim().slice(0,200);model.title=model.name;}
  const element = document.createElement('section'); element.className = 'screen'; element.dataset.id = model.id;
  const title = document.createElement('button'); title.className = 'screen-title'; title.textContent = model.title; title.setAttribute('aria-label', `Select or move ${model.title}`);
  const refresh=document.createElement('button');refresh.className='screen-refresh';refresh.type='button';
  refresh.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 7a6.5 6.5 0 1 0 .3 5M16 3v4h-4"/></svg>';
  refresh.setAttribute('aria-label',`Refresh ${model.title}`);refresh.title=`Refresh ${model.title}`;
  const theme=document.createElement('button');theme.className='screen-theme';theme.type='button';
  theme.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 0 1 0 14Z" style="fill:currentColor;stroke:none"/></svg>';
  theme.setAttribute('aria-label',`Toggle dark mode for ${model.title}`);theme.title='Toggle screen theme';theme.setAttribute('aria-pressed','false');
  const more=document.createElement('button');more.className='screen-more';more.type='button';
  more.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4.5" cy="10" r="1" style="fill:currentColor;stroke:none"/><circle cx="10" cy="10" r="1" style="fill:currentColor;stroke:none"/><circle cx="15.5" cy="10" r="1" style="fill:currentColor;stroke:none"/></svg>';
  more.setAttribute('aria-label',`More actions for ${model.title}`);more.title='More';
  const fullscreen=document.createElement('button');fullscreen.className='screen-fullscreen';fullscreen.type='button';
  fullscreen.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4"/></svg>';
  fullscreen.setAttribute('aria-label',`Open ${model.title} fullscreen`);fullscreen.title='Open fullscreen';
  const orientation=document.createElement('button');orientation.className='screen-orientation';orientation.type='button';
  orientation.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="2" width="10" height="16" rx="2"/></svg>';
  element.append(title,orientation,theme,refresh,fullscreen,more); world.append(element);
  const entry = { model, element, title, orientation, theme, more, refresh, fullscreen, iframe: null, visible: false };
  orientation.addEventListener('click',()=>{
    stop();const before=history.checkpoint();
    [model.width,model.height]=[model.height,model.width];
    model.x=clamp(model.x,0,extent.width-model.width);model.y=clamp(model.y,0,extent.height-model.height);
    updateSelection();schedule();commitEdit(before);
  });
  fullscreen.addEventListener('click',()=>preview.enter(entry));
  // When the icon row is wider than the screen it folds into one ... button and opens while the pointer is on it.
  const actions=[orientation,theme,refresh,fullscreen,more];
  const expand=open=>element.toggleAttribute('data-expanded',open);
  more.addEventListener('pointerenter',()=>expand(true));more.addEventListener('click',()=>expand(true));
  for(const b of actions)b.addEventListener('pointerleave',event=>{if(!actions.includes(event.relatedTarget))expand(false);});
  theme.addEventListener('click',()=>{
    entry.dark=!entry.dark;theme.setAttribute('aria-pressed',String(entry.dark));
    applyScreenTheme(entry);
  });
  title.title = model.title;
  refresh.addEventListener('click',()=>{
    stop();
    mount(entry,!!entry.iframe);
  });
  title.addEventListener('pointerdown', event => {
    if (title.isContentEditable || event.button !== 0 || document.body.hasAttribute('data-space')) return;
    const toggleAfterClick=event.shiftKey && selectedEntries.has(entry);
    if (event.shiftKey && !toggleAfterClick) select(entry, true);
    else if (!event.shiftKey && !selectedEntries.has(entry)) select(entry);
    if (selectedEntries.has(entry)){start('move', event, entry);if(toggleAfterClick)gesture.shiftToggle=entry;}
  });
  title.addEventListener('click', event => { if (!title.isContentEditable && event.detail === 0) select(entry, event.shiftKey); });
  title.addEventListener('dblclick',event=>{event.preventDefault();beginRename(entry);});
  return entry;
}
// A first visit (nothing saved on this device) opens an empty canvas; pages are
// added from the picker. Saved state lives in this browser's localStorage only.
const entries = saved.version===1 ? screens.map(definition=>createEntry(definition)) : [];
// Restore instances only from known local sources, never a stored URL.
// The first screen of a page carries no number; copies count up from (1). When the
// original was removed, the lowest saved copy stands in as that first screen.
const titleFor = (source, number) => number > 0 ? `${source.title} (${number})` : source.title;
const firstCopy = new Map();
const hasFirst = new Set((saved.instances ?? []).filter(instance => instance?.number === 0).map(instance => instance.sourceId));
if (Array.isArray(saved.instances) && Array.isArray(saved.removedSources)) for (const instance of saved.instances.slice(0, 200)) {
  if (!saved.removedSources.includes(instance?.sourceId) || hasFirst.has(instance.sourceId) || !Number.isInteger(instance.number) || instance.number < 1) continue;
  const lowest = firstCopy.get(instance.sourceId);
  if (!lowest || instance.number < lowest.number) firstCopy.set(instance.sourceId, instance);
}
if (Array.isArray(saved.instances)) for (const instance of saved.instances.slice(0, 200)) {
  const source = screens.find(screen => screen.id === instance?.sourceId);
  if (!source || typeof instance.id !== 'string' || instance.id.length > 100 || entries.some(entry => entry.model.id === instance.id) || !Number.isInteger(instance.number) || instance.number < 0 || instance.number > 100000) continue;
  const number = firstCopy.get(source.id) === instance ? 0 : instance.number;
  entries.push(createEntry({ ...source, id: instance.id, sourceId: source.id, number, title: titleFor(source, number) }));
}
if (Array.isArray(saved.removedSources)) for (const id of saved.removedSources) {
  const index = entries.findIndex(entry => entry.model.id === id && !entry.model.sourceId);
  if (index >= 0) entries.splice(index,1)[0].element.remove();
}
if(Array.isArray(saved.order)){
  const order=new Map(saved.order.filter(id=>typeof id==='string').map((id,index)=>[id,index]));
  entries.sort((a,b)=>(order.get(a.model.id)??Infinity)-(order.get(b.model.id)??Infinity));
}
let layersCollapsed=saved.layersCollapsed===true;
const drawer=createLayerDrawer({root:$('#layers'),presets,collapsed:layersCollapsed,
  onSelect(id,shift){
    if(isTextLayer(id)){
      const model=textTool?.objects().find(t=>t.id===textLayerId(id));if(!model)return;
      selectLayers(shift?[...currentLayerSelection(),id]:[id]);
      if(!shift){const x=camera.x+model.x*camera.scale,y=camera.y+model.y*camera.scale;if(x+model.width*camera.scale<=0||y+model.height*camera.scale<=0||x>=innerWidth||y>=innerHeight)fitEntries([{model}]);}
      return;
    }
    const entry=entries.find(e=>e.model.id===id);if(!entry)return;
    if(shift)selectLayers([...currentLayerSelection(),id]);else select(entry,false);
    if(!shift && !entry.visible)fitEntries([entry]);
  },
  onSelectMany:selectLayers,
  onDrop(ids,target,before){applyLayerOrder(dropLayers(objectOrder,ids.map(layerKey),layerKey(target),before));},
  onRename(id,label){const entry=entries.find(e=>e.model.id===id);if(entry)beginRename(entry,label);},
  onCollapse(value){cameraMotion=null;layersCollapsed=value;cachedWorkArea=null;schedule();persist();}
});
function syncObjectOrder(){
  const ids=[...entries.map(e=>`screen:${e.model.id}`),...(arrowTool?.ids??[]).map(id=>`arrow:${id}`),...(textTool?.ids??[]).map(id=>`text:${id}`)],wanted=new Set(ids);
  objectOrder=[...new Set(objectOrder.filter(id=>wanted.has(id)))];
  const existing=new Set(objectOrder);
  for(const id of ids)if(!existing.has(id)){objectOrder.push(id);existing.add(id);}
  objectRanks=new Map(objectOrder.map((id,index)=>[id,index+1]));
}
// The Layers drawer lists screens and texts. A screen's layer id is its model id; a text's is "text:" and its id.
const isTextLayer=id=>id.startsWith('text:'),textLayerId=id=>id.slice(5),layerKey=id=>isTextLayer(id)?id:`screen:${id}`;
const currentLayerSelection=()=>[...[...selectedEntries].map(entry=>entry.model.id),...(textTool?.selectedIds??[]).map(id=>`text:${id}`)];
function selectLayers(ids){
  const wanted=new Set(ids);
  selectedEntries.clear();for(const entry of entries)if(wanted.has(entry.model.id))selectedEntries.add(entry);
  arrowTool?.clearSelection();
  textTool?.selectRect(null,ids.filter(isTextLayer).map(textLayerId));
  updateSelection(true);
}
// A text layer is named by its content on one line; a text with no content reads "Text".
const textTitles=new Map(),titleBox=document.createElement('template');
function textTitle(html){
  let title=textTitles.get(html);
  if(title===undefined){
    titleBox.innerHTML=html.replace(/<br\s*\/?>|<\/(?:div|p)>/gi,' ');
    title=titleBox.content.textContent.replace(/\s+/g,' ').trim().slice(0,200)||'Text';
    if(textTitles.size>500)textTitles.clear();
    textTitles.set(html,title);
  }
  return title;
}
let layerSignature='';
function syncLayers(force=false){
  const byScreen=new Map(entries.map(entry=>[`screen:${entry.model.id}`,entry.model])),byText=new Map((textTool?.layers()??[]).map(text=>[`text:${text.id}`,text]));
  const items=[];
  for(const key of objectOrder){
    const model=byScreen.get(key);
    if(model)items.push({id:model.id,kind:'screen',title:model.title,preset:model.preset});
    else if(byText.has(key))items.push({id:key,kind:'text',title:textTitle(byText.get(key).html)});
  }
  const selection=currentLayerSelection(),signature=JSON.stringify([items,selection]);
  if(!force && signature===layerSignature)return;
  layerSignature=signature;drawer.update(items,selection);
}
function applyLayerOrder(next){
  if(next.every((id,index)=>id===objectOrder[index]))return;
  stop();const before=history.checkpoint();objectOrder=next;syncObjectOrder();
  entries.sort((a,b)=>objectRanks.get(`screen:${a.model.id}`)-objectRanks.get(`screen:${b.model.id}`));
  updateSelection(true);commitEdit(before);
}
function moveLayers(action){
  stop();const before=history.checkpoint();
  const chosen=[...[...selectedEntries].map(e=>`screen:${e.model.id}`),...(arrowTool?.selectedIds??[]).map(id=>`arrow:${id}`),...(textTool?.selectedIds??[]).map(id=>`text:${id}`)];
  objectOrder=reorderLayers(objectOrder,chosen,action);syncObjectOrder();
  entries.sort((a,b)=>objectRanks.get(`screen:${a.model.id}`)-objectRanks.get(`screen:${b.model.id}`));
  syncLayers(true);schedule();commitEdit(before);
}
function arrangeSelection(action){
  const models=[...[...selectedEntries].map(entry=>entry.model),...(textTool?.selectedModels()??[])];
  if(models.length<2)return;
  stop();const next=arrangeScreens(models.map(m=>({x:m.x,y:m.y,width:m.width,height:m.height})),action);
  if(!next)return;
  const before=history.checkpoint();
  models.forEach((model,index)=>{model.x=next[index].x;model.y=next[index].y;});
  updateSelection(true);commitEdit(before);
}

function captureDocument() {
  syncObjectOrder();
  return {objectOrder:[...objectOrder],arrows:arrowTool?.capture()??[],arrowSelection:arrowTool?.selectedIds??[],texts:textTool?.capture()??[],textSelection:textTool?.selectedIds??[],models:entries.map(entry=>({...entry.model})),selection:[...selectedEntries].map(entry=>entry.model.id),sources:screens.map(source=>source.id)};
}
function restoreDocument(snapshot) {
  const wanted = new Set(snapshot.models.map(model=>model.id));
  // A newly registered source is outside the history of older edits.
  for (const entry of [...entries]) if(snapshot.sources.includes(sourceOf(entry)) && !wanted.has(entry.model.id)) {
    loader.dispose(entry);entry.element.remove();entries.splice(entries.indexOf(entry),1);
  }
  for (const model of snapshot.models) {
    let entry=entries.find(item=>item.model.id===model.id);
    if(entry){entry.model=pixelRect(model);syncTitle(entry);}
    else {entry=createEntry({...model},false);entries.push(entry);}
  }
  const order=new Map(snapshot.models.map((m,i)=>[m.id,i]));
  entries.sort((a,b)=>(order.get(a.model.id)??Infinity)-(order.get(b.model.id)??Infinity));
  selectedEntries.clear();
  for(const entry of entries)if(snapshot.selection.includes(entry.model.id))selectedEntries.add(entry);
  updateSelection();arrowTool?.restore(snapshot.arrows,snapshot.arrowSelection);textTool?.restore(snapshot.texts??[],snapshot.textSelection);objectOrder=[...(snapshot.objectOrder??[])];syncObjectOrder();persist();
}
const history=createHistory(captureDocument,restoreDocument);
function updateHistory() {
  $('#undo').disabled=!history.canUndo;$('#redo').disabled=!history.canRedo;
}
function commitEdit(before) {history.commit(before);updateHistory();persist();}
function runHistory(direction) {arrowTool?.cancel();textTool?.cancel();stop();history[direction]();updateHistory();}
function syncTitle(entry) {
  entry.title.textContent=entry.model.title;entry.title.title=entry.model.title;
  entry.title.setAttribute('aria-label',`Select or move ${entry.model.title}`);
  entry.fullscreen.setAttribute('aria-label',`Open ${entry.model.title} fullscreen`);
  entry.refresh.setAttribute('aria-label',`Refresh ${entry.model.title}`);entry.refresh.title=`Refresh ${entry.model.title}`;
  if(entry.iframe)entry.iframe.title=entry.model.title;
}
function beginRename(entry, title=entry.title) {
  if(title.isContentEditable)return;
  stop();select(entry);
  const before=history.checkpoint();
  title.contentEditable='plaintext-only';title.spellcheck=false;title.setAttribute('role','textbox');title.setAttribute('aria-label','Screen name');
  title.focus();
  const range=document.createRange();range.selectNodeContents(title);
  const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
  let cancelled=false;
  const onKey=event=>{
    if(event.key==='Enter'){event.preventDefault();title.blur();}
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelled=true;title.blur();}
  };
  title.addEventListener('keydown',onKey);
  title.addEventListener('blur',()=>{
    const value=title.textContent.trim().slice(0,200);
    title.removeAttribute('contenteditable');title.removeAttribute('role');title.removeAttribute('aria-label');title.removeEventListener('keydown',onKey);
    if(!cancelled){
      const source=screens.find(source=>source.id===sourceOf(entry));
      const next=value||source.title;
      if(next!==entry.model.title){entry.model.name=next;entry.model.title=next;}
    }
    syncTitle(entry);syncLayers(true);if(!cancelled)commitEdit(before);
  },{once:true});
}
function save() {
    syncObjectOrder();
    try { localStorage.setItem(key, JSON.stringify({ version: 1, camera, objectOrder, arrows:arrowTool?.capture()??[], texts:textTool?.capture()??[], order:entries.map(e=>e.model.id),layersCollapsed, removedSources: screens.filter(source => !entries.some(entry => entry.model.id === source.id)).map(source => source.id), instances: entries.filter(entry => entry.model.sourceId).map(({model:m}) => ({id:m.id,sourceId:m.sourceId,number:m.number})), screens: Object.fromEntries(entries.map(({model:m}) => [m.id, { x:m.x,y:m.y,width:m.width,height:m.height,preset:m.preset,name:m.name }])) })); } catch {}
}
function persist() {
  clearTimeout(saveTimer); saveTimer = setTimeout(save, 150);
}
// A change made in the last 150ms would be lost if the tab closed now.
addEventListener('pagehide',()=>{if(saveTimer){clearTimeout(saveTimer);saveTimer=0;save();}});
function schedule() { if (!frameRequest) frameRequest = requestAnimationFrame(render); }
function workArea(){
  if(cachedWorkArea)return cachedWorkArea;
  const inset=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--canvas-panel-inset'));
  const left=layersCollapsed?0:Math.min($('#layers').getBoundingClientRect().right+inset,Math.max(0,innerWidth-160));
  return cachedWorkArea={left,width:innerWidth-left};
}
function flushMove() {
  const event=pendingMove;pendingMove=null;
  if(event)applyMove(event);
}
// While the camera moves, the browser scales one saved picture of the world, which is
// cheap but soft. Once it has been still for a moment, drop the layer hint for one frame
// so the text is drawn again at the final scale, then restore it. Costs nothing while moving.
let sharpenTimer = 0;
function sharpenWorldSoon() {
  clearTimeout(sharpenTimer);
  sharpenTimer = setTimeout(() => {
    if (cameraMotion || document.body.hasAttribute('data-fullscreen')) return;
    world.style.willChange = 'auto';
    requestAnimationFrame(() => requestAnimationFrame(() => { world.style.willChange = ''; }));
  }, 140);
}
function render(now) {
  if(cameraMotion){
    // Keep screen-space controls and iframe visibility in sync with every zoom frame.
    const {from,to,start,duration}=cameraMotion;
    const progress=matchMedia('(prefers-reduced-motion: reduce)').matches?1:clamp((now-start)/duration,0,1);
    const eased=1-(1-progress)**3;
    for(const axis of ['x','y','scale'])camera[axis]=from[axis]+(to[axis]-from[axis])*eased;
    if(progress===1){cameraMotion=null;persist();}
  }
  // Consume the newest pointer position once per paint, not once per event.
  // Keep the request marked as pending while flushing to avoid a second frame.
  flushMove();
  frameRequest = 0;
  // The camera and frames share the same 0..extent workspace. Never pan
  // beyond its edges; center only when an axis fits inside the viewport.
  const panAxis = (position, viewportSize, size, inset=0) => {
    const room = viewportSize - inset - size * camera.scale;
    return room >= 0 ? inset+room / 2 : clamp(position, viewportSize-size*camera.scale, inset);
  };
  if(!preview.entry){
    camera.scale = Math.max(camera.scale, minScale());
    camera.x = panAxis(camera.x, innerWidth, extent.width, workArea().left);
    camera.y = panAxis(camera.y, innerHeight, extent.height);
  }
  let dotSpacing=24*camera.scale;while(dotSpacing<12)dotSpacing*=2;
  viewport.style.backgroundSize=`${dotSpacing}px ${dotSpacing}px`;
  viewport.style.backgroundPosition=`${camera.x}px ${camera.y}px`;
  syncObjectOrder();
  syncLayers();
  const worldTransform = `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
  if (world.style.transform !== worldTransform) { world.style.transform = worldTransform; sharpenWorldSoon(); }
  for (const entry of entries) {
    const {model:m,element,title} = entry;
    const order=objectRanks.get(`screen:${m.id}`);
    if(entry.paintOrder!==order){element.style.zIndex=String(order);entry.paintOrder=order;}
    const geometry=`${m.x}:${m.y}:${m.width}:${m.height}`;
    if(entry.paintGeometry!==geometry){
      Object.assign(element.style, { left:`${m.x}px`,top:`${m.y}px`,width:`${m.width}px`,height:`${m.height}px` });
      entry.paintGeometry=geometry;
    }
    const canRotate=['phone','tablet'].includes(presets[m.preset].device);
    entry.orientation.hidden=!canRotate;
    const landscape=m.width>m.height;
    entry.orientation.setAttribute('aria-label',`Switch ${m.title} to ${landscape?'portrait':'landscape'}`);
    entry.orientation.title=`Switch to ${landscape?'portrait':'landscape'}`;
    entry.orientation.setAttribute('aria-pressed',String(landscape));
    entry.orientation.querySelector('svg').style.rotate=landscape?'0deg':'90deg';
    // Icons that fit stay in the row; the rest fold behind a ... button and slide in on hover.
    const row=[entry.fullscreen,entry.refresh,entry.theme,...(canRotate?[entry.orientation]:[])];
    const fit=Math.floor(m.width*camera.scale/28),folded=fit>=row.length?0:row.length-Math.max(0,fit-1),shown=row.length-folded;
    if(entry.paintScale!==camera.scale || entry.paintWidth!==m.width || entry.paintCanRotate!==canRotate || entry.paintShown!==shown){
      entry.paintCanRotate=canRotate;entry.paintShown=shown;
      if(!folded)element.removeAttribute('data-expanded');
      element.toggleAttribute('data-folded',folded>0);
      row.forEach((b,i)=>{
        b.style.transform=`translateX(${-i*28/camera.scale}px) scale(${1/camera.scale})`;
        b.toggleAttribute('data-fold',i>=shown);b.style.setProperty('--i',Math.max(0,i-shown));
      });
      entry.more.style.transform=`translateX(${-shown*28/camera.scale}px) scale(${1/camera.scale})`;
      title.style.transform = `scale(${1/camera.scale})`;
      title.style.maxWidth = `${Math.max(0,m.width*camera.scale-(shown+(folded?1:0))*28-4)}px`;
      element.style.setProperty('--screen-outline', `${1/camera.scale}px`);
      entry.paintScale=camera.scale;entry.paintWidth=m.width;
    }
    const x = camera.x+m.x*camera.scale, y = camera.y+m.y*camera.scale;
    const visible = preview.entry ? preview.entry===entry : x+m.width*camera.scale > 0 && y+m.height*camera.scale > 0 && x < innerWidth && y < innerHeight;
    if (visible && !entry.iframe) mount(entry);
    notifyInput(entry);
    if (entry.visible !== visible) { entry.visible = visible; notify(entry); }

  }
  syncGroupUi();
  const mixedTexts=textTool?.selectedModels()??[];
  if (selectedEntries.size || mixedTexts.length>1) {
    const chosen=[...selectedEntries],box = bounds([...chosen.map(entry=>entry.model),...mixedTexts]);
    Object.assign(selection.style,{left:`${camera.x+box.x*camera.scale}px`,top:`${camera.y+box.y*camera.scale}px`,width:`${box.width*camera.scale}px`,height:`${box.height*camera.scale}px`});
    const reordering=gesture?.kind==='reorder';
    smartHandles.update(chosen,camera,box,{enabled:reordering || (!gesture && !mixedTexts.length && !!smartLayout(chosen.map(entry=>entry.model))),active:reordering?gesture.entry:null,destination:reordering?gesture.plan?.[gesture.sourceIndex]:null});
  } else smartHandles.update([],camera,null,{enabled:false});
  updateGap();
  renderContact();
  textTool?.render();
  arrowTool?.render();
  if (document.activeElement !== $('#zoom')) $('#zoom').value = `${Math.round(camera.scale*100)}%`;
  const zoomTarget=cameraMotion?.kind==='zoom'?cameraMotion.to.scale:camera.scale;
  $('#zoom-out').disabled=zoomTarget<=minScale()+1e-9;$('#zoom-in').disabled=zoomTarget>=2;
  for(const direction of ['out','in']){
    const button=$(`#zoom-${direction}`),label=`Zoom ${direction} by ${zoomStep(zoomTarget)*100}%`;
    button.title=label;button.setAttribute('aria-label',label);
  }
  positionSelectMenus();
  if(cameraMotion)schedule();
}
function notifyInput(entry,force=false) {
  if(!entry.iframe)return;
  const active=selected===entry,touch=presets[entry.model.preset].touch===true;
  const fullscreen=preview.entry===entry;
  const canArrange=selectedEntries.size>1;
  const state=`${active}:${touch}:${fullscreen}:${canArrange}`;if(!force && entry.inputState===state)return;
  entry.inputState=state;entry.iframe.contentWindow.postMessage({type:'tio-canvas:input',active,touch,fullscreen,canArrange},location.origin);
}
function notify(entry) {
  entry.iframe?.contentWindow.postMessage({type:'tio-canvas:visibility', visible:entry.visible && !document.hidden}, location.origin);
}
const loader=createScreenLoader({
  onReady(entry){if(entry.dark!==undefined)applyScreenTheme(entry);notify(entry);notifyInput(entry,true);entry.refresh.title=`Refresh ${entry.model.title}`;$('#canvas-status').textContent='';},
  onError(entry,message){entry.refresh.title=message;$('#canvas-status').textContent=message;}
});
function mount(entry,replacing=false){loader.mount(entry,replacing);}
// Screens and texts share one selection box, one set of gap fields and one group drag.
const groupModels=()=>[...[...selectedEntries].map(entry=>entry.model),...(textTool?.selectedModels()??[])];
function syncGroupUi(){
  const texts=textTool?.selectedModels().length??0,total=selectedEntries.size+texts;
  selection.hidden=!(selectedEntries.size||texts>1);
  groupGrab.hidden=total<2||!selectedEntries.size;
  $('#inspector').hidden=!selected||texts>0;
  $('#group-inspector').hidden=total<2;
  selection.toggleAttribute('data-locked',!selected||selected.model.preset!=='custom'||texts>0);
}
function updateSelection(preserveArrows=false) {
  closeSelectMenus();
  if(selectedEntries.size && !preserveArrows){arrowTool?.clearSelection();textTool?.clearSelection();}
  selected = selectedEntries.size === 1 ? [...selectedEntries][0] : null;
  for (const item of entries) {
    item.element.toggleAttribute('data-selected', selectedEntries.has(item));
    item.element.toggleAttribute('data-input-active', item===selected);
  }
  $('#fit-screen').hidden = !selectedEntries.size;
  syncGroupUi();
  updateGap();
  if (selected) {
    const m = selected.model;
    $('#preset-label').textContent = presets[m.preset].label; $('#preset').value = m.preset; $('#width').value = m.width; $('#height').value = m.height;
    $('#width').disabled = $('#height').disabled = m.preset !== 'custom';
  }
  syncLayers(true);
  schedule();
}
function select(entry, toggle = false) {
  if (!toggle) {selectedEntries.clear();arrowTool?.clearSelection();textTool?.clearSelection();}
  if (entry) {
    if (toggle && selectedEntries.has(entry)) selectedEntries.delete(entry);
    else selectedEntries.add(entry);
  }
  updateSelection(toggle);
}
function sourceOf(entry) { return entry.model.sourceId ?? entry.model.id; }
// Nothing of this page on the canvas yet: the first screen has no number. Otherwise count on from the highest.
function nextNumber(sourceId) {
  const same = entries.filter(entry => sourceOf(entry) === sourceId);
  return same.length ? Math.max(...same.map(entry => entry.model.number ?? 0)) + 1 : 0;
}
function deletableEntries() {
  return [...selectedEntries];
}
function deleteSelection() {
  stop();const before=history.checkpoint();
  for (const entry of deletableEntries()) {
    selectedEntries.delete(entry);loader.dispose(entry);entry.element.remove();entries.splice(entries.indexOf(entry),1);
  }
  arrowTool?.removeSelected();textTool?.removeSelected();updateSelection();commitEdit(before);
}
let presetGroup;
for (const [id,preset] of Object.entries(presets)) {
  if (preset.group && preset.group !== presetGroup) {
    presetGroup = preset.group;
    const group = document.createElement('optgroup'); group.label = preset.group; $('#preset').append(group);
  }
  const option = document.createElement('option'); option.value=id; option.textContent=preset.label;
  (preset.group ? $('#preset').lastElementChild : $('#preset')).append(option);
}
setupSelectFields();
$('#preset').addEventListener('change', event => {
  if (!selected) return; const before=history.checkpoint();selected.model.preset = event.target.value;
  if (event.target.value !== 'custom') {
    Object.assign(selected.model,{width:presets[event.target.value].width,height:presets[event.target.value].height});
    selected.model.x=clamp(selected.model.x,0,extent.width-selected.model.width);
    selected.model.y=clamp(selected.model.y,0,extent.height-selected.model.height);
  }
  select(selected); commitEdit(before);
});
for (const axis of ['width','height']) $(`#${axis}`).addEventListener('change', event => {
  if (!selected || selected.model.preset !== 'custom') return;
  const before=history.checkpoint();
  const position = axis === 'width' ? 'x' : 'y';
  selected.model[axis] = Math.round(finite(event.target.valueAsNumber, selected.model[axis],160,Math.min(3840,Math.floor(extent[axis]-selected.model[position])))); select(selected); commitEdit(before);
});
function updateGap() {
  const models=groupModels();
  const horizontal=groupSpacing(models,extent,'x'),vertical=groupSpacing(models,extent,'y');
  const primary=horizontal??vertical;
  for(const [input,spacing] of [[$('#gap'),primary],[$('#gap-y'),horizontal&&vertical]]){
    input.parentElement.hidden=!spacing;
    if(!spacing)continue;
    input.dataset.axis=spacing.axis;
    input.setAttribute('aria-label',`${spacing.axis==='x'?'Horizontal':'Vertical'} gap between selected objects`);
    if(input.id==='gap')$('#gap-label').textContent=spacing.axis==='x'?'Gap X':'Gap Y';
    input.disabled=spacing.max<0;
    input.max=String(Math.max(0,spacing.max));
    if(document.activeElement!==input){
      input.value=spacing.gap!==null && spacing.gap>=0?String(spacing.gap):'';
      input.placeholder=spacing.gap!==null && spacing.gap<0?'Overlap':'Mixed';
    }
  }
}
for(const input of [$('#gap'),$('#gap-y')])input.addEventListener('change',event=>{
  const items=groupModels(),axis=input.dataset.axis;
  const models=spaceGroup(items,input.valueAsNumber,extent,axis);
  if(!models){input.blur();updateGap();return;}
  const before=history.checkpoint();
  items.forEach((model,index)=>Object.assign(model,{x:models[index].x,y:models[index].y}));
  input.value=String(groupSpacing(models,extent,axis).gap);
  updateSelection(true);commitEdit(before);
});
$('#group-inspector').addEventListener('submit',event=>event.preventDefault());
$('#inspector').addEventListener('submit',event=>event.preventDefault());
for (const [direction,x,y] of [['nw',0,0],['n',50,0],['ne',100,0],['e',100,50],['se',100,100],['s',50,100],['sw',0,100],['w',0,50]]) {
  const handle = document.createElement('button'); handle.type='button'; handle.className='handle'; handle.setAttribute('aria-label',`Resize ${direction}`);
  handle.style.cssText=`left:${x}%;top:${y}%;cursor:${direction}-resize`;
  if (direction.length === 1) handle.dataset.side = x===50?'horizontal':'vertical';
  handle.addEventListener('pointerdown',event=>{ if (event.button===0 && selected?.model.preset==='custom') start(direction,event,selected); });
  $('#handles').append(handle);
}
function start(kind,event,entry=null) {
  cameraMotion=null;
  closeContext();
  event.preventDefault?.();
  // A canvas gesture ends field editing even though pointer defaults are blocked.
  // Do not steal focus from an iframe forwarding a pan gesture.
  // Panning while typing in a text keeps the caret where it was.
  const typingInText=kind==='pan' && document.activeElement?.closest?.('.text-object[contenteditable="true"]');
  if(event.target instanceof Element && !typingInText)viewport.focus({preventScroll:true});
  gesture = { duplicate:kind==='move' && event.altKey, kind, x:event.screenX,y:event.screenY, camera:{...camera}, entry, model:entry?{...entry.model}:null,
    models: [...selectedEntries].map(item=>({entry:item,model:{...item.model}})),texts:kind==='move'?(textTool?.selectedModels()??[]).map(model=>({model,x:model.x,y:model.y})):[],
    clientX:event.clientX,clientY:event.clientY,initialArrows:event.shiftKey?(arrowTool?.selectedIds??[]):[],initialTexts:event.shiftKey?(textTool?.selectedIds??[]):[],initial: new Set(event.shiftKey ? selectedEntries : []),before:!['pan','marquee'].includes(kind)?history.checkpoint():null };
  if(kind==='marquee') {
    if(!event.shiftKey)select(null);
    // A press starts a fresh gesture, not a replay of the last rectangle.
    marquee.hidden=true;
    marquee.removeAttribute('style');
  }
  document.body.dataset.gesture = kind==='pan'?'pan':'resize';
}
function move(event) {
  if(!gesture)return;
  if(gesture.kind==='move' && event.altKey)gesture.duplicate=true;
  pendingMove={screenX:event.screenX,screenY:event.screenY,clientX:event.clientX,clientY:event.clientY,shiftKey:event.shiftKey,altKey:event.altKey,metaKey:event.metaKey,ctrlKey:event.ctrlKey};
  gesture.lastPointer=pendingMove;
  schedule();
}
function applyMove(event) {
  if (!gesture) return;
  const g=gesture, dx=event.screenX-g.x, dy=event.screenY-g.y;
  if (g.kind==='pan') { camera.x=g.camera.x+dx; camera.y=g.camera.y+dy; }
  else if (g.kind==='marquee') {
    const x=g.clientX+dx,y=g.clientY+dy;
    const box={x:Math.min(g.clientX,x),y:Math.min(g.clientY,y),width:Math.abs(dx),height:Math.abs(dy)};
    const dragging=(box.width>2 || box.height>2) && box.width>0 && box.height>0;
    marquee.hidden=!dragging;
    Object.assign(marquee.style,{left:`${box.x}px`,top:`${box.y}px`,width:`${box.width}px`,height:`${box.height}px`});
    const worldBox={x:(box.x-camera.x)/camera.scale,y:(box.y-camera.y)/camera.scale,width:box.width/camera.scale,height:box.height/camera.scale};
    const next=new Set(g.initial);
    if(dragging)for(const entry of entries)if(intersects(worldBox,entry.model))next.add(entry);
    if(next.size!==selectedEntries.size || [...next].some(entry=>!selectedEntries.has(entry))){
      selectedEntries.clear();for(const entry of next)selectedEntries.add(entry);
      updateSelection(true);
    }
    arrowTool?.selectRect(dragging?worldBox:null,g.initialArrows);
    textTool?.selectRect(dragging?worldBox:null,g.initialTexts);
  } else if(g.kind==='reorder'){
    if(!g.moved && Math.hypot(dx,dy)<3)return;
    g.moved=true;
    const model=g.models[g.sourceIndex].model;
    const target=nearestSmartSlot(g.layout,model.x+model.width/2+dx/camera.scale,model.y+model.height/2+dy/camera.scale);
    const plan=reorderSmartLayout(g.layout,g.sourceSlot,target,extent);
    if(plan){
      g.plan=plan;g.models.forEach((item,index)=>Object.assign(item.entry.model,plan[index]));
      g.entry.model.x=Math.round(clamp(model.x+dx/camera.scale,0,extent.width-model.width));
      g.entry.model.y=Math.round(clamp(model.y+dy/camera.scale,0,extent.height-model.height));
    }else{
      g.plan=null;g.models.forEach(item=>Object.assign(item.entry.model,item.model));
      $('#canvas-status').textContent='This order would exceed the canvas boundary.';
    }
  } else if (g.kind==='move') {
    if(!g.moved && Math.hypot(dx,dy)<3)return;
    g.duplicate ||= event.altKey===true;
    if(g.duplicate && !g.duplicated && !g.duplicateDenied){
      if(entries.filter(entry=>entry.model.sourceId).length+g.models.length>200){
        $('#canvas-status').textContent='The canvas supports up to 200 added screens.';g.duplicateDenied=true;
      }else{
        const copies=g.models.map(({entry,model})=>{
          // A late Option press restores the original and continues with a copy.
          Object.assign(entry.model,{x:model.x,y:model.y});
          const copy=duplicate(entry,0);return{entry:copy,model:{...copy.model}};
        });
        selectedEntries.clear();copies.forEach(item=>selectedEntries.add(item.entry));
        g.models=copies;g.shiftToggle=null;g.duplicated=true;
        updateSelection(true);
        if(g.texts.length){
          g.texts.forEach(t=>{t.model.x=t.x;t.model.y=t.y;});
          const textCopies=textTool.duplicateSelected(0);
          if(textCopies)g.texts=textCopies.map(model=>({model,x:model.x,y:model.y}));
        }
      }
    }
    g.moved=true;
    const original=bounds([...g.models.map(item=>item.model),...g.texts.map(t=>({x:t.x,y:t.y,width:t.model.width,height:t.model.height}))]);
    // Re-evaluate the dominant direction from the drag origin while Shift is held.
    g.axis=event.shiftKey?(Math.abs(dx)>=Math.abs(dy)?'x':'y'):null;
    const proposal={...original,x:original.x+(g.axis==='y'?0:dx/camera.scale),y:original.y+(g.axis==='x'?0:dy/camera.scale)};
    const snap=snapRect(proposal,[...entries.filter(entry=>!selectedEntries.has(entry)).map(entry=>entry.model),...(textTool?.objects()??[]).filter(o=>!g.texts.some(t=>t.model.id===o.id))],6/camera.scale);
    if(g.axis==='x')snap.y=original.y;if(g.axis==='y')snap.x=original.x;
    const x=Math.round(clamp(snap.x,0,extent.width-original.width))-original.x,y=Math.round(clamp(snap.y,0,extent.height-original.height))-original.y;
    for(const item of g.models){item.entry.model.x=item.model.x+x;item.entry.model.y=item.model.y+y;}
    for(const t of g.texts){t.model.x=t.x+x;t.model.y=t.y+y;}
    const lines=g.axis?snap.guides.filter(line=>line.kind==='gap'?line.axis!==g.axis:line.axis===g.axis):snap.guides;
    if(g.axis){const horizontal=g.axis==='x';lines.push({axis:horizontal?'y':'x',value:original[horizontal?'y':'x']+original[horizontal?'height':'width']/2,from:Math.min(original[g.axis],original[g.axis]+(horizontal?x:y)),to:Math.max(original[g.axis]+original[horizontal?'width':'height'],original[g.axis]+(horizontal?x:y)+original[horizontal?'width':'height']),kind:'axis'});}
    drawGuides(lines);
  } else {
    const m=g.entry.model, base=g.model, x=dx/camera.scale,y=dy/camera.scale;
    if (g.kind.includes('e')) m.width=Math.round(clamp(base.width+x,160,Math.min(3840,Math.floor(extent.width-base.x))));
    if (g.kind.includes('s')) m.height=Math.round(clamp(base.height+y,160,Math.min(3840,Math.floor(extent.height-base.y))));
    if (g.kind.includes('w')) { m.width=Math.round(clamp(base.width-x,160,Math.min(3840,Math.floor(base.x+base.width)))); m.x=base.x+base.width-m.width; }
    if (g.kind.includes('n')) { m.height=Math.round(clamp(base.height-y,160,Math.min(3840,Math.floor(base.y+base.height)))); m.y=base.y+base.height-m.height; }
    $('#width').value=m.width;$('#height').value=m.height;
  }
  schedule();
}
function drawGuides(lines) {
  guides.replaceChildren(...lines.map(line=>{
    const element=document.createElement('div');element.className=`guide ${line.kind}`;
    if(line.reference)element.dataset.reference='';
    const vertical=line.axis==='x';element.dataset.axis=vertical?'vertical':'horizontal';
    Object.assign(element.style,{left:`${camera.x+(vertical?line.value:line.from)*camera.scale}px`,top:`${camera.y+(vertical?line.from:line.value)*camera.scale}px`,width:vertical?'1px':`${(line.to-line.from)*camera.scale}px`,height:vertical?`${(line.to-line.from)*camera.scale}px`:'1px'});
    if(line.kind==='gap'){const label=document.createElement('span');label.textContent=String(Math.round(line.gap));element.append(label);}
    return element;
  }));
}
function startReorder(entry,event){
  const layout=smartLayout([...selectedEntries].map(item=>item.model));if(!layout)return;
  start('reorder',event,entry);
  gesture.layout=layout;gesture.sourceIndex=gesture.models.findIndex(item=>item.entry===entry);
  gesture.sourceSlot=layout.order.indexOf(gesture.sourceIndex);
  entry.element.setAttribute('data-reordering','');
  document.body.dataset.gesture='reorder';schedule();
}
function stop() {
  flushMove();const previous=gesture;gesture=null;
  if(previous?.kind==='reorder'){
    previous.entry.element.removeAttribute('data-reordering');
    previous.models.forEach((item,index)=>Object.assign(item.entry.model,previous.plan?.[index]??item.model));
    updateSelection();
  }
  if(previous?.shiftToggle && !previous.moved)select(previous.shiftToggle,true);
  if(previous?.emptyClick && !previous.moved)select(null);
  if(previous?.before)commitEdit(previous.before);else if(previous)persist();
  marquee.hidden=true;guides.replaceChildren();delete document.body.dataset.gesture;if(previous)schedule();
}
function cancelReorder(){
  if(gesture?.kind!=='reorder')return false;
  pendingMove=null;const previous=gesture;gesture=null;
  previous.entry.element.removeAttribute('data-reordering');
  previous.models.forEach(item=>Object.assign(item.entry.model,item.model));
  delete document.body.dataset.gesture;updateSelection();return true;
}
function release() { if(!cancelReorder())stop();delete document.body.dataset.space; }
window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',release);window.addEventListener('blur',release);
viewport.addEventListener('pointerdown',event=>{
  if(preview.entry)return;
  if (event.button===1 || (event.button===0 && document.body.hasAttribute('data-space'))) start('pan',event);
  else if (event.button===0 && event.target.matches('.screen')) {
    const entry=entries.find(item=>item.element===event.target);
    if(!entry)return;
    event.preventDefault();select(entry,event.shiftKey);
    if(event.altKey && selectedEntries.has(entry))start('move',event,entry);
  }
  else if (event.button===0 && (event.target===viewport || event.target===world)) start('marquee',event);
});
groupGrab.addEventListener('pointerdown',event=>{
  if(event.button!==0 || document.body.hasAttribute('data-space'))return;
  const x=(event.clientX-camera.x)/camera.scale,y=(event.clientY-camera.y)/camera.scale;
  const contains=entry=>x>=entry.model.x&&x<=entry.model.x+entry.model.width&&y>=entry.model.y&&y<=entry.model.y+entry.model.height;
  const unselected=event.shiftKey?[...entries].reverse().find(entry=>!selectedEntries.has(entry)&&contains(entry)):null;
  if(unselected){select(unselected,true);start('move',event,unselected);return;}
  const toggleAfterClick=event.shiftKey?[...selectedEntries].find(entry=>x>=entry.model.x&&x<=entry.model.x+entry.model.width&&y>=entry.model.y&&y<=entry.model.y+entry.model.height):null;
  const overText=(textTool?.selectedModels()??[]).some(m=>x>=m.x&&x<=m.x+m.width&&y>=m.y&&y<=m.y+m.height);
  const overSelected=[...selectedEntries].some(contains)||overText;
  start('move',event);if(toggleAfterClick)gesture.shiftToggle=toggleAfterClick;
  // A plain click on empty space inside the box lets go of the selection.
  if(!overSelected&&!event.shiftKey&&!event.altKey)gesture.emptyClick=true;
});
viewport.addEventListener('auxclick',event=>{if(event.button===1)event.preventDefault();});
let nudgeBefore=null;
function endNudge(){if(!nudgeBefore)return;const before=nudgeBefore;nudgeBefore=null;commitEdit(before);}
function nudgeSelection(event){
  const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,dy=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0,step=event.shiftKey?20:10;
  const models=[...[...selectedEntries].map(entry=>entry.model),...(textTool?.selectedModels()??[])];
  const mx=Math.min(...models.map(m=>m.x)),my=Math.min(...models.map(m=>m.y)),Mx=Math.max(...models.map(m=>m.x+m.width)),My=Math.max(...models.map(m=>m.y+m.height));
  const ox=clamp(dx*step,-mx,extent.width-Mx),oy=clamp(dy*step,-my,extent.height-My);
  if(!ox&&!oy)return;
  stop();nudgeBefore??=history.checkpoint();
  models.forEach(m=>{m.x+=ox;m.y+=oy;});
  updateSelection(true);schedule();
}
function keyboard(event) {
  if(preview.entry || document.querySelector('dialog[open]'))return;
  if(document.body.hasAttribute('data-layer-drag'))return;
  if(event.key==='Shift' && gesture?.kind==='move' && gesture.lastPointer)move({...gesture.lastPointer,shiftKey:event.type==='keydown'});
  if(event.key==='Alt' && gesture?.kind==='move' && gesture.lastPointer)move({...gesture.lastPointer,altKey:event.type==='keydown'});
  const typing=event.target?.closest?.('input,textarea,select,.icon-options,[contenteditable]:not([contenteditable="false"])');
  if (event.code==='Space' && !typing && !event.target.closest?.('#layers')) { if(event.type==='keydown') {event.preventDefault();document.body.dataset.space='';} else delete document.body.dataset.space; }
  if(event.type==='keyup' && event.key.startsWith('Arrow'))endNudge();
  if(event.type==='keydown' && !typing && (selectedEntries.size || textTool?.selectedIds.length) && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.closest?.('#layers,#screen-context,#layers-menu,dialog,select') && !gesture){event.preventDefault();nudgeSelection(event);return;}
  const arrangeAction=arrangeShortcut(event);
  if(event.type==='keydown' && !typing && arrangeAction && selectedEntries.size+(textTool?.selectedIds.length??0)>1){event.preventDefault();if(!event.repeat)arrangeSelection(arrangeAction);return;}
  const layerAction=layerShortcut(event);
  if(event.type==='keydown' && !typing && event.shiftKey && ['Digit1','Digit2'].includes(event.code) && !event.metaKey && !event.ctrlKey && !event.altKey){event.preventDefault();if(!event.repeat)(event.code==='Digit1'?fitEntries(fitAll()):fitEntries([...selectedEntries,...(textTool?.selectedModels()??[]).map(model=>({model}))],{fullViewport:true}));}
  if(event.type==='keydown' && !typing && layerAction){event.preventDefault();moveLayers(layerAction);}
  if(event.type==='keydown' && !typing && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase()==='a'){
    event.preventDefault();stop();
    entries.forEach(entry=>selectedEntries.add(entry));arrowTool?.selectRect(null,arrowTool.ids);textTool?.selectRect(null,textTool.ids);updateSelection(true);
    return;
  }
  const historyAction=historyShortcut(event);
  if(event.type==='keydown' && !typing && historyAction){event.preventDefault();runHistory(historyAction);}
  if (event.type === 'keydown' && (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'd' && !typing && (selectedEntries.size || textTool?.selectedIds.length)) {
    event.preventDefault(); if (!event.repeat) duplicateSelection();
  }
  if (event.type==='keydown' && !typing && ['Backspace','Delete'].includes(event.key) && (selectedEntries.size || arrowTool?.selectedIds.length || textTool?.selectedIds.length)) {event.preventDefault();deleteSelection();}
  if(event.key==='Escape') cancelReorder();
}
window.addEventListener('keydown',keyboard);window.addEventListener('keyup',keyboard);window.addEventListener('blur',endNudge);
function moveCamera(to, animated, kind) {
  if(animated && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    cameraMotion={from:{...camera},to,kind,start:performance.now(),duration:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--canvas-camera-duration'))};
  }else{cameraMotion=null;Object.assign(camera,to);persist();}
  schedule();
}
// The onboarding asks for a pan when what it points at has left the screen.
document.addEventListener('tio-canvas:pan-by',event=>{
  const {dx=0,dy=0}=event.detail??{};
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
  moveCamera({scale:camera.scale,x:clamp(camera.x+dx,innerWidth-extent.width*camera.scale,workArea().left),y:clamp(camera.y+dy,innerHeight-extent.height*camera.scale,0)},true,'pan');
});
function zoomAt(scale, x, y, animated=false) {
  if (![scale,x,y].every(Number.isFinite)) return;
  scale = clamp(scale,minScale(),2);
  const ratio = scale/camera.scale;
  const to={scale,
    x:clamp(x-(x-camera.x)*ratio,innerWidth-extent.width*scale,workArea().left),
    y:clamp(y-(y-camera.y)*ratio,innerHeight-extent.height*scale,0)};
  moveCamera(to,animated,'zoom');
}
const ZOOM_SENSITIVITY = .002;
const PINCH_ZOOM_SENSITIVITY = .008;
function wheelZoom(delta, mode, x, y, sensitivity = ZOOM_SENSITIVITY) {
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? innerHeight : 1);
  zoomAt(camera.scale*Math.exp(-clamp(pixels,-1000,1000)*sensitivity),x,y);
}
function wheelPan(dx,dy,mode) {
  cameraMotion=null;
  const unit=mode===1?16:mode===2?innerHeight:1;
  camera.x-=dx*(mode===2?innerWidth:unit);camera.y-=dy*unit;schedule();persist();
}
viewport.addEventListener('wheel',event=>{
  if(preview.entry || event.target.closest('#inspector,#group-inspector')) return;
  event.preventDefault();
  if(event.metaKey || event.ctrlKey)wheelZoom(event.deltaY,event.deltaMode,event.clientX,event.clientY,event.ctrlKey && !event.metaKey ? PINCH_ZOOM_SENSITIVITY : ZOOM_SENSITIVITY);
  else wheelPan(event.deltaX,event.deltaY,event.deltaMode);
},{passive:false});
window.addEventListener('message',event=>{
  if(event.origin!==location.origin) return;
  if(event.data?.type==='tio-canvas:ready'){loader.ready(event.source);return;}
  const entry=entries.find(item=>item.iframe?.contentWindow===event.source);if(!entry)return;
  const data=event.data;
  if(document.querySelector('dialog[open]'))return;
  if(preview.entry){
    if(entry===preview.entry && data?.type==='tio-canvas:preview-pointer')preview.close();
    if(entry===preview.entry && data?.type==='tio-canvas:preview-escape')preview.close();
    return;
  }
  if(data?.type==='tio-canvas:context' && [data.x,data.y].every(Number.isFinite))openContext(entry,camera.x+(entry.model.x+data.x)*camera.scale,camera.y+(entry.model.y+data.y)*camera.scale);
  if(data?.type==='tio-canvas:alt-drag' && [data.screenX,data.screenY].every(Number.isFinite)){
    if(!selectedEntries.has(entry))select(entry);
    start('move',{...data,altKey:true},entry);
  }
  if(data?.type==='tio-canvas:contact'){
    if(data.visible===true && [data.x,data.y].every(Number.isFinite)){contactState={entry,x:data.x,y:data.y};renderContact();}
    else if(contactState?.entry===entry)clearContact();
  }
  if(data?.type==='tio-canvas:arrange')arrangeSelection(data.action);
  if(data?.type==='tio-canvas:fit-all')fitEntries(fitAll());
  if(data?.type==='tio-canvas:fit-selection')fitEntries([...selectedEntries],{fullViewport:true});
  if(data?.type==='tio-canvas:layer' && ['above','below','top','bottom'].includes(data.action))moveLayers(data.action);
  if(data?.type==='tio-canvas:history' && ['undo','redo'].includes(data.direction))runHistory(data.direction);
  if(data?.type==='tio-canvas:select'){
    // Simulated touch can cancel native focus transfer out of a host field.
    // Only blur that host field; never steal focus from a project editor.
    if(document.activeElement?.matches('input,textarea,select,[contenteditable]'))document.activeElement.blur();
    select(entry,data.shift===true);
  }
  if(data?.type==='tio-canvas:duplicate') { if(!selectedEntries.size)select(entry);duplicateSelection(); }
  if(data?.type==='tio-canvas:delete') { if(!selectedEntries.size)select(entry);deleteSelection(); }
  if(data?.type==='tio-canvas:zoom' && [data.x,data.y,data.delta,data.mode].every(Number.isFinite)) {
    // Map iframe viewport coordinates into the host's screen-space camera.
    const m = entry.model;
    wheelZoom(data.delta,data.mode,camera.x+(m.x+data.x)*camera.scale,camera.y+(m.y+data.y)*camera.scale,data.ctrlKey === true ? PINCH_ZOOM_SENSITIVITY : ZOOM_SENSITIVITY);
  }
  if(data?.type==='tio-canvas:wheel-pan' && [data.dx,data.dy,data.mode].every(Number.isFinite))wheelPan(data.dx,data.dy,data.mode);
  if(data?.type==='tio-canvas:pan') {start('pan',data);}
  if(data?.type==='tio-canvas:move') move(data);
  if(data?.type==='tio-canvas:stop') release();
  if(data?.type==='tio-canvas:space') document.body.toggleAttribute('data-space',data.down===true);
});
// A fit of the selection centres on the whole viewport, as with the Layers drawer
// closed; "Fit all" keeps to the area the drawer leaves free.
const fitAll=()=>[...entries,...(textTool?.objects()??[]).map(model=>({model}))];
function fitEntries(targets,{fullViewport=false}={}) {
  if(!targets.length)return;
  const minX=Math.min(...targets.map(e=>e.model.x)),minY=Math.min(...targets.map(e=>e.model.y));
  const maxX=Math.max(...targets.map(e=>e.model.x+e.model.width)),maxY=Math.max(...targets.map(e=>e.model.y+e.model.height));
  const {left:availableLeft,width:availableWidth}=fullViewport?{left:0,width:innerWidth}:workArea();
  const scale=clamp(Math.min((availableWidth-160)/(maxX-minX),(innerHeight-280)/(maxY-minY)),minScale(),2);
  const to={scale,
    x:clamp(availableLeft+(availableWidth-(maxX-minX)*scale)/2-minX*scale,innerWidth-extent.width*scale,availableLeft),
    y:clamp((innerHeight-(maxY-minY)*scale)/2-minY*scale,innerHeight-extent.height*scale,0)};
  moveCamera(to,true,'fit');
}
function duplicate(entry,offsetX,offsetY=0) {
  if (entries.filter(item => item.model.sourceId).length >= 200) return;
  const sourceId = entry.model.sourceId ?? entry.model.id;
  const source = screens.find(screen => screen.id === sourceId);
  const number = nextNumber(sourceId);
  const model = { ...entry.model, id:crypto.randomUUID(),sourceId,number,name:undefined,title:titleFor(source,number),x:entry.model.x+offsetX,y:entry.model.y+offsetY };
  const copy = createEntry(model,false);entries.push(copy);return copy;
}
// A text-led Option drag carries the selected screens along; these copy and undo-copy them.
function duplicateScreensInPlace() {
  const originals=[...selectedEntries];
  if(!originals.length || entries.filter(entry=>entry.model.sourceId).length+originals.length>200)return [];
  const copies=originals.map(entry=>duplicate(entry,0)).filter(Boolean);
  selectedEntries.clear();copies.forEach(copy=>selectedEntries.add(copy));updateSelection(true);
  return copies.map(copy=>copy.model);
}
function discardScreens(copies,sources) {
  for(const entry of [...entries])if(copies.includes(entry.model)){selectedEntries.delete(entry);loader.dispose(entry);entry.element.remove();entries.splice(entries.indexOf(entry),1);}
  for(const entry of entries)if(sources.includes(entry.model))selectedEntries.add(entry);
  updateSelection(true);
}
function duplicateSelection() {
  stop();
  const originals=[...selectedEntries];
  if(!originals.length){
    if(!textTool?.selectedIds.length)return;
    const before=history.checkpoint();if(textTool.duplicateSelected())commitEdit(before);return;
  }
  const box=bounds(originals.map(entry=>entry.model));
  const offset=duplicateOffset(box,entries.map(entry=>entry.model),extent);
  if(!offset || entries.filter(entry=>entry.model.sourceId).length+originals.length>200)return;
  const before=history.checkpoint();
  const copies=originals.map(entry=>duplicate(entry,offset.x,offset.y)).filter(Boolean);
  if(!copies.length)return;
  selectedEntries.clear();copies.forEach(copy=>selectedEntries.add(copy));updateSelection(true);textTool?.duplicateSelected(offset.x,offset.y);fitEntries(copies);commitEdit(before);
}
createPagePicker({dialog:$('#add-pages'),trigger:$('#add'),sources:screens,
  groups:Object.entries(screenKinds).map(([id,label])=>({id,label})),
  count:id=>entries.filter(entry=>sourceOf(entry)===id).length,
  onOpen(){closeContext();stop();clearContact();delete document.body.dataset.space;},
  onAdd(ids){
    const sources=ids.map(id=>screens.find(source=>source.id===id)).filter(Boolean);
    if(entries.filter(entry=>entry.model.sourceId).length+sources.length>200)return false;
    const positions=addedPagePositions(sources,[...entries.map(entry=>entry.model),...(textTool?.objects()??[])],extent);
    if(!positions)return false;
    const before=history.checkpoint(),copies=[];
    for(const [index,source] of sources.entries()){
      const number=nextNumber(source.id);
      const copy=createEntry({...source,id:crypto.randomUUID(),sourceId:source.id,number,title:titleFor(source,number),...positions[index]},false);
      entries.push(copy);copies.push(copy);
    }
    selectedEntries.clear();copies.forEach(copy=>selectedEntries.add(copy));updateSelection();fitEntries(copies);commitEdit(before);return true;
  }
});
// Native popover dismissal and dialog focus handling keep overlays keyboard-safe.
const context=$('#screen-context');
let contextTrigger=null;
function closeContext(){if(context.matches(':popover-open'))context.hidePopover();}
function openContext(entry,x,y){
  if(preview.entry || document.querySelector('dialog[open]'))return;
  stop();if(entry && !selectedEntries.has(entry))select(entry);
  if(!selectedEntries.size && !textTool?.selectedIds.length)return;
  contextTrigger=entry?.title??document.activeElement;
  context.showPopover();
  const rect=context.getBoundingClientRect();
  const inset=parseFloat(getComputedStyle(context).getPropertyValue('--canvas-panel-inset'));
  context.style.left=`${Math.max(inset,Math.min(x,innerWidth-rect.width-inset))}px`;
  context.style.top=`${Math.max(inset,Math.min(y,innerHeight-rect.height-inset))}px`;
  // Focus the menu itself so opening it does not highlight an action.
  context.focus({preventScroll:true});
}
context.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
  closeContext();if(action==='duplicate')duplicateSelection();else deleteSelection();viewport.focus();
});
context.addEventListener('keydown',event=>{
  event.stopPropagation();
  const buttons=[...context.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:index<0?(event.key==='ArrowDown'?0:buttons.length-1):(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();
  }
  if(event.key==='Escape'){event.preventDefault();closeContext();if(contextTrigger?.isConnected)contextTrigger.focus();else viewport.focus();}
});
document.addEventListener('contextmenu',event=>{
  if(event.target.closest('input,textarea,[contenteditable="plaintext-only"],[contenteditable="true"],dialog'))return;
  const textObject=event.target.closest('.text-object');
  if(textObject){event.preventDefault();textTool.selectOnly(textObject.dataset.textId);openContext(null,event.clientX,event.clientY);return;}
  const screen=event.target.closest('.screen'),row=event.target.closest('[data-layer-id]');
  const entry=entries.find(item=>item.element===screen || item.model.id===row?.dataset.layerId);
  if(!entry && event.target!==groupGrab && event.target!==viewport && event.target!==world)return;
  event.preventDefault();openContext(entry,event.clientX,event.clientY);
});
const shortcuts=$('#shortcuts');
$('#shortcuts-open').onclick=()=>{closeContext();stop();clearContact();delete document.body.dataset.space;shortcuts.showModal();};
$('#shortcuts-close').onclick=()=>shortcuts.close();
shortcuts.addEventListener('click',event=>{
  if(event.target!==shortcuts)return;
  const rect=shortcuts.getBoundingClientRect();
  if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)shortcuts.close();
});
shortcuts.addEventListener('close',()=>$('#layers-more').focus());
const changelog=$('#changelog');
$('#changelog-open').onclick=()=>{closeContext();stop();clearContact();delete document.body.dataset.space;renderChangelog(changelog.querySelector('.changelog-body'));changelog.showModal();};
$('#changelog-close').onclick=()=>changelog.close();
changelog.addEventListener('click',event=>{
  if(event.target!==changelog)return;
  const rect=changelog.getBoundingClientRect();
  if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)changelog.close();
});
changelog.addEventListener('close',()=>$('#layers-more').focus());
const installGuide=$('#install');
$('#install-open').onclick=()=>{closeContext();stop();clearContact();delete document.body.dataset.space;renderInstallGuide(installGuide.querySelector('.install-body'));installGuide.showModal();};
$('#install-close').onclick=()=>installGuide.close();
installGuide.addEventListener('click',event=>{
  if(event.target!==installGuide)return;
  const rect=installGuide.getBoundingClientRect();
  if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)installGuide.close();
});
installGuide.addEventListener('close',()=>$('#layers-more').focus());
$('#undo').onclick=()=>runHistory('undo');
$('#redo').onclick=()=>runHistory('redo');
$('#fit').onclick=()=>fitEntries(fitAll());
$('#fit-screen').onclick=()=>fitEntries([...selectedEntries],{fullViewport:true});
$('#zoom-reset').onclick=()=>zoomAt(1,innerWidth/2,innerHeight/2,true);
function zoomStep(scale){return scale>.5?.2:scale>.2?.1:.02;}
function stepZoom(direction){
  const scale=cameraMotion?.kind==='zoom'?cameraMotion.to.scale:camera.scale;
  zoomAt(Math.round((scale+direction*zoomStep(scale))*1e10)/1e10,innerWidth/2,innerHeight/2,true);
}
$('#zoom-out').onclick=()=>stepZoom(-1);
$('#zoom-in').onclick=()=>stepZoom(1);
function commitZoom() {
  const text = $('#zoom').value.trim().replace(/%$/, '').trim();
  const percentage = text === '' ? NaN : Number(text);
  if (Number.isFinite(percentage)) zoomAt(percentage/100,innerWidth/2,innerHeight/2);
  $('#zoom').value=`${Math.round(camera.scale*100)}%`;
}
$('#zoom').addEventListener('change',commitZoom);
$('#zoom').addEventListener('keydown',event=>{
  if(event.key==='Enter'){event.preventDefault();commitZoom();$('#zoom').blur();}
  if(event.key==='Escape'){$('#zoom').value=`${Math.round(camera.scale*100)}%`;$('#zoom').blur();}
});
let themeTimer;
$('#theme').onclick=()=>{
  // The theme fades through the root tokens; controls must not add their own transitions on top.
  const root=document.documentElement;root.setAttribute('data-theming','');
  clearTimeout(themeTimer);themeTimer=setTimeout(()=>root.removeAttribute('data-theming'),300);
  const dark=document.documentElement.toggleAttribute('data-dark');
  $('#theme-label').textContent=dark?'Light mode':'Dark mode';
};
const moreMenu=$('#layers-menu'),moreButton=$('#layers-more');
moreMenu.addEventListener('beforetoggle',event=>{
  if(event.newState!=='open')return;
  closeContext();stop();clearContact();
  const anchor=moreButton.getBoundingClientRect();
  const gap=parseFloat(getComputedStyle(moreMenu).getPropertyValue('--canvas-menu-offset')),inset=parseFloat(getComputedStyle(moreMenu).getPropertyValue('--canvas-panel-inset')),width=parseFloat(getComputedStyle(moreMenu).getPropertyValue('--canvas-preview-menu'));
  moreMenu.style.top=`${anchor.bottom+gap}px`;
  moreMenu.style.left=`${Math.max(inset,Math.min(anchor.left+(anchor.width-width)/2,innerWidth-width-inset))}px`;
});
moreMenu.addEventListener('toggle',event=>{if(event.newState==='open')moreMenu.focus({preventScroll:true});moreButton.setAttribute('aria-expanded',String(event.newState==='open'));});
moreMenu.addEventListener('click',event=>{if(event.target.closest('#shortcuts-open,#onboarding-open,#changelog-open,#install-open'))moreMenu.hidePopover();});
moreMenu.addEventListener('keydown',event=>{
  event.stopPropagation();
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  event.preventDefault();
  const buttons=[...moreMenu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
  buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:index<0?(event.key==='ArrowDown'?0:buttons.length-1):(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();
});
window.addEventListener('resize',()=>{cameraMotion=null;cachedWorkArea=null;schedule();});
document.addEventListener('visibilitychange',()=>{release();entries.forEach(notify);});
const preview=createFullscreen({
  onEnter(entry){cameraMotion=null;stop();clearContact();delete document.body.dataset.space;select(entry);if(!entry.iframe)mount(entry);schedule();},
  onExit(){cachedWorkArea=null;schedule();},
});
textTool=createTexts({viewport,world,camera,extent,saved:saved.texts,screenSelectionCount:()=>selectedEntries.size,rank:id=>objectRanks.get(`text:${id}`)??1,checkpoint:()=>history.checkpoint(),commit:commitEdit,clearScreens:()=>select(null),schedule,stopCanvas:()=>{cameraMotion=null;stop();},setTool:value=>arrowTool.setTool(value),companions:()=>[...selectedEntries].map(entry=>entry.model),duplicateCompanions:duplicateScreensInPlace,discardCompanions:discardScreens,snapTargets:()=>[...entries.map(entry=>entry.model),...textTool.objects()],drawGuides});
arrowTool=createArrows({viewport,world,camera,screenSelectionCount:()=>selectedEntries.size,rank:id=>objectRanks.get(`arrow:${id}`)??1,objects:()=>[...entries.map(entry=>entry.model),...textTool.objects()],saved:saved.arrows,checkpoint:()=>history.checkpoint(),commit:commitEdit,clearScreens:()=>select(null),schedule,stopCanvas:()=>{cameraMotion=null;stop();}});
updateSelection();
updateHistory();
// Migrate any fractional geometry from older saved layouts on first load.
persist();
// The toolbars are plain markup that this module resizes (Fit all appears or goes,
// the Layers drawer fills with rows). Keep them invisible until that is done, so a
// reload never paints the markup's first guess and then jumps to the real state.
requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.setAttribute('data-ready','')));

// Scrolling over a number field nudges it by 5; up raises it, down lowers it.
// Trackpads send many small deltas, so they add up to one step per 50 units.
{
  let carry=0;
  document.addEventListener('wheel',event=>{
    const input=event.target instanceof Element?event.target.closest('input[type="number"]'):null;
    if(!input||input.disabled||input.readOnly||event.ctrlKey)return;
    event.preventDefault();
    carry+=event.deltaMode===0?event.deltaY:event.deltaY*50;
    const steps=Math.trunc(carry/50);
    if(!steps)return;
    carry-=steps*50;
    const min=input.min===''?-Infinity:Number(input.min),max=input.max===''?Infinity:Number(input.max);
    const current=Number.isFinite(input.valueAsNumber)?input.valueAsNumber:(Number.isFinite(min)?min:0);
    const next=Math.min(max,Math.max(min,current-steps*5));
    if(next===current)return;
    input.value=String(next);
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  },{passive:false});
}
