const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {VideoLibrary}=require('./library.cjs');
const {FlowProjects,browserDriver}=require('./flow-projects.cjs');
const {FlowRunner}=require('./flow-runner.cjs');
const {UpscaleRunner}=require('./upscale-runner.cjs');
const {PostProduction}=require('./postproduction.cjs');
const {ProductionPipeline}=require('./production-pipeline.cjs');
const {pipelineSteps}=require('./pipeline-steps.cjs');
const {buildPrompt,parseStoryboard}=require('./storyboard.cjs');
const gemini=require('./gemini.cjs');
const flow=require('./flow.cjs');
const {urls}=require('./service-urls.cjs');
const {atomic}=require('./bulk-runner.cjs');
const {inspect1080}=require('./media-quality.cjs');
function buildBulkScriptPrompt(project,marker){return buildPrompt(project)+'\nCURRENT EPISODE: '+JSON.stringify({title:project.title,brief:project.brief,style:project.style,ratio:project.ratio,scenes:project.scenes,sceneDuration:project.sceneDuration})+'\nUse this current episode only; it overrides any example topic from a saved template.\nRequest marker: '+marker+'\nReturn the JSON storyboard only.';}
class BulkRuntime{
 constructor({item,profile,root,browser,executable,report,log,recordBalance}){
  fs.mkdirSync(root,{recursive:true});const parentLog=log;
  log=(level,message,fields={})=>{fs.appendFileSync(path.join(root,'events.jsonl'),JSON.stringify({time:new Date().toISOString(),level,message,...fields})+'\n');parentLog(level,message,fields);};
  Object.assign(this,{item,profile,root,browser,executable,report,log,recordBalance});this.pages=new Set();this.stopped=false;
  fs.mkdirSync(root,{recursive:true});this.file=path.join(root,'workspace.json');
  if(fs.existsSync(this.file))this.state=JSON.parse(fs.readFileSync(this.file,'utf8'));
  else{
   const project=structuredClone(item.project),references=item.references.map((r,i)=>this.copyReference(r,i));
   for(const [i,s]of project.production.speakers.entries())if(s.imagePath)s.imagePath=this.copyReference({path:s.imagePath},100+i).path;
   this.state={activeProjectId:randomUUID(),activeBrowserProfileId:profile.id,project,flowReferences:references,confirmations:{}};
  }
  if(this.state.activeBrowserProfileId!==profile.id)throw Error('Dự án gián đoạn phải được đối soát trên đúng profile cũ.');
  this.library=new VideoLibrary(root);this.library.bootstrap(this.state);
  const persist=()=>this.persist(),owned=p=>{this.pages.add(p);return p;};
  const driver={...browserDriver,
   home:async(...args)=>owned(await browserDriver.home(...args)),
   openLinked:async(...args)=>owned(await browserDriver.openLinked(...args)),
   findOwned:async(...args)=>{const p=await browserDriver.findOwned(...args);if(p)owned(p);return p;}
  };
  this.flowProjects=new FlowProjects({state:this.state,persist,connect:async()=>browser,driver,onPage:p=>owned(p)});
  const ensureFlow=async()=>{this.checkStop();const p=await this.flowProjects.ensure();this.state.flowProject.profileId=profile.id;persist();return p;};
  const getAdapter=()=>({...flow,
   prepare:async(...args)=>{this.checkStop();return flow.prepare(...args);},
   download1080:async(page,job,file,save,progress,timeout,options)=>{
    this.checkStop();
    // Reconcile an interrupted transfer from its validated staging file. An
    // uncertain paid upscale request must never be clicked again automatically.
    if(job.upscale?.requestedAt&&!['completed','failed'].includes(job.upscale.status)){
     const temporary=file+'.part.mp4';
     if(fs.existsSync(temporary)){try{const metadata=inspect1080(temporary,job);fs.renameSync(temporary,file);job.renditions||={};job.renditions['1080p']={file,metadata,downloadedAt:new Date().toISOString(),source:'Flow upscale recovery'};job.upscale.status='completed';await save();return metadata;}catch(e){log('warning','File tải dở chưa hợp lệ: '+e.message,{stage:'upscale.reconcile',sceneId:job.sceneId});}}
     throw Error('Yêu cầu 1080p trước chưa rõ kết quả; đối soát chưa thấy file hợp lệ. Không tự bấm lại để tránh yêu cầu trùng.');
    }
    return flow.download1080(page,job,file,save,progress,timeout,{...options,shouldStop:()=>this.stopped||options?.shouldStop?.()});
   }
  });
  this.runner=new FlowRunner({state:this.state,root,persist,getAdapter,getPage:async url=>{this.checkStop();return this.flowProjects.open(url);},getSubmissionPage:ensureFlow,recordBalance:amount=>recordBalance(amount,profile.id),log});
  this.upscaler=new UpscaleRunner({state:this.state,root,library:this.library,persist,getPage:async url=>{this.checkStop();return this.flowProjects.open(url);},getAdapter,log});
  this.postproduction=new PostProduction({root,library:this.library,executable,log:(level,message,fields)=>log(level,message,{stage:'postproduction',...fields})});
  this.pipeline=new ProductionPipeline({state:this.state,persist,steps:pipelineSteps({state:this.state,root,library:this.library,getRunner:()=>this.runner,ensureFlow,openGemini:job=>this.openGemini(job),generateScript:data=>this.generateScript(data),recoverScript:()=>this.recoverScript(),upscaler:this.upscaler,postproduction:this.postproduction,persist}),log});
  this.persist();
  this.progressTimer=setInterval(()=>{try{this.publish();}catch(e){this.stopped=true;clearInterval(this.progressTimer);try{this.log('error',e.message,{stage:'bulk.progress'});}catch{}}},1000);
 }
 copyReference(r,index){const directory=path.join(this.root,'references');fs.mkdirSync(directory,{recursive:true});const id=randomUUID(),name=`bulk-ref-${index}-${id}${path.extname(r.path).toLowerCase()}`,file=path.join(directory,name);fs.copyFileSync(r.path,file);return {...r,id,name,path:file,displayName:path.basename(r.path)};}
 checkStop(){if(this.stopped)throw Error('Đã bỏ qua dự án theo yêu cầu.');}
 persist(){
  require('./references.cjs').syncCharacterReferences(this.state);
  atomic(this.file,this.state);this.library?.saveWorkspace(this.state);
  this.publish();
 }
 publish(){
  const job=this.state.productionPipeline;
  if(job){const progress={projectId:this.state.activeProjectId,stage:job.stage,done:[...job.done],detail:job.detail||'',flowProjectUrl:this.state.flowProject?.url||null,scenes:this.state.flowBatch?.jobs.map(j=>({sceneId:j.sceneId,status:j.status,error:j.error||null,upscale:j.upscale?.status||null}))||[],spent:this.state.flowBatch?.spent||0,postProgress:this.postproduction?.job?.progress||0,geminiStatus:this.state.geminiJob?.status||null};const stamp=JSON.stringify(progress);if(stamp!==this.progressStamp){this.progressStamp=stamp;this.report(progress);}}
 }
 async openGemini(job){
  this.checkStop();if(this.geminiPage&&!this.geminiPage.isClosed())return this.geminiPage;
  const p=await this.browser.contexts()[0].newPage();this.pages.add(p);this.geminiPage=p;
  await p.goto(job?.conversationUrl||urls.gemini,{waitUntil:'domcontentloaded',timeout:60000});return p;
 }
 async generateScript(project){
  this.checkStop();const old=this.state.geminiJob;
  // A completed but invalid response is safe to rewrite; an uncertain send is
  // always collected from the original conversation instead of being resent.
  const page=await this.openGemini(old),id=randomUUID(),marker='VIDEO_STUDIO_REQUEST_'+id;
  if(old?.id&&/^[a-zA-Z0-9-]+$/.test(old.id))atomic(path.join(this.root,'gemini-attempts',old.id+'.json'),old);
  const prompt=buildBulkScriptPrompt(project,marker);
  const job={id,marker,prompt,pipelineId:project.pipelineId,project:structuredClone(project),profileId:this.profile.id,status:'preparing',createdAt:new Date().toISOString(),raw:''};
  this.state.geminiJob=job;this.persist();
  await gemini.sendGemini(page,prompt,baseline=>{job.baseline=baseline;job.status='submitting';job.conversationUrl=page.url();this.persist();});
  job.status='waiting';job.conversationUrl=page.url();this.persist();await this.collectScript(page,job);
 }
 async collectScript(page,job){
  let raw;
  try{raw=await gemini.collectGemini(page,job,text=>{job.raw=text;job.conversationUrl=page.url();this.persist();});}
  catch(e){job.error=e.message;job.status=job.baseline?'interrupted':'failed';this.persist();throw e;}
  try{const board=parseStoryboard(raw,job.project.scenes,job.project.production,{sceneDuration:job.project.sceneDuration});this.state.storyboard={...board,requestId:job.id,updatedAt:new Date().toISOString()};job.status='completed';delete job.error;this.persist();}
  catch(e){job.status='invalid_json';job.error=e.message;this.persist();throw e;}
 }
 async recoverScript(){
  const job=this.state.geminiJob;if(!job)throw Error('Không có yêu cầu Gemini để đối soát.');
  if(job.status==='invalid_json')return this.generateScript(job.project);
  if(!job.baseline)throw Error('Yêu cầu Gemini chưa được gửi.');
  await this.collectScript(await this.openGemini(job),job);
 }
 async reconcile(){
  this.checkStop();this.log('info','Đọc lại manifest và kết quả đã có; tiếp tục đúng bước lỗi',{stage:'bulk.reconcile'});
  if(this.state.productionPipeline?.done.includes('script')&&!this.state.storyboard)this.state.storyboard=structuredClone(this.state.productionPipeline.storyboard);
  this.persist();
 }
 async run(){
  this.checkStop();let job=this.state.productionPipeline;
  if(!job)job=this.pipeline.start({project:this.state.project,options:this.item.options,references:structuredClone(this.state.flowReferences)});
  else if(job.status!=='completed')this.pipeline.resume();
  if(this.pipeline.completion)await this.pipeline.completion;
  this.checkStop();job=this.state.productionPipeline;
  if(job.status!=='completed'||job.done.length!==5||!job.output?.file)throw Error(job.error||'Chưa hoàn tất đủ năm bước sản xuất.');
  const actual=this.library.safeFile(job.output.file),metadata=require('./mp4.cjs').inspectMp4(actual);
  if(Math.min(metadata.width,metadata.height)<1080)throw Error('Thành phẩm chưa đủ 1080p.');
  return {output:{file:actual,metadata},warnings:[...(job.results.cleanup?.warnings||[]),...(job.results.merge?.warnings||[])]};
 }
 async stop(){this.stopped=true;this.pipeline.pause();this.runner.pause();this.upscaler.pause();await this.postproduction.cancel();await Promise.allSettled([...this.pages].filter(p=>!p.isClosed()).map(p=>p.close()));}
 async close(){clearInterval(this.progressTimer);await Promise.allSettled([...this.pages].filter(p=>!p.isClosed()).map(p=>p.close()));}
}
module.exports={BulkRuntime,buildBulkScriptPrompt};
