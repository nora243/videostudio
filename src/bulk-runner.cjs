const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {MIN_CREDITS}=require('./bulk-input.cjs');
const atomic=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2));fs.renameSync(file+'.tmp',file);};
const publicItem=item=>({...item,project:{...item.project,production:undefined}});
class BulkRunner{
 constructor({root,getProfiles,probe,createRuntime,log=()=>{},retryDelayMs=1000}){Object.assign(this,{root,getProfiles,probe,createRuntime,log,retryDelayMs});this.busy=false;this.active=new Map();this.file=path.join(root,'bulk-production.json');
  if(fs.existsSync(this.file)){this.run=JSON.parse(fs.readFileSync(this.file,'utf8'));for(const item of this.run.items){const input=path.join(item.directory,'input.json');if(fs.existsSync(input)){const saved=JSON.parse(fs.readFileSync(input,'utf8'));item.project=saved.project;item.references=saved.references;item.options=saved.options;}else if(item.project?.production)atomic(input,{project:item.project,references:item.references,options:item.options});}
   if(['running','checking','pausing'].includes(this.run.status)){this.run.status='paused';for(const item of this.run.items)if(['running','retrying','reconciling'].includes(item.status)){item.status='interrupted';item.error='Ứng dụng đã dừng. Tiếp tục sẽ đối soát trạng thái đã lưu, không tạo lại dự án.';}this.save();}}
 }
 save(){clearTimeout(this.saveTimer);this.saveTimer=null;if(this.run){this.run.updatedAt=new Date().toISOString();const saved=this.snapshot().run;atomic(this.file,saved);atomic(path.join(this.run.directory,'manifest.json'),saved);}}
 scheduleSave(){if(!this.saveTimer){this.saveTimer=setTimeout(()=>{this.saveTimer=null;try{this.save();}catch(e){this.run.pauseRequested=true;this.run.error='Không lưu được trạng thái: '+e.message;}},500);this.saveTimer.unref?.();}}
 event(level,message,fields={}){const entry={time:new Date().toISOString(),level,message,runId:this.run.id,...fields};fs.appendFileSync(path.join(this.run.directory,'events.jsonl'),JSON.stringify(entry)+'\n');this.run.events.push(entry);this.run.events=this.run.events.slice(-500);this.log(level,message,{action:'bulk',...fields,runId:this.run.id});if(level==='error')this.save();else this.scheduleSave();}
 snapshot(){return {busy:this.busy,run:this.run?{...this.run,items:this.run.items.map(publicItem)}:null};}
 start(plan){if(this.busy)throw Error('Đang chạy sản xuất hàng loạt.');if(!plan?.ok||!plan.jobs?.length)throw Error('File đầu vào chưa hợp lệ.');if(this.run?.items.some(i=>['queued','running','interrupted','retrying','reconciling'].includes(i.status))&&!['completed','completed_with_errors','cancelled'].includes(this.run.status))throw Error('Còn hàng đợi cũ. Tiếp tục hoặc kết thúc trước khi nhập lô mới.');
  const id=randomUUID(),directory=path.join(plan.outputDirectory,'runs',id);fs.mkdirSync(directory,{recursive:true});
  this.run={id,directory,outputDirectory:plan.outputDirectory,successDirectory:path.join(plan.outputDirectory,'successful'),createdAt:new Date().toISOString(),status:'paused',pauseRequested:false,profiles:[],events:[],items:plan.jobs.map(j=>({...structuredClone(j),status:'queued',attempt:0,done:[],directory:path.join(directory,'projects',j.id)}))};for(const item of this.run.items)atomic(path.join(item.directory,'input.json'),{project:item.project,references:item.references,options:item.options});this.save();return this.resume();
 }
 resume(){if(this.busy)throw Error('Đang chạy sản xuất hàng loạt.');if(!this.run||['completed','completed_with_errors','cancelled'].includes(this.run.status))throw Error('Không có hàng đợi đang dở để tiếp tục.');this.busy=true;this.run.status='checking';this.run.pauseRequested=false;delete this.run.error;this.save();this.completion=this.execute().catch(e=>{this.run.status='paused';this.run.error=e.message;this.event('error',e.message,{stage:'bulk.run',stack:e.stack});}).finally(()=>{this.busy=false;this.save();});return this.snapshot();}
 pause(){if(this.run){this.run.pauseRequested=true;if(this.busy)this.run.status='pausing';this.save();}return this.snapshot();}
 async skip(id){const item=this.run?.items.find(i=>i.id===id);if(!item)throw Error('Không tìm thấy dự án.');if(item.status==='completed')throw Error('Dự án đã hoàn tất.');item.skipRequested=true;const runtime=this.active.get(id);if(runtime)await runtime.stop();else item.status='skipped';this.event('warning','Đã yêu cầu bỏ qua dự án',{itemId:id});return this.snapshot();}
 cancel(){if(this.busy)throw Error('Dừng và chờ dự án đang chạy hoàn tất trước khi kết thúc lô.');for(const item of this.run?.items||[])if(['queued','interrupted'].includes(item.status))item.status='skipped';if(this.run){this.run.status='cancelled';this.save();}return this.snapshot();}
 async execute(){
  const all=this.getProfiles(),candidates=all.filter(p=>p.enabled&&p.ready),valid=[];this.run.profiles=all.map(p=>({id:p.id,name:p.name,status:!p.enabled?'disabled':!p.ready?'not_ready':'checking',cachedBalance:p.balance?.amount}));this.event('info','Kiểm tra profile đã bật và đọc lại số dư trực tiếp',{stage:'bulk.preflight'});
  await Promise.all(candidates.map(async p=>{const result=this.run.profiles.find(r=>r.id===p.id);this.save();try{const balance=await this.probe(p);if(!Number.isFinite(balance)||balance<0)throw Error("Invalid live credit balance");result.balance=balance;result.checkedAt=new Date().toISOString();result.status=balance>=MIN_CREDITS?'eligible':'insufficient';if(balance>=MIN_CREDITS)valid.push(p);}catch(e){result.status='error';result.error=e.message;}this.event(result.status==='eligible'?'info':'warning',`Profile ${p.name}: ${result.status}${result.balance!==undefined?' · '+result.balance+' tín dụng':''}`,{profileId:p.id,stage:'bulk.preflight'});}));
  if(!valid.length){this.run.status='paused';this.run.error='Không có profile đã bật, sẵn sàng và có số dư trực tiếp ít nhất 100 tín dụng.';this.save();return;}
  this.run.status=this.run.pauseRequested?'pausing':'running';this.save();
  const results=await Promise.allSettled(valid.map(p=>this.worker(p)));
  for(const result of results)if(result.status==='rejected')this.event('error',result.reason?.message||String(result.reason),{stage:'bulk.worker.unexpected'});
  const unfinished=this.run.items.some(i=>['queued','interrupted'].includes(i.status));this.run.status=unfinished?'paused':this.run.items.some(i=>['failed','skipped'].includes(i.status))?'completed_with_errors':'completed';
  if(unfinished&&!this.run.pauseRequested)this.run.error='Còn dự án chờ; không còn profile hợp lệ hoặc profile đã được dành để đối soát dự án gián đoạn.';
  this.event('info','Đã dừng/hoàn tất lô sản xuất',{stage:'bulk.done'});
 }
 async worker(profile){
  const slot=this.run.profiles.find(p=>p.id===profile.id);let first=true;
  while(!this.run.pauseRequested){
   const live=this.getProfiles().find(p=>p.id===profile.id);if(!live?.enabled||!live.ready)break;
   const pinned=this.run.items.find(i=>i.status==='interrupted'&&i.profileId===profile.id);
   if(!first){try{slot.balance=await this.probe(profile);if(!Number.isFinite(slot.balance)||slot.balance<0)throw Error('Không đọc được số dư hợp lệ.');slot.checkedAt=new Date().toISOString();}catch(e){slot.error=e.message;slot.status='error';break;}}
   first=false;if(slot.balance<MIN_CREDITS){slot.status='insufficient';break;}
   const item=pinned||this.run.items.find(i=>i.status==='queued');if(!item)break;
   item.profileId=profile.id;item.profileName=profile.name;item.status='running';item.startedAt||=new Date().toISOString();slot.itemId=item.id;slot.status='running';this.save();
   let runtime;
   try{
    const start=Math.max(1,item.attempt||1);
    for(let attempt=start;attempt<=3;attempt++){
     if(item.skipRequested)break;item.attempt=attempt;item.status=attempt===1?'running':'reconciling';this.save();
     try{
      if(attempt>1&&this.retryDelayMs)await new Promise(resolve=>setTimeout(resolve,this.retryDelayMs));
      if(!runtime){runtime=await this.createRuntime({item,profile,root:item.directory,report:fields=>{Object.assign(item,fields);this.scheduleSave();},log:(level,message,fields={})=>this.event(level,message,{...fields,itemId:item.id,profileId:profile.id})});this.active.set(item.id,runtime);}
      if(item.skipRequested)break;
      if(attempt>1){this.event('warning',`Đối soát và thử lại ${attempt-1}/2`,{itemId:item.id,profileId:profile.id,stage:item.stage});await runtime.reconcile();}
      item.status='running';this.save();
      const result=await runtime.run();if(item.skipRequested)break;
      if(!result?.output?.file||!fs.existsSync(result.output.file))throw Error('Quy trình chưa có file thành phẩm.');
      const success=path.join(this.run.successDirectory,this.run.id+'-'+item.id),staging=path.join(this.run.directory,'publishing',item.id);fs.mkdirSync(staging,{recursive:true});
      fs.copyFileSync(result.output.file,path.join(item.directory,'final.mp4.part'));fs.renameSync(path.join(item.directory,'final.mp4.part'),path.join(item.directory,'final.mp4'));
      const metadata={id:item.id,title:item.project.title,profileId:profile.id,runId:this.run.id,completedAt:new Date().toISOString(),output:'final.mp4',warnings:result.warnings||[],metadata:result.output.metadata||null};
      if(!fs.existsSync(success)){
       fs.copyFileSync(result.output.file,path.join(staging,'final.mp4'));atomic(path.join(staging,'project.json'),metadata);fs.mkdirSync(this.run.successDirectory,{recursive:true});fs.renameSync(staging,success);
      }else{const previous=JSON.parse(fs.readFileSync(path.join(success,'project.json'),'utf8'));if(previous.runId!==this.run.id||previous.id!==item.id||!fs.existsSync(path.join(success,'final.mp4')))throw Error('Thư mục thành phẩm đã tồn tại nhưng không khớp dự án.');}
      item.status='completed';item.output=path.join(item.directory,'final.mp4');item.successDirectory=success;item.done=['script','videos','upscale','cleanup','merge'];item.warnings=result.warnings||[];delete item.error;
      this.event('info','Dự án đã có thành phẩm 1080p qua xóa watermark và ghép phim',{itemId:item.id,profileId:profile.id,stage:'bulk.project.done'});break;
     }catch(e){item.error=e.message;item.status=attempt===3?'failed':'retrying';this.event('error',e.message,{itemId:item.id,profileId:profile.id,stage:item.stage,attempt,stack:e.stack});}
    }
   }catch(e){item.status='failed';item.error=e.message;this.event('error',e.message,{itemId:item.id,profileId:profile.id,stage:'bulk.worker',stack:e.stack});}
   finally{if(item.skipRequested)item.status='skipped';item.finishedAt=new Date().toISOString();this.active.delete(item.id);await runtime?.close().catch(e=>this.event('warning',e.message,{itemId:item.id}));slot.itemId=null;slot.status='eligible';this.save();}
  }
  if(slot.status==='running'||slot.status==='eligible')slot.status='idle';this.save();
 }
}
module.exports={BulkRunner,atomic,publicItem};
