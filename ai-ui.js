import {AI_DEFAULTS,endpointURL,planReport,localAdvice,apiContext,applyAdvice,analyzeAI,requestAI,CHAT_PROMPT} from './ai.js';

export function setupAI({getState,change,toast,speak}) {
  const $=id=>document.getElementById(id), CONFIG='whale-focus:ai-config:v1', KEY='whale-focus:ai-session:v1';
  let config={...AI_DEFAULTS},key='',remember=false,busy=false,controller=null,lastReport=null,lastAdvice=null;
  const messages=[],history=[];
  try {
    const saved=JSON.parse(localStorage.getItem(CONFIG)||'null');
    if(saved)config={endpoint:endpointURL(saved.endpoint||AI_DEFAULTS.endpoint),model:typeof saved.model==='string'?saved.model.slice(0,120):'',shareContext:saved.shareContext===true};
    const secret=JSON.parse(sessionStorage.getItem(KEY)||'null');
    if(secret?.endpoint===config.endpoint&&secret?.model===config.model&&typeof secret.key==='string'&&secret.key.length<=2000){key=secret.key;remember=true;}
  } catch {config={...AI_DEFAULTS};}
  const ready=()=>Boolean(config.model.trim()&&(key.trim()||new URL(config.endpoint).hostname!=='api.deepseek.com'));
  function status(text,error=false,target='aiRequestStatus') {$(target).textContent=text;$(target).classList.toggle('error',error);}
  function modeNote() {
    $('aiModeNote').textContent=ready()?`已配置模型 ${config.model}。分析发送到 ${new URL(config.endpoint).origin}；聊天仅在你点击发送时请求接口。${config.shareContext?'已允许发送任务统计。':'尚未允许发送任务统计，计划分析仍使用本地统计。'}`:'尚未配置 AI 接口：计划分析使用本地统计。聊天需要先在“接口设置”中填写地址、模型和密钥。';
  }
  function setBusy(value,label='') {
    busy=value;for(const id of ['aiRunAnalysis','aiSendChat','aiTestConnection','aiApply'])$(id).disabled=value;
    $('aiCancelRequest').hidden=!value;$('aiConfigCancelRequest').hidden=!value;$('aiScope').disabled=value;
    if(label)status(label);
  }
  function tab(name) {
    const plan=name==='plan';$('aiPlanPanel').hidden=!plan;$('aiChatPanel').hidden=plan;
    $('aiPlanTab').setAttribute('aria-selected',String(plan));$('aiChatTab').setAttribute('aria-selected',String(!plan));
  }
  function chatRender() {
    const nodes=messages.map(m=>{
      const el=document.createElement('div');el.className=`ai-message ${m.role==='user'?'user':''}`;
      const label=document.createElement('span');label.className='ai-message-label';label.textContent=m.role==='user'?'你':m.role==='assistant'?'小鲸 · AI 回复':'使用提示';
      el.append(label,document.createTextNode(m.content));return el;
    });
    $('aiChatMessages').replaceChildren(...nodes);$('aiChatMessages').scrollTop=$('aiChatMessages').scrollHeight;
  }
  function openAssistant(name) {
    modeNote();tab(name);
    if(!messages.length){messages.push({role:'notice',content:'我是陪你安排计划的小鲸。配置接口后，可以聊聊任务怎么拆、时间怎么安排，或复盘专注节奏。AI 建议只有在你点击“应用”后才会修改任务。'});chatRender();}
    if(!$('aiDialog').open)$('aiDialog').showModal();
  }
  function readForm() {
    const endpoint=endpointURL($('aiEndpoint').value),model=$('aiModel').value.trim();
    if(model.length>120)throw new Error('模型名称过长。');
    return {config:{endpoint,model,shareContext:$('aiShareContext').checked},key:$('aiKey').value.trim(),remember:$('aiRememberKey').checked};
  }
  function openConfig() {
    $('aiEndpoint').value=config.endpoint;$('aiModel').value=config.model;$('aiKey').value=key;
    $('aiRememberKey').checked=remember;$('aiShareContext').checked=config.shareContext;$('aiPreset').value='custom';
    status('',false,'aiConfigStatus');if(!$('aiConfigDialog').open)$('aiConfigDialog').showModal();
  }
  function showAdvice(advice,report) {
    lastReport=report;lastAdvice=advice;
    const root=$('aiAnalysisResult');root.replaceChildren();
    const card=document.createElement('div');card.className='ai-analysis-summary';
    const metrics=document.createElement('div');metrics.className='ai-metrics';
    for(const text of [`${report.tasks.length} 项范围内任务`,`全局 ${report.totalPomodoros} 个完整番茄`,`全局 ${report.totalMinutes} 分钟`,`${report.sampleCount} 项速度样本`]){const tag=document.createElement('span');tag.textContent=text;metrics.append(tag);}
    const title=document.createElement('strong');title.textContent=advice.source==='ai'?'小鲸的 AI 计划建议':'本地统计建议';
    const summary=document.createElement('p');summary.textContent=advice.summary;
    const pace=document.createElement('p');pace.textContent=advice.paceAdvice;
    const unit=document.createElement('p');unit.className='field-help';unit.textContent=`当前一轮专注 ${report.focusMinutes} 分钟。预算调整均为总番茄数；父任务用时包含子任务，不能重复相加。`;
    card.append(metrics,title,summary,pace,unit);
    if(report.tasks.length>200){const limit=document.createElement('p');limit.textContent='AI 每次最多接收范围内 200 项任务（优先未完成任务）；更多任务请选中一项后缩小到它的子树。';card.append(limit);}
    if(report.tasks.length){
      const details=document.createElement('details'),caption=document.createElement('summary'),table=document.createElement('table');
      caption.textContent=`查看任务预算与实际投入${report.tasks.length>50?'（前 50 项）':''}`;table.className='ai-task-table';
      const head=document.createElement('tr');for(const name of ['任务','预计总番茄','完整番茄','实际分钟']){const cell=document.createElement('th');cell.textContent=name;head.append(cell);}table.append(head);
      for(const t of report.tasks.slice(0,50)){const row=document.createElement('tr');for(const value of [t.title+(t.childCount?'（含子任务）':''),t.estimate||'未估算',t.actualPomodoros,t.actualMinutes]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}table.append(row);}
      const wrap=document.createElement('div');wrap.className='ai-table-scroll';wrap.append(table);details.append(caption,wrap);card.append(details);
    }
    root.append(card);
    const list=document.createElement('div');list.className='ai-suggestion-list';
    const tasks=new Map(report.tasks.map(t=>[t.id,t]));
    const suggestions=[...advice.adjustments.map(a=>({title:tasks.get(a.taskId)?.title||'任务',detail:`总预算：${tasks.get(a.taskId)?.estimate||'未估算'} → ${a.estimate} 个番茄；已完成 ${tasks.get(a.taskId)?.actualPomodoros||0} 个，已投入 ${tasks.get(a.taskId)?.actualMinutes||0} 分钟`,reason:a.reason})),...advice.subtasks.map(a=>({title:`新增子任务：${a.title}`,detail:`所属任务：${tasks.get(a.parentId)?.title||'任务'} · 预计 ${a.estimate} 个番茄`,reason:a.reason}))];
    suggestions.forEach((a,index)=>{
      const label=document.createElement('label');label.className='ai-suggestion';
      const check=document.createElement('input');check.type='checkbox';check.dataset.adviceIndex=index;check.checked=true;check.setAttribute('aria-label',`应用建议：${a.title}`);
      const content=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('em'),reason=document.createElement('small');
      title.textContent=a.title;detail.textContent=a.detail;reason.textContent=a.reason;content.append(title,detail,reason);label.append(check,content);list.append(label);
    });
    if(!suggestions.length){const empty=document.createElement('p');empty.className='field-help';empty.textContent=advice.source==='ai'?'本次没有需要应用的结构或预算调整，可以参考以上建议继续。':'暂无足够依据调整预算。可以先填写预计番茄数、积累已完成任务，或配置接口获取任务拆分建议。';list.append(empty);}
    root.append(list);$('aiApply').hidden=!suggestions.length;
  }
  async function analyze() {
    if(busy)return;status('');
    let report;
    try {const state=getState(),selected=$('aiScope').value==='selected';if(selected&&!state.selectedTaskId)throw new Error('请先在任务列表中选择当前任务，再分析它的子树。');report=planReport(state,{scopeId:selected?state.selectedTaskId:null});}
    catch(error){status(error.message,true);return;}
    showAdvice(localAdvice(report),report);
    if(!ready()){status('本地统计已完成。配置接口后，可让小鲸进一步设计子任务并调整预算。');return;}
    if(!config.shareContext){status('本地统计已完成。若要使用 AI，请在接口设置中允许发送任务与专注统计。');return;}
    if(!report.tasks.length){status('先添加至少一项任务，再请 AI 分析。');return;}
    controller=new AbortController();setBusy(true,'小鲸正在分析你的计划……可以取消，当前任务尚未修改。');
    try {const advice=await analyzeAI(config,key,report,{signal:controller.signal});showAdvice(advice,report);status('AI 分析已完成。请检查所选建议后应用。');speak(advice.summary.slice(0,160));}
    catch(error){status(`${error.message} 当前仍显示本地统计建议。`,true);}
    finally {controller=null;setBusy(false);}
  }
  $('aiAnalyzeOpen').onclick=()=>{openAssistant('plan');analyze();};
  $('aiChatOpen').onclick=()=>openAssistant('chat');$('characterButton').onclick=()=>openAssistant('chat');
  $('aiPlanTab').onclick=()=>tab('plan');$('aiChatTab').onclick=()=>tab('chat');
  $('aiConfigOpen').onclick=openConfig;$('aiSettingsLink').onclick=openConfig;$('aiRunAnalysis').onclick=analyze;
  $('aiScope').onchange=()=>{lastAdvice=null;lastReport=null;$('aiAnalysisResult').replaceChildren();$('aiApply').hidden=true;status('已更改范围，请重新分析。');};
  $('aiApply').onclick=()=>{
    if(busy||!lastAdvice||!lastReport)return;
    const selected=[...$('aiAnalysisResult').querySelectorAll('input[data-advice-index]:checked')].map(e=>Number(e.dataset.adviceIndex));
    if(change(()=>applyAdvice(getState(),lastAdvice,lastReport,selected))){lastAdvice=null;$('aiApply').hidden=true;$('aiAnalysisResult').querySelectorAll('input').forEach(e=>e.disabled=true);status('所选建议已应用并在本机保存。任务完成状态和当前计时没有改变。');toast('计划已更新，可以按新的小步骤继续。');}
  };
  $('aiPreset').onchange=()=>{if($('aiPreset').value==='deepseek'){$('aiEndpoint').value=AI_DEFAULTS.endpoint;$('aiModel').value='deepseek-flash';$('aiKey').value='';}};
  $('aiConfigForm').onsubmit=event=>{
    event.preventDefault();if(busy){status('请先等待或取消当前请求。',true,'aiConfigStatus');return;}
    try {
      const next=readForm();config=next.config;key=next.key;remember=next.remember;
      let saved=true;
      try{localStorage.setItem(CONFIG,JSON.stringify(config));if(remember&&key)sessionStorage.setItem(KEY,JSON.stringify({endpoint:config.endpoint,model:config.model,key}));else sessionStorage.removeItem(KEY);}catch{saved=false;}
      modeNote();$('aiConfigDialog').close();toast(saved?'接口配置已保存。密钥不会进入任务备份。':'配置在本页生效；浏览器无法保存，请勿关闭当前页面。');
    } catch(error){status(error.message,true,'aiConfigStatus');}
  };
  $('aiForgetKey').onclick=()=>{controller?.abort();key='';remember=false;$('aiKey').value='';$('aiRememberKey').checked=false;try{sessionStorage.removeItem(KEY);}catch{}modeNote();status('已清除本页及当前标签页暂存的密钥。',false,'aiConfigStatus');};
  $('aiCancelRequest').onclick=()=>controller?.abort();$('aiConfigCancelRequest').onclick=()=>controller?.abort();
  $('aiTestConnection').onclick=async()=>{
    if(busy)return;
    let next;try{next=readForm();}catch(error){status(error.message,true,'aiConfigStatus');return;}
    controller=new AbortController();setBusy(true);status('正在测试连接，仅发送一句测试文字，不发送任务。',false,'aiConfigStatus');
    try{await requestAI(next.config,next.key,[{role:'user',content:'请只回复：小鲸已就绪。'}],{signal:controller.signal});status('连接成功，可以保存配置并开始分析或聊天。',false,'aiConfigStatus');}
    catch(error){status(error.message,true,'aiConfigStatus');}
    finally{controller=null;setBusy(false);}
  };
  window.addEventListener('whale-data-cleared',()=>{controller?.abort();config={...AI_DEFAULTS};key='';remember=false;lastAdvice=null;lastReport=null;messages.length=0;history.length=0;try{localStorage.removeItem(CONFIG);sessionStorage.removeItem(KEY);}catch{}$('aiKey').value='';$('aiAnalysisResult').replaceChildren();$('aiApply').hidden=true;chatRender();modeNote();});
  $('aiChatForm').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    const content=$('aiChatInput').value.trim();if(!content)return;
    if(!ready()){status('请先打开“接口设置”，配置模型和密钥后再聊天。',true);return;}
    if($('aiChatContext').checked&&!config.shareContext){status('请先在接口设置中允许发送任务与专注统计，或取消附带统计。',true);return;}
    let context='';
    try{if($('aiChatContext').checked)context='\n以下为本次用户允许附带的任务统计数据：'+JSON.stringify(apiContext(planReport(getState())));}
    catch(error){status(error.message,true);return;}
    const user={role:'user',content};messages.push(user);chatRender();
    controller=new AbortController();setBusy(true,'小鲸正在回复……');
    try {
      const reply=await requestAI(config,key,[{role:'system',content:CHAT_PROMPT+context},...history.slice(-12),user],{signal:controller.signal});
      const assistant={role:'assistant',content:reply};history.push(user,assistant);messages.push(assistant);
      if(messages.length>60)messages.splice(0,messages.length-60);if(history.length>12)history.splice(0,history.length-12);
      chatRender();$('aiChatInput').value='';status('小鲸回复了。聊天不会直接修改任务。');speak(reply.slice(0,160));
    } catch(error){status(error.message,true);}
    finally{controller=null;setBusy(false);}
  };
}
