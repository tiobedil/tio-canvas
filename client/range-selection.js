// Shared range selection for page rows and the Layers drawer. The caller owns
// selection state; this helper owns only the pointer gesture and its anchor.
export function createRangeSelection({root,items,selected,onChange,toggleClick=false,shiftRange=true,toggleModifiers=false,toggleDrag=false,startTarget=null}) {
  let anchor=null,gesture=null,frame=0;
  function range(first,last){const ids=items(),a=ids.indexOf(first),b=ids.indexOf(last);return a<0||b<0?[]:ids.slice(Math.min(a,b),Math.max(a,b)+1);}
  function apply(id){
    const ids=range(gesture.start,id),next=new Set(gesture.base);
    for(const value of ids){if(gesture.remove)next.delete(value);else next.add(value);}
    onChange([...next]);
  }
  function scroll(){
    if(!gesture)return;
    const rect=root.getBoundingClientRect(),delta=gesture.y<rect.top+24?-10:gesture.y>rect.bottom-24?10:0;
    if(delta && gesture.moved){root.scrollTop+=delta;hit();}
    frame=requestAnimationFrame(scroll);
  }
  function hit(){
    const rect=root.getBoundingClientRect();
    const row=document.elementFromPoint(Math.max(rect.left+1,Math.min(rect.right-1,gesture.x)),Math.max(rect.top+1,Math.min(rect.bottom-1,gesture.y)))?.closest('[data-range-id]');
    if(row && root.contains(row))apply(row.dataset.rangeId);
  }
  function cancel(){const old=gesture;gesture=null;cancelAnimationFrame(frame);if(old && root.hasPointerCapture(old.pointer))root.releasePointerCapture(old.pointer);}
  function select(id,event){
    if(event.shiftKey&&shiftRange&&anchor){
      onChange([...new Set([...selected(),...range(anchor,id)])]);
    }else{
      anchor=id;
      const toggling=toggleClick||(toggleModifiers&&(event.metaKey||event.ctrlKey))||(!shiftRange&&event.shiftKey);
      const next=new Set(toggling?selected():[]);
      if(toggling&&next.has(id))next.delete(id);else next.add(id);
      onChange([...next]);
    }
  }
  root.addEventListener('pointerdown',event=>{
    const row=event.target.closest('[data-range-id]');
    if(event.button!==0 || !row || (startTarget&&!event.target.closest(startTarget)) || event.target.closest('[contenteditable],svg,[data-reorder]'))return;
    event.preventDefault();const id=row.dataset.rangeId,base=toggleDrag||event.shiftKey||(toggleModifiers&&(event.metaKey||event.ctrlKey))?selected():[];
    const start=event.shiftKey&&shiftRange&&anchor?anchor:id;
    const remove=toggleDrag&&base.includes(id)&&!(event.shiftKey&&shiftRange&&anchor);
    select(id,event);
    gesture={moved:false,pointer:event.pointerId,start,base,remove,x:event.clientX,y:event.clientY};
    (startTarget?row.querySelector(startTarget):row).focus({preventScroll:true});frame=requestAnimationFrame(scroll);
  });
  root.addEventListener('pointermove',event=>{if(gesture && gesture.pointer===event.pointerId){if(!gesture.moved && Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<4)return;gesture.moved=true;root.setPointerCapture(event.pointerId);gesture.x=event.clientX;gesture.y=event.clientY;hit();}});
  root.addEventListener('pointerup',()=>{cancel();});root.addEventListener('pointercancel',cancel);root.addEventListener('lostpointercapture',cancel);
  window.addEventListener('keydown',event=>{if(event.key==='Escape')cancel();});
  window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  root.addEventListener('click',event=>{
    const row=event.target.closest('[data-range-id]');if(!row || event.detail!==0 || (startTarget&&!event.target.closest(startTarget)))return;
    const id=row.dataset.rangeId;
    select(id,event);
  });
  return {cancel,select,reset(){cancel();anchor=null;}};
}
