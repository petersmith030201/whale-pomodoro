import {AI_DEFAULTS,DEEPSEEK_MODELS,isDeepSeek,normalizeKey,listModels,chooseModel,requestBubble,bubbleText,modificationSteps,endpointURL,planReport,localAdvice,apiContext,applyAdvice,analyzeAI,requestAI,CHAT_PROMPT} from './ai.js?v=1.2.0';

export function setupAI({getState,change,toast,speak}) {
  const $=id=>document.getElementById(id), CONFIG='whale-focus:ai-config:v1', KEY='whale-focus:ai-session:v1';
  let config={...AI_DEFAULTS},key='',remember=false,busy=false,controller=null,lastReport=null,lastAdvice=null;
  const messages=[],history=[];let availableModels=[],modelsEndpoint="",lastBubbleAt=0;
  try {
    const saved=JSON.parse(localStorage.getItem(CONFIG)||'null');
    if(saved)config={endpoint:endpointURL(saved.endpoint||AI_DEFAULTS.endpoint),model:typeof saved.model==='string'?saved.model.slice(0,200):'',shareContext:saved.shareContext===true};
    const secret=JSON.parse(sessionStorage.getItem(KEY)||'null');
    if(secret?.endpoint===config.endpoint&&secret?.model===config.model&&typeof secret.key==='string'&&secret.key.length<=2000){key=secret.key;remember=true;}
  } catch {config={...AI_DEFAULTS};}
  const ready=()=>Boolean(config.model.trim()&&(key.trim()||new URL(config.endpoint).hostname!=='api.deepseek.com'));
  function status(text,error=false,target='aiRequestStatus') {$(target).textContent=text;$(target).classList.toggle('error',error);}
  function bubbleHint(text,error=false){$('aiBubbleHint').textContent=text;$('aiBubbleHint').classList.toggle('error',error);}
  function modeNote() {
    $('aiModeNote').textContent=ready()?`已配置模型 ${config.model}。分析发送到 ${new URL(config.endpoint).origin}；聊天仅在你点击发送时请求接口。${config.shareContext?'已允许发送任务统计。':'尚未允许发送任务统计，计划分析仍使用本地统计。'}`:config.model&&isDeepSeek(config.endpoint)?'DeepSeek 地址和模型已准备好，但本页没有密钥。请在接口设置中粘贴密钥；未暂存密钥时，刷新后需要重新填写。计划仍可使用本地统计。':'尚未配置 AI 接口：计划分析使用本地统计。请在接口设置中填写地址、密钥，并读取可用模型。';
    $('aiBubbleTag').textContent=ready()?'AI 对话 · 点小鲸换一句':'轻点小鲸 · 先连接 AI';if(!busy)bubbleHint(ready()?'点击生成一次，按最近对话回应。':'配置接口后，小鲸会接着你的话聊。');
  }
  function setBusy(value,label='') {
    busy=value;for(const id of ['aiRunAnalysis','aiSendChat','aiTestConnection','aiFetchModels','aiApply','aiPreset','aiEndpoint','aiKey','aiModelSelect','aiModel','aiBubbleNext','whaleQuickSend','characterButton'])$(id).disabled=value;
    $('companionCard').classList.toggle('is-thinking',value);$('characterButton').setAttribute('aria-busy',String(value));$('aiBubbleCancel').hidden=!value;if(value)bubbleHint('小鲸正在想一想…');else if(!$('aiBubbleHint').classList.contains('error'))bubbleHint('点击生成一次，按最近对话回应。');
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
    if(!messages.length){messages.push({role:'notice',content:'这里可以和小鲸聊任务与计划。主界面轻点小鲸，会根据最近对话生成一句新的回应；聊天不会直接改动任务。'});chatRender();}
    if(!$('aiDialog').open)$('aiDialog').showModal();
  }
  function readForm() {
    const endpoint=endpointURL($('aiEndpoint').value),model=$('aiModel').value.trim();
    if(model.length>200)throw new Error('模型名称过长。');
    return {config:{endpoint,model,shareContext:$('aiShareContext').checked},key:normalizeKey($('aiKey').value),remember:$('aiRememberKey').checked};
  }
  function renderModelChoices(models,selected) {
    const select=$('aiModelSelect');select.replaceChildren(new Option('请选择模型',''));
    for(const m of models)select.add(new Option(m.name&&m.name!==m.id?`${m.name} · ${m.id}`:m.id,m.id));
    if(selected&&!models.some(m=>m.id===selected))select.add(new Option(`手动填写：${selected}`,selected));
    select.add(new Option('手动填写其他模型 ID','__custom__'));select.value=selected||'';
  }
  function resetModelChoices() {
    let endpoint;try{endpoint=endpointURL($('aiEndpoint').value);}catch{endpoint='';}
    const models=endpoint===modelsEndpoint?availableModels:endpoint&&isDeepSeek(endpoint)?DEEPSEEK_MODELS:[];
    renderModelChoices(models,$('aiModel').value.trim());
    $('aiModelHint').textContent=endpoint===modelsEndpoint&&availableModels.length?`已从此接口读取 ${availableModels.length} 个模型。选择下拉项，也可以修改模型 ID。`:'先填密钥，再点击“读取可用模型”；候选项以平台实际返回的列表为准。';
  }
  function saveConfig(next) {
    if(next.key&&!next.config.model)throw new Error('请选择一个模型，或点击“读取可用模型”。');
    const destinationChanged=config.endpoint!==next.config.endpoint;config=next.config;key=next.key;remember=next.remember;if(destinationChanged){messages.length=0;history.length=0;chatRender();}let saved=true;
    try{localStorage.setItem(CONFIG,JSON.stringify(config));if(remember&&key)sessionStorage.setItem(KEY,JSON.stringify({endpoint:config.endpoint,model:config.model,key}));else sessionStorage.removeItem(KEY);}catch{saved=false;}
    modeNote();return saved;
  }
  async function fetchModelsFor(next,signal) {
    const models=await listModels(next.config,next.key,{signal});availableModels=models;modelsEndpoint=next.config.endpoint;
    const selected=chooseModel(models,next.config.model);next.config.model=selected;$('aiModel').value=selected;renderModelChoices(models,selected);
    $('aiModelHint').textContent=`已从平台读取 ${models.length} 个可用模型，当前选择 ${selected}。`;return models;
  }
  function openConfig() {
    $('aiEndpoint').value=config.endpoint;$('aiModel').value=config.model|| (isDeepSeek(config.endpoint)?AI_DEFAULTS.model:'');$('aiKey').value=key;
    $('aiRememberKey').checked=remember;$('aiShareContext').checked=config.shareContext;$('aiPreset').value=isDeepSeek(config.endpoint)?'deepseek':'custom';
    resetModelChoices();$('aiAdvanced').open=!isDeepSeek(config.endpoint);if(!$('aiConfigDialog').open){$('aiConfigDialog').showModal();$('aiConfigDialog').scrollTop=0;}
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
    const steps=document.createElement('section');steps.className='ai-next-steps';const stepTitle=document.createElement('h3');stepTitle.textContent='接下来这样做';const stepList=document.createElement('ol');
    for(const text of advice.nextSteps||[]){const li=document.createElement('li');li.textContent=text;stepList.append(li);}steps.append(stepTitle,stepList);root.append(steps);
    const list=document.createElement('div');list.className='ai-suggestion-list';
    const tasks=new Map(report.tasks.map(t=>[t.id,t]));
    const suggestions=[...advice.adjustments.map(a=>({title:tasks.get(a.taskId)?.title||'任务',detail:`总预算：${tasks.get(a.taskId)?.estimate||'未估算'} → ${a.estimate} 个番茄；已完成 ${tasks.get(a.taskId)?.actualPomodoros||0} 个，已投入 ${tasks.get(a.taskId)?.actualMinutes||0} 分钟`,reason:a.reason,guide:modificationSteps(a,report)})),...advice.subtasks.map(a=>({title:`新增子任务：${a.title}`,detail:`所属任务：${tasks.get(a.parentId)?.title||'任务'} · 预计 ${a.estimate} 个番茄`,reason:a.reason,guide:modificationSteps(a,report)}))];
    suggestions.forEach((a,index)=>{
      const label=document.createElement('label');label.className='ai-suggestion';
      const check=document.createElement('input');check.type='checkbox';check.dataset.adviceIndex=index;check.checked=true;check.setAttribute('aria-label',`应用建议：${a.title}`);
      const content=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('em'),reason=document.createElement('small');
      title.textContent=a.title;detail.textContent=a.detail;reason.textContent=a.reason;content.append(title,detail,reason);label.append(check,content);
      const wrapper=document.createElement('div');wrapper.className='ai-suggestion-wrap';const guide=document.createElement('details');guide.className='ai-step-guide';const summary=document.createElement('summary');summary.textContent='查看具体修改步骤';const ol=document.createElement('ol');for(const text of a.guide){const li=document.createElement('li');li.textContent=text;ol.append(li);}guide.append(summary,ol);wrapper.append(label,guide);list.append(wrapper);
    });
    if(!suggestions.length){const empty=document.createElement('p');empty.className='field-help';empty.textContent=advice.source==='ai'?'本次没有需要应用的结构或预算调整，可以参考以上建议继续。':'暂无足够依据调整预算。可以先填写预计番茄数、积累已完成任务，或配置接口获取任务拆分建议。';list.append(empty);}
    root.append(list);$('aiApply').hidden=!suggestions.length;
  }
  async function analyze() {
    if(busy)return;status('');
    let report;
    try {const state=getState(),selected=$('aiScope').value==='selected';if(selected&&!state.selectedTaskId)throw new Error('请先在任务列表中选择当前任务，再分析它的子树。');report=planReport(state,{scopeId:selected?state.selectedTaskId:null});report.goal=$('aiAnalysisGoal').value.trim().slice(0,800);}
    catch(error){status(error.message,true);return;}
    showAdvice(localAdvice(report),report);
    if(!ready()){status('本地统计已完成。配置接口后，可让小鲸进一步设计子任务并调整预算。');return;}
    if(!config.shareContext){status('本地统计已完成。若要使用 AI，请在接口设置中允许发送任务与专注统计。');return;}
    if(!report.tasks.length){status('先添加至少一项任务，再请 AI 分析。');return;}
    controller=new AbortController();setBusy(true,'小鲸正在分析你的计划……可以取消，当前任务尚未修改。');
    try {const advice=await analyzeAI(config,key,report,{signal:controller.signal});showAdvice(advice,report);status('AI 分析已完成。请检查所选建议后应用。');speak(bubbleText(advice.summary),{source:'AI 计划建议',sticky:true});}
    catch(error){status(`${error.message} 当前仍显示本地统计建议。`,true);}
    finally {controller=null;setBusy(false);}
  }
  $('aiAnalyzeOpen').onclick=()=>{openAssistant('plan');analyze();};
  $('aiChatOpen').onclick=()=>openAssistant('chat');$('aiChatExpand').onclick=()=>openAssistant('chat');$('characterButton').onclick=()=>makeBubble();$('aiBubbleNext').onclick=()=>makeBubble();$('aiAnalyzeShortcut').onclick=()=>{openAssistant('plan');analyze();};
  $('aiPlanTab').onclick=()=>tab('plan');$('aiChatTab').onclick=()=>tab('chat');
  $('aiConfigOpen').onclick=openConfig;$('aiSettingsLink').onclick=openConfig;$('aiRunAnalysis').onclick=analyze;
  $('aiScope').onchange=()=>{lastAdvice=null;lastReport=null;$('aiAnalysisResult').replaceChildren();$('aiApply').hidden=true;status('已更改范围，请重新分析。');};
  $('aiApply').onclick=()=>{
    if(busy||!lastAdvice||!lastReport)return;
    const selected=[...$('aiAnalysisResult').querySelectorAll('input[data-advice-index]:checked')].map(e=>Number(e.dataset.adviceIndex));
    if(change(()=>applyAdvice(getState(),lastAdvice,lastReport,selected))){lastAdvice=null;$('aiApply').hidden=true;$('aiAnalysisResult').querySelectorAll('input').forEach(e=>e.disabled=true);status('所选建议已应用并在本机保存。任务完成状态和当前计时没有改变。');toast('计划已更新，可以按新的小步骤继续。');}
  };
  $('aiModelSelect').onchange=()=>{const value=$('aiModelSelect').value;if(value==='__custom__'){$('aiModel').focus();return;}$('aiModel').value=value;};
  $('aiModel').oninput=resetModelChoices;$('aiEndpoint').onchange=resetModelChoices;
  $('aiPreset').onchange=()=>{if($('aiPreset').value==='deepseek'){$('aiEndpoint').value=AI_DEFAULTS.endpoint;if(!$('aiModel').value.trim())$('aiModel').value=AI_DEFAULTS.model;}$('aiAdvanced').open=$('aiPreset').value==='custom';resetModelChoices();};
  $('aiConfigForm').onsubmit=event=>{
    event.preventDefault();if(busy){status('请先等待或取消当前请求。',true,'aiConfigStatus');return;}
    try {const saved=saveConfig(readForm());$('aiConfigDialog').close();toast(saved?(remember?'接口配置已保存，密钥已在当前标签页暂存。':'接口配置已保存；密钥仅在本页有效，刷新后需重填。'):'配置在本页生效；浏览器无法保存，请勿关闭当前页面。');}
    catch(error){status(error.message,true,'aiConfigStatus');}
  };
  $('aiFetchModels').onclick=async()=>{
    if(busy)return;let next;try{next=readForm();}catch(error){status(error.message,true,'aiConfigStatus');return;}
    controller=new AbortController();setBusy(true);status('正在读取平台可用模型，不发送任务，也不生成聊天回复。',false,'aiConfigStatus');
    try{const models=await fetchModelsFor(next,controller.signal);status(`读取成功：${models.length} 个模型。请选择模型后点击“保存并测试”。`,false,'aiConfigStatus');}
    catch(error){status('读取模型失败：'+error.message,true,'aiConfigStatus');}
    finally{controller=null;setBusy(false);}
  };
  $('aiForgetKey').onclick=()=>{controller?.abort();key='';remember=false;$('aiKey').value='';$('aiRememberKey').checked=false;try{sessionStorage.removeItem(KEY);}catch{}modeNote();status('已清除本页及当前标签页暂存的密钥。',false,'aiConfigStatus');};
  $('aiCancelRequest').onclick=()=>controller?.abort();$('aiConfigCancelRequest').onclick=()=>controller?.abort();$('aiBubbleCancel').onclick=()=>controller?.abort();
  $('aiTestConnection').onclick=async()=>{
    if(busy)return;
    let next;try{next=readForm();}catch(error){status(error.message,true,'aiConfigStatus');return;}
    controller=new AbortController();setBusy(true);status('正在检查接口和模型……',false,'aiConfigStatus');
    try{
      if(isDeepSeek(next.config.endpoint)){
        status('第 1 步：使用此密钥读取 DeepSeek 可用模型。',false,'aiConfigStatus');
        await fetchModelsFor(next,controller.signal);
      }
      status(`第 2 步：测试模型 ${next.config.model||'（未选择）'}。仅发送一句测试文字，不发送任务。`,false,'aiConfigStatus');
      await requestAI(next.config,next.key,[{role:'user',content:'请只回复：OK'}],{signal:controller.signal,maxTokens:next.config.model.includes('reasoner')?4096:128});
      const saved=saveConfig(next);status(`连接成功：${next.config.model} 已实际返回回复。${saved?'配置已保存，关闭此窗口即可开始聊天或分析。':'配置仅在本页生效，请保持页面打开。'}`,false,'aiConfigStatus');
    }
    catch(error){status('连接失败：'+error.message,true,'aiConfigStatus');}
    finally{controller=null;setBusy(false);}
  };
  window.addEventListener('whale-data-cleared',()=>{controller?.abort();config={...AI_DEFAULTS};key='';remember=false;lastAdvice=null;lastReport=null;messages.length=0;history.length=0;try{localStorage.removeItem(CONFIG);sessionStorage.removeItem(KEY);}catch{}$('aiKey').value='';$('aiAnalysisResult').replaceChildren();$('aiApply').hidden=true;chatRender();modeNote();});
  function contextForConversation(){
    if($('aiChatContext').checked&&!config.shareContext)throw new Error('请先在接口设置中允许发送任务统计，或在聊天窗口取消附带统计。');
    return $('aiChatContext').checked?'\n以下为用户主动选择附带的任务统计：'+JSON.stringify(apiContext(planReport(getState()))):'';
  }
  function rememberReply(user,assistant,{bubble=false}={}){
    history.push(user,assistant);messages.push(bubble?{role:'notice',content:'轻点小鲸 · 换了一句新的 AI 回应。'}:user,assistant);
    if(messages.length>60)messages.splice(0,messages.length-60);if(history.length>12)history.splice(0,history.length-12);chatRender();
  }
  async function makeBubble(){
    if(busy)return;
    if(!getState().settings.bubbles){openAssistant('chat');status('气泡目前已关闭。你可以在这里聊天，或到专注设置开启气泡。');return;}
    if(!ready()){bubbleHint('先连接 AI，小鲸才能生成新的回应。');openConfig();return;}
    if(Date.now()-lastBubbleAt<1000){bubbleHint('刚刚换好一句，稍等一下再点我。');return;}
    let context;try{context=contextForConversation();}catch(error){bubbleHint(error.message,true);return;}
    lastBubbleAt=Date.now();controller=new AbortController();setBusy(true,'小鲸正在接着最近的对话想一句…');
    try{
      const reply=await requestBubble(config,key,history,{mode:getState().timer.mode,context,signal:controller.signal});
      rememberReply({role:'user',content:'我轻点了小鲸，请接着最近的话题换一句。'},{role:'assistant',content:reply},{bubble:true});
      speak(bubbleText(reply),{source:'AI 对话 · 点我再换一句',sticky:true});status('新的 AI 回应已显示在小鲸气泡里。');
    }catch(error){bubbleHint(error.message,true);status(error.message,true);status(error.message,true,'aiConfigStatus');}
    finally{controller=null;setBusy(false);}
  }
  async function sendChat(input,{quick=false}={}){
    if(busy)return;const content=input.value.trim();if(!content)return;
    if(!ready()){if(quick)openConfig();else status('请先打开“接口设置”，配置模型和密钥后再聊天。',true);return;}
    let context;try{context=contextForConversation();}catch(error){status(error.message,true);bubbleHint(error.message,true);return;}
    if(quick&&!getState().settings.bubbles)openAssistant('chat');
    controller=new AbortController();setBusy(true,'小鲸正在回复…');
    try{
      const user={role:'user',content};const reply=await requestAI(config,key,[{role:'system',content:CHAT_PROMPT+context},...history.slice(-12),user],{signal:controller.signal});
      rememberReply(user,{role:'assistant',content:reply});input.value='';status('小鲸回复了。点击小鲸，还可以围绕最近的对话换一句。');speak(bubbleText(reply),{source:'AI 对话 · 来自最近的聊天',sticky:true});
    }catch(error){status(error.message,true);bubbleHint(error.message,true);status(error.message,true,'aiConfigStatus');}
    finally{controller=null;setBusy(false);}
  }
  $('aiChatForm').onsubmit=event=>{event.preventDefault();sendChat($('aiChatInput'));};
  $('whaleQuickChat').onsubmit=event=>{event.preventDefault();sendChat($('whaleQuickInput'),{quick:true});};
  modeNote();
}
