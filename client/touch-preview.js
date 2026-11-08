// Dev-only mouse-to-touch preview. Native device emulation and trusted touch
// events require browser tooling; this supplies a scaled contact and inertial drag scroll.
import { suppressPreviewHover } from './hover-preview.js';

// Exponential coast: velocity falls to 1/e every 325ms. Values use iframe CSS
// pixels and elapsed time, so zoom and refresh rate do not change the gesture.
const COAST={decay:325,maxSpeed:3,minSpeed:.02,sampleWindow:80,stale:100};
export function createTouchPreview(canDrag,onContact) {
  const style=document.createElement('style');
  // A simulated tap must not inherit keyboard focus styling from the editor.
  // Keyboard focus inside a native popover needs its own top-layer outline.
  style.textContent=`html[data-canvas-touch-preview],html[data-canvas-touch-preview] *{cursor:none!important}
    html[data-canvas-touch-preview][data-canvas-touch-pointer] :focus-visible{outline:none!important}
    html[data-canvas-touch-preview][data-canvas-touch-pointer] tp-focus-ring{display:none!important}
    html[data-canvas-touch-preview]:not([data-canvas-touch-pointer]) :is(:popover-open:focus-visible,:popover-open :focus-visible){outline:var(--ring-width,2px) solid var(--ring,currentColor);outline-offset:var(--ring-offset,2px)}`;
  document.head.append(style);
  const refreshHover=suppressPreviewHover();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let enabled=false,drag=null,suppressClick=false,coastFrame=0;
  function stopCoast(){cancelAnimationFrame(coastFrame);coastFrame=0;}
  function coast(target,vx,vy){
    stopCoast();if(reducedMotion.matches || !canDrag())return;
    let previous=performance.now();
    function tick(now){
      coastFrame=0;
      if(!enabled || !canDrag() || !target.isConnected)return;
      const elapsed=Math.min(50,now-previous);previous=now;
      const decay=Math.exp(-elapsed/COAST.decay);
      const moved=scrollFrom(target,vx*COAST.decay*(1-decay),vy*COAST.decay*(1-decay));
      vx=moved.x?vx*decay:0;vy=moved.y?vy*decay:0;
      if(Math.hypot(vx,vy)>=COAST.minSpeed)coastFrame=requestAnimationFrame(tick);
    }
    if(Math.hypot(vx,vy)>=COAST.minSpeed)coastFrame=requestAnimationFrame(tick);
  }
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)stopCoast();});
  const hide=()=>onContact({visible:false});
  function stop() {
    const current=drag;drag=null;
    if(current?.target.hasPointerCapture?.(current.id))current.target.releasePointerCapture(current.id);
  }
  function cancel(){stopCoast();stop();hide();}
  window.addEventListener('pointerdown',event=>{
    if(enabled){stopCoast();document.documentElement.setAttribute('data-canvas-touch-pointer','');}
    if(!enabled || !canDrag() || event.pointerType!=='mouse' || event.button!==0 || event.shiftKey || event.metaKey || event.ctrlKey)return;
    if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
    suppressClick=false;
    drag={id:event.pointerId,target:event.target,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false,samples:[{x:event.clientX,y:event.clientY,time:performance.now()}]};
    event.preventDefault();
  },true);
  window.addEventListener('pointermove',event=>{
    if(!enabled || event.pointerType!=='mouse')return;
    if(!event.buttons || drag)event.stopImmediatePropagation();
    onContact({visible:true,x:event.clientX,y:event.clientY});
    if(!drag)return;
    if(!drag.moved && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6)return;
    event.preventDefault();
    if(!drag.moved){drag.moved=true;drag.target.setPointerCapture?.(drag.id);}
    scrollFrom(drag.target,drag.x-event.clientX,drag.y-event.clientY);
    const now=performance.now();
    drag.samples.push({x:event.clientX,y:event.clientY,time:now});
    while(drag.samples.length>2 && now-drag.samples[0].time>COAST.sampleWindow)drag.samples.shift();
    drag.x=event.clientX;drag.y=event.clientY;
  },{capture:true,passive:false});
  window.addEventListener('pointerup',()=>{
    const current=drag;stop();if(!current?.moved)return;
    suppressClick=true;
    const first=current.samples[0],last=current.samples.at(-1),elapsed=Math.max(8,last.time-first.time);
    if(performance.now()-last.time>COAST.stale)return; // Holding still stops a fling.
    const speed=value=>Math.max(-COAST.maxSpeed,Math.min(COAST.maxSpeed,value));
    coast(current.target,speed((first.x-last.x)/elapsed),speed((first.y-last.y)/elapsed));
  },true);
  window.addEventListener('click',event=>{
    if(suppressClick && event.detail>0){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}
  },true);
  window.addEventListener('lostpointercapture',()=>{if(drag)cancel();});
  window.addEventListener('keydown',event=>{
    if(!['Shift','Control','Alt','Meta'].includes(event.key))document.documentElement.removeAttribute('data-canvas-touch-pointer');
    stopCoast();if(event.key==='Escape')cancel();
  },true);
  window.addEventListener('wheel',stopCoast,{capture:true,passive:true});
  window.addEventListener('pointercancel',()=>{suppressClick=false;cancel();});
  window.addEventListener('pointerout',event=>{if(!event.relatedTarget && !drag)hide();});
  window.addEventListener('blur',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  window.addEventListener('canvasvisibilitychange',event=>{if(!event.detail.visible)cancel();});
  return {configure(touch,active){
    enabled=touch;document.documentElement.toggleAttribute('data-canvas-touch-preview',touch);
    if(touch)refreshHover();else document.documentElement.removeAttribute('data-canvas-touch-pointer');
    if(!touch || !active)cancel();
  }};
}

function scrollFrom(target,dx,dy) {
  const root=document.scrollingElement;let movedX=0,movedY=0;
  for(let node=target;node && (dx || dy);node=node.parentElement){
    const style=getComputedStyle(node),isRoot=node===root;
    for(const axis of ['X','Y']){
      const delta=axis==='X'?dx:dy;if(!delta)continue;
      const overflow=style[`overflow${axis}`];
      const bodyOverflow=isRoot?getComputedStyle(document.body)[`overflow${axis}`]:'';
      if(!/auto|scroll|overlay/.test(overflow) && !(isRoot && !/hidden|clip/.test(overflow) && !/hidden|clip/.test(bodyOverflow)))continue;
      const property=axis==='X'?'scrollLeft':'scrollTop',before=node[property];
      node.scrollBy({left:axis==='X'?delta:0,top:axis==='Y'?delta:0,behavior:'instant'});
      const moved=node[property]-before;
      if(axis==='X')movedX+=moved;else movedY+=moved;
      const remainder=delta-moved;
      const remaining=style[`overscrollBehavior${axis}`]==='auto'?remainder:0;
      if(axis==='X')dx=remaining;else dy=remaining;
    }
  }
  return {x:movedX,y:movedY};
}
