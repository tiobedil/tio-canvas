// Make readable preview styles behave as if no pointer can hover. The guard
// has zero added specificity and becomes inert when the mobile preset is left.
// No source stylesheet or production asset is rewritten.
const GUARD=':hover:not(:where([data-canvas-touch-preview], [data-canvas-touch-preview] *))';
export function suppressPreviewHover() {
  const processed=new WeakMap();
  function visit(sheet) {
    let rules;try{rules=sheet.cssRules;}catch{return;} // Cross-origin CSS is not readable.
    for(const rule of rules){
      if(typeof rule.selectorText==='string' && processed.get(rule)!==rule.selectorText){
        const selector=rule.selectorText.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|:hover\b/g,(match,quoted)=>quoted??GUARD);
        if(selector!==rule.selectorText)rule.selectorText=selector;
        processed.set(rule,rule.selectorText);
      }
      if(rule.styleSheet)visit(rule.styleSheet);
      if(rule.cssRules)visit(rule);
    }
  }
  function refresh(){
    if(!document.documentElement.hasAttribute('data-canvas-touch-preview'))return;
    for(const sheet of [...document.styleSheets,...document.adoptedStyleSheets])visit(sheet);
  }
  new MutationObserver(refresh).observe(document.head,{childList:true,subtree:true,characterData:true});
  document.addEventListener('load',event=>{if(event.target.tagName==='LINK')refresh();},true);
  // Real mouse hover events must not activate project hover handlers either.
  for(const type of ['pointerover','pointerenter','mouseover','mouseenter','mousemove']){
    window.addEventListener(type,event=>{
      if(!document.documentElement.hasAttribute('data-canvas-touch-preview'))return;
      // A pressed drag inside an editor is editing, not hover.
      if(type==='mousemove' && event.buttons && event.target.closest?.('input,textarea,select,[contenteditable]'))return;
      event.stopImmediatePropagation();
    },true);
  }
  return refresh;
}
