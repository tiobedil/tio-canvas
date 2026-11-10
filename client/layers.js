import { createRangeSelection } from './range-selection.js';
import { h, Icon, setIcon } from './ui/index.js';
export function deviceKind(preset,presets){return presets[preset]?.device??'custom';}
export function createLayerDrawer({root,presets,collapsed=false,onSelect,onDrop,onCollapse,onRename,onSelectMany}){
  const list=root.querySelector('ol'),toggle=root.querySelector('#layers-toggle'),count=root.querySelector('#screens-count');
  const rows=new Map(),ghost=document.createElement('div');ghost.className='layer-ghost';ghost.hidden=true;ghost.setAttribute('aria-hidden','true');ghost.inert=true;document.body.append(ghost);
  let current=[],selected=new Set(),drag=null,scrollFrame=0;
  function setCollapsed(value){
    root.toggleAttribute('data-collapsed',value);list.hidden=value;
    toggle.setAttribute('aria-expanded',String(!value));toggle.setAttribute('aria-label',`${value?'Expand':'Minimize'} Layers`);toggle.title=`${value?'Expand':'Minimize'} Layers`;
    setIcon(toggle.querySelector('svg'),value?'chevron-down':'chevron-up');
  }
  // The drawer is clipped (overflow: hidden), so animating its height reveals or
  // hides the list instead of snapping. One box, 160ms, ease-out-quint.
  let collapseMotion;
  function animateCollapse(value){
    collapseMotion?.cancel();
    const from=root.getBoundingClientRect().height;
    setCollapsed(value);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const to=root.getBoundingClientRect().height;
    if(from===to)return;
    if(value)list.hidden=false;
    const motion=collapseMotion=root.animate([{height:`${from}px`},{height:`${to}px`}],{duration:160,easing:'cubic-bezier(0.23, 1, 0.32, 1)'});
    motion.onfinish=()=>{if(collapseMotion===motion){collapseMotion=null;list.hidden=root.hasAttribute('data-collapsed');}};
    motion.oncancel=()=>{if(collapseMotion===motion){collapseMotion=null;list.hidden=root.hasAttribute('data-collapsed');}};
  }
  toggle.addEventListener('click',()=>{cancel();const value=!root.hasAttribute('data-collapsed');animateCollapse(value);onCollapse(value);});
  setCollapsed(collapsed);
  // Items run bottom to top: { id, kind: 'screen' | 'text', title, preset, component }. A component frame has its own icon. A text layer is named by
  // its content and cannot be renamed; `selection` is a set of layer ids.
  function update(items,selection){
    count.textContent=String(items.length);root.toggleAttribute('data-empty',!items.length);document.getElementById('fit').hidden=!items.length;
    const focused=document.activeElement?.dataset.layerId;
    current=items.map(item=>item.id);selected=new Set(selection);
    const wanted=new Set(current);
    for(const [id,row] of rows)if(!wanted.has(id)){row.remove();rows.delete(id);}
    let previous=null;
    for(const item of [...items].reverse()){
      const {id,title,preset,kind:itemKind}=item;let row=rows.get(id);
      if(!row){
        const button=h('button',{type:'button',class:'layer-row ui-row',dataset:{layerId:id,rangeId:id}},
          h('span',{class:'layer-grab',dataset:{reorder:true},'aria-hidden':'true'},Icon('grabber',{className:'layer-grabber'}),Icon('custom',{className:'layer-device'})),
          h('span',{class:'layer-label'}));
        row=h('li',{},button);rows.set(id,row);
      }
      const button=row.firstElementChild,kind=itemKind==='text'?'text':item.component?'component':deviceKind(preset,presets);button.dataset.kind=itemKind;
      if(button.dataset.device!==kind){setIcon(button.querySelector('.layer-device'),kind);button.dataset.device=kind;}
      if(!button.querySelector('.layer-label').isContentEditable && button.querySelector('.layer-label').textContent!==title)button.querySelector('.layer-label').textContent=title;button.dataset.tooltip='Drag to select, or drag the grip to reorder';
      button.setAttribute('aria-label',`${title}, ${itemKind==='text'?'Text':item.component?'Component':presets[preset]?.label??'Custom'}`);button.setAttribute('aria-pressed',String(selected.has(id)));
      const next=previous?previous.nextElementSibling:list.firstElementChild;
      if(next!==row)list.insertBefore(row,next);previous=row;
    }
    if(focused && rows.has(focused) && document.activeElement?.dataset.layerId!==focused)rows.get(focused).firstElementChild.focus({preventScroll:true});
  }
  // The drop position is one line between two rows. It slides from gap to gap, and
  // a pointer outside the list keeps it at the nearest end instead of removing it.
  const line=document.createElement('div');line.className='layer-drop-line';line.setAttribute('aria-hidden','true');line.inert=true;line.hidden=true;list.append(line);
  function clearDrop(){line.hidden=true;}
  function targetAt(y){
    const candidates=[...list.children].filter(row=>row!==line).map(row=>[row.firstElementChild.dataset.layerId,row]).filter(([id])=>!drag.ids.includes(id));
    for(const [id,row] of candidates){const r=row.getBoundingClientRect();if(y<r.bottom)return{id,before:y<r.top+r.height/2};}
    return candidates.length?{id:candidates.at(-1)[0],before:false}:null;
  }
  function preview(){
    if(!drag?.moved)return;
    drag.target=targetAt(drag.y);
    if(drag.target){
      const row=rows.get(drag.target.id),half=parseFloat(getComputedStyle(root).getPropertyValue('--canvas-layer-gap'))/2;
      const y=(drag.target.before?row.offsetTop-half:row.offsetTop+row.offsetHeight+half)-line.offsetHeight/2;
      const show=line.hidden;
      if(show){line.style.transition='none';line.hidden=false;}
      line.style.transform=`translateY(${y}px)`;
      if(show){line.offsetWidth;line.style.transition='';}
    }else clearDrop();
    ghost.style.transform=`translate(${drag.pointerX-drag.offsetX}px,${drag.y-drag.offset}px)`;
  }
  function autoScroll(){
    scrollFrame=0;if(!drag?.moved)return;
    const rect=list.getBoundingClientRect(),edge=24;
    const delta=drag.y<rect.top+edge?-10:drag.y>rect.bottom-edge?10:0;
    if(delta){list.scrollTop+=delta;preview();}
    scrollFrame=requestAnimationFrame(autoScroll);
  }
  function cancel(){
    const old=drag;drag=null;cancelAnimationFrame(scrollFrame);clearDrop();ghost.hidden=true;delete document.body.dataset.layerDrag;
    for(const row of rows.values())delete row.dataset.dragging;
    if(old && root.hasPointerCapture(old.pointer))root.releasePointerCapture(old.pointer);
  }
  const rangeSelection=createRangeSelection({root:list,items:()=>[...current].reverse(),selected:()=>[...selected],onChange:onSelectMany,toggleModifiers:true});
  list.addEventListener('dblclick',event=>{
    const label=event.target.closest('.layer-label');
    if(!label || label.isContentEditable || label.closest('[data-kind="text"]'))return;
    event.preventDefault();cancel();onRename(label.closest('[data-layer-id]').dataset.layerId,label);
  });
  list.addEventListener('pointerdown',event=>{
    if(event.target.isContentEditable || !event.target.closest('[data-reorder]'))return;
    const button=event.target.closest('[data-layer-id]');if(event.button!==0 || !button)return;
    const rect=button.getBoundingClientRect();drag={id:button.dataset.layerId,pointer:event.pointerId,x:event.clientX,pointerX:event.clientX,startY:event.clientY,y:event.clientY,left:rect.left,offsetX:event.clientX-rect.left,offset:event.clientY-rect.top,moved:false,shiftKey:event.shiftKey,metaKey:event.metaKey,ctrlKey:event.ctrlKey};

  });
  root.addEventListener('pointermove',event=>{
    if(!drag || event.pointerId!==drag.pointer)return;drag.y=event.clientY;drag.pointerX=event.clientX;
    if(!drag.moved && Math.hypot(event.clientX-drag.x,event.clientY-drag.startY)<4)return;
    event.preventDefault();
    if(!drag.moved){
      root.setPointerCapture(event.pointerId);
      drag.moved=true;if(!selected.has(drag.id))onSelect(drag.id,false);
      drag.ids=current.filter(id=>selected.has(id));
      document.body.dataset.layerDrag='';
      const button=rows.get(drag.id).firstElementChild;
      const width=button.offsetWidth;
      for(const id of drag.ids)rows.get(id).dataset.dragging='';
      const cards=[...current].reverse().filter(id=>drag.ids.includes(id)).map(id=>{
        const card=rows.get(id).firstElementChild.cloneNode(true);
        card.removeAttribute('data-layer-id');card.removeAttribute('data-range-id');card.tabIndex=-1;
        return card;
      });
      ghost.replaceChildren(...cards);
      ghost.style.width=`${width}px`;ghost.hidden=false;
      scrollFrame=requestAnimationFrame(autoScroll);
    }
    preview();
  });
  // Focus moves to a row after a click, which a browser treats as keyboard focus.
  // Track the last input so a pointer selection draws no ring and the keyboard still does.
  root.addEventListener('pointerdown',()=>root.setAttribute('data-pointer',''),true);
  document.addEventListener('keydown',()=>root.removeAttribute('data-pointer'),true);
  root.addEventListener('pointerup',event=>{
    if(!drag || event.pointerId!==drag.pointer)return;
    const old=drag;cancel();
    if(old.moved){
      if(old.target){
        const tops=new Map([...rows].map(([id,row])=>[id,row.getBoundingClientRect().top]));
        onDrop(old.ids,old.target.id,old.target.before);
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const [id,row] of rows){
          const delta=tops.get(id)-row.getBoundingClientRect().top;
          if(delta)row.animate([{transform:`translateY(${delta}px)`},{transform:'none'}],{duration:180,easing:'cubic-bezier(0.23, 1, 0.32, 1)'});
        }
      }
    }
    else rangeSelection.select(old.id,old);
    rows.get(old.id)?.firstElementChild.focus({preventScroll:true});
  });
  root.addEventListener('pointercancel',cancel);root.addEventListener('lostpointercapture',()=>{if(drag)cancel();});window.addEventListener('blur',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  window.addEventListener('keydown',event=>{if(event.key==='Escape' && drag){event.preventDefault();event.stopImmediatePropagation();cancel();}},true);
  return {update,setCollapsed};
}
