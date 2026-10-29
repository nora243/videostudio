(() => {
const $=id=>document.getElementById(id),make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
const statuses={queued:'Chờ gửi',selected:'Đã chọn',disabled:'Bỏ chọn',preparing:'Chuẩn bị',submitting:'Đang gửi',generating:'Đang tạo',generated:'Chờ tải',downloading:'Đang tải',downloaded:'Đã tải',needs_review:'Cần đối soát',download_failed:'Lỗi tải',failed:'Lỗi',cancelled:'Đã bỏ qua'};
const processing=new Set(['preparing','submitting','generating','generated','downloading']),issues=new Set(['failed','needs_review','download_failed']);
let latest=null,projectId=null,activeScene=1,mode='plan',lastBatch=null,selectedJob=null,detailKey='',version='',dirty=false,debounce;
let editing=false,undoScript=null;
const cards=()=>[...$('storyboard').querySelectorAll('.scene-card')];
const checkboxes=()=>[...$('scene-outline').querySelectorAll('[data-flow-scene]')];
const selectedIds=()=>checkboxes().filter(e=>e.checked).map(e=>Number(e.dataset.flowScene));
const projectJobs=()=>latest?.productionJobs||latest?.flowBatch?.jobs||[];
const sceneValue=(card,name)=>card.querySelector(`[data-field="${name}"]`)?.value||'';
const safeRead=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
function persistSelection(){try{localStorage.setItem(`studio-selection:${projectId}`,JSON.stringify({selected:selectedIds(),known:cards().map(c=>Number(c.dataset.scene))}));}catch{}}
function navigate(nav){if(window.libraryUI)window.libraryUI.workspace(nav);else show(nav);}
const projectCard=document.querySelector('.bottom-grid>.project');$('script-project-host').append(projectCard);
$('script-generate-host').append($('generate-script'));
$('prompt-dialog-host').append($('prompt-area'));
const sceneTools=make('div','scene-edit-tools');
for(const [id,text,title]of [['scene-up','↑','Chuyển cảnh lên'],['scene-down','↓','Chuyển cảnh xuống'],['scene-regenerate','Tạo lại cảnh này','Gửi Gemini viết lại riêng cảnh đang xem'],['scene-delete','Xóa cảnh','Xóa cảnh khỏi kịch bản'],['scene-undo','Hoàn tác','Hoàn tác thao tác đổi vị trí hoặc xóa gần nhất']]){const button=make('button','secondary',text);button.id=id;button.type='button';button.title=title;button.setAttribute('aria-label',title);sceneTools.append(button);}
const position=make('select');position.id='scene-position';position.setAttribute('aria-label','Chuyển đến vị trí');sceneTools.prepend(position);$('storyboard').before(sceneTools);
const rewriteLabel=make('label','','Yêu cầu viết lại cảnh (tùy chọn)'),rewriteInput=make('textarea');rewriteInput.id='script-rewrite-note';rewriteInput.maxLength=3000;rewriteInput.placeholder='Ví dụ: hook mạnh hơn, giải thích điều kiện bảo hành, thêm bước kiểm tra thực tế…';rewriteLabel.append(rewriteInput);$('project').append(rewriteLabel);
function show(nav='overview-nav'){
 const view=nav==='script-nav'?'script':nav==='flow-nav'?'flow':'workspace';document.body.dataset.view=view;$('library-section').hidden=true;
 $('app-route').textContent=`WORKSPACE / ${view==='script'?'KỊCH BẢN':view==='flow'?'SẢN XUẤT VIDEO':'TỔNG QUAN'}`;
 for(const item of document.querySelectorAll('aside nav>div'))item.classList.toggle('selected',item.id===nav);
 try{localStorage.setItem('studio-view',view);}catch{}
 window.scrollTo(0,0);if(view==='script')selectScene(activeScene,false);if(view==='flow'){selectedJob=projectJobs().find(j=>j.sceneId===activeScene)?.id||selectedJob;renderQueue();}
}
function boardChanged(id){
 if(projectId!==id){projectId=id;activeScene=safeRead(`studio-active-scene:${id}`,1);lastBatch=null;selectedJob=null;mode='plan';dirty=false;undoScript=null;rewriteInput.value='';}
 const all=cards(),saved=safeRead(`studio-selection:${id}`,null),selected=new Set(saved?.selected||all.map(c=>Number(c.dataset.scene))),known=new Set(saved?.known||[]);
 $('scene-outline').replaceChildren();$('script-scene-count').textContent=all.length;
 $('scene-position').replaceChildren();
 for(const [index,card] of all.entries()){
  const sceneId=Number(card.dataset.scene),row=make('div','outline-row');row.dataset.outlineScene=sceneId;row.setAttribute('role','listitem');
  const checkbox=make('input');checkbox.type='checkbox';checkbox.dataset.flowScene=sceneId;checkbox.checked=!saved||!known.has(sceneId)||selected.has(sceneId);checkbox.setAttribute('aria-label',`Chọn cảnh ${index+1} để viết lại hoặc sản xuất`);
  checkbox.addEventListener('change',()=>{persistSelection();updateSelection();renderQueue();});
  const option=make('option','',`Vị trí ${index+1}`);option.value=index;$('scene-position').append(option);
  const button=make('button'),title=make('span','outline-title',`Cảnh ${String(index+1).padStart(2,'0')}`);button.type='button';button.dataset.selectScene=sceneId;button.setAttribute('aria-label',`Biên tập cảnh ${index+1}`);
  title.append(make('small','',`${sceneValue(card,'duration_seconds')}s`));button.append(title,make('span','outline-excerpt',sceneValue(card,'description_vi')||'Chưa có mô tả'));button.addEventListener('click',()=>selectScene(sceneId));row.append(checkbox,button);$('scene-outline').append(row);
 }
 if(!all.some(c=>Number(c.dataset.scene)===activeScene))activeScene=Number(all[0]?.dataset.scene)||1;
 $('script-empty').hidden=Boolean(all.length);$('storyboard').hidden=!all.length;
 selectScene(activeScene,false);filterOutline();updateSelection();
}
function selectScene(id,scroll=true){
 const all=cards();if(all.length&&!all.some(c=>Number(c.dataset.scene)===Number(id)))id=Number(all[0].dataset.scene);
 activeScene=Number(id)||1;for(const card of all)card.classList.toggle('is-active',Number(card.dataset.scene)===activeScene);
 for(const row of $('scene-outline').children){const chosen=Number(row.dataset.outlineScene)===activeScene;row.classList.toggle('is-active',chosen);row.querySelector('button').setAttribute('aria-current',chosen?'true':'false');if(chosen&&scroll&&!row.hidden)row.scrollIntoView({block:'nearest'});}
 $('selected-scene-title').textContent=all.length?`Cảnh ${String(all.findIndex(c=>Number(c.dataset.scene)===activeScene)+1).padStart(2,'0')}`:'Chưa có cảnh';
 const index=all.findIndex(c=>Number(c.dataset.scene)===activeScene);$('scene-prev').disabled=index<=0;$('scene-next').disabled=index<0||index>=all.length-1;
 $('scene-position').value=String(index);updateEditTools();
 if([...$('flow-scene').options].some(o=>Number(o.value)===activeScene))$('flow-scene').value=activeScene;
 try{localStorage.setItem(`studio-active-scene:${projectId}`,JSON.stringify(activeScene));}catch{}
 if(mode==='plan')renderQueue();
}
function showTab(tab){
 $('storyboard').dataset.editorTab=tab;
 for(const button of document.querySelectorAll('[data-editor-tab-button]'))button.setAttribute('aria-selected',String(button.dataset.editorTabButton===tab));
 try{localStorage.setItem('studio-editor-tab',JSON.stringify(tab));}catch{}
}
function updateSelection(){
 const chosen=new Set(selectedIds()),duration=cards().filter(c=>chosen.has(Number(c.dataset.scene))).reduce((sum,c)=>sum+Number(sceneValue(c,'duration_seconds')||0),0);
 $('script-selection-summary').textContent=`${chosen.size}/${cards().length} cảnh được chọn · ${duration}s`;
 $('queue-selection-summary').textContent=`${chosen.size} cảnh được chọn · ${duration} giây dự kiến`;
 $('queue-select-all').checked=cards().length>0&&chosen.size===cards().length;$('queue-select-all').indeterminate=chosen.size>0&&chosen.size<cards().length;
 if(latest?.storyboard?.scenes.length&&!latest.generatingScript&&!$('generate-script').disabled)$('generate-script').textContent=`Viết lại ${chosen.size} cảnh đã chọn`;
 updateEditTools();
 if(latest){const unfinished=latest.flowBatch?.jobs.some(j=>!['downloaded','cancelled'].includes(j.status)),action=primaryAction();$('flow-start').disabled=latest.flowBusy||(action==='start'&&(!latest.storyboard||!chosen.size));$('flow-one').disabled=latest.flowBusy||!latest.storyboard||unfinished;$('flow-start').textContent=action==='recover'?'Đối soát tác vụ':action==='resume'?'Tiếp tục hàng đợi':`Chạy ${chosen.size} cảnh đã chọn`;}
}
function updateEditTools(){const all=cards(),index=all.findIndex(c=>Number(c.dataset.scene)===activeScene),blocked=editing||window.workspaceUI.scriptBusy()||latest?.generatingScript||latest?.flowBusy||['waiting','submitting','interrupted','invalid_json'].includes(latest?.geminiJob?.status)&&latest?.geminiJob?.sceneIds;
 for(const id of ['scene-up','scene-down','scene-regenerate','scene-delete','scene-position'])$(id).disabled=Boolean(blocked)||index<0;
 $('scene-up').disabled||=index<=0;$('scene-down').disabled||=index>=all.length-1;$('scene-undo').disabled=Boolean(blocked)||!undoScript;
}
async function changeScene(action,target){if(editing)return;const before=window.workspaceUI.readStoryboard(),script=structuredClone(before),index=script.scenes.findIndex(s=>s.id===activeScene);let next=activeScene;
 if(action==='undo'){if(!undoScript)return;Object.assign(script,structuredClone(undoScript));}
 else if(index<0)return;
 else if(action==='delete'){script.scenes.splice(index,1);next=script.scenes[Math.min(index,script.scenes.length-1)]?.id||1;}
 else{const to=Number(target);if(!Number.isInteger(to)||to<0||to>=script.scenes.length||to===index)return;const [scene]=script.scenes.splice(index,1);script.scenes.splice(to,0,scene);}
 editing=true;updateEditTools();try{await window.workspaceUI.saveEdited(script);undoScript=action==='undo'?null:before;selectScene(next);persistSelection();window.workspaceUI.notify(action==='delete'?'Đã xóa cảnh và lưu kịch bản.':action==='undo'?'Đã hoàn tác và lưu kịch bản.':'Đã đổi thứ tự và lưu kịch bản.');}catch(e){window.workspaceUI.notify(e.message);}finally{editing=false;updateEditTools();}}
$('scene-up').onclick=()=>changeScene('move',cards().findIndex(c=>Number(c.dataset.scene)===activeScene)-1);
$('scene-down').onclick=()=>changeScene('move',cards().findIndex(c=>Number(c.dataset.scene)===activeScene)+1);
$('scene-position').onchange=()=>changeScene('move',$('scene-position').value);
$('scene-delete').onclick=()=>changeScene('delete');$('scene-undo').onclick=()=>changeScene('undo');$('scene-regenerate').onclick=()=>window.workspaceUI.regenerate([activeScene]);
function primaryAction(){const jobs=latest?.flowBatch?.jobs||[];if(!jobs.some(j=>!['downloaded','cancelled'].includes(j.status)))return'start';return jobs.some(j=>['needs_review','submitting','generating','generated','downloading','download_failed'].includes(j.status))?'recover':'resume';}
function setSelected(id,value){const checkbox=checkboxes().find(e=>Number(e.dataset.flowScene)===id);if(checkbox)checkbox.checked=value;persistSelection();updateSelection();renderQueue();}
function filterOutline(){const query=fold($('script-scene-search').value);for(const row of $('scene-outline').children){const card=cards().find(c=>c.dataset.scene===row.dataset.outlineScene);row.hidden=Boolean(query&&!fold([`cảnh ${row.dataset.outlineScene}`,sceneValue(card,'description_vi'),sceneValue(card,'voiceover_vi'),sceneValue(card,'video_prompt_en')].join(' ')).includes(query));}}
$('overview-continue').addEventListener('click',()=>navigate(latest?.storyboard?'flow-nav':'script-nav'));
$('overview-script').addEventListener('click',()=>navigate('script-nav'));
$('overview-projects').addEventListener('click',()=>window.libraryUI.show());
$('overview-budget').addEventListener('click',()=>$('budget-dialog').showModal());
function sync(data){
 latest=data;
 window.upscaleUI?.sync(data);
 $('overview-project-name').textContent=$('title').value.trim()||data.project?.title||'Dự án chưa đặt tên';
 $('overview-project-description').textContent=$('brief').value.trim()||data.storyboard?.summary||'Bắt đầu với ý tưởng của bạn để Gemini chuẩn bị kịch bản.';
 $('overview-scenes').textContent=data.storyboard?.scenes?.length?data.storyboard.scenes.length+' cảnh':'Chưa có cảnh';
 $('overview-project-state').textContent=data.flowBusy?'Đang sản xuất':data.storyboard?'Kịch bản sẵn sàng':'Bản nháp';
 $('overview-ratio').textContent=$('ratio').value;
 $('overview-queue').textContent=projectJobs().length?projectJobs().filter(j=>j.status==='downloaded').length+'/'+projectJobs().length+' cảnh đã tải':'Chưa bắt đầu';
 $('overview-balance').textContent=data.flowBalance?data.flowBalance.amount.toLocaleString('vi-VN')+' tín dụng':'Chưa cập nhật';
 $('overview-continue').textContent=data.storyboard?(data.flowBatch?'Theo dõi hàng đợi →':'Sản xuất video →'):'Bắt đầu viết kịch bản →';
 $('overview-script').hidden=!data.storyboard;
 $('app-project-name').textContent=$('title').value.trim()||data.project?.title||'Dự án chưa đặt tên';$('app-project-name').title=$('app-project-name').textContent;
 $('app-session').textContent=data.generatingScript?'✦ Gemini đang viết':data.flowBusy?'● Flow đang xử lý':data.browser?'● Trình duyệt đã kết nối':'Lưu trữ trên máy';
 if(projectId!==data.activeProjectId)boardChanged(data.activeProjectId);
 if(version!==data.storyboard?.updatedAt){version=data.storyboard?.updatedAt;dirty=false;}
 $('script-edit-state').textContent=dirty?'● Có thay đổi chưa lưu':data.storyboard?'✓ Kịch bản đã lưu':'Bản nháp trên máy';$('script-edit-state').classList.toggle('is-dirty',dirty);
 if(data.flowBatch?.id!==lastBatch){lastBatch=data.flowBatch?.id||null;mode=lastBatch?'jobs':'plan';selectedJob=null;detailKey='';}
 const jobs=projectJobs(),completed=jobs.filter(j=>j.status==='downloaded').length,total=jobs.length||cards().length;
 $('queue-completed').textContent=`${completed} / ${total}`;$('queue-processing').textContent=jobs.filter(j=>processing.has(j.status)).length||Number(Boolean(data.flowBusy));$('queue-issues').textContent=jobs.filter(j=>issues.has(j.status)).length;
 $('queue-budget').textContent=String(data.productionSpent??data.flowBatch?.spent??0);
 const percent=total?Math.round(completed/total*100):0;$('queue-meter').style.width=`${percent}%`;$('queue-percent').textContent=jobs.length?`${percent}% đã tải về`:'Sẵn sàng bắt đầu';
 $('queue-settings-caption').textContent=`${$('ratio').value} · x1 clip/lần · thời lượng theo cảnh`;
 if(data.flowBusy&&!data.flowBatch)$('flow-progress').textContent='Đang chuẩn bị project và cấu hình Flow…';
 if(!data.flowBatch&&!data.flowBusy)$('flow-progress').textContent='Chọn cảnh và kiểm tra thiết lập. Project Flow sẽ tự được tạo khi cần.';
 $('flow-pause').disabled=!data.flowBusy||!data.flowBatch;
 if(data.geminiJob?.status==='invalid_json'&&sync.lastInvalid!==data.geminiJob.id){sync.lastInvalid=data.geminiJob.id;if(document.body.dataset.view==='script'&&!$('raw-dialog').open)$('raw-dialog').showModal();}
 updateSelection();renderQueue();
}
function renderQueue(){
 if(!latest)return;
 $('queue-tab-plan').setAttribute('aria-selected',String(mode==='plan'));$('queue-tab-jobs').setAttribute('aria-selected',String(mode==='jobs'));$('queue-select-all').disabled=mode==='jobs';
 const chosen=new Set(selectedIds()),query=fold($('queue-search').value),filter=$('queue-filter').value;
 const rows=mode==='jobs'?projectJobs().map(job=>({id:job.id,sceneId:job.sceneId,position:job.position||(latest.flowBatch.storyboardSnapshot?.scenes?.findIndex(s=>s.id===job.sceneId)??-1)+1||job.sceneId,status:job.status,duration:job.configuration?.duration||job.scene?.duration_seconds,description:job.scene?.description_vi||'',prompt:job.prompt||job.scene?.video_prompt_en||'',job})):cards().map((card,index)=>({id:`plan-${card.dataset.scene}`,sceneId:Number(card.dataset.scene),position:index+1,status:chosen.has(Number(card.dataset.scene))?'selected':'disabled',duration:Number(sceneValue(card,'duration_seconds')),description:sceneValue(card,'description_vi'),prompt:sceneValue(card,'video_prompt_en')}));
 const visible=rows.filter(row=>(!query||fold(`cảnh ${row.position} ${row.description} ${row.prompt}`).includes(query))&&(filter==='all'||filter==='selected'&&chosen.has(row.sceneId)||filter==='processing'&&processing.has(row.status)||filter==='issues'&&issues.has(row.status)||filter==='downloaded'&&row.status==='downloaded'||filter==='queued'&&['queued','selected','disabled'].includes(row.status)));
 if(mode==='jobs'&&!rows.some(row=>row.id===selectedJob))selectedJob=rows.find(row=>row.sceneId===activeScene)?.id||rows.find(row=>processing.has(row.status)||issues.has(row.status))?.id||rows[0]?.id;
 const scroll=$('flow-jobs').closest('.queue-scroll').scrollTop;$('flow-jobs').replaceChildren();$('queue-empty').hidden=Boolean(visible.length);
 for(const row of visible){
  const tr=make('tr');tr.dataset.queueRow=row.id;tr.classList.toggle('is-active',mode==='jobs'?selectedJob===row.id:activeScene===row.sceneId);tr.tabIndex=0;tr.setAttribute('aria-label',`Cảnh ${row.position}, ${statuses[row.status]||row.status}`);
  const select=make('td');if(mode==='plan'){const checkbox=make('input');checkbox.type='checkbox';checkbox.checked=chosen.has(row.sceneId);checkbox.setAttribute('aria-label',`Chọn cảnh ${row.position} trong hàng đợi`);checkbox.addEventListener('click',event=>event.stopPropagation());checkbox.addEventListener('change',()=>setSelected(row.sceneId,checkbox.checked));select.append(checkbox);}else select.textContent=String(row.position).padStart(2,'0');
  const content=make('td');content.append(make('span','queue-scene-name',`Cảnh ${String(row.position).padStart(2,'0')}`),make('span','queue-scene-description',row.description||row.prompt||'Chưa có mô tả'));
  const downloadable=row.job||projectJobs().find(j=>j.sceneId===row.sceneId&&j.assetId);if(downloadable?.assetId){const high=Boolean(downloadable.media&&Math.min(downloadable.media.metadata.width,downloadable.media.metadata.height)>=1080),button=make('button','text-button upscale-row-button',high?'✓ 1080p':'Tải 1080p');button.disabled=high||latest.flowBusy;button.addEventListener('click',event=>{event.stopPropagation();void window.upscaleUI.start({projectId:latest.activeProjectId,sceneId:downloadable.sceneId,batchId:downloadable.batchId||latest.flowBatch.id,jobId:downloadable.id});});button.addEventListener('keydown',event=>event.stopPropagation());content.append(button);}
  const state=make('td'),badge=make('span','job-badge',statuses[row.status]||row.status);badge.dataset.state=row.status;state.append(badge);
  const duration=make('td','',`${row.duration||'—'}s`),cost=make('td','',row.job?String(row.job.reserved??row.job.cost??'—'):'—'),arrow=make('td','','›');tr.append(select,content,state,duration,cost,arrow);
  const selectRow=()=>{selectedJob=mode==='jobs'?row.id:selectedJob;selectScene(row.sceneId,false);if(mode==='jobs')renderQueue();inspector(mode==='jobs'?'detail':'settings');if(mode==='plan')renderDetail(row);};
  tr.addEventListener('click',selectRow);tr.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();selectRow();}});$('flow-jobs').append(tr);
 }
 $('flow-jobs').closest('.queue-scroll').scrollTop=scroll;
 if(mode==='jobs')renderDetail(rows.find(row=>row.id===selectedJob));else renderDetail(rows.find(row=>row.sceneId===activeScene));
}
function inspector(tab){$('queue-settings').hidden=tab!=='settings';$('queue-job-detail').hidden=tab!=='detail';$('queue-inspector-settings').setAttribute('aria-selected',String(tab==='settings'));$('queue-inspector-detail').setAttribute('aria-selected',String(tab==='detail'));}
function renderDetail(row){
 const key=JSON.stringify([row,latest?.flowBusy,latest?.activeProjectId]);if(key===detailKey)return;detailKey=key;
 const host=$('queue-job-detail');host.querySelector('video')?.pause();host.replaceChildren();
 if(!row){const empty=make('div','studio-empty');empty.append(make('span','','▧'),make('p','','Chọn một cảnh hoặc tác vụ để xem chi tiết.'));host.append(empty);return;}
 const header=make('div','queue-job-heading'),badge=make('span','job-badge',statuses[row.status]||row.status);badge.dataset.state=row.status;header.append(make('h3','',`Cảnh ${String(row.position).padStart(2,'0')}`),badge);host.append(header);
 const body=make('div','queue-job-body');host.append(body);const job=row.job;
 if(job){const steps=make('div','job-stage-list');const stage=job.status==='downloaded'?4:job.assetId||job.status==='downloading'?3:job.submittedAt?2:job.status==='preparing'?1:0;for(let i=0;i<4;i++){const span=make('span',i<stage?'is-done':'');span.title=['Chuẩn bị','Gửi yêu cầu','Tạo video','Tải clip'][i];steps.append(span);}body.append(steps);}
 if(job?.media||job?.file){const video=make('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.id='queue-preview';video.src=`studio-media://video/${encodeURIComponent(latest.activeProjectId)}/${encodeURIComponent(job.batchId||latest.flowBatch.id)}/${encodeURIComponent(job.id)}?quality=${job.media?.metadata?.width||0}`;body.append(video);}
 if(job?.error)body.append(make('p','job-error',job.error));
 const metadata=make('div','job-detail-meta');for(const[label,value]of [['Thời lượng',`${row.duration||'—'} giây`],['Độ phân giải',job?.media?`${Math.min(job.media.metadata.width,job.media.metadata.height)}p`:job?.configuration?.resolution||$('flow-resolution').value],['Mô hình',job?.configuration?.model||'Omni 1.1 Flash'],['Tín dụng',job?job.reserved??job.cost??'—':'Đọc khi chuẩn bị']]){const item=make('div');item.append(make('span','',label),make('strong','',String(value)));metadata.append(item);}body.append(metadata);
 const actions=make('div','project-actions');const edit=make('button','secondary','Biên tập cảnh');edit.addEventListener('click',()=>{navigate('script-nav');selectScene(row.sceneId);});actions.append(edit);
 if(job?.file||job?.media){const file=make('button','secondary','Mở vị trí file');file.addEventListener('click',async()=>{const result=await window.studio.flowFile({jobId:job.id,batchId:job.batchId||latest.flowBatch.id});if(!result.ok)window.workspaceUI.notify(result.error);});actions.append(file);}
 if(job?.assetId){const high=Boolean(job.media&&Math.min(job.media.metadata.width,job.media.metadata.height)>=1080),upscale=make('button','secondary',high?'✓ Đã có 1080p':'Tải bản 1080p');upscale.disabled=high||latest.flowBusy;upscale.addEventListener('click',()=>window.upscaleUI.start({projectId:latest.activeProjectId,sceneId:job.sceneId,batchId:job.batchId||latest.flowBatch.id,jobId:job.id}));actions.append(upscale);if(job.upscale?.error)body.append(make('p','job-error','1080p: '+job.upscale.error));}
 const currentJob=job&&(!job.batchId||job.batchId===latest.flowBatch?.id);
 if(currentJob&&!latest.flowBusy&&['needs_review','download_failed','generating','generated','downloading','submitting'].includes(job.status)){const recover=make('button','secondary','Đối soát / tải lại');recover.addEventListener('click',()=>$('flow-recover').click());actions.append(recover);}
 if(currentJob&&!latest.flowBusy&&issues.has(job.status)){const skip=make('button','secondary','Đã kiểm tra · bỏ qua');skip.title='Không hủy tác vụ trên Flow';skip.addEventListener('click',async()=>{const result=await window.studio.flowSkip(job.id);if(result.ok)sync(result.data);else window.workspaceUI.notify(result.error);});actions.append(skip);}body.append(actions,make('h4','','PROMPT VIDEO'),make('pre','',row.prompt||'Chưa có prompt.'));
}
for(const button of document.querySelectorAll('[data-editor-tab-button]')){button.addEventListener('click',()=>showTab(button.dataset.editorTabButton));button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const buttons=[...document.querySelectorAll('[data-editor-tab-button]')],index=buttons.indexOf(button),next=buttons[(index+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length];next.click();next.focus();}});}
$('scene-prev').addEventListener('click',()=>{const all=cards(),index=all.findIndex(c=>Number(c.dataset.scene)===activeScene);if(index>0)selectScene(all[index-1].dataset.scene);});
$('scene-next').addEventListener('click',()=>{const all=cards(),index=all.findIndex(c=>Number(c.dataset.scene)===activeScene);if(index>=0&&index<all.length-1)selectScene(all[index+1].dataset.scene);});
$('scene-outline').addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const rows=[...$('scene-outline').children].filter(e=>!e.hidden),index=rows.findIndex(e=>Number(e.dataset.outlineScene)===activeScene),next=rows[index+(event.key==='ArrowDown'?1:-1)];if(next){selectScene(Number(next.dataset.outlineScene));next.querySelector('button').focus();}}});
$('script-scene-search').addEventListener('input',filterOutline);
for(const[id,value]of [['script-select-all',true],['script-select-none',false]])$(id).addEventListener('click',()=>{for(const checkbox of checkboxes())checkbox.checked=value;persistSelection();updateSelection();renderQueue();});
$('queue-select-all').addEventListener('change',()=>{for(const checkbox of checkboxes())checkbox.checked=$('queue-select-all').checked;persistSelection();updateSelection();renderQueue();});
for(const[id,value]of [['queue-tab-plan','plan'],['queue-tab-jobs','jobs']])$(id).addEventListener('click',()=>{mode=value;detailKey='';renderQueue();});
for(const id of ['queue-search','queue-filter'])$(id).addEventListener(id==='queue-search'?'input':'change',()=>{$('flow-jobs').closest('.queue-scroll').scrollTop=0;renderQueue();});
$('queue-inspector-settings').addEventListener('click',()=>inspector('settings'));$('queue-inspector-detail').addEventListener('click',()=>inspector('detail'));
$('script-to-queue').addEventListener('click',()=>navigate('flow-nav'));$('queue-edit-selected').addEventListener('click',()=>{const id=mode==='jobs'?projectJobs().find(j=>j.id===selectedJob)?.sceneId:activeScene;navigate('script-nav');if(id)selectScene(id);});
$('flow-scene').addEventListener('change',()=>selectScene(Number($('flow-scene').value),false));
$('script-raw').addEventListener('click',()=>$('raw-dialog').showModal());
for(const button of document.querySelectorAll('[data-close-dialog]'))button.addEventListener('click',()=>$(button.dataset.closeDialog).close());
$('header-library').addEventListener('click',()=>window.libraryUI.show());
$('header-new').addEventListener('click',()=>$('project-new').click());
document.addEventListener('input',event=>{
 if(event.target.closest('#storyboard,#script-story-info')){dirty=true;$('script-edit-state').textContent='● Có thay đổi chưa lưu';$('script-edit-state').classList.add('is-dirty');}
 if(event.target.closest('#storyboard')){clearTimeout(debounce);debounce=setTimeout(()=>{for(const row of $('scene-outline').children){const card=cards().find(c=>c.dataset.scene===row.dataset.outlineScene);row.querySelector('.outline-excerpt').textContent=sceneValue(card,'description_vi')||'Chưa có mô tả';row.querySelector('small').textContent=`${sceneValue(card,'duration_seconds')}s`;}filterOutline();updateSelection();renderQueue();},180);}
 if(event.target.id==='title')$('app-project-name').textContent=event.target.value||'Dự án chưa đặt tên';
});
document.addEventListener('click',event=>{for(const menu of document.querySelectorAll('.command-menu[open]'))if(!menu.contains(event.target))menu.open=false;});
window.studioUI={show,sync,boardChanged,selectScene,showTab,setSelected,inspector,primaryAction,selectedIds,refreshControls:updateEditTools};
const initial=window.workspaceUI.status();if(initial){boardChanged(initial.activeProjectId);sync(initial);}
showTab(safeRead('studio-editor-tab','visual'));
try{const view=localStorage.getItem('studio-view');if(view==='script'||view==='flow')show(view==='script'?'script-nav':'flow-nav');}catch{}
})();
