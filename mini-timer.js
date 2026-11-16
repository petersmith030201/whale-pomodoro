// The desktop window is a view of the existing timer, never a second timer.
export function countdownText(milliseconds) {
  const value=Number(milliseconds),seconds=Math.ceil((Number.isFinite(value)?Math.max(0,value):0)/1000);
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}

const MINI_STYLE=`
  :root{color-scheme:light;background:#fafcff;color:#243f6c}
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
  body{display:grid;place-items:center;user-select:none}
  #miniCountdown{font-family:Bahnschrift,"Segoe UI",sans-serif;font-weight:500;
    font-variant-numeric:tabular-nums;letter-spacing:-.045em;line-height:1;
    font-size:min(27vw,67vh);white-space:nowrap;padding:0 .06em}
  body[data-status=paused] #miniCountdown{color:#73839d}
`;

export function createMiniTimer({host=window,getSnapshot,onTick=()=>{},onStatus=()=>{},onError=()=>{},openTimeoutMs=8000}) {
  let view=null,pending=null,disposed=false;
  const supported=()=>Boolean(host.isSecureContext&&host.documentPictureInPicture?.requestWindow);
  const isOpen=()=>Boolean(view&&!view.window.closed);
  function update(){
    if(!isOpen())return;
    const snapshot=getSnapshot(),text=countdownText(snapshot.remainingMs);
    view.time.textContent=text;view.time.setAttribute('aria-label',`剩余 ${text}`);
    view.window.document.body.dataset.status=snapshot.status;
    view.window.document.title=`${text} · 倒计时`;
  }
  function release(current){
    if(current.interval!=null)current.window.clearInterval(current.interval);
    if(view===current){view=null;onStatus(false);}
  }
  function close(){
    const current=view;if(!current)return;
    release(current);if(!current.window.closed)current.window.close();
  }
  function open(){
    if(disposed)return Promise.resolve(false);
    if(isOpen()){update();return Promise.resolve(true);}
    if(pending)return pending;
    if(!supported()){
      onError('当前浏览器不支持桌面置顶小窗。请用支持画中画的桌面浏览器打开本站，例如 Chrome 或 Edge。');
      return Promise.resolve(false);
    }
    // Invoke synchronously inside the Start button gesture, before awaiting anything.
    let request,openingWindow=null,expired=false,timeout;
    try{request=host.documentPictureInPicture.requestWindow({width:200,height:90,disallowReturnToOpener:true,preferInitialWindowPlacement:false});}
    catch(error){request=Promise.reject(error);}
    const result=Promise.resolve(request).then(win=>{if(expired||disposed){win.close();return null;}return win;});
    const deadline=new Promise((_,reject)=>{timeout=setTimeout(()=>{expired=true;reject(new Error('Window opening timed out'));},openTimeoutMs);});
    pending=Promise.race([result,deadline]).then(win=>{
      if(!win)return false;
      openingWindow=win;
      if(disposed){win.close();return false;}
      const doc=win.document;doc.documentElement.lang='zh-CN';
      const style=doc.createElement('style');style.textContent=MINI_STYLE;doc.head.append(style);
      const time=doc.createElement('div');time.id='miniCountdown';time.setAttribute('role','timer');
      doc.body.replaceChildren(time);
      const current={window:win,time,interval:null};view=current;
      win.addEventListener('pagehide',()=>release(current),{once:true});
      current.interval=win.setInterval(()=>{if(view!==current||win.closed)return;onTick();update();},250);
      update();onStatus(true);return true;
    }).catch(()=>{
      if(openingWindow){if(view?.window===openingWindow)close();else if(!openingWindow.closed)openingWindow.close();}
      onError('桌面小窗未能打开，计时仍会继续。请点击“桌面小窗”重试，或用支持画中画的桌面浏览器打开。');
      return false;
    }).finally(()=>{clearTimeout(timeout);pending=null;});
    return pending;
  }
  return {supported,isOpen,open,close,update,dispose(){disposed=true;close();}};
}
