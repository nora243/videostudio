const {ProductionPipeline}=require('./production-pipeline.cjs');
const {pipelineSteps}=require('./pipeline-steps.cjs');
let pipeline;const operations={};
const {ROLES,references,orderedReferences}=require('./references.cjs');
const {BrowserProfiles}=require('./browser-profiles.cjs');
let profiles;let profileOperation=false,browserOperations=0;const profileSessions=new Map(),profileLaunches=new Map();
async function invokeOperation(name,fn,args){const tracked=['open','confirm','read-credits','recover-script','generate-script','flow-prepare','flow-bind','flow-start','flow-resume','flow-recover','flow-reference','flow-reference-update','flow-clear-reference','upscale-start'].includes(name);if(tracked)browserOperations++;try{return await fn(...args);}finally{if(tracked)browserOperations--;}}
const {PostProduction}=require('./postproduction.cjs');
let postproduction;
const { app, BrowserWindow, ipcMain, shell, dialog, protocol, clipboard, nativeImage } = require('electron');
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { urls, isServiceUrl } = require('./service-urls.cjs');
const { randomUUID } = require('node:crypto');
const { buildPrompt, validateProject, parseStoryboard, validateStoryboard } = require('./storyboard.cjs');
const {validateEditedStoryboard,selectedScenes,buildRewritePrompt,applyScriptResult}=require('./script-edit.cjs');
const { FlowRunner } = require('./flow-runner.cjs');
const { VideoLibrary, scopedFields } = require('./library.cjs');
const { FlowProjects } = require('./flow-projects.cjs');
const { Readable } = require('node:stream');
const {ActivityLog}=require('./activity-log.cjs');
const {bestMedia}=require('./media-quality.cjs');
const {UpscaleRunner}=require('./upscale-runner.cjs');
const {productionHistory}=require('./production-history.cjs');
let upscaler;
let activity;
protocol.registerSchemesAsPrivileged([{scheme:'studio-media',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
const devMode = !app.isPackaged && process.argv.includes('--dev');
function getFlowReader() {
  const filename = require.resolve('./flow-credits.cjs');
  if (devMode) delete require.cache[filename];
  return require(filename).readFlowCredits;
}
function getGemini() {
  const filename = require.resolve('./gemini.cjs');
  if (devMode) delete require.cache[filename];
  return require(filename);
}
let generatingScript = false;
let flowRunner;
let library;
let flowProjects;
let preparingFlow=false;
function getFlow() {
  const filename = require.resolve('./flow.cjs');
  // Browser adapters are stateless; reload fixes on the next action, including normal npm start.
  for(const module of [filename,require.resolve('./video-identity.cjs'),require.resolve('./reference-identity.cjs')])delete require.cache[module];
  const adapter=require(filename);return {...adapter,prepare:(...args)=>{args[4]||=((stage,message)=>activity?.stage(stage,message));return adapter.prepare(...args);}};
}
let browser, root, state;
const pages = {};
function persist() {
  const target = path.join(root,'workspace.json'), temp = target + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(state,null,2)); fs.renameSync(temp,target);
  library?.saveWorkspace(state);
}
function findBrowser() {
  const candidates = [
    [process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'],
    [process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'],
    [process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'],
    [process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe']
  ];
  return candidates.map(([base, tail]) => base && path.join(base, tail)).find(p => p && fs.existsSync(p));
}
async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer(); server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}
async function connect() {
  const id=state.activeBrowserProfileId,session=profileSessions.get(id);
  if(session?.isConnected()){browser=session;return session;}
  if(profileLaunches.has(id))return profileLaunches.get(id);
  const pending=(async()=>{
    const executable=findBrowser();if(!executable)throw Error('Chưa tìm thấy Chrome hoặc Microsoft Edge.');
    const directory=profiles.directory(id);fs.mkdirSync(directory,{recursive:true});
    const attach=async endpoint=>{const connection=await chromium.connectOverCDP(endpoint,{timeout:3000});profileSessions.set(id,connection);if(state.activeBrowserProfileId===id)browser=connection;return connection;};
    try{const lines=fs.readFileSync(path.join(directory,'DevToolsActivePort'),'utf8').trim().split(/\r?\n/);if(lines[1])return await attach('ws://127.0.0.1:'+Number(lines[0])+lines[1]);}catch{}
    if(id==='default'&&state.browserPort){try{return await attach('http://127.0.0.1:'+state.browserPort);}catch{}}
    const port=await freePort(),child=spawn(executable,[`--user-data-dir=${directory}`,`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1','--no-first-run','--no-default-browser-check','about:blank'],{detached:true,stdio:'ignore',windowsHide:true});let launchError;child.on('error',e=>{launchError=e;});child.unref();
    for(let i=0;i<40;i++){if(launchError)throw launchError;try{const connection=await attach('http://127.0.0.1:'+port);if(id==='default')state.browserPort=port;persist();return connection;}catch{await new Promise(resolve=>setTimeout(resolve,500));}}
    throw Error('Không kết nối được trình duyệt của profile. Hãy kiểm tra cửa sổ trình duyệt.');
  })();profileLaunches.set(id,pending);try{return await pending;}finally{profileLaunches.delete(id);}
}
function syncProfileLink(){
  const id=state.activeBrowserProfileId;state.flowProfileLinks||={};
  if(state.flowProject&&(state.flowProject.profileId||'default')!==id){const owner=state.flowProject.profileId||'default';state.flowProfileLinks[owner]={flowProject:state.flowProject,flowProjectCreation:state.flowProjectCreation};const link=state.flowProfileLinks[id]||{};state.flowProject=link.flowProject||null;state.flowProjectCreation=link.flowProjectCreation||null;state.flowPrepared=null;}
}
function activateProfile(id){syncProfileLink();profiles.activate(id);browser=profileSessions.get(id)||null;for(const service of Object.keys(pages))delete pages[service];}
async function ensureProfileProject(){syncProfileLink();const page=await flowProjects.ensure();state.flowProject.profileId=state.activeBrowserProfileId;state.flowProfileLinks[state.activeBrowserProfileId]={flowProject:state.flowProject,flowProjectCreation:state.flowProjectCreation};persist();return page;}
async function profileFlowPage(){const connection=await connect(),context=connection.contexts()[0];let page=context.pages().find(p=>!p.isClosed()&&isServiceUrl('flow',p.url()));if(!page){page=await context.newPage();await page.goto(urls.flow,{waitUntil:'domcontentloaded',timeout:60000});}pages.flow=page;return page;}
async function openOwnedFlow(url,profileId='default'){if(state.activeBrowserProfileId!==profileId)activateProfile(profileId);const page=await flowProjects.open(url);pages.flow=page;return page;}
function makeFlowRunner(){return new FlowRunner({state,persist,root,getAdapter:getFlow,getPage:openOwnedFlow,getSubmissionPage:()=>ensureProfileProject(),recordBalance:(amount,id)=>profiles.balance(amount,id),switchForCredits:async({cost,exclude,report})=>{
  const previous=state.activeBrowserProfileId;
  const picked=await profiles.nextWithCredits({cost,exclude,activate:async id=>activateProfile(id),probe:async()=>getFlow().balance(await profileFlowPage())});
  if(!picked){activateProfile(previous);persist();return null;}
  report('flow.profile.selected',`Chuyển sang profile ${picked.name}; còn ${picked.balance.amount} tín dụng`);
  const page=await ensureProfileProject();return {page,credits:picked.balance.amount,profileId:picked.id};
},log:(level,message,fields)=>activity.write(level,message,fields)});}
function validService(service) { if (!Object.hasOwn(urls, service)) throw new Error('Dịch vụ không hợp lệ.'); }
async function status() {
  const history=productionHistory(library?library.manifests().filter(b=>{try{return library.projectId(b)===state.activeProjectId;}catch{return false;}}).map(b=>({...b,projectId:state.activeProjectId})):[],state.flowBatch,state.activeProjectId,state.storyboard);
  const productionJobs=history.jobs.map(job=>({...job,media:bestMedia(job,root)}));
  return { productionPipeline:state.productionPipeline||null,pipelineBusy:!!pipeline?.busy, activeBrowserProfileId:state.activeBrowserProfileId,activeBrowserProfile:profiles?.get().name, activeProjectId:state.activeProjectId, project: state.project, storyboard: state.storyboard || null, geminiJob: state.geminiJob || null, generatingScript, flowReference:references(state).length?{name:references(state)[0].displayName||references(state)[0].name}:null,flowReferences:orderedReferences(references(state)).map(r=>({id:r.id||r.name,name:r.displayName||r.name,role:r.role,description:r.description||'',thumbnail:`studio-media://reference/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(r.id||r.name)}`})), flowProject:state.flowProject || null, flowPrepared:state.flowPrepared || null, flowBatch:state.flowBatch?{...state.flowBatch,jobs:state.flowBatch.jobs.map(job=>({...job,media:bestMedia(job,root)}))}:null, flowBusy:Boolean(flowRunner?.busy||preparingFlow),upscaleBusy:Boolean(upscaler?.busy),upscaleQueue:upscaler?.queue||null, confirmations: state.confirmations, flowBalance: state.flowBalance || null, browser: Boolean(browser?.isConnected()),
    productionJobs,productionSpent:history.spent,services: Object.fromEntries(Object.keys(urls).map(s => [s, Boolean(browser?.isConnected() && pages[s] && !pages[s].isClosed())])), dataPath: root };
}
function handle(name, fn) {
  operations[name]=fn;
  ipcMain.handle(name, async (_event, ...args) => {
    const invoke=async()=>{const started=Date.now(),quiet=['status','logs-list','logs-client','post-status','profiles-list','pipeline-status'].includes(name);try{if(!quiet)activity?.stage('start',`Bắt đầu: ${name}`);if(profileOperation&&!name.startsWith('profiles-')&&!['status','post-status','logs-list','logs-client','flow-pause','upscale-pause'].includes(name))throw Error('Đang kết nối hoặc chuyển profile. Hãy chờ thao tác hoàn tất.');if(pipeline?.busy&&!['status','pipeline-pause','pipeline-status','pipeline-output','logs-list','logs-client','logs-copy','logs-export','logs-folder','library-list','post-status','post-projects','profiles-list','flow-pause','upscale-pause','folder'].includes(name))throw Error('Quy trình Sản xuất video đang quản lý dự án. Hãy tạm dừng trước khi thao tác riêng.');const data=await invokeOperation(name,fn,args);if(!quiet){const warning=data?.scriptWarning||data?.creditWarning;if(warning)activity.write('warning',warning,{stage:'result',durationMs:Date.now()-started});else activity?.stage('complete',`Hoàn tất: ${name}`,{durationMs:Date.now()-started});}return {ok:true,data};}catch(e){activity?.error(e,{durationMs:Date.now()-started});return {ok:false,error:e.message};}};
    return activity?activity.run({action:name,projectId:state?.activeProjectId,sceneId:Number.isInteger(args[0]?.sceneId)?args[0].sceneId:undefined},invoke):invoke();
  });
}
app.whenReady().then(() => {
  root = path.join(app.getPath('userData'), 'workspace'); fs.mkdirSync(root, { recursive: true });
  activity=new ActivityLog(root,{onEntry:entry=>{for(const win of BrowserWindow.getAllWindows())if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('activity-entry',entry);}});
  activity.write('info','Khởi động Video Studio',{action:'application',stage:'startup'});
  handle('logs-list',options=>({entries:activity.list({limit:1000,...options}),storageError:activity.storageError||null}));
  handle('logs-client',data=>{activity.write('error',String(data?.message||'Lỗi giao diện').slice(0,10000),{action:'renderer',stage:'unhandled',stack:String(data?.stack||'').slice(0,40000)});return null;});
  handle('logs-folder',async()=>{const error=await shell.openPath(activity.directory);if(error)throw Error(error);return null;});
  handle('logs-copy',async id=>{const entry=activity.list({limit:2000}).find(e=>e.id===id);if(!entry)throw Error('Sự kiện không còn trong bộ nhớ nhật ký. Hãy tải lại.');await clipboard.writeText(JSON.stringify(entry,null,2));return null;});
  handle('logs-export',async()=>{const choice=await dialog.showSaveDialog({title:'Xuất nhật ký',defaultPath:`video-studio-logs-${new Date().toISOString().slice(0,10)}.jsonl`,filters:[{name:'Nhật ký JSON Lines',extensions:['jsonl']}]});if(choice.canceled||!choice.filePath)return {cancelled:true};const entries=activity.list({limit:2000});await fs.promises.writeFile(choice.filePath,entries.map(e=>JSON.stringify(e)).join('\n')+'\n');return {exported:entries.length};});
  try { state = JSON.parse(fs.readFileSync(path.join(root, 'workspace.json'), 'utf8')); } catch { state = {}; }
  state.project ||= { title: '', brief: '', style: 'Điện ảnh', ratio: '16:9', scenes: 5, credits: 1000, cost: 20 }; state.confirmations ||= {};
  profiles=new BrowserProfiles(root,state,persist);
  if(state.flowBatch){state.flowBatch.profileId||='default';for(const job of state.flowBatch.jobs)job.profileId||=state.flowBatch.profileId;}
  library=new VideoLibrary(root);library.bootstrap(state);syncProfileLink();persist();
  const profileIdle=()=>{if(browserOperations||generatingScript||flowRunner?.busy||preparingFlow||upscaler?.busy||readingCredits||profileOperation)throw Error('Hãy chờ hoặc tạm dừng tác vụ hiện tại trước khi thay đổi profile.');};
  const profileTask=async fn=>{profileIdle();profileOperation=true;try{return await fn();}finally{profileOperation=false;}};
  handle('profiles-list',()=>({...profiles.list(),busy:!!(pipeline?.busy||browserOperations||profileOperation||generatingScript||flowRunner?.busy||preparingFlow||upscaler?.busy||readingCredits)}));
  handle('profiles-add',data=>profileTask(async()=>{profiles.add(data);return profiles.list();}));
  handle('profiles-update',data=>profileTask(async()=>{profiles.update(data);return profiles.list();}));
  handle('profiles-auto',value=>profileTask(async()=>{profiles.data.autoSwitch=!!value;profiles.save();return profiles.list();}));
  handle('profiles-select',id=>profileTask(async()=>{activateProfile(id);return profiles.list();}));
  handle('profiles-open',id=>profileTask(async()=>{activateProfile(id);const page=await profileFlowPage();await page.bringToFront();return profiles.list();}));
  handle('profiles-check',id=>profileTask(async()=>{activateProfile(id);try{profiles.balance(await getFlow().balance(await profileFlowPage()));persist();}catch(error){const p=profiles.get();p.ready=false;p.error=error.message;profiles.save();throw error;}return profiles.list();}));
  protocol.handle('studio-media',async request=>{
    try{
      if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
      const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      if(url.hostname==='reference'&&parts.length===2){
        const [projectId,id]=parts,source=projectId===state.activeProjectId?state:library.readProject(projectId),reference=source&&references(source).find(r=>(r.id||r.name)===id);if(!reference)return new Response(null,{status:404});
        const actual=fs.realpathSync(reference.path),base=fs.realpathSync(path.join(root,'references')),relative=path.relative(base,actual);if(relative.startsWith('..')||path.isAbsolute(relative)||!['.png','.jpg','.jpeg','.webp'].includes(path.extname(actual).toLowerCase()))return new Response(null,{status:404});
        const image=nativeImage.createFromPath(actual);if(image.isEmpty())return new Response(null,{status:404});const size=image.getSize(),scale=Math.min(1,320/size.width,240/size.height),thumbnail=image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale))}).toPNG();return new Response(request.method==='HEAD'?null:thumbnail,{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=3600'}});
      }
      if(url.hostname!=='video'||parts.length!==3)return new Response(null,{status:404});
      const {file}=library.findVersion(...parts),size=fs.statSync(file).size;
      let start=0,end=size-1,statusCode=200;const range=request.headers.get('range');
      if(range){
        const match=/^bytes=(\d*)-(\d*)$/.exec(range);
        if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
        if(!match[1])start=Math.max(0,size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
        statusCode=206;
      }
      const headers={'Content-Type':'video/mp4','Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Access-Control-Allow-Origin':'*','Cache-Control':'no-cache'};
      if(statusCode===206)headers['Content-Range']=`bytes ${start}-${end}/${size}`;
      return new Response(request.method==='HEAD'?null:Readable.toWeb(fs.createReadStream(file,{start,end})),{status:statusCode,headers});
    }catch{return new Response(null,{status:404});}
  });
  handle('status', status);
  postproduction=new PostProduction({root,library,executable:findBrowser,log:(level,message)=>activity.write(level,message,{action:'postproduction'})});
  handle('post-projects',()=>library.list().projects.map(p=>{const order=library.readProject(p.id)?.storyboard?.scenes?.map(s=>s.id)||p.scenes.map(s=>s.id);return {...p,scenes:order.map(id=>p.scenes.find(s=>s.id===id)).filter(Boolean)};}));
  handle('post-status',()=>postproduction.job);
  handle('post-start',data=>postproduction.start(data));
  handle('post-cancel',async()=>{await postproduction.cancel();return postproduction.job;});
  handle('post-folder',()=>{if(postproduction.job?.outputs.length)shell.showItemInFolder(postproduction.job.outputs[0].file);});
  handle('library-list',()=>({...library.list(),activeProjectId:state.activeProjectId,upscaleBusy:Boolean(upscaler?.busy),upscaleQueue:upscaler?.queue||null}));
  handle('library-update',({id,changes})=>{
    const result=library.update(id,changes);
    if(id===state.activeProjectId&&changes.name!==undefined){state.project.title=changes.name.trim();persist();}
    return result;
  });
  handle('library-prefer',({projectId,sceneId,versionId})=>library.prefer(projectId,sceneId,versionId));
  handle('library-import',async({projectId,sceneId})=>{
    const project=library.list().projects.find(p=>p.id===projectId);
    if(!project||!Number.isInteger(sceneId)||sceneId<1||sceneId>50||project.scenes.length&&!project.scenes.some(s=>s.id===sceneId))throw new Error('Chọn cảnh hợp lệ trong dự án.');
    const choice=await dialog.showOpenDialog({title:`Thêm video vào cảnh ${sceneId} · ${project.name}`,properties:['openFile'],filters:[{name:'Video MP4',extensions:['mp4']}]});if(choice.canceled)return{cancelled:true};
    const source=choice.filePaths[0];if(path.extname(source).toLowerCase()!=='.mp4')throw new Error('Chỉ hỗ trợ video MP4.');
    const metadata=require('./mp4.cjs').inspectMp4(source),id=randomUUID(),jobId=randomUUID(),now=new Date().toISOString();
    const folder=path.join(root,'projects',projectId,'videos',id);fs.mkdirSync(folder,{recursive:true});
    const target=path.join(folder,`scene-${String(sceneId).padStart(3,'0')}-${jobId}.mp4`);await fs.promises.copyFile(source,target);
    const scene={id:sceneId,duration_seconds:metadata.duration,description_vi:project.scenes.find(s=>s.id===sceneId)?.description||`Video nhập: ${path.basename(source)}`,voiceover_vi:'',video_prompt_en:'',negative_prompt_en:''};
    const batch={id,projectId,title:project.name,createdAt:now,status:'completed',source:'import',spent:0,options:{model:'Video từ máy',resolution:`${Math.min(metadata.width,metadata.height)}p`},jobs:[{id:jobId,sceneId,status:'downloaded',scene,file:target,metadata,downloadedAt:now,source:'import',sourceName:path.basename(source)}]};
    const manifestFolder=path.join(root,'batches',id);fs.mkdirSync(manifestFolder,{recursive:true});
    const file=path.join(manifestFolder,'manifest.json');fs.writeFileSync(file+'.tmp',JSON.stringify(batch,null,2));fs.renameSync(file+'.tmp',file);
    library.update(projectId,{});return{cancelled:false};
  });
  handle('library-file',({projectId,batchId,jobId})=>{shell.showItemInFolder(library.findVersion(projectId,batchId,jobId).file);});
  handle('library-folder',async id=>{
    const project=library.list().projects.find(p=>p.id===id);if(!project)throw new Error('Không tìm thấy dự án.');
    const folder=path.join(root,'projects',id);fs.mkdirSync(folder,{recursive:true});
    const error=await shell.openPath(folder);if(error)throw new Error(error);
  });
  handle('library-export',async id=>{
    const project=library.list().projects.find(p=>p.id===id);if(!project)throw new Error('Không tìm thấy dự án.');
    const picks=project.scenes.map(scene=>({scene,version:scene.versions.find(v=>v.id===scene.preferredId&&v.available)})).filter(x=>x.version);
    if(!picks.length)throw new Error('Dự án chưa có video đã tải để xuất.');
    const choice=await dialog.showOpenDialog({title:'Chọn nơi lưu các cảnh đã chọn',properties:['openDirectory','createDirectory']});if(choice.canceled)return{cancelled:true};
    const name=project.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80).replace(/[. ]+$/g,'')||'Video';
    const target=path.join(choice.filePaths[0],`${name}-${randomUUID().slice(0,8)}`);fs.mkdirSync(target);
    const output=[];
    for(const{scene,version}of picks){const filename=`scene-${String(scene.id).padStart(3,'0')}.mp4`;await fs.promises.copyFile(library.findVersion(id,version.batchId,version.jobId).file,path.join(target,filename));output.push({scene:scene.id,file:filename,versionId:version.id,metadata:version.metadata,prompt:version.prompt,voiceover:version.voiceover});}
    fs.writeFileSync(path.join(target,'project.json'),JSON.stringify({name:project.name,notes:project.notes,scenes:output,missingScenes:project.scenes.filter(s=>!picks.some(p=>p.scene.id===s.id)).map(s=>s.id)},null,2));
    return{folder:target,exported:output.length,missing:project.scenes.length-output.length};
  });
  function canSwitchProject(){if(generatingScript||flowRunner?.busy||preparingFlow)throw new Error('Hãy chờ tác vụ hiện tại hoàn tất hoặc tạm dừng hàng đợi trước khi chuyển dự án.');}
  handle('project-new',async()=>{
    canSwitchProject();persist();state.activeProjectId=randomUUID();
    for(const key of scopedFields)state[key]=null;
    state.project={title:'',brief:'',style:'Điện ảnh',ratio:'16:9',scenes:5,credits:state.flowBalance?.amount??1000,cost:6};
    persist();return status();
  });
  handle('project-open',async id=>{
    canSwitchProject();const snapshot=library.restore(id);persist();state.activeProjectId=id;
    for(const key of scopedFields)state[key]=snapshot[key]??null;
    flowRunner=makeFlowRunner();syncProfileLink();if(state.productionPipeline?.status==='running'){state.productionPipeline.status='paused';state.productionPipeline.error='Quy trình đã bị gián đoạn. Bấm Tiếp tục để khôi phục.';}persist();return status();
  });
  flowProjects=new FlowProjects({state,persist,connect,onPage:page=>{pages.flow=page;},owners:()=>Object.keys(library.index.projects).map(id=>({id,url:library.readProject(id)?.flowProject?.url}))});
  flowRunner = makeFlowRunner();
  upscaler=new UpscaleRunner({root,state,library,persist,getPage:openOwnedFlow,getAdapter:getFlow,log:(level,message,fields)=>activity.write(level,message,fields)});
  handle('upscale-start',async data=>{
    if(flowRunner.busy||preparingFlow||generatingScript)throw Error('Hãy chờ tác vụ hiện tại hoàn tất hoặc tạm dừng trước khi tải 1080p.');
    upscaler.start({...data,projectId:data?.projectId||state.activeProjectId});if(upscaler.queue.items.length){preparingFlow=true;void upscaler.run().catch(error=>{activity.error(error,{action:'upscale'});upscaler.queue.status='paused';upscaler.queue.error=error.message;upscaler.save();}).finally(()=>{preparingFlow=false;});}return status();
  });
  handle('upscale-pause',()=>{upscaler.pause();return status();});
  async function editReferences(fn){if(flowRunner.busy||preparingFlow)throw Error('Hàng đợi đang chạy.');preparingFlow=true;try{return await fn();}finally{preparingFlow=false;}}
  async function detachOwnedReferences(items){
    if(!browser?.isConnected())return;
    const known=[...references(state),...(state.flowPrepared?.configuration?.references||[]),...(state.flowBatch?.options.references||[]),...(state.flowBatch?.options.reference?[state.flowBatch.options.reference]:[])];
    for(const item of items){const bindings=known.filter(r=>r.name===item.name&&r.assetId&&r.projectUrl);for(const r of bindings){const page=browser.contexts().flatMap(c=>c.pages()).find(p=>!p.isClosed()&&p.url().split('?')[0]===r.projectUrl);if(page)await getFlow().removeReference(page,r.assetId);}}
    const prepared=state.flowPrepared;
    if(prepared?.prompt&&prepared.projectUrl){const page=browser.contexts().flatMap(c=>c.pages()).find(p=>!p.isClosed()&&p.url().split('?')[0]===prepared.projectUrl);if(page){const input=page.locator('.ProseMirror[role="textbox"]');if((await input.innerText()).replace(/\s+/g,' ').trim()===prepared.prompt.replace(/\s+/g,' ').trim())await input.fill('');}}
  }
  handle('flow-reference',async(data={})=>editReferences(async()=>{
    const role=data.role||'female_lead';if(!ROLES[role])throw Error('Nhóm ảnh không hợp lệ.');
    const choice=await dialog.showOpenDialog({title:'Thêm ảnh tham chiếu · '+ROLES[role].label,properties:['openFile','multiSelections'],filters:[{name:'Ảnh',extensions:['png','jpg','jpeg','webp']}]});if(choice.canceled)return status();
    const checked=choice.filePaths.map(source=>{if(!['.png','.jpg','.jpeg','.webp'].includes(path.extname(source).toLowerCase())||fs.statSync(source).size>20*1024*1024||nativeImage.createFromPath(source).isEmpty())throw Error('Ảnh tham chiếu phải là PNG/JPG/WebP hợp lệ và không quá 20 MB mỗi ảnh.');return source;});
    const list=references(state);await detachOwnedReferences(list);for(const r of list){delete r.assetId;delete r.projectUrl;}const folder=path.join(root,'references');fs.mkdirSync(folder,{recursive:true});const added=[];
    for(const source of checked){const id=randomUUID(),name=`vs-ref-${role.replaceAll('_','-')}-${id}${path.extname(source).toLowerCase()}`,target=path.join(folder,name);fs.copyFileSync(source,target);added.push({id,name,path:target,displayName:path.basename(source),role,description:''});}
    state.flowReferences=[...list,...added];state.flowReference=null;state.flowPrepared=null;persist();return status();
  }));
  handle('flow-reference-update',async({id,role,description})=>editReferences(async()=>{
    if(!ROLES[role]||typeof description!=='string'||description.length>2000)throw Error('Vai trò hoặc mô tả ảnh không hợp lệ.');
    const list=references(state),reference=list.find(r=>(r.id||r.name)===id);if(!reference)throw Error('Không tìm thấy ảnh tham chiếu.');
    // Detach known chips before changing their order, keeping the new prompt and attachment order aligned.
    await detachOwnedReferences(list);reference.role=role;reference.description=description.trim();for(const r of list){delete r.assetId;delete r.projectUrl;}state.flowReferences=list;state.flowReference=null;state.flowPrepared=null;persist();return status();
  }));
  handle('flow-clear-reference',async(data={})=>editReferences(async()=>{
    const list=references(state),removed=data.id?list.filter(r=>(r.id||r.name)===data.id):list;await detachOwnedReferences(list);for(const r of list){delete r.assetId;delete r.projectUrl;}state.flowReferences=list.filter(r=>!removed.includes(r));state.flowReference=null;state.flowPrepared=null;persist();return status();
  }));
  handle('flow-bind', async () => {
    if (flowRunner.busy||preparingFlow) throw new Error('Flow đang xử lý.');
    preparingFlow=true;try{await ensureProfileProject();}finally{preparingFlow=false;}
    return status();
  });
  handle('flow-prepare', async ({ sceneId, options }) => {
    if (flowRunner.busy||preparingFlow) throw new Error('Flow đang xử lý.');
    const scene = state.storyboard?.scenes.find(s=>s.id===sceneId);
    const adapter=getFlow(), config={...adapter.validateOptions(options),references:orderedReferences(references(state)),reference:null};adapter.compilePrompt(scene);
    preparingFlow=true;
    try{activity.stage('flow.project','Mở hoặc tạo project Flow của dự án');const page=await ensureProfileProject();state.flowPrepared = { ...await adapter.prepare(page,scene,config,state.flowPrepared?.prompt || ''),sceneId, preparedAt:new Date().toISOString() };persist();activity.stage('flow.ready',`Cảnh đã sẵn sàng: ${state.flowPrepared.cost} tín dụng; chưa gửi tạo video`);}
    finally{preparingFlow=false;}
    return status();
  });
  handle('flow-start', async ({ sceneIds, options }) => {
    if(preparingFlow||flowRunner.busy)throw new Error('Flow đang xử lý.');
    if(state.flowBatch?.jobs.some(j=>!['downloaded','cancelled'].includes(j.status)))throw new Error('Hàng đợi cũ chưa hoàn tất. Hãy tiếp tục/đối soát hoặc kết thúc trước.');
    const adapter=getFlow();adapter.validateOptions(options);
    if(!Array.isArray(sceneIds)||!sceneIds.length||new Set(sceneIds).size!==sceneIds.length)throw new Error('Chọn ít nhất một cảnh, không trùng.');
    for(const id of sceneIds)adapter.compilePrompt(state.storyboard?.scenes.find(s=>s.id===id));
    preparingFlow=true;try{await ensureProfileProject();flowRunner.create(sceneIds,options);state.flowBatch.profileId=state.activeBrowserProfileId;flowRunner.save();}finally{preparingFlow=false;}
    void flowRunner.run().catch(error=>{ state.flowBatch.error=error.message; state.flowBatch.status='paused'; persist(); });
    return status();
  });
  async function startFlowRun(recover){
    if(flowRunner.busy||preparingFlow)throw new Error('Flow đang xử lý.');
    if(!state.flowBatch)throw new Error('Chưa có hàng đợi Flow.');
    if(!recover&&state.flowBatch.jobs.some(j=>['needs_review','submitting','generating','generated','downloading','download_failed'].includes(j.status)))throw new Error('Có cảnh đã gửi. Bấm Đối soát / tải lại để tránh tạo trùng.');
    void flowRunner.run(recover).catch(error=>{state.flowBatch.error=error.message;state.flowBatch.status='paused';persist();});return status();
  }
  handle('flow-resume',()=>startFlowRun(false));
  handle('flow-recover',()=>startFlowRun(true));
  handle('flow-skip',async id=>{flowRunner.skip(id);return status();});
  handle('flow-pause', async () => { flowRunner.pause(); return status(); });
  handle('flow-finish', async () => { flowRunner.finish(); return status(); });
  handle('flow-file', async data => {
    if(typeof data==='object'){shell.showItemInFolder(library.findVersion(state.activeProjectId,data.batchId,data.jobId).file);return;}
    const job=state.flowBatch?.jobs.find(j=>j.id===data);const media=job&&bestMedia(job,root);if(!media)throw Error('Clip chưa tải về.');shell.showItemInFolder(media.file);
  });
  function geminiPage() {
    if (!browser?.isConnected()) throw new Error('Hãy bấm Kết nối Gemini trước.');
    const page = pages.gemini && !pages.gemini.isClosed() && isServiceUrl('gemini', pages.gemini.url()) ? pages.gemini :
      browser.contexts().flatMap(c => c.pages()).find(p => !p.isClosed() && isServiceUrl('gemini', p.url()));
    if (!page) throw new Error('Chưa tìm thấy tab Gemini. Hãy mở Gemini và đăng nhập.');
    pages.gemini = page; return page;
  }
  handle('preview-prompt', buildPrompt);
  async function receiveScript(page) {
    const job = state.geminiJob;
    if(job.status==='completed')return status();
    activity.stage('gemini.response','Chờ và đọc phản hồi Gemini');
    const raw = await getGemini().collectGemini(page, job, async text => {
      if (text.length > 1000000) throw new Error('Phản hồi Gemini vượt giới hạn 1 MB.');
      if (job.raw !== text) { job.raw = text; job.conversationUrl = page.url(); persist(); }
    });
    job.raw = raw; job.conversationUrl = page.url(); job.receivedAt = new Date().toISOString();
    try {
      state.storyboard = { ...applyScriptResult(raw,job,state.storyboard), requestId: job.id, updatedAt: new Date().toISOString() };
      state.project.scenes=Math.max(1,state.storyboard.scenes.length);
      if(job.sceneIds)job.appliedStoryboard=structuredClone(state.storyboard);
      job.status = 'completed'; delete job.error;
    } catch (error) { job.status = 'invalid_json'; job.error = error.message;activity.error(error,{stage:'gemini.parse'}); }
    persist(); return { ...await status(), scriptWarning: job.error || null };
  }
  handle('generate-script', async data => {
    if (generatingScript) throw new Error('Đang tạo kịch bản, vui lòng chờ.');
    if (['submitting', 'waiting', 'interrupted'].includes(state.geminiJob?.status)) throw new Error('Yêu cầu trước chưa xác định kết quả. Bấm Lấy lại phản hồi để đọc tiếp, tránh gửi trùng.');
    if(flowRunner.busy||preparingFlow)throw new Error('Hãy tạm dừng sản xuất Flow trước khi viết lại cảnh.');
    const project = validateProject(data), sceneIds=data.sceneIds?selectedScenes(state.storyboard,data.sceneIds):null, page = geminiPage();
    generatingScript = true;
    const id = randomUUID(), marker = `VIDEO_STUDIO_REQUEST_${id}`;
    const job = { id, marker, project, pipelineId:data.pipelineId||null, profileId:state.activeBrowserProfileId, ...(sceneIds?{sceneIds,baseStoryboard:structuredClone(state.storyboard)}:{}), status: 'preparing', prompt: `${sceneIds?buildRewritePrompt(project,state.storyboard,sceneIds,data.rewriteNote):buildPrompt(project)}\nMã yêu cầu: ${marker}. Không đưa mã này vào JSON.`, createdAt: new Date().toISOString(), raw: '' };
    state.geminiJob = job;
    state.project = { ...state.project, ...project }; persist();
    try {
      activity.stage('gemini.send',sceneIds?`Gửi yêu cầu viết lại ${sceneIds.length} cảnh`:'Gửi yêu cầu tạo kịch bản');
      await getGemini().sendGemini(page, job.prompt, baseline => {
        job.baseline = baseline; job.status = 'submitting'; job.conversationUrl = page.url(); persist();
      });
      job.status = 'waiting'; job.conversationUrl = page.url(); persist();
      return await receiveScript(page);
    } catch (error) {
      activity.error(error);
      job.status = job.baseline ? 'interrupted' : 'failed'; job.error = error.message; persist();
      return { ...await status(), scriptWarning: error.message };
    } finally { generatingScript = false; }
  });
  handle('recover-script', async () => {
    if (generatingScript) throw new Error('Đang đọc phản hồi Gemini.');
    if (!state.geminiJob?.baseline) throw new Error('Chưa có yêu cầu Gemini cần khôi phục.');
    if((state.geminiJob.profileId||'default')!==state.activeBrowserProfileId)throw Error('Chọn lại profile đã gửi yêu cầu Gemini trước khi lấy phản hồi.');
    const page = geminiPage(); generatingScript = true;
    try { return await receiveScript(page); }
    catch (error) { state.geminiJob.status = 'interrupted'; state.geminiJob.error = error.message; persist(); return { ...await status(), scriptWarning: error.message }; }
    finally { generatingScript = false; }
  });
  handle('import-script', async raw => {
    if (generatingScript) throw new Error('Hãy chờ Gemini hoàn tất trước khi chỉnh kịch bản.');
    const job=state.geminiJob;
    const storyboard = job?.sceneIds?applyScriptResult(raw,job.status==='completed'?{...job,baseStoryboard:job.appliedStoryboard}:job,state.storyboard):parseStoryboard(raw, job?.project.scenes, job?.project.production);
    state.storyboard = { ...storyboard, requestId: state.geminiJob?.id || null, updatedAt: new Date().toISOString() };
    if(job?.sceneIds)job.appliedStoryboard=structuredClone(state.storyboard);
    if (state.geminiJob) { state.geminiJob.raw = raw; state.geminiJob.status = 'completed'; delete state.geminiJob.error; }
    persist(); return status();
  });
  handle('save-storyboard', async data => {
    if (generatingScript) throw new Error('Hãy chờ Gemini hoàn tất trước khi lưu chỉnh sửa.');
    if(flowRunner.busy||preparingFlow)throw new Error('Hãy tạm dừng sản xuất Flow trước khi sửa kịch bản.');
    if(['submitting','waiting','interrupted','invalid_json'].includes(state.geminiJob?.status)&&state.geminiJob?.sceneIds)throw new Error('Hãy lấy lại hoặc xử lý phản hồi Gemini đang chờ trước khi sửa cảnh.');
    state.storyboard = { ...validateEditedStoryboard(data), requestId: state.storyboard?.requestId || null, updatedAt: new Date().toISOString() };
    state.project.scenes=Math.max(1,state.storyboard.scenes.length);
    persist(); return status();
  });
  let readingCredits = false;
  async function refreshCredits() {
    if(flowRunner.busy||preparingFlow)throw new Error('Hàng đợi đang quản lý Flow; số dư sẽ được cập nhật sau cảnh hiện tại.');
    if (readingCredits) throw new Error('Đang đọc tín dụng Flow, vui lòng chờ.');
    readingCredits = true;
    try {
      if (!browser?.isConnected()) throw new Error('Hãy bấm Kết nối Flow trước khi đọc tín dụng.');
      const page = pages.flow && !pages.flow.isClosed() && isServiceUrl('flow', pages.flow.url()) ? pages.flow :
        browser.contexts().flatMap(context => context.pages()).find(p => !p.isClosed() && isServiceUrl('flow', p.url()));
      if (!page) throw new Error('Chưa tìm thấy tab Flow. Hãy bấm Kết nối Flow trước.');
      pages.flow = page;
      const amount = await getFlowReader()(page);
      // Reject results if the page navigated away while the account menu was read.
      if (!isServiceUrl('flow', page.url())) throw new Error('Trang Flow đã chuyển hướng. Hãy mở lại Flow và thử lại.');
      state.flowBalance = { amount, readAt: new Date().toISOString(), source: 'Flow · giao diện trình duyệt' };
      profiles.balance(amount);state.project.credits = amount;
      delete state.flowBalanceError;
      persist(); return status();
    } finally { readingCredits = false; }
  }
  handle('read-credits', refreshCredits);
  handle('open', async service => {
    if(service==='flow'&&state.flowProject?.url&&!flowRunner.busy){
      if(preparingFlow)throw new Error('Flow đang xử lý.');
      preparingFlow=true;try{await ensureProfileProject();}finally{preparingFlow=false;}return status();
    }
    validService(service); const connection = await connect(); const context = connection.contexts()[0];
    if (!pages[service] || pages[service].isClosed()) {
      pages[service] = context.pages().find(p => !p.isClosed() && isServiceUrl(service, p.url())) || await context.newPage();
      if (!isServiceUrl(service, pages[service].url())) {
        await pages[service].goto(urls[service], { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
    }
    await pages[service].bringToFront(); return status();
  });
  handle('confirm', async service => {
    validService(service);
    if (!browser?.isConnected() || !pages[service] || pages[service].isClosed()) throw new Error('Hãy mở dịch vụ và đăng nhập trước.');
    const servicePage = isServiceUrl(service, pages[service].url()) ? pages[service] :
      browser.contexts().flatMap(context => context.pages()).find(page => !page.isClosed() && isServiceUrl(service, page.url()));
    if (!servicePage) throw new Error('Chưa tìm thấy trang dịch vụ. Hãy hoàn tất đăng nhập và mở lại Gemini hoặc Flow.');
    pages[service] = servicePage;
    state.confirmations[service] = new Date().toISOString(); persist();
    if (service === 'flow') {
      try { return await refreshCredits(); }
      catch (error) { return { ...await status(), creditWarning: error.message }; }
    }
    return status();
  });
  handle('save', async data => {
    if (!data || typeof data.title !== 'string' || typeof data.brief !== 'string' || data.title.length > 200 || data.brief.length > 20000) throw new Error('Thông tin dự án không hợp lệ.');
    for (const key of ['scenes', 'credits', 'cost']) if (!Number.isFinite(data[key]) || data[key] < (key === 'credits' ? 0 : 1) || data[key] > 1000000) throw new Error('Kiểm tra số cảnh và ngân sách.');
    state.project = { title: data.title, brief: data.brief, style: String(data.style).slice(0, 100), ratio: ['16:9', '9:16', '1:1'].includes(data.ratio) ? data.ratio : '16:9', scenes: Math.floor(data.scenes), credits: data.credits, cost: data.cost, production:require('./production.cjs').validateProduction(data.production) }; persist(); return status();
  });
  handle('folder', async () => { const error = await shell.openPath(root); if (error) throw new Error(error); });
  async function openPipelineGemini(job){
    if(job?.profileId&&job.profileId!==state.activeBrowserProfileId)activateProfile(job.profileId);
    const connection=await connect(),context=connection.contexts()[0],target=job?.conversationUrl&&isServiceUrl('gemini',job.conversationUrl)?job.conversationUrl:urls.gemini;
    let page=context.pages().find(p=>!p.isClosed()&&(job?.conversationUrl?p.url()===target:isServiceUrl('gemini',p.url())));
    if(!page){page=await context.newPage();await page.goto(target,{waitUntil:'domcontentloaded',timeout:60000});}await page.bringToFront();pages.gemini=page;return page;
  }
  pipeline=new ProductionPipeline({state,persist,steps:pipelineSteps({state,root,library,getRunner:()=>flowRunner,ensureFlow:ensureProfileProject,openGemini:openPipelineGemini,generateScript:data=>operations['generate-script'](data),recoverScript:()=>operations['recover-script'](),upscaler,postproduction,persist}),log:(level,message,fields)=>activity.write(level,message,{action:'production-pipeline',...fields})});
  function pipelineIdle(){if(pipeline.busy||browserOperations||profileOperation||generatingScript||flowRunner.busy||preparingFlow||upscaler.busy||postproduction.busy)throw Error('Hãy chờ hoặc tạm dừng tác vụ hiện tại trước khi chạy quy trình.');}
  handle('pipeline-status',()=>({job:state.productionPipeline||null,busy:pipeline.busy}));
  handle('pipeline-start',data=>{
    pipelineIdle();const project=validateProject(data.project),options=getFlow().validateOptions({...data.options,ratio:project.ratio});
    if(state.flowBatch?.jobs.some(j=>!['downloaded','cancelled'].includes(j.status)))throw Error('Hàng đợi Flow hiện tại chưa hoàn tất. Đối soát/kết thúc hàng đợi đó trước khi bắt đầu quy trình mới.');
    if(state.productionPipeline&&!['completed','cancelled'].includes(state.productionPipeline.status))throw Error('Có quy trình đang dở. Hãy bấm Tiếp tục hoặc kết thúc quy trình cũ.');
    if(['submitting','waiting','interrupted'].includes(state.geminiJob?.status))throw Error('Yêu cầu Gemini cũ chưa rõ kết quả. Hãy lấy lại phản hồi trước.');
    state.project={...state.project,...project};persist();pipeline.start({project,options,references:structuredClone(orderedReferences(references(state)))});return status();
  });
  handle('pipeline-resume',()=>{pipelineIdle();pipeline.resume();return status();});
  handle('pipeline-pause',async()=>{pipeline.pause();if(flowRunner.busy)flowRunner.pause();if(upscaler.busy)upscaler.pause();if(postproduction.busy)await postproduction.cancel();return status();});
  handle('pipeline-cancel',()=>{pipelineIdle();pipeline.cancel();return status();});
  handle('pipeline-output',()=>{const output=state.productionPipeline?.output;if(!output?.file||!fs.existsSync(output.file))throw Error('Video hoàn chỉnh chưa có trên máy.');shell.showItemInFolder(library.safeFile(output.file));});
  const win = new BrowserWindow({ width: 1370, height: 940, minWidth: 1050, minHeight: 760, backgroundColor: '#0d111b', title: 'Video Studio', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.on('render-process-gone',(_event,details)=>activity.write('error',`Giao diện dừng: ${details.reason}`,{action:'application',stage:'renderer-exit',exitCode:details.exitCode}));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'index.html'));
  if (devMode) {
    win.setTitle('Video Studio · DEV');
    let reloadTimer;
    const watcher = fs.watch(__dirname, (_event, filename) => {
      if (!filename) return;
      filename = String(filename);
      // Browser automation modules are re-required on the next action.
      if (['flow-credits.cjs', 'gemini.cjs', 'flow.cjs'].includes(filename)) return;
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        if (['main.cjs', 'preload.cjs', 'service-urls.cjs', 'storyboard.cjs','flow-runner.cjs','mp4.cjs','library.cjs','flow-projects.cjs','upscale-runner.cjs','media-quality.cjs','activity-log.cjs','reference-identity.cjs','production.cjs','script-edit.cjs','browser-profiles.cjs','postproduction.cjs','references.cjs','production-pipeline.cjs','pipeline-steps.cjs'].includes(filename)) {
          app.relaunch(); app.exit(0);
        } else if (/\.(html|css|js)$/.test(filename) && !win.isDestroyed()) win.webContents.reload();
      }, 600);
    });
    app.on('before-quit', () => { clearTimeout(reloadTimer); watcher.close(); });
  }
});
app.on('window-all-closed', () => app.quit());
