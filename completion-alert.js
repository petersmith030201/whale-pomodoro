export const ALERT_DURATION=6400;
export const EDGE_STYLE=`
.completion-edge{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;max-width:none!important;max-height:none!important;background:transparent!important;pointer-events:none!important;z-index:2147483647;box-sizing:border-box;--edge-color:40,165,105;box-shadow:inset 0 0 0 9px rgba(var(--edge-color),.7),inset 0 0 54px 15px rgba(var(--edge-color),.45);animation:completionGlow 1.6s ease-in-out 4}
.completion-edge[data-completed=short],.completion-edge[data-completed=long]{--edge-color:220,66,76}
.completion-edge[data-quiet=true]{animation:none!important;opacity:.75}
.completion-edge[hidden]{display:none!important}
@keyframes completionGlow{0%,100%{opacity:.2}50%{opacity:.9}}
@media(prefers-reduced-motion:reduce){.completion-edge{animation:none!important;opacity:.75}}
`;

// A hidden page keeps its own unread alert even when the desktop window showed it.
export function createCompletionAlerts({getReducedMotion=()=>false,now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout}={}){
  const views=new Map(),seen=new Set();let latest=null;
  function hide(view){if(view.timeout)cancel(view.timeout);view.timeout=null;try{view.edge.hidePopover?.();}catch{}view.edge.hidden=true;}
  function display(view){
    if(!latest||view.last===latest.id||view.doc.visibilityState==='hidden')return;
    view.last=latest.id;hide(view);view.edge.dataset.completed=latest.mode;view.edge.dataset.quiet=String(getReducedMotion());
    view.edge.hidden=false;try{view.edge.showPopover?.();}catch{}
    for(const animation of view.edge.getAnimations?.()||[])animation.currentTime=0;
    view.timeout=schedule(()=>hide(view),ALERT_DURATION);
  }
  function attach(doc,{main=false}={}){
    if(views.has(doc))return ()=>{};
    const style=doc.createElement('style');style.textContent=EDGE_STYLE;doc.head.append(style);
    const edge=doc.createElement('div');edge.className='completion-edge';edge.hidden=true;edge.setAttribute('aria-hidden','true');edge.setAttribute('popover','manual');doc.body.append(edge);
    const view={doc,edge,style,last:0,timeout:null};views.set(doc,view);
    const visible=()=>{if(main||latest&&now()-latest.at<ALERT_DURATION)display(view);};doc.addEventListener('visibilitychange',visible);view.unlisten=()=>doc.removeEventListener('visibilitychange',visible);
    // Opening a window later must not revive an old alert.
    if(latest&&now()-latest.at<ALERT_DURATION)display(view);
    return ()=>{hide(view);doc.removeEventListener('visibilitychange',visible);edge.remove();style.remove();views.delete(doc);};
  }
  function notify(event){
    if(!event||!['focus','short','long'].includes(event.completedMode))return false;
    const key=event.sessionId;if(key&&seen.has(key))return false;
    if(key){seen.add(key);if(seen.size>100)seen.delete(seen.values().next().value);}
    latest={id:(latest?.id||0)+1,mode:event.completedMode,at:now()};for(const view of views.values())display(view);return true;
  }
  return {attach,notify,dispose(){for(const view of [...views.values()]){hide(view);view.unlisten();view.edge.remove();view.style.remove();}views.clear();}};
}
