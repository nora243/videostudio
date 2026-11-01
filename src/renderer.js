const $ = id => document.getElementById(id);
let toastTimer;
let activeProjectId=null;
let lastStatus=null;
let localGenerating = false, renderedScriptVersion = '', renderedRaw = '', currentStoryboard = null;
function storeDraft() {
  try{
    if(!activeProjectId)return;
    localStorage.setItem(`project-draft:${activeProjectId}`,JSON.stringify(readProject()));
    if(currentStoryboard&&$('script-story-info').querySelector('[data-field="title"]'))localStorage.setItem(`storyboard-draft:${activeProjectId}`,JSON.stringify({version:renderedScriptVersion,data:readStoryboard()}));
  }catch{}
}
function notify(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6500); }
function rawFeedback(message,error=false){const node=$('raw-import-feedback');node.textContent=message;node.hidden=!message;node.dataset.error=String(error);node.setAttribute('role',error?'alert':'status');}
async function call(promise) { const result = await promise; if (!result.ok) throw new Error(result.error); return result.data; }
function renderStatus(data) {
  lastStatus=data;
  window.pipelineUI?.render(data);
  activeProjectId=data.activeProjectId||activeProjectId;
  renderScriptStatus(data);
  renderFlowStatus(data);
  if (data.flowBalance) {
    $('balance-source').textContent = `Số dư đã đọc: ${data.flowBalance.amount.toLocaleString('vi-VN')} tín dụng · ${new Date(data.flowBalance.readAt).toLocaleString('vi-VN')}. Bấm đọc lại sau khi tạo video hoặc đổi tài khoản.`;
  }
  $('browser-status').textContent = data.browser ? '● Trình duyệt đã kết nối' : '● Trình duyệt chưa kết nối';
  for (const service of ['gemini', 'flow']) {
    const opened = data.services[service], confirmed = Boolean(data.confirmations[service]);
    $(service + '-badge').textContent = opened ? (confirmed ? 'Bạn đã xác nhận' : 'Đang mở · chờ đăng nhập') : 'Chưa mở';
    $(service + '-badge').classList.toggle('ready', opened && confirmed);
    document.querySelector(`[data-confirm="${service}"]`).disabled = !opened;
    if (confirmed) $(service + '-note').textContent = `Xác nhận lần cuối: ${new Date(data.confirmations[service]).toLocaleString('vi-VN')}. Phiên có thể hết hạn.`;
  }
}
function readProject() { return { title: $('title').value.trim(), brief: $('brief').value.trim(), style: $('style').value, ratio: $('ratio').value, scenes: $('scenes').value==='auto'?'auto':Number($('scenes').value), sceneDuration: $('sceneDuration').value==='auto'?'auto':Number($('sceneDuration').value), credits: Number($('credits').value), cost: Number($('cost').value), production:window.productionUI.read() }; }
function estimate() {
  const p = readProject();
  if(p.scenes==='auto'){$('estimate').textContent='Auto';$('meter-fill').style.width='0%';$('budget-note').textContent='Ước tính sau khi Gemini chọn số cảnh.';return;}
  const total = p.scenes * p.cost;
  $('estimate').textContent = total.toLocaleString('vi-VN');
  $('meter-fill').style.width = `${Math.min(100, p.credits ? total / p.credits * 100 : 100)}%`;
  $('meter-fill').style.background = total > p.credits ? '#f0a18c' : '#b6a2fb';
  $('budget-note').textContent = total > p.credits ? `Vượt ngân sách ${(total - p.credits).toLocaleString('vi-VN')} tín dụng.` : `Còn dự kiến ${(p.credits - total).toLocaleString('vi-VN')} tín dụng sau dự án.`;
}
for (const button of document.querySelectorAll('[data-open]')) button.addEventListener('click', async () => {
  const original = button.textContent; button.disabled = true; button.textContent = 'Đang mở trình duyệt…';
  try { renderStatus(await call(window.studio.open(button.dataset.open))); notify('Trình duyệt đã mở. Hãy tự đăng nhập, sau đó bấm “Tôi đã đăng nhập”.'); } catch (e) { notify(e.message); }
  finally { button.disabled = false; button.textContent = original; }
});
for (const button of document.querySelectorAll('[data-confirm]')) button.addEventListener('click', async () => {
  const flow = button.dataset.confirm === 'flow';
  button.disabled = true; button.textContent = flow ? 'Đang kiểm tra tín dụng…' : 'Đang xác nhận…';
  try {
    const data = await call(window.studio.confirm(button.dataset.confirm));
    renderStatus(data);
    if (flow && !data.creditWarning && data.flowBalance) {
      $('credits').value = data.flowBalance.amount; estimate(); storeDraft();
      notify(`Đã xác nhận Flow. Số dư: ${data.flowBalance.amount.toLocaleString('vi-VN')} tín dụng.`);
    } else notify(data.creditWarning ? `Đã lưu xác nhận Flow. ${data.creditWarning}` : 'Đã lưu xác nhận của bạn.');
  } catch (e) { notify(e.message); }
  finally { button.disabled = false; button.textContent = 'Tôi đã đăng nhập'; }
});
$('project').addEventListener('submit', async event => { event.preventDefault(); try { renderStatus(await call(window.studio.save(readProject()))); notify('Đã lưu dự án trên máy.'); } catch (e) { notify(e.message); } });
$('folder').addEventListener('click', async () => { try { await call(window.studio.folder()); } catch (e) { notify(e.message); } });
$('read-credits').addEventListener('click', async () => {
  const button = $('read-credits'); button.disabled = true; button.textContent = 'Đang đọc số dư…';
  try {
    const data = await call(window.studio.readCredits());
    $('credits').value = data.flowBalance.amount;
    storeDraft();
    renderStatus(data); estimate();
    notify(`Đã đọc ${data.flowBalance.amount.toLocaleString('vi-VN')} tín dụng từ Flow và cập nhật ngân sách.`);
  } catch (e) { notify(e.message); }
  finally { button.disabled = false; button.textContent = 'Đọc tín dụng Flow'; }
});
for (const id of ['scenes', 'credits', 'cost']) $(id).addEventListener('input', estimate);
$('prompt').addEventListener('click', async () => {
  if (!$('project').reportValidity()) return;
  const p = readProject(); if (!p.brief) return notify('Hãy mô tả ý tưởng video trước khi tạo prompt.');
  try { $('prompt-output').value = await call(window.studio.previewPrompt(p)); $('prompt-area').hidden = false; $('prompt-dialog').showModal(); }
  catch (error) { notify(error.message); }
});
$('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('prompt-output').value); notify('Đã sao chép prompt.'); } catch { $('prompt-output').select(); notify('Hãy nhấn Ctrl+C để sao chép prompt.'); } });

function renderScriptStatus(data) {
  const job = data.geminiJob;
  const busy = localGenerating || data.generatingScript || data.pipelineBusy;
  const awaitingRewrite=Boolean(job?.sceneIds&&['submitting','waiting','interrupted'].includes(job.status));
  const labels = { preparing: 'Chuẩn bị gửi', submitting: 'Đang gửi', waiting: 'Gemini đang viết…', completed: 'Đã nhận kịch bản', invalid_json: 'Cần kiểm tra JSON', interrupted: 'Cần lấy lại phản hồi', failed: 'Chưa gửi được' };
  $('script-status').textContent = job ? labels[job.status] || job.status : 'Chưa có kịch bản';
  $('script-progress').textContent = job?.error || (data.pipelineBusy ? 'Quy trình Sản xuất video đang chạy. Theo dõi các bước ở bảng tiến trình phía trên.' : (localGenerating||data.generatingScript) ? 'Đang chờ Gemini. Có thể xem tiến trình trong tab trình duyệt; tool không tự gửi lại yêu cầu.' : 'Kết quả được lưu trên máy. Bạn có thể chỉnh từng cảnh trước khi tạo video.');
  $('generate-script').disabled = busy || ['submitting', 'waiting', 'interrupted'].includes(job?.status);
  $('generate-new-script').disabled = $('generate-script').disabled || data.flowBusy;
  $('generate-new-script').textContent = (localGenerating||data.generatingScript) ? 'Đang tạo kịch bản…' : 'Tạo mới kịch bản';
  $('generate-script').textContent = (localGenerating||data.generatingScript) ? 'Đang tạo kịch bản…' : data.storyboard?.scenes.length ? `Viết lại ${window.studioUI?.selectedIds().length||0} cảnh đã chọn` : 'Gửi Gemini & tạo kịch bản';
  $('recover-script').disabled = busy || !job?.baseline || job?.status==='completed';
  $('retry-script').hidden = !job?.prompt || !['interrupted','failed','waiting','submitting','invalid_json'].includes(job.status);
  $('retry-script').disabled = busy;
  $('save-storyboard').disabled = busy || !data.storyboard;
  $('export-storyboard').disabled = !data.storyboard;
  $('import-script').disabled = busy;
  if (job?.raw && job.raw !== renderedRaw && document.activeElement !== $('raw-response')) { $('raw-response').value = job.raw; renderedRaw = job.raw; }
  if (job?.status === 'invalid_json') {
    $('raw-details').open = true;
    if($('raw-import-feedback').dataset.jobId!==job.id){$('raw-import-feedback').dataset.jobId=job.id;rawFeedback(job.error||'Không áp dụng được phản hồi Gemini. Kiểm tra JSON bên dưới.',true);}
  }
  if (data.storyboard && data.storyboard.updatedAt !== renderedScriptVersion) {
    currentStoryboard = data.storyboard; renderedScriptVersion = data.storyboard.updatedAt;
    renderStoryboard(data.storyboard);
  }
  for(const input of document.querySelectorAll('#storyboard input,#storyboard textarea,#storyboard select,#storyboard button,#script-story-info input,#script-story-info textarea'))input.disabled=busy||awaitingRewrite;
}

function field(parent, labelText, value, name, type = 'textarea') {
  const label = document.createElement('label'); label.textContent = labelText;
  const input = document.createElement(type === 'number' ? 'input' : 'textarea');
  if (type === 'number') { input.type = 'number'; input.min = '1'; input.max = '120'; input.step = '1'; }
  input.dataset.field = name; input.value = value; label.append(input); parent.append(label);
  if(name==='duration_seconds')label.classList.add('scene-timing');
  if(name==='description_vi')label.dataset.editorTab='visual';
  if(name==='voiceover_vi')label.dataset.editorTab='voice';
  if(name==='video_prompt_en'||name==='negative_prompt_en')label.dataset.editorTab='prompt';
}
function renderStoryboard(script) {
  
  try{const draft=JSON.parse(localStorage.getItem(`storyboard-draft:${activeProjectId}`)||'null');if(draft?.version===script.updatedAt&&Array.isArray(draft.data?.scenes))script={...script,...draft.data};}catch{}
  const container = $('storyboard'); container.replaceChildren();
  $('script-caption').textContent = `${script.title} · ${script.scenes.length} cảnh · cập nhật ${new Date(script.updatedAt).toLocaleString('vi-VN')}`;
  $('script-story-info').replaceChildren();
  field($('script-story-info'), 'Tên kịch bản', script.title, 'title');
  field($('script-story-info'), 'Tóm tắt', script.summary, 'summary');
  const previousScene=$('flow-scene').value;$('flow-scene').replaceChildren();
  for (const scene of script.scenes) {
    const position=script.scenes.indexOf(scene)+1;
    const option=document.createElement('option');option.value=scene.id;option.textContent=`Cảnh ${position} · ${scene.duration_seconds} giây`;$('flow-scene').append(option);
    const card = document.createElement('article'); card.className = 'scene-card'; card.dataset.scene = scene.id;
    const heading = document.createElement('h3'); heading.textContent = `Cảnh ${position}`; card.append(heading);
    field(card, 'Thời lượng dự kiến (giây)', scene.duration_seconds, 'duration_seconds', 'number');
    field(card, 'Mô tả hình ảnh', scene.description_vi, 'description_vi');
    field(card, scene.audio?'Lời dẫn ngoài hình (để trống nếu không có)':'Lời dẫn', scene.voiceover_vi, 'voiceover_vi');
    field(card, 'Prompt video (English)', scene.video_prompt_en, 'video_prompt_en');
    field(card, 'Negative prompt (English)', scene.negative_prompt_en, 'negative_prompt_en');
    window.productionUI.renderAudio(card,scene);
    container.append(card);
  }
  if([...$('flow-scene').options].some(option=>option.value===previousScene))$('flow-scene').value=previousScene;
  window.studioUI?.boardChanged(activeProjectId);
}
function readStoryboard() {
  const value = name => $('script-story-info').querySelector(`[data-field="${name}"]`).value;
  return { title: value('title'), summary: value('summary'), scenes: [...$('storyboard').querySelectorAll('[data-scene]')].map(card => {
    const scene = { id: Number(card.dataset.scene) };
    for (const input of card.querySelectorAll('[data-field]')) scene[input.dataset.field] = input.dataset.field === 'duration_seconds' ? Number(input.value) : input.value;
    const audio=window.productionUI.readAudio(card);if(audio)scene.audio=audio;
    return scene;
  }) };
}
async function runScript(recover = false, explicitIds = null, retry = false, createNew = false) {
  if(localGenerating)return;
  window.libraryUI?.workspace('script-nav');
  if (!recover && !retry && !$('project').reportValidity()) return;
  const sceneIds=createNew?null:retry?lastStatus?.geminiJob?.sceneIds:!recover&&currentStoryboard?.scenes.length?(explicitIds||window.studioUI.selectedIds()):null;
  if(sceneIds&&!sceneIds.length)return notify('Hãy tick các cảnh cần viết lại hoặc dùng nút Tạo lại cảnh này.');
  localGenerating = true; $('generate-script').disabled = true; $('recover-script').disabled = true; $('retry-script').disabled = true;
  if(lastStatus)renderScriptStatus(lastStatus);window.studioUI.refreshControls();
  $('script-progress').textContent = retry ? 'Đang gửi lại prompt của yêu cầu trước tới Gemini…' : recover ? 'Đang lấy lại phản hồi; không gửi prompt mới…' : 'Đang gửi ý tưởng tới Gemini…';
  try {
    const project=readProject();
    if(createNew&&project.production)project.production={...project.production,geminiPrompt:''};
    if(!recover&&!retry){await call(window.studio.save(project));if(sceneIds)renderStatus(await call(window.studio.saveStoryboard(readStoryboard())));}
    const data = await call(retry ? window.studio.retryScript() : recover ? window.studio.recoverScript() : window.studio.generateScript({...project,...(sceneIds?{sceneIds,rewriteNote:$('script-rewrite-note').value}:{})}));
    localGenerating = false;
    if(createNew&&!data.scriptWarning)window.productionUI.apply(data.project?.production);
    renderStatus({ ...data, generatingScript: false });
    if(!data.scriptWarning){storeDraft();if(sceneIds?.length)window.studioUI?.selectScene(sceneIds[0]);}
    notify(data.scriptWarning || data.scriptNotice || (sceneIds?`Đã viết lại ${sceneIds.length} cảnh được chọn; các cảnh khác được giữ nguyên.`:`Đã dựng ${data.storyboard.scenes.length} cảnh từ Gemini.`));
  } catch (error) { notify(error.message); }
  finally {
    localGenerating = false;
    try { renderStatus(await call(window.studio.status())); } catch {}
  }
}
$('generate-script').addEventListener('click', () => runScript());
$('generate-new-script').addEventListener('click', () => runScript(false,null,false,true));
$('recover-script').addEventListener('click', () => runScript(true));
$('retry-script').addEventListener('click', () => runScript(false,null,true));
$('save-storyboard').addEventListener('click', async () => { try { renderStatus(await call(window.studio.saveStoryboard(readStoryboard()))); notify('Đã lưu chỉnh sửa kịch bản.'); } catch (error) { notify(error.message); } });
async function importScriptResponse(){
  if($('import-script').disabled)return;
  $('import-script').disabled=true;rawFeedback('Đang kiểm tra và áp dụng JSON…');
  try{
    const data=await call(window.studio.importScript($('raw-response').value));
    renderStatus(data);storeDraft();
    const sceneId=data.geminiJob?.sceneIds?.[0];
    if(sceneId){window.studioUI?.selectScene(sceneId);window.studioUI?.showTab('visual');}
    const message=data.scriptNotice||'Đã áp dụng JSON vào kịch bản.';
    rawFeedback(message);$('raw-dialog').close();notify(message);
  }catch(error){rawFeedback(error.message,true);notify(error.message);}
  finally{$('import-script').disabled=Boolean(localGenerating||lastStatus?.generatingScript||lastStatus?.pipelineBusy);}
}
$('import-script').addEventListener('click',importScriptResponse);
$('export-storyboard').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(readStoryboard(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'video-storyboard.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('script-nav').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); $('script-nav').click(); } });

let flowUiBusy=false,flowQueueVersion='';
function flowOptions(){return{resolution:$('flow-resolution').value,ratio:$('ratio').value};}
function renderFlowStatus(data){
  const busy=flowUiBusy||data.flowBusy||data.pipelineBusy,batch=data.flowBatch;
  const labels={queued:'Chờ gửi',preparing:'Chuẩn bị',submitting:'Đang gửi',generating:'Flow đang tạo',generated:'Đã tạo · chờ tải',downloading:'Đang tải',downloaded:'Đã tải',needs_review:'Cần đối soát',download_failed:'Cần tải lại',failed:'Chưa gửi được',cancelled:'Đã bỏ qua'};
  $('flow-status').textContent=busy?'Đang xử lý':batch?({running:'Đang chạy',paused:'Tạm dừng',completed:'Hoàn tất',finished:'Đã kết thúc'}[batch.status]||batch.status):data.flowProject?'Đã liên kết Flow':'Tự tạo project khi sản xuất';
  $('flow-project-info').textContent=data.flowProject?`Project riêng của dự án: ${data.flowProject.url}${data.flowProject.warning?' · '+data.flowProject.warning:''}`:'Khi chuẩn bị hoặc tạo video, tool sẽ tự tạo project Flow riêng và lưu liên kết cho dự án này.';
  $('flow-bind').textContent=data.flowProject?'Mở project Flow':'Tạo project Flow cho dự án';
  $('flow-reference-info').textContent=data.flowReference?`Ảnh chung: ${data.flowReference.name}. Tool sẽ upload/chọn và gắn ảnh này cho từng cảnh.`:'Chưa chọn ảnh tham chiếu. Có thể tạo bằng prompt hoặc chọn cùng một ảnh để tăng nhất quán nhân vật.';
  for(const id of ['flow-bind','flow-reference','flow-clear-reference','flow-resolution','flow-scene'])$(id).disabled=busy;
  for(const id of ['flow-prepare','flow-one','flow-start'])$(id).disabled=busy||!data.storyboard;
  $('flow-pause').disabled=!data.flowBusy;
  for(const id of ['flow-resume','flow-recover','flow-finish'])$(id).disabled=busy||!batch;
  if(data.flowPrepared)$('flow-prepared-info').textContent=`Cảnh ${data.flowPrepared.sceneId}: ${data.flowPrepared.configuration.model} · ${data.flowPrepared.configuration.resolution} · ${data.flowPrepared.configuration.duration} giây · ${data.flowPrepared.configuration.ratio} · x1 → ${data.flowPrepared.cost} tín dụng theo Flow.`;
  const projectJobs=data.productionJobs||batch?.jobs||[];
  $('flow-progress').textContent=projectJobs.length?`${projectJobs.filter(j=>j.status==='downloaded').length}/${projectJobs.length} cảnh đã tải. Tín dụng đã dùng/dự trù: ${data.productionSpent??batch?.spent??0}. ${batch?.pauseRequested?'Đang chờ cảnh hiện tại hoàn tất để tạm dừng. ':''}${batch?.error||''}`:'';
  window.referencesUI?.render(data,busy);
  window.studioUI?.sync({...data,flowBusy:busy});
}
async function flowAction(action){
  flowUiBusy=true;
  try{renderStatus({...await call(window.studio.status()),flowBusy:true});const data=await action();flowUiBusy=false;renderStatus(data);return data;}
  catch(error){notify(error.message);}
  finally{flowUiBusy=false;try{renderStatus(await call(window.studio.status()));}catch{}}
}
$('flow-bind').addEventListener('click',()=>flowAction(async()=>{await call(window.studio.save(readProject()));return call(window.studio.flowBind());}));
$('flow-reference').addEventListener('click',()=>flowAction(()=>call(window.studio.flowReference())));
$('flow-clear-reference').addEventListener('click',()=>flowAction(()=>call(window.studio.flowClearReference({scope:'common'}))));
async function flowSelection(start=false,one=false){
  if(!currentStoryboard)return notify('Hãy tạo kịch bản trước.');
  const sceneId=Number($('flow-scene').value),sceneIds=one?[sceneId]:[...document.querySelectorAll('[data-flow-scene]:checked')].map(e=>Number(e.dataset.flowScene)),options=flowOptions();
  await flowAction(async()=>{
    await call(window.studio.save(readProject()));
    await call(window.studio.saveStoryboard(readStoryboard()));
    const data=await call(start?window.studio.flowStart({sceneIds,options}):window.studio.flowPrepare({sceneId,options}));
    notify(start?'Đã bắt đầu hàng đợi Flow.':'Đã chuẩn bị cảnh và đọc chi phí; chưa tạo video.');return data;
  });
}
$('flow-prepare').addEventListener('click',()=>flowSelection());
$('flow-one').addEventListener('click',()=>flowSelection(true,true));
$('flow-start').addEventListener('click',()=>{const action=window.studioUI?.primaryAction();if(action==='recover')$('flow-recover').click();else if(action==='resume')$('flow-resume').click();else flowSelection(true,false);});
for(const [id,method] of [['flow-pause','flowPause'],['flow-resume','flowResume'],['flow-recover','flowRecover'],['flow-finish','flowFinish']])$(id).addEventListener('click',()=>flowAction(()=>call(window.studio[method]())));
$('flow-nav').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('flow-nav').click();}});
function applyWorkspace(data){
  activeProjectId=data.activeProjectId;renderedScriptVersion='';renderedRaw='';currentStoryboard=null;flowQueueVersion='';
  $('storyboard').replaceChildren();$('script-story-info').replaceChildren();$('flow-scene').replaceChildren();$('script-caption').textContent='';$('raw-response').value='';$('prompt-area').hidden=true;
  $('flow-prepared-info').textContent='Chuẩn bị để kiểm tra cấu hình và chi phí trước khi tạo video.';
  $('sceneDuration').value=data.project?.sceneDuration??8;
  for(const[key,value]of Object.entries(data.project||{}))if($(key))$(key).value=value;
  try{const draft=JSON.parse(localStorage.getItem(`project-draft:${activeProjectId}`)||'null');if(draft)for(const[key,value]of Object.entries(draft))if($(key))$(key).value=value;}catch{}
  let production=data.project?.production;try{const draft=JSON.parse(localStorage.getItem(`project-draft:${activeProjectId}`)||'null');if(draft&&Object.hasOwn(draft,'production'))production=draft.production;}catch{}
  window.productionUI.apply(production);
  renderStatus(data);estimate();
  window.studioUI?.boardChanged(activeProjectId);
}
function renameProjectDraft(id,name){
  try{const key=`project-draft:${id}`,draft=JSON.parse(localStorage.getItem(key)||'null');if(draft){draft.title=name;localStorage.setItem(key,JSON.stringify(draft));}}catch{}
  if(activeProjectId===id){$('title').value=name;storeDraft();}
}
window.workspaceUI={readProject,apply:applyWorkspace,storeDraft,notify,rename:renameProjectDraft,readStoryboard,updateStatus:renderStatus,status:()=>lastStatus,scriptBusy:()=>localGenerating,regenerate:ids=>runScript(false,ids),saveEdited:async(script)=>{const data=await call(window.studio.saveStoryboard(script));renderStatus(data);storeDraft();return data;}};
$('project-new').addEventListener('click',async()=>{storeDraft();try{applyWorkspace(await call(window.studio.projectNew()));window.libraryUI?.workspace('overview-nav');notify('Đã tạo dự án mới.');}catch(error){notify(error.message);}});

document.addEventListener('input', storeDraft);
document.addEventListener('change', storeDraft);
(async () => { try {
  const data = await call(window.studio.status());
  try{if(!localStorage.getItem('project-draft-migrated')){const old=localStorage.getItem('project-draft');if(old&&!localStorage.getItem(`project-draft:${data.activeProjectId}`))localStorage.setItem(`project-draft:${data.activeProjectId}`,old);localStorage.setItem('project-draft-migrated','1');}}catch{}
  applyWorkspace(data);
} catch (e) { notify(e.message); } })();
setInterval(async () => { try { renderStatus(await call(window.studio.status())); } catch { /* Keep current UI during shutdown. */ } }, 5000);
