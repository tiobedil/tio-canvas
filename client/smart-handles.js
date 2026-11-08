// Host controls stay above the multi-selection grab area and every preview.
export function createSmartHandles({ selection, viewport, onDrag }) {
  const root=document.createElement('div');root.id='smart-handles';selection.append(root);
  const target=document.createElement('div');target.id='smart-target';target.hidden=true;target.setAttribute('aria-hidden','true');viewport.append(target);
  const buttons=new Map();
  return {
    update(entries,camera,box,{enabled,active=null,destination=null}){
      const wanted=new Set(enabled?entries:[]);
      for(const [entry,button] of buttons)if(!wanted.has(entry)){button.remove();buttons.delete(entry);}
      for(const entry of wanted){
        let button=buttons.get(entry);
        if(!button){
          button=document.createElement('button');button.type='button';button.className='smart-handle';button.dataset.screenId=entry.model.id;
          button.addEventListener('pointerdown',event=>{if(event.button===0 && !document.body.hasAttribute('data-space')){event.stopPropagation();onDrag(entry,event);}});
          button.dataset.tooltip='Drag to reorder screens';
          root.append(button);buttons.set(entry,button);
        }
        const name=`Reorder ${entry.model.title}`;
        if(button.getAttribute('aria-label')!==name)button.setAttribute('aria-label',name);
        const m=entry.model,position=`${(m.x+m.width/2-box.x)*camera.scale}px ${(m.y+m.height/2-box.y)*camera.scale}px`;
        if(button.style.translate!==position)button.style.translate=position;
        button.toggleAttribute('data-moving',entry===active);
      }
      target.hidden=!destination;
      if(destination)Object.assign(target.style,{left:`${camera.x+destination.x*camera.scale}px`,top:`${camera.y+destination.y*camera.scale}px`,width:`${destination.width*camera.scale}px`,height:`${destination.height*camera.scale}px`});
    }
  };
}
