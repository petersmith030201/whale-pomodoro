export function initCompanion(getSettings) {
  const card=document.getElementById('companionCard'),button=document.getElementById('characterButton');
  let clearMood;
  const quiet=()=>getSettings().reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  function gesture(kind='hello') {
    clearTimeout(clearMood);card.dataset.gesture=kind;
    if(!quiet()){
      const frames=kind==='reply'?[{transform:'translateY(0) rotate(0)'},{transform:'translateY(-13px) rotate(-4deg)'},{transform:'translateY(0) rotate(3deg)'},{transform:'translateY(0) rotate(0)'}]:[{transform:'rotate(0)'},{transform:'rotate(-7deg) translateY(-5px)'},{transform:'rotate(5deg)'},{transform:'rotate(0)'}];
      button.animate(frames,{duration:kind==='reply'?700:540,easing:'cubic-bezier(.2,.8,.25,1)'});
      const effects=document.getElementById('whaleEffects');effects.replaceChildren();
      for(let i=0;i<7;i++){const el=document.createElement('i');el.textContent=i%2?'✦':'○';el.style.setProperty('--fx-x',`${(i-3)*24}px`);el.style.setProperty('--fx-y',`${-55-Math.abs(i-3)*9}px`);el.style.animationDelay=`${i*.035}s`;effects.append(el);}
      setTimeout(()=>effects.replaceChildren(),1300);
    }
    clearMood=setTimeout(()=>{if(card.dataset.gesture===kind)delete card.dataset.gesture;},1600);
  }
  button.addEventListener('pointermove',e=>{
    if(quiet()||e.pointerType==='touch')return;
    const r=button.getBoundingClientRect();card.style.setProperty('--look-x',`${((e.clientX-r.left)/r.width-.5)*10}px`);card.style.setProperty('--look-y',`${((e.clientY-r.top)/r.height-.5)*7}px`);
  });
  button.addEventListener('pointerleave',()=>{card.style.setProperty('--look-x','0px');card.style.setProperty('--look-y','0px');});
  button.addEventListener('pointerdown',()=>gesture('hello'));
  window.addEventListener('whale-gesture',e=>gesture(e.detail?.kind||'reply'));
  const note=document.querySelector('.photo-note'),noteButton=document.getElementById('quietNoteButton');
  noteButton?.addEventListener('click',()=>{
    const active=noteButton.getAttribute('aria-pressed')!=='true';noteButton.setAttribute('aria-pressed',String(active));note?.classList.toggle('is-quiet',active);
    document.getElementById('quietNoteTitle').textContent=active?'收到，轻轻陪你。':'嘘，潜入专注。';
    const text=document.getElementById('quietNoteText');text.replaceChildren(document.createTextNode(active?'小鲸收好鲸尾，陪你做眼前这件事。':'外面的世界先小声一点。'),document.createElement('br'),document.createTextNode(active?'准备好了，就开始一轮吧。':'把眼前的一件事，慢慢做好。'));
    noteButton.replaceChildren(document.createTextNode(active?'继续安静陪伴 ':'和小鲸安静一下 '));const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent=active?'✓':'↗';noteButton.append(arrow);
    if(active)gesture('reply');
  });
  return gesture;
}
