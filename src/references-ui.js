(() => {
const $=id=>document.getElementById(id),roles={character_group:'Gia đình / nhóm nhân vật',female_lead:'Nữ chính',male_lead:'Nam chính',setting:'Bối cảnh',product:'Sản phẩm'},frameRoles={start_frame:'Khung hình bắt đầu',end_frame:'Khung hình kết thúc'};
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const host=make('div',null,'reference-groups');host.id='reference-groups';$('flow-reference-info').after(host);$('flow-reference').hidden=true;$('flow-clear-reference').textContent='Bỏ ảnh chung';
const sceneHost=make('section',null,'settings-block scene-reference-settings');sceneHost.id='scene-reference-settings';$('flow-scene').closest('.settings-block').after(sceneHost);
let signature='',working=false,last=null,currentScene=null;
async function action(fn){
 if(working)return;working=true;render(last,true);
 try{const result=await fn();if(!result.ok)throw Error(result.error);last=result.data;window.workspaceUI.updateStatus(result.data);}
 catch(e){window.workspaceUI.notify(e.message);}
 finally{working=false;const result=await window.studio.status();if(result.ok){last=result.data;window.workspaceUI.updateStatus(result.data);}else render(last);}
}
function group(parent,refs,role,label,sceneId=null){
 const frame=!!frameRoles[role],section=make('section',null,'reference-group');section.dataset.role=role;
 if(sceneId!=null)section.dataset.imageKind=frame?'frames':'ingredients';
 const heading=make('div',null,'reference-group-heading'),add=make('button',frame&&refs.length?'Thay ảnh':'+ Thêm ảnh','secondary');add.type='button';add.dataset.addRole=role;
 if(sceneId!=null)add.dataset.sceneId=sceneId;
 add.onclick=()=>{
  const fromComputer=()=>action(()=>window.studio.flowReference({role,sceneId}));
  if(sceneId!=null)window.framePicker.open({role,sceneId,targetProjectId:last.activeProjectId},{fromComputer,onApplied:data=>{last=data;window.workspaceUI.updateStatus(data);}});
  else fromComputer();
 };heading.append(make('strong',label),add);section.append(heading);
 if(!refs.length)section.append(make('p',sceneId==null?'Chưa có ảnh.':frame?'Chưa đặt khung hình.':'Dùng ảnh chung của nhóm này nếu có.','reference-empty'));
 for(const r of refs){
  const card=make('div',null,'reference-card');card.dataset.referenceId=r.id;
  const image=make('img');image.src=r.thumbnail;image.alt=`${label}: ${r.name}`;image.loading='lazy';
  const detail=make('div',null,'reference-card-detail');detail.append(make('span',r.name,'reference-filename'));
  if(r.source?.watermarkChecked)detail.append(make('small',`Tách từ video · ${Number(r.source.actualSeconds).toFixed(3)}s · ${r.source.watermarkRemoved?'Đã xóa watermark':'Đã kiểm tra watermark'}`));
  const description=make('textarea');description.value=r.description||'';description.maxLength=2000;description.rows=2;description.placeholder='Đặc điểm cần giữ / cách dùng ảnh';description.setAttribute('aria-label',`Mô tả ${r.name}`);detail.append(description);
  const tools=make('div',null,'reference-card-tools');let select;
  if(!frame){select=make('select');select.setAttribute('aria-label',`Vai trò ${r.name}`);for(const [value,text]of Object.entries(roles)){const option=make('option',text);option.value=value;select.append(option);}select.value=r.role;tools.append(select);}
  const save=make('button','Lưu','secondary');save.type='button';save.onclick=()=>action(()=>window.studio.flowUpdateReference({id:r.id,role:select?.value||r.role,description:description.value}));
  const remove=make('button','Bỏ ảnh','quiet-button');remove.type='button';remove.onclick=()=>action(()=>window.studio.flowClearReference({id:r.id}));
  remove.dataset.removeReference=r.id;
  tools.append(save,remove);detail.append(tools);card.append(image,detail);section.append(card);
 }
 parent.append(section);
}
function render(data,busy=false){
 if(!data)return;last=data;busy=Boolean(busy||working||data.flowBusy||data.pipelineBusy);
 const refs=data.flowReferences||[],common=refs.filter(r=>r.sceneId==null),scenes=data.storyboard?.scenes||[];
 if(!scenes.some(s=>s.id===currentScene))currentScene=scenes[0]?.id??null;
 const currentRefs=refs.filter(r=>r.sceneId===currentScene),hasFrames=currentRefs.some(r=>frameRoles[r.role]),hasIngredients=currentRefs.some(r=>roles[r.role]);
 $('flow-reference-info').textContent=`${common.length} ảnh chung · Mỗi cảnh có thể thay ảnh của từng nhóm. Tên và mã nhân vật chỉ để định danh, không được hiển thị trên video.`;
 const key=JSON.stringify([data.activeProjectId,refs,scenes.map(s=>s.id),currentScene]);
 if(key!==signature){
  signature=key;host.replaceChildren();
  for(const [role,label]of Object.entries(roles))group(host,common.filter(r=>r.role===role),role,label);
  sceneHost.replaceChildren(make('h3','Ảnh riêng & khung hình từng cảnh'));
  if(!scenes.length)sceneHost.append(make('p','Có kịch bản rồi bạn có thể chọn ảnh riêng và khung hình đầu/cuối cho từng cảnh.'));
  else{
   const label=make('label','Cảnh đang cấu hình'),select=make('select');select.id='scene-reference-scene';
   scenes.forEach((scene,index)=>{const option=make('option',`Cảnh ${index+1}`);option.value=scene.id;select.append(option);});select.value=currentScene;
   select.onchange=()=>{currentScene=Number(select.value);window.studioUI?.selectScene(currentScene,false);render(last);};label.append(select);sceneHost.append(label);
   const local=refs.filter(r=>r.sceneId===currentScene),frames=local.some(r=>frameRoles[r.role]);
   sceneHost.append(make('p',frames&&hasIngredients?'Cảnh đang có cả khung hình và ảnh tham chiếu riêng từ cấu hình cũ. Gỡ hết ảnh của một nhóm để sử dụng nhóm còn lại.':frames?'Chế độ Frames: ảnh tham chiếu riêng đang khóa. Gỡ hết khung hình đầu/cuối để chọn ảnh tham chiếu riêng. Cần ảnh bắt đầu để tạo video.':hasIngredients?'Chế độ Ingredients: khung hình đầu/cuối đang khóa. Gỡ hết ảnh tham chiếu riêng của cảnh để chọn khung hình.':'Chọn khung hình đầu/cuối hoặc ảnh tham chiếu riêng. Hai nhóm không dùng đồng thời; ảnh chung vẫn được lưu cho các cảnh khác.'));
   const frameHost=make('div',null,'reference-groups');for(const [role,title]of Object.entries(frameRoles))group(frameHost,local.filter(r=>r.role===role),role,title,currentScene);sceneHost.append(frameHost);
   const details=make('details');details.open=!frames;details.append(make('summary','Ảnh tham chiếu riêng (Ingredients)'));
   const localHost=make('div',null,'reference-groups');for(const [role,title]of Object.entries(roles))group(localHost,local.filter(r=>r.role===role),role,title,currentScene);details.append(localHost);sceneHost.append(details);
  }
 }
 for(const section of sceneHost.querySelectorAll('[data-image-kind]')){
  const locked=section.dataset.imageKind==='frames'?hasIngredients:hasFrames;
  section.classList.toggle('is-disabled',locked);
 }
 for(const container of [host,sceneHost])for(const node of container.querySelectorAll('button,select,textarea')){
  const kind=node.closest('[data-image-kind]')?.dataset.imageKind,locked=kind==='frames'?hasIngredients:kind==='ingredients'?hasFrames:false;
  node.disabled=busy||Boolean(locked&&!node.hasAttribute('data-remove-reference'));
  if(node.dataset.addRole)node.title=locked?(kind==='frames'?'Gỡ hết ảnh tham chiếu riêng của cảnh để chọn khung hình.':'Gỡ hết khung hình đầu/cuối để chọn ảnh tham chiếu riêng.'):'';
 }
 $('flow-clear-reference').disabled=busy||!common.length;
}
window.referencesUI={render,selectScene(id){if(currentScene===id)return;currentScene=id;render(last);}};
if(window.workspaceUI.status())render(window.workspaceUI.status());
})();
