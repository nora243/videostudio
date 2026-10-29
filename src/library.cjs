const fs=require('node:fs');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const {bestMedia,availableMedia,resolution}=require('./media-quality.cjs');
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
const scopedFields=['productionPipeline','project','storyboard','geminiJob','flowProject','flowProjectCreation','flowProfileLinks','flowReference','flowReferences','flowPrepared','flowBatch'];
const atomic=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2));fs.renameSync(file+'.tmp',file);};
function legacyId(batch){return batch.projectUrl?'flow-'+createHash('sha256').update(batch.projectUrl).digest('hex').slice(0,24):'batch-'+batch.id;}
class VideoLibrary{
 constructor(root){
  this.root=root;this.file=path.join(root,'library.json');this.index={version:1,projects:{},preferred:{}};this.cache=new Map();this.snapshotCache=new Map();this.warnings=[];
  try{if(fs.existsSync(this.file)){const value=JSON.parse(fs.readFileSync(this.file,'utf8'));if(value.version!==1||!value.projects||!value.preferred)throw Error('Cấu trúc không hợp lệ');this.index=value;}}
  catch(error){this.error='Không đọc được library.json. Dữ liệu cũ được giữ nguyên; cần sửa tệp này trước khi đổi thông tin thư viện.';}
 }
 write(){if(this.error)throw Error(this.error);atomic(this.file,this.index);}
 projectId(batch){const id=batch.projectId||legacyId(batch);if(!validId(id))throw Error('Mã dự án không hợp lệ');return id;}
 manifests(){
  const items=[],folder=path.join(this.root,'batches');this.warnings=this.error?[this.error]:[];
  if(!fs.existsSync(folder))return items;
  for(const dir of fs.readdirSync(folder,{withFileTypes:true})){
   if(!dir.isDirectory()||!validId(dir.name))continue;
   const file=path.join(folder,dir.name,'manifest.json');if(!fs.existsSync(file))continue;
   try{
    const stat=fs.statSync(file),stamp=`${stat.mtimeMs}:${stat.size}`;let cached=this.cache.get(file);
    if(cached?.stamp!==stamp){const batch=JSON.parse(fs.readFileSync(file,'utf8'));if(batch.id!==dir.name||!Array.isArray(batch.jobs))throw Error('Manifest không hợp lệ');cached={stamp,batch};this.cache.set(file,cached);}
    items.push(cached.batch);
   }catch{this.warnings.push(`Không đọc được hàng đợi ${dir.name}. Tệp gốc vẫn được giữ.`);}
  }
  return items;
 }
 bootstrap(state){
  const batches=this.manifests();
  if(!validId(state.activeProjectId)){
   const legacy=state.flowBatch||batches.find(b=>b.projectUrl===state.flowProject?.url);
   state.activeProjectId=legacy?this.projectId(legacy):randomUUID();
  }
  if(state.flowBatch&&validId(state.flowBatch.id)&&Array.isArray(state.flowBatch.jobs)){
    const file=path.join(this.root,'batches',state.flowBatch.id,'manifest.json');if(!fs.existsSync(file))atomic(file,state.flowBatch);
  }
  this.saveWorkspace(state);
 }
 saveWorkspace(state){
  if(this.error||!validId(state.activeProjectId))return;
  const id=state.activeProjectId,snapshot={id};for(const key of scopedFields)snapshot[key]=state[key]??null;
  const json=JSON.stringify(snapshot);if(this.snapshotCache.get(id)===json)return;
  const existing=this.index.projects[id]||{},now=new Date().toISOString();
  this.index.projects[id]={...existing,id,name:existing.customName?existing.name:state.project?.title?.trim()||state.storyboard?.title||'Dự án chưa đặt tên',createdAt:existing.createdAt||now,updatedAt:now};
  atomic(path.join(this.root,'projects',id,'project.json'),snapshot);this.snapshotCache.set(id,json);this.write();
 }
 readProject(id){
  if(!validId(id))throw Error('Mã dự án không hợp lệ.');
  try{return JSON.parse(fs.readFileSync(path.join(this.root,'projects',id,'project.json'),'utf8'));}
  catch{return null;}
 }
 list(){
  const batches=this.manifests(),projects=new Map();
  for(const [id,meta]of Object.entries(this.index.projects))if(validId(id))projects.set(id,{...meta,id,batches:[],scenes:new Map()});
  for(const batch of batches){
   let id;try{id=this.projectId(batch);}catch{continue;}
   if(!projects.has(id))projects.set(id,{id,name:batch.title||'Dự án Flow',createdAt:batch.createdAt,updatedAt:batch.createdAt,batches:[],scenes:new Map()});
   const project=projects.get(id);project.batches.push({id:batch.id,status:batch.status,createdAt:batch.createdAt,spent:batch.spent||0,options:batch.options});
   if((batch.createdAt||'')>(project.updatedAt||''))project.updatedAt=batch.createdAt;
   const scenes=batch.storyboardSnapshot?.scenes||batch.jobs.map(j=>j.scene).filter(Boolean);
   for(const scene of scenes)if(!project.scenes.has(scene.id))project.scenes.set(scene.id,{id:scene.id,description:scene.description_vi||'',versions:[]});
   for(const [index,job]of batch.jobs.entries()){
    if(!Number.isInteger(job.sceneId)||job.sceneId<1)continue;
    if(!project.scenes.has(job.sceneId))project.scenes.set(job.sceneId,{id:job.sceneId,description:job.scene?.description_vi||'',versions:[]});
    const scene=project.scenes.get(job.sceneId),jobId=validId(job.id)?job.id:`legacy-${index}`;
    const media=bestMedia(job,this.root),files=availableMedia(job,this.root),available=Boolean(media);
    scene.versions.push({id:`${batch.id}:${jobId}`,batchId:batch.id,jobId,sceneId:job.sceneId,status:job.status,available,missing:Boolean((job.file||Object.keys(job.renditions||{}).length)&&!available),createdAt:job.downloadedAt||job.generatedAt||job.submittedAt||batch.createdAt,metadata:media?.metadata||job.metadata||{},size:files.reduce((sum,f)=>sum+f.size,0),fileCount:files.length,quality:media?.quality||null,has1080:files.some(f=>resolution(f.metadata)>=1080),upscale:job.upscale||null,projectUrl:job.projectUrl||batch.projectUrl||null,prompt:job.prompt||job.scene?.video_prompt_en||'',negativePrompt:job.scene?.negative_prompt_en||'',voiceover:job.scene?.voiceover_vi||'',configuration:{...(job.configuration||batch.options||{}),...(media&&resolution(media.metadata)?{resolution:`${resolution(media.metadata)}p`}:{})},error:job.error||'',assetId:job.assetId||null,cost:job.reserved??job.cost??0});
   }
  }
  const result=[];
  for(const project of projects.values()){
   const snapshot=this.readProject(project.id);
   for(const scene of snapshot?.storyboard?.scenes||[]){
    if(!project.scenes.has(scene.id))project.scenes.set(scene.id,{id:scene.id,description:scene.description_vi||'',versions:[]});
    else project.scenes.get(scene.id).description=scene.description_vi||project.scenes.get(scene.id).description;
   }
   const scenes=[...project.scenes.values()].sort((a,b)=>a.id-b.id);
   for(const scene of scenes){
    scene.versions.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')||b.id.localeCompare(a.id));
    const choice=this.index.preferred[`${project.id}:${scene.id}`];
    scene.preferredId=scene.versions.find(v=>v.id===choice&&v.available)?.id||[...scene.versions].filter(v=>v.available).sort((a,b)=>resolution(b.metadata)-resolution(a.metadata))[0]?.id||null;
   }
   const versions=scenes.flatMap(s=>s.versions);
   const ready=scenes.filter(s=>s.versions.some(v=>v.available)).length;
   const duration=scenes.reduce((sum,scene)=>sum+(scene.versions.find(v=>v.id===scene.preferredId&&v.available)?.metadata.duration||0),0);
   result.push({...project,scenes,batches:project.batches.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')),notes:project.notes||'',favorite:Boolean(project.favorite),archived:Boolean(project.archived),stats:{scenes:scenes.length,ready,versions:versions.length,files:versions.reduce((sum,v)=>sum+(v.fileCount||0),0),missing:versions.filter(v=>v.missing).length,issues:scenes.filter(s=>s.versions.some(v=>['failed','needs_review','download_failed'].includes(v.status)||v.missing)).length,size:versions.reduce((sum,v)=>sum+v.size,0),duration,credits:project.batches.reduce((sum,b)=>sum+b.spent,0)}});
  }
  result.sort((a,b)=>Number(b.favorite)-Number(a.favorite)||(b.updatedAt||'').localeCompare(a.updatedAt||''));
  return{projects:result,warnings:this.warnings};
 }
 safeFile(file){
  const actual=fs.realpathSync(file),base=fs.realpathSync(this.root),relative=path.relative(base,actual);
  if(!relative||relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)||path.extname(actual).toLowerCase()!=='.mp4'||!fs.statSync(actual).isFile())throw Error('File không thuộc thư viện.');
  return actual;
 }
 findVersion(projectId,batchId,jobId){
  const project=this.list().projects.find(p=>p.id===projectId),version=project?.scenes.flatMap(s=>s.versions).find(v=>v.batchId===batchId&&v.jobId===jobId);
  if(!version)throw Error('Không tìm thấy phiên bản video.');
  const batch=this.cache.get(path.join(this.root,'batches',batchId,'manifest.json'))?.batch;
  const index=jobId.startsWith('legacy-')?Number(jobId.slice(7)):-1;
  const job=batch?.jobs.find(j=>j.id===jobId)||(index>=0?batch?.jobs[index]:null);
  const media=job&&bestMedia(job,this.root);if(!media)throw Error('Video chưa tải về.');
  return{project,version,file:this.safeFile(media.file)};
 }
 update(id,changes){
  const project=this.list().projects.find(p=>p.id===id);if(!project)throw Error('Không tìm thấy dự án.');
  const meta={...this.index.projects[id],id,name:project.name,createdAt:project.createdAt,updatedAt:project.updatedAt};
  if(changes.name!==undefined){if(typeof changes.name!=='string'||!changes.name.trim()||changes.name.length>200)throw Error('Tên dự án cần từ 1 đến 200 ký tự.');meta.name=changes.name.trim();meta.customName=true;}
  if(changes.notes!==undefined){if(typeof changes.notes!=='string'||changes.notes.length>10000)throw Error('Ghi chú tối đa 10.000 ký tự.');meta.notes=changes.notes;}
  for(const key of ['favorite','archived'])if(changes[key]!==undefined){if(typeof changes[key]!=='boolean')throw Error('Giá trị không hợp lệ.');meta[key]=changes[key];}
  meta.updatedAt=new Date().toISOString();this.index.projects[id]=meta;this.write();return this.list();
 }
 prefer(projectId,sceneId,versionId){
  const scene=this.list().projects.find(p=>p.id===projectId)?.scenes.find(s=>s.id===sceneId);
  if(!scene?.versions.find(v=>v.id===versionId&&v.available))throw Error('Chỉ chọn được phiên bản đã có file trên máy.');
  this.index.preferred[`${projectId}:${sceneId}`]=versionId;this.write();return this.list();
 }
 restore(id){
  const project=this.list().projects.find(p=>p.id===id);if(!project)throw Error('Không tìm thấy dự án.');
  const snapshot=this.readProject(id);if(snapshot)return{...snapshot,project:{...snapshot.project,title:project.name}};
  const batches=this.manifests().filter(b=>this.projectId(b)===id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  const batch=batches[0];
  const sceneMap=new Map();for(const item of [...batches].reverse())for(const scene of item.storyboardSnapshot?.scenes||item.jobs.map(j=>j.scene).filter(Boolean))sceneMap.set(scene.id,scene);
  const scenes=[...sceneMap.values()].sort((a,b)=>a.id-b.id);
  return{id,project:{title:project.name,brief:'',style:'Điện ảnh',ratio:batch?.options?.ratio||'16:9',scenes:scenes.length||1,credits:0,cost:batch?.jobs[0]?.cost||6},storyboard:scenes.length?{title:project.name,summary:'',scenes,updatedAt:new Date().toISOString()}:null,flowProject:batch?.projectUrl?{url:batch.projectUrl}:null,flowReference:batch?.options?.reference||null,flowBatch:batch||null,geminiJob:null,flowPrepared:null};
 }
}
module.exports={VideoLibrary,scopedFields,validId};
