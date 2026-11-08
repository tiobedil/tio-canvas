import { arrangeShortcut } from './arrange.js';
import { layerShortcut } from './layer-order.js';
import { historyShortcut } from './history.js';
import { createTouchPreview } from './touch-preview.js';
// Dev-only host communication. Does not replace handlers or alter preview controls.
const send = data => parent.postMessage(data, location.origin);
let space = false, panning = false, active = false, fullscreen = false, canArrange = false;
const typing = target => target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
window.addEventListener('pointerdown', event => {
  if(fullscreen){send({type:'tio-canvas:preview-pointer'});return;}
  if(event.button===0 && event.altKey && !space){event.preventDefault();event.stopImmediatePropagation();panning=true;send({type:'tio-canvas:alt-drag',screenX:event.screenX,screenY:event.screenY,shiftKey:event.shiftKey});return;}
  if(event.button===0 && !space){if(!event.shiftKey)active=true;send({type:'tio-canvas:select',shift:event.shiftKey});}
  if(event.button===1 || (event.button===0 && space)) {
    event.preventDefault();panning=true;
    send({type:'tio-canvas:pan',screenX:event.screenX,screenY:event.screenY});
  }
},true);
window.addEventListener('pointermove',event=>{if(panning)send({type:'tio-canvas:move',screenX:event.screenX,screenY:event.screenY,shiftKey:event.shiftKey,altKey:event.altKey,metaKey:event.metaKey,ctrlKey:event.ctrlKey});});
const stop=()=>{const active=panning||space;panning=false;space=false;if(active)send({type:'tio-canvas:stop'});};
window.addEventListener('pointerup',()=>{if(panning)stop();});window.addEventListener('pointercancel',stop);window.addEventListener('blur',stop);
window.addEventListener('contextmenu',event=>{if(fullscreen || typing(event.target))return;event.preventDefault();send({type:'tio-canvas:context',x:event.clientX,y:event.clientY});});
window.addEventListener('auxclick',event=>{if(!fullscreen && event.button===1)event.preventDefault();});
window.addEventListener('keydown',event=>{
  if(fullscreen){if(event.key==='Escape')send({type:'tio-canvas:preview-escape'});return;}
  if(event.shiftKey && event.code==='Digit1' && !event.metaKey && !event.ctrlKey && !event.altKey && !typing(event.target)){event.preventDefault();if(!event.repeat)send({type:'tio-canvas:fit-all'});}
  if(event.shiftKey && event.code==='Digit2' && !event.metaKey && !event.ctrlKey && !event.altKey && !typing(event.target)){event.preventDefault();if(!event.repeat)send({type:'tio-canvas:fit-selection'});}
  const arrangeAction=arrangeShortcut(event);
  if(arrangeAction && canArrange && !typing(event.target)){event.preventDefault();if(!event.repeat)send({type:'tio-canvas:arrange',action:arrangeAction});return;}
  const layerAction=layerShortcut(event);
  if(layerAction && !typing(event.target)){event.preventDefault();send({type:'tio-canvas:layer',action:layerAction});}
  const direction=historyShortcut(event);
  if(direction && !typing(event.target)){event.preventDefault();send({type:'tio-canvas:history',direction});}
  if(event.code==='Space' && !typing(event.target)){event.preventDefault();space=true;send({type:'tio-canvas:space',down:true});}
  if((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase()==='d' && !typing(event.target)) {
    event.preventDefault();if(!event.repeat)send({type:'tio-canvas:duplicate'});
  }
  if(['Backspace','Delete'].includes(event.key) && !typing(event.target)) {
    event.preventDefault();if(!event.repeat)send({type:'tio-canvas:delete'});
  }
});
window.addEventListener('keyup',event=>{if(fullscreen)return;if(event.code==='Space'){space=false;send({type:'tio-canvas:space',down:false});}});
const touchPreview=createTouchPreview(()=>active && !space && !panning,contact=>send({type:'tio-canvas:contact',...contact}));
window.addEventListener('message',event=>{
  if(event.source!==parent || event.origin!==location.origin)return;
  if(event.data?.type==='tio-canvas:input'){
    fullscreen=event.data.fullscreen===true;
    canArrange=event.data.canArrange===true;
    if(fullscreen){space=false;panning=false;}
    active=event.data.active===true;touchPreview.configure(!fullscreen && event.data.touch===true,active);return;
  }
  if(event.data?.type!=='tio-canvas:visibility')return;
  const visible=event.data.visible===true;
  document.documentElement.dataset.canvasVisible=String(visible);
  window.dispatchEvent(new CustomEvent('canvasvisibilitychange',{detail:{visible}}));
});

// A single active screen keeps native wheel scrolling. Inactive screens pan
// the workspace; modified wheel gestures (including trackpad pinch) always zoom.
window.addEventListener('wheel',event=>{
  if(fullscreen || (active && !event.metaKey && !event.ctrlKey && !space))return;
  event.preventDefault();
  // Embedded pages can scroll in their own wheel listeners even after the
  // browser's default is cancelled. Canvas gestures must not reach them.
  event.stopImmediatePropagation();
  if(event.metaKey || event.ctrlKey)send({type:'tio-canvas:zoom',x:event.clientX,y:event.clientY,delta:event.deltaY,mode:event.deltaMode,ctrlKey:event.ctrlKey && !event.metaKey});
  else send({type:'tio-canvas:wheel-pan',dx:event.deltaX,dy:event.deltaY,mode:event.deltaMode});
},{passive:false,capture:true});

// Report usable document readiness without waiting for images or weather.
async function reportReady(){
  document.documentElement.getBoundingClientRect();await document.fonts.ready;
  send({type:'tio-canvas:ready'});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',reportReady,{once:true});else void reportReady();
