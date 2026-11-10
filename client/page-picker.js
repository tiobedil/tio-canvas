import { createRangeSelection } from './range-selection.js';
import { h, Button, Checkbox, Disclosure, Pill, openDialog } from './ui/index.js';

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
  const ranges=createRangeSelection({root:list,items:()=>ordered.map(source=>source.id),selected:()=>[...selection],onChange:update,toggleClick:true,toggleDrag:true,startTarget:'.ui-checkbox'});
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
      const closed=closedGroups.has(group.id);
      const section=Disclosure({id:`picker-group-${group.id}`,label:group.label,count:members.length,open:!closed,
        onToggle:open=>{if(open)closedGroups.delete(group.id);else closedGroups.add(group.id);}},...members.map(buildRow));
      list.append(section);
    }
    update([]);openDialog(dialog);
  });
  function buildRow(source){
    const number=count(source.id);
    const thumbnail=h('span',{class:'page-thumbnail','aria-hidden':'true'});
    const image=h('img',{src:`/canvas/thumbnails/${encodeURIComponent(source.id)}.webp`,alt:'',loading:'lazy',decoding:'async'});image.draggable=false;
    image.addEventListener('error',()=>image.remove(),{once:true});thumbnail.append(image);
    const row=h('div',{class:'page-option ui-row',dataset:{rangeId:source.id}},
      Checkbox({label:`Select ${source.title}`}),
      h('button',{type:'button',class:'page-option-add','aria-label':`Add ${source.title}`},
        thumbnail,
        h('span',{class:'page-option-label'},source.title,h('small',{},source.description)),
        number?Pill({},`${number} on canvas`):null));
    row.addEventListener('click',event=>{if(event.target.closest('.ui-checkbox'))return;
      if(selection.size){const next=new Set(selection);if(!next.delete(source.id))next.add(source.id);ranges.reset();update([...next]);}
      else add([source.id]);});
    return row;
  }
  dialog.querySelector('#add-pages-select-all').onclick=()=>{ranges.reset();update(sources.map(source=>source.id));};
  dialog.querySelector('#add-pages-unselect-all').onclick=()=>{ranges.reset();update([]);};
  dialog.addEventListener('close',()=>{ranges.reset();trigger.focus({preventScroll:true});});
  submit.addEventListener('click',()=>{
    if(!selection.size)return;
    add([...selection]);
  });
}
