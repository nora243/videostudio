const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');const{bestMedia,resolution}=require('./media-quality.cjs');
const atomic=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2));fs.renameSync(file+'.tmp',file);};
class UpscaleRunner{
 constructor({root,state,library,getPage,getAdapter,persist,log=()=>{}}){Object.assign(this,{root,state,library,getPage,getAdapter,persist,log});this.file=path.join(root,'upscale-queue.json');this.busy=false;try{this.queue=JSON.parse(fs.readFileSync(this.file,'utf8'));if(this.queue.status==='running'){this.queue.status='paused';for(const item of this.queue.items)if(item.status==='running'){item.status='interrupted';item.error='Ứng dụng dừng khi đang tải. Kiểm tra Flow rồi tải riêng cảnh; không tự gửi lại yêu cầu.';}this.save();}}catch{this.queue=null;}}
 save(){if(this.queue)atomic(this.file,this.queue);}
 start({projectId,sceneId,batchId,jobId}={}){
  if(this.busy)throw Error('Đang tải hàng đợi 1080p.');const project=this.library.list().projects.find(p=>p.id===projectId);if(!project)throw Error('Không tìm thấy dự án.');
  const scenes=project.scenes.filter(s=>sceneId===undefined||s.id===sceneId);if(!scenes.length)throw Error('Không tìm thấy cảnh.');const items=[];let skipped=0,unsupported=0;
  for(const scene of scenes){const version=batchId&&jobId?scene.versions.find(v=>v.batchId===batchId&&v.jobId===jobId):scene.versions.find(v=>v.id===scene.preferredId)||scene.versions.find(v=>v.assetId&&v.projectUrl);
   if(!version){unsupported++;continue;}if(version.has1080){skipped++;continue;}if(!version.assetId||!version.projectUrl){unsupported++;continue;}
   if(sceneId===undefined&&['requesting','waiting','downloading','needs_review'].includes(version.upscale?.status)){unsupported++;continue;}
   items.push({sceneId:scene.id,batchId:version.batchId,jobId:version.jobId,status:'queued'});
  }
  this.queue={id:randomUUID(),projectId,projectName:project.name,status:items.length?'paused':'completed',createdAt:new Date().toISOString(),items,skipped,unsupported,pauseRequested:false};this.save();return this.queue;
 }
 pause(){if(this.queue){this.queue.pauseRequested=true;this.save();}}
 load(item){const batch=this.state.activeProjectId===this.queue.projectId&&this.state.flowBatch?.id===item.batchId?this.state.flowBatch:JSON.parse(fs.readFileSync(path.join(this.root,'batches',item.batchId,'manifest.json'),'utf8'));if(this.library.projectId(batch)!==this.queue.projectId)throw Error('Hàng đợi không thuộc dự án.');const job=batch.jobs.find(j=>j.id===item.jobId&&j.sceneId===item.sceneId);if(!job?.assetId)throw Error('Video không có mã kết quả Flow.');return{batch,job};}
 saveJob(batch){atomic(path.join(this.root,'batches',batch.id,'manifest.json'),batch);if(this.state.activeProjectId===this.queue.projectId&&this.state.flowBatch?.id===batch.id)this.state.flowBatch=batch;this.persist();}
 async run(){if(this.busy)throw Error('Đang tải 1080p.');const queue=this.queue;if(!queue?.items.length)return queue;this.busy=true;queue.status='running';this.save();
  try{for(const item of queue.items){if(queue.pauseRequested)break;if(item.status!=='queued')continue;item.status='running';this.save();let stage='upscale.project';const report=(step,message)=>{stage=step;item.step=step;this.save();this.log('info',message,{action:'upscale',stage:step,projectId:queue.projectId,sceneId:item.sceneId,batchId:item.batchId,jobId:item.jobId});};let batch,job;
   try{({batch,job}=this.load(item));if(resolution(bestMedia(job,this.root)?.metadata)>=1080){item.status='skipped';continue;}report('upscale.project','Mở project Flow của video cần tải 1080p');job.projectUrl||=batch.projectUrl;const page=await this.getPage(job.projectUrl,job.profileId||batch.profileId||'default'),file=path.join(this.root,'projects',queue.projectId,'videos',batch.id,`scene-${String(job.sceneId).padStart(3,'0')}-${job.id}-1080p.mp4`);await this.getAdapter().download1080(page,job,file,()=>this.saveJob(batch),report);item.status='downloaded';}
   catch(error){item.status='failed';item.error=error.message;if(job){job.upscale={...job.upscale,status:job.upscale?.requestedAt?'needs_review':'failed',error:error.message};this.saveJob(batch);}this.log('error',error.message,{action:'upscale',stage,projectId:queue.projectId,sceneId:item.sceneId,batchId:item.batchId,jobId:item.jobId,stack:error.stack});}
   finally{this.save();}
  }queue.status=queue.pauseRequested?'paused':queue.items.some(i=>['failed','interrupted'].includes(i.status))?'completed_with_errors':'completed';}
  finally{this.busy=false;this.save();}return queue;
 }
}
module.exports={UpscaleRunner};
