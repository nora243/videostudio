(() => {
const byId=id=>document.getElementById(id),el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const toast=message=>window.workspaceUI.notify(message);
const api=async promise=>{const result=await promise;if(!result.ok)throw Error(result.error);return result.data;};
const bytes=n=>n>=1024**3?`${(n/1024**3).toFixed(1)} GB`:n>=1024**2?`${(n/1024**2).toFixed(1)} MB`:`${Math.ceil(n/1024)} KB`;
const date=value=>value?new Date(value).toLocaleString('vi-VN'):'—';
const compactDate=value=>value?new Date(value).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
const uri=(project,version)=>`studio-media://video/${encodeURIComponent(project.id)}/${encodeURIComponent(version.batchId)}/${encodeURIComponent(version.jobId)}?quality=${version.metadata?.width||0}`;
let data={projects:[],warnings:[]},selected=null,dirty=false,signature='',preview=null,loading=false;
const thumbnailCache=new Map(),tasks=[];let running=0;
const sceneFilters=new Map();
function pump(){while(running<2&&tasks.length){const task=tasks.shift();if(!task.box.isConnected)continue;running++;task.run(()=>{running--;pump();});}}
const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);const task=entry.target.loadThumbnail;if(task){tasks.push({box:entry.target,run:task});pump();}}},{rootMargin:'150px'});
function thumbnail(project,version){
 const box=el('div','library-thumb');box.append(el('span','thumb-play','▷'));
 if(!version?.available)return box;
 const source=uri(project,version);
 const show=image=>{box.replaceChildren();const img=el('img');img.alt='Khung hình xem trước';img.src=image;box.append(img,el('span','thumb-play','▷'));};
 if(thumbnailCache.has(source)){show(thumbnailCache.get(source));return box;}
 box.loadThumbnail=done=>{
  const video=document.createElement('video');video.muted=true;video.preload='auto';video.crossOrigin='anonymous';let ended=false;
  const finish=()=>{if(ended)return;ended=true;clearTimeout(timer);video.removeAttribute('src');video.load();done();};
  const capture=()=>{try{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=Math.max(1,Math.round(320*video.videoHeight/video.videoWidth));canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);const image=canvas.toDataURL('image/jpeg',.75);thumbnailCache.set(source,image);if(thumbnailCache.size>180)thumbnailCache.delete(thumbnailCache.keys().next().value);if(box.isConnected)show(image);}catch{}finally{finish();}};
  const timer=setTimeout(finish,12000);video.onloadeddata=()=>{if(video.duration>.2){video.onseeked=capture;video.currentTime=.1;}else capture();};video.onerror=finish;video.src=source;video.load();
 };
 observer.observe(box);return box;
}
function button(text,handler,secondary=true){const node=el('button',secondary?'secondary':'',text);node.addEventListener('click',async()=>{node.disabled=true;try{await handler();}catch(error){toast(error.message);}finally{node.disabled=false;}});return node;}
function metric(label,value){const box=el('div','library-metric');box.append(el('strong','',String(value)),el('span','',label));return box;}
async function importVideo(projectId,sceneId){const result=await api(window.studio.libraryImport({projectId,sceneId}));if(!result.cancelled){await refresh(true);toast(`Đã thêm một phiên bản video cho cảnh ${sceneId}.`);}}
function workspace(nav='overview-nav'){
 if(window.studioUI)window.studioUI.show(nav);else document.body.dataset.view='workspace';byId('library-section').hidden=true;stopPreview();
 for(const node of document.querySelectorAll('aside nav>div'))node.classList.toggle('selected',node.id===nav);
}
async function refresh(force=false){
 if(loading)return;loading=true;
 try{const next=await api(window.studio.libraryList()),nextSignature=JSON.stringify(next);data=next;if(force||signature!==nextSignature){signature=nextSignature;render();}}
 catch(error){byId('library-warnings').textContent=error.message;}
 finally{loading=false;}
}
function show(){
 window.workspaceUI.storeDraft();document.body.dataset.view='library';byId('library-section').hidden=false;
 for(const node of document.querySelectorAll('aside nav>div'))node.classList.toggle('selected',node.id==='library-nav');
 try{localStorage.setItem('studio-view','library');}catch{}
 window.scrollTo({top:0,behavior:'smooth'});void refresh(true);
 byId('app-route').textContent='WORKSPACE / THƯ VIỆN DỰ ÁN';
}
function render(){
 const active=data.projects.filter(p=>!p.archived),stats=byId('library-stats');stats.replaceChildren(metric('Dự án đang dùng',active.length),metric('Video trên máy',active.reduce((n,p)=>n+p.stats.files,0)),metric('Cảnh cần kiểm tra',active.reduce((n,p)=>n+p.stats.issues,0)),metric('Dung lượng thư viện',bytes(data.projects.reduce((n,p)=>n+p.stats.size,0))));
 byId('library-warnings').textContent=data.warnings.join('\n');
 const project=data.projects.find(p=>p.id===selected);if(selected&&!project){selected=null;dirty=false;}
 byId('library-projects').hidden=Boolean(selected);byId('library-detail').hidden=!selected;
 if(selected&&project){if(!dirty)renderDetail(project);}else renderProjects();
}
function renderProjects(){
 observer.disconnect();tasks.length=0;
 const container=byId('library-projects');container.replaceChildren();
 const query=fold(byId('library-search').value),filter=byId('library-filter').value,sort=byId('library-sort').value;
 const projects=data.projects.filter(project=>{
  if(filter==='active'&&project.archived||filter==='archived'&&!project.archived||filter==='favorite'&&(!project.favorite||project.archived)||filter==='issues'&&(project.archived||!project.stats.issues))return false;
  return !query||fold([project.name,project.notes,...project.scenes.flatMap(s=>[s.description,...s.versions.map(v=>v.prompt)])].join(' ')).includes(query);
 }).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||(sort==='name'?a.name.localeCompare(b.name,'vi'):sort==='ready'?b.stats.ready-a.stats.ready:(b.updatedAt||'').localeCompare(a.updatedAt||'')));
 if(!projects.length){const empty=el('div','library-empty');empty.append(el('h2','',query?'Không tìm thấy dự án phù hợp':'Chưa có dự án trong mục này'),el('p','','Thử đổi bộ lọc hoặc tạo dự án mới để bắt đầu.'));container.append(empty);return;}
 for(const project of projects){
  const card=el('article','project-tile'),open=el('button','project-card');open.dataset.projectId=project.id;open.setAttribute('aria-label',`Mở dự án ${project.name}`);
  const cover=project.scenes.map(s=>s.versions.find(v=>v.id===s.preferredId&&v.available)||s.versions.find(v=>v.available)).find(Boolean);
  open.append(thumbnail(project,cover));const info=el('div','project-card-info');
  info.append(el('span','project-card-name',project.name),el('span','muted',project.stats.scenes?`${project.stats.ready}/${project.stats.scenes} cảnh có video · ${project.stats.versions} phiên bản`:'Chưa có kịch bản · Bản nháp'));
  const progress=el('div','library-progress'),fill=el('div');fill.style.width=`${project.stats.scenes?project.stats.ready/project.stats.scenes*100:0}%`;progress.append(fill);info.append(progress);
  const tags=el('div','library-tags');tags.append(el('span','',project.archived?'Đã lưu trữ':project.stats.issues?'Cần kiểm tra':project.stats.ready===project.stats.scenes&&project.stats.scenes?'Đủ cảnh':'Đang thực hiện'),el('span','',bytes(project.stats.size)));info.append(tags,el('span','project-updated',date(project.updatedAt)));open.append(info);
  open.addEventListener('click',()=>{selected=project.id;dirty=false;render();window.scrollTo({top:0,behavior:'smooth'});});
  const star=button(project.favorite?'★':'☆',async()=>{await api(window.studio.libraryUpdate({id:project.id,changes:{favorite:!project.favorite}}));await refresh(true);});star.className='project-star';star.setAttribute('aria-label',project.favorite?'Bỏ đánh dấu sao':'Đánh dấu sao');card.append(open,star);container.append(card);
 }
}
function renderDetail(project){
 observer.disconnect();tasks.length=0;const container=byId('library-detail');container.replaceChildren();
 const top=el('div','library-detail-top');top.append(button('← Tất cả dự án',()=>{selected=null;dirty=false;render();}));
 const actions=el('div','project-actions');
 const upscaleAll=button('Tải 1080p tất cả cảnh',()=>window.upscaleUI.start({projectId:project.id}));upscaleAll.disabled=!!data.upscaleBusy;actions.append(upscaleAll);
 actions.append(button('Mở để tiếp tục làm việc',async()=>{window.workspaceUI.storeDraft();const result=await api(window.studio.projectOpen(project.id));window.workspaceUI.apply(result);workspace('script-nav');byId('script-section').scrollIntoView({behavior:'smooth'});toast('Đã mở dự án.');},false),button('Thư mục dự án',()=>api(window.studio.libraryFolder(project.id))),button('Xuất các cảnh đã có',async()=>{const result=await api(window.studio.libraryExport(project.id));if(!result.cancelled)toast(`Đã xuất ${result.exported} cảnh vào ${result.folder}${result.missing?`. ${result.missing} cảnh chưa có video được ghi trong manifest.`:''}`);}),button(project.archived?'Khôi phục dự án':'Lưu trữ dự án',async()=>{await api(window.studio.libraryUpdate({id:project.id,changes:{archived:!project.archived}}));await refresh(true);}));top.append(actions);container.append(top);
 const heading=el('div','library-project-heading');heading.append(el('h2','',project.name),el('p','',`${project.stats.ready}/${project.stats.scenes} cảnh có video · ${project.stats.files} file · ${project.stats.duration.toFixed(1)} giây theo bản đã chọn · ${project.stats.credits} tín dụng đã dùng/dành`));container.append(heading);
 if(data.upscaleQueue?.projectId===project.id)heading.append(el('p','upscale-progress',window.upscaleUI?.describe(data.upscaleQueue)||''));
 const editor=el('details','library-editor'),summary=el('summary','','Thông tin dự án & ghi chú');editor.append(summary);
 const nameLabel=el('label','','Tên dự án'),name=el('input');name.value=project.name;name.maxLength=200;name.id='library-project-name';nameLabel.append(name);
 const notesLabel=el('label','','Ghi chú sản xuất'),notes=el('textarea');notes.value=project.notes;notes.maxLength=10000;notes.id='library-project-notes';notesLabel.append(notes);
 name.addEventListener('input',()=>dirty=true);notes.addEventListener('input',()=>dirty=true);
 const editActions=el('div','project-actions');editActions.append(button('Lưu thông tin',async()=>{await api(window.studio.libraryUpdate({id:project.id,changes:{name:name.value,notes:notes.value}}));window.workspaceUI.rename(project.id,name.value.trim());dirty=false;await refresh(true);toast('Đã lưu thông tin dự án.');},false),button('Bỏ chỉnh sửa',()=>{dirty=false;render();}));editor.append(nameLabel,notesLabel,editActions);container.append(editor);
 const filterLabel=el('label','scene-filter','Hiển thị cảnh'),filter=el('select');filter.id='library-scene-filter';
 for(const[value,text]of [['all','Tất cả cảnh'],['ready','Đã có video'],['missing','Thiếu file trên máy'],['issues','Cần kiểm tra'],['planned','Chưa có video']]){const option=el('option','',text);option.value=value;filter.append(option);}
 const filterRow=el('div','library-scene-toolbar'),searchLabel=el('label','','Tìm trong dự án'),search=el('input');search.type='search';search.id='library-scene-search';search.placeholder='Số cảnh, mô tả, prompt hoặc lời dẫn…';searchLabel.append(search);
 const saved=sceneFilters.get(project.id)||{filter:'all',query:''};filter.value=saved.filter;search.value=saved.query;
 filterLabel.append(filter);filterRow.append(searchLabel,filterLabel);container.append(filterRow);
 const grid=el('div','library-scenes');container.append(grid);
 if(!project.scenes.length){const add=button('Thêm video từ máy vào cảnh 1',()=>importVideo(project.id,1));container.insertBefore(add,grid);}
 const renderScenes=()=>{
  grid.replaceChildren();
  const query=fold(search.value);
  const scenes=project.scenes.filter(s=>(filter.value==='all'||filter.value==='ready'&&s.versions.some(v=>v.available)||filter.value==='missing'&&s.versions.some(v=>v.missing)||filter.value==='issues'&&s.versions.some(v=>v.error||v.missing)||filter.value==='planned'&&!s.versions.some(v=>v.available))&&(!query||fold([`Cảnh ${s.id}`,s.description,...s.versions.flatMap(v=>[v.prompt,v.voiceover])].join(' ')).includes(query)));
  if(!scenes.length)grid.append(el('div','library-empty','Chưa có cảnh phù hợp. Các cảnh và video tạo từ dự án này sẽ tự xuất hiện tại đây.'));
  for(const scene of scenes)grid.append(sceneCard(project,scene));
 };
 const filterScenes=()=>{sceneFilters.set(project.id,{filter:filter.value,query:search.value});renderScenes();};filter.addEventListener('change',filterScenes);search.addEventListener('input',filterScenes);renderScenes();
}
function sceneCard(project,scene){
 const card=el('article','library-scene');card.dataset.sceneId=scene.id;
 let version=scene.versions.find(v=>v.id===scene.preferredId)||scene.versions[0];
 const title=el('div','library-scene-title');title.append(el('h3','',`Cảnh ${scene.id}`),el('span','',`${scene.versions.length} phiên bản`));card.append(title);
 const cover=el('div','scene-cover');card.append(cover);
 const description=el('p','scene-description',scene.description||'Chưa có mô tả cảnh.');card.append(description);
 const select=el('select');select.setAttribute('aria-label',`Phiên bản cảnh ${scene.id}`);
 for(const[vIndex,item]of scene.versions.entries()){const option=el('option','',`Bản ${scene.versions.length-vIndex} · ${item.configuration.resolution||'—'} · ${compactDate(item.createdAt)}${item.missing?' · Thiếu file':!item.available?' · Chưa tải':''}${item.id===scene.preferredId?' · Đã chọn':''}`);option.value=item.id;select.append(option);}if(version)select.value=version.id;select.disabled=!scene.versions.length;card.append(select);
 const status=el('p','scene-version-status'),actions=el('div','project-actions');
 const view=button('▶ Xem trước',()=>showPreview(project,version),false),prefer=button('Dùng bản này',async()=>{await api(window.studio.libraryPrefer({projectId:project.id,sceneId:scene.id,versionId:version.id}));await refresh(true);toast(`Đã chọn phiên bản cho cảnh ${scene.id}.`);}),folder=button('Vị trí file',()=>api(window.studio.libraryFile({projectId:project.id,batchId:version.batchId,jobId:version.jobId})));
 const upscale=button('Tải bản 1080p',()=>window.upscaleUI.start({projectId:project.id,sceneId:scene.id,batchId:version.batchId,jobId:version.jobId}));actions.append(view,prefer,folder,upscale,button('Nhập phiên bản từ máy',()=>importVideo(project.id,scene.id)));card.append(status,actions);
 const update=()=>{cover.replaceChildren(thumbnail(project,version));view.disabled=prefer.disabled=folder.disabled=!version?.available;prefer.textContent=version?.id===scene.preferredId?'✓ Bản đang dùng':'Dùng bản này';prefer.disabled=prefer.disabled||version?.id===scene.preferredId;upscale.disabled=!version?.assetId||!version?.projectUrl||version.has1080||!!data.upscaleBusy;upscale.textContent=version?.has1080?'✓ Đã có 1080p':'Tải bản 1080p';status.textContent=version?version.available?`${version.metadata.width||'—'}×${version.metadata.height||'—'} · ${version.metadata.duration||'—'} giây · ${bytes(version.size)}`:version.missing?'Thiếu file trên máy. Có thể mở dự án để đối soát/tải lại.':version.error||'Cảnh chưa có video đã tải.':'Chưa tạo video cho cảnh này.';if(version?.upscale?.error)status.textContent+=' · 1080p: '+version.upscale.error;};
 select.addEventListener('change',()=>{version=scene.versions.find(v=>v.id===select.value);update();});update();return card;
}
function stopPreview(){const video=byId('preview-video');video.pause();video.removeAttribute('src');video.load();if(byId('library-preview').open)byId('library-preview').close();preview=null;}
function showPreview(project,version){
 if(!version?.available)return;
 preview={project,version};byId('preview-title').textContent=`${project.name} · Cảnh ${version.sceneId}`;byId('preview-meta').textContent=`${version.configuration.model||'Video'} · ${version.configuration.resolution||'—'} · ${version.metadata.duration||'—'} giây · ${date(version.createdAt)}`;
 byId('preview-prompt').textContent=`${version.prompt}\n\nLời dẫn:\n${version.voiceover||'Chưa có'}`;byId('preview-error').textContent='';
 byId('preview-prefer').disabled=project.scenes.find(s=>s.id===version.sceneId)?.preferredId===version.id;
 byId('preview-video').src=uri(project,version);byId('library-preview').showModal();byId('preview-video').play().catch(()=>{});
}
byId('preview-close').addEventListener('click',stopPreview);
byId('library-preview').addEventListener('cancel',event=>{event.preventDefault();stopPreview();});
byId('preview-video').addEventListener('error',()=>{if(preview)byId('preview-error').textContent='Không phát được video. Hãy kiểm tra file bằng nút Mở vị trí file.';});
byId('preview-folder').addEventListener('click',async()=>{if(preview)try{await api(window.studio.libraryFile({projectId:preview.project.id,batchId:preview.version.batchId,jobId:preview.version.jobId}));}catch(error){toast(error.message);}});
byId('preview-prefer').addEventListener('click',async()=>{if(preview)try{await api(window.studio.libraryPrefer({projectId:preview.project.id,sceneId:preview.version.sceneId,versionId:preview.version.id}));byId('preview-prefer').disabled=true;await refresh(true);toast('Đã chọn phiên bản video.');}catch(error){toast(error.message);}});
byId('library-nav').addEventListener('click',show);byId('library-nav').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();show();}});
for(const id of ['overview-nav','script-nav','flow-nav'])byId(id).addEventListener('click',()=>workspace(id),{capture:true});
byId('overview-nav').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();byId('overview-nav').click();}});
byId('overview-nav').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
byId('library-refresh').addEventListener('click',()=>refresh(true));
for(const id of ['library-search','library-filter','library-sort'])byId(id).addEventListener(id==='library-search'?'input':'change',()=>{selected=null;dirty=false;render();});
byId('library-new').addEventListener('click',()=>byId('project-new').click());
window.libraryUI={show,workspace,refresh};
setInterval(()=>{if(document.body.dataset.view==='library'&&!byId('library-preview').open)void refresh();},10000);
try{if(localStorage.getItem('studio-view')==='library')show();}catch{}
})();
