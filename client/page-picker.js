import { createRangeSelection } from './range-selection.js';

// Pages are grouped by `kind` in an accordion; `groups` is [{id,label}] in display order.
export function createPagePicker({dialog,trigger,sources,groups,count,onOpen,onAdd}) {
  const list=dialog.querySelector('#page-options'),submit=dialog.querySelector('#add-pages-submit'),error=dialog.querySelector('#page-picker-error');
  let selection=new Set();
  // Display order, so a shift-range follows what is on screen rather than the registry.
  const ordered=groups.flatMap(group=>sources.filter(source=>source.kind===group.id));
  const closedGroups=new Set();
  function update(ids){
    selection=new Set(ids);
    for(const row of list.querySelectorAll('.page-option')){
      row.dataset.checked=String(selection.has(row.dataset.rangeId));
      row.querySelector('[role="checkbox"]').setAttribute('aria-checked',row.dataset.checked);
    }
    dialog.querySelector('footer').hidden=!selection.size;
    submit.hidden=!selection.size;submit.disabled=!selection.size;submit.textContent=selection.size?`Add ${selection.size} ${selection.size===1?'page':'pages'}`:'Add pages';
    dialog.querySelector('#add-pages-select-all').disabled=selection.size===sources.length;
    dialog.querySelector('#add-pages-unselect-all').disabled=!selection.size;
  }
  const ranges=createRangeSelection({root:list,items:()=>ordered.map(source=>source.id),selected:()=>[...selection],onChange:update,toggleClick:true,toggleDrag:true,startTarget:'.page-checkbox-target'});
  function close(){ranges.reset();dialog.close();}
  function add(ids){
    if(onAdd(ids)!==false)close();
    else error.textContent='Cannot add these pages. The canvas is full. Remove screens or select fewer pages.';
  }
  trigger.addEventListener('click',()=>{
    onOpen();ranges.reset();list.replaceChildren();error.textContent='';
    for(const group of groups){
      const members=ordered.filter(source=>source.kind===group.id);
      if(!members.length)continue;
      const section=document.createElement('section');section.className='picker-group';
      const toggle=document.createElement('button');toggle.type='button';toggle.className='picker-group-toggle';
      const panelId=`picker-group-${group.id}`;toggle.setAttribute('aria-controls',panelId);
      toggle.innerHTML='<span class="picker-group-label"></span><span class="picker-group-count"></span><svg class="chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>';
      toggle.querySelector('.picker-group-label').textContent=group.label;
      toggle.querySelector('.picker-group-count').textContent=String(members.length);
      const panel=document.createElement('div');panel.className='picker-group-panel';panel.id=panelId;
      const items=document.createElement('div');items.className='picker-group-list';panel.append(items);
      const setOpen=open=>{section.dataset.open=String(open);toggle.setAttribute('aria-expanded',String(open));panel.inert=!open;};
      setOpen(!closedGroups.has(group.id));
      toggle.addEventListener('click',()=>{const open=section.dataset.open!=='true';if(open)closedGroups.delete(group.id);else closedGroups.add(group.id);setOpen(open);});
      section.append(toggle,panel);list.append(section);
      for(const source of members)items.append(buildRow(source));
    }
    update([]);dialog.showModal();
  });
  function buildRow(source){
      const row=document.createElement('div');row.className='page-option';row.dataset.rangeId=source.id;
      const checkbox=document.createElement('button');checkbox.type='button';checkbox.className='page-checkbox-target';checkbox.setAttribute('role','checkbox');checkbox.setAttribute('aria-label',`Select ${source.title}`);
      const mark=document.createElement('span');mark.className='page-checkbox';mark.setAttribute('aria-hidden','true');checkbox.append(mark);
      const action=document.createElement('button');action.type='button';action.className='page-option-add';action.setAttribute('aria-label',`Add ${source.title}`);
      row.addEventListener('click',event=>{if(event.target.closest('.page-checkbox-target'))return;
        if(selection.size){const next=new Set(selection);if(!next.delete(source.id))next.add(source.id);ranges.reset();update([...next]);}
        else add([source.id]);});
      const thumbnail=document.createElement('span');thumbnail.className='page-thumbnail';thumbnail.setAttribute('aria-hidden','true');
      const image=document.createElement('img');image.src=`/canvas/thumbnails/${encodeURIComponent(source.id)}.webp`;image.alt='';image.loading='lazy';image.decoding='async';image.draggable=false;
      image.addEventListener('error',()=>image.remove(),{once:true});thumbnail.append(image);
      const label=document.createElement('span');label.className='page-option-label';label.textContent=source.title;
      const description=document.createElement('small');description.textContent=source.description;label.append(description);action.append(thumbnail,label);row.append(checkbox,action);
      const number=count(source.id);
      if(number){const pill=document.createElement('span');pill.className='page-pill';pill.textContent=`${number} on canvas`;action.append(pill);}
      return row;
  }
  dialog.querySelector('#add-pages-close').onclick=close;
  dialog.querySelector('#add-pages-select-all').onclick=()=>{ranges.reset();update(sources.map(source=>source.id));};
  dialog.querySelector('#add-pages-unselect-all').onclick=()=>{ranges.reset();update([]);};
  dialog.addEventListener('close',()=>{ranges.reset();trigger.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();
  });
  submit.addEventListener('click',()=>{
    if(!selection.size)return;
    add([...selection]);
  });
}
