// Iframe lifecycle. Document readiness excludes images and
// other nonessential requests; the old painted screen survives refresh failure.
// The development server adds the bridge to the pages it serves. A production
// page is served untouched, so the canvas adds the bridge itself. These are
// same-origin documents, which is what makes that possible.
function injectBridge(frame) {
  const doc=frame.contentDocument;
  if(!doc?.body || [...doc.scripts].some(script=>script.src.endsWith('/canvas/bridge.js')))return;
  const script=doc.createElement('script');script.type='module';script.src='/canvas/bridge.js';doc.body.append(script);
}
export function createScreenLoader({onReady,onError,timeout=15000}) {
  const documents=new WeakMap();
  function forget(frame) { if(frame?.contentWindow)documents.delete(frame.contentWindow); }
  function cancel(entry) {
    clearTimeout(entry.refreshTimer);
    if(entry.pending){forget(entry.pending);entry.pending.remove();entry.pending=null;}
    entry.refresh.disabled=false;entry.element.removeAttribute('aria-busy');
  }
  function dispose(entry) { cancel(entry);forget(entry.iframe); }
  async function finish(record) {
    const {entry,frame}=record;
    if(record.settling || !frame.isConnected)return;
    record.settling=true;
    try {
      // Layout requests the fonts actually used by this document. Unlike load,
      // fonts.ready does not wait for an image or an unrelated fetch to finish.
      frame.contentDocument?.documentElement.getBoundingClientRect();
      await frame.contentDocument?.fonts?.ready;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(!frame.isConnected || !entry.element.isConnected)return;
      if(entry.pending===frame){
        const previous=entry.iframe,focused=document.activeElement===previous;
        clearTimeout(entry.refreshTimer);entry.pending=null;entry.iframe=frame;
        forget(previous);previous?.remove();
        delete frame.dataset.refreshPending;frame.inert=false;frame.removeAttribute('aria-hidden');frame.title=entry.model.title;
        entry.refresh.disabled=false;entry.element.removeAttribute('aria-busy');
        if(focused)frame.focus({preventScroll:true});
      }
      if(entry.iframe===frame)onReady(entry);
    }finally{record.settling=false;}
  }
  function mount(entry,replacing=false) {
    if(entry.pending)return;
    const frame=document.createElement('iframe'),url=new URL(entry.model.src,location.origin);
    if(url.origin!==location.origin)throw new Error('Canvas screens must use local pages.');
    url.searchParams.set('canvasScreen','1');frame.title=entry.model.title;
    // Native lazy loading keeps host loading independent from embedded media.
    // An invisible refresh replacement must load eagerly, not wait to be seen.
    frame.loading=replacing?'eager':'lazy';
    if(replacing && entry.iframe){
      entry.pending=frame;frame.dataset.refreshPending='';frame.inert=true;frame.setAttribute('aria-hidden','true');
      entry.refresh.disabled=true;entry.element.setAttribute('aria-busy','true');
      entry.refreshTimer=setTimeout(()=>{
        if(entry.pending!==frame)return;
        cancel(entry);onError(entry,'Refresh timed out. The previous screen is still shown. Try again.');
      },timeout);
    }else entry.iframe=frame;
    const record={entry,frame,settling:false};
    // Fallback for a document that cannot run the bridge. A working bridge
    // signals readiness earlier, at DOMContentLoaded plus font readiness.
    frame.addEventListener('load',()=>{injectBridge(frame);void finish(record);});
    frame.src=url.href;entry.element.append(frame);
    documents.set(frame.contentWindow,record);
  }
  function ready(source) { const record=documents.get(source);if(record)void finish(record); }
  return {mount,ready,dispose};
}
