const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {randomUUID}=require('node:crypto');
function planProject(library,projectId,sceneIds){
 const project=library.list().projects.find(p=>p.id===projectId);if(!project)throw Error('Không tìm thấy dự án.');
 const storyboard=library.readProject(projectId)?.storyboard?.scenes;
 const order=storyboard?.length?storyboard.map(s=>s.id):project.scenes.map(s=>s.id);
 const ids=sceneIds===undefined?order:sceneIds;
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!order.includes(id)))throw Error('Danh sách cảnh không hợp lệ.');
 return ids.map(id=>{const scene=project.scenes.find(s=>s.id===id),v=scene?.versions.find(v=>v.id===scene.preferredId&&v.available);if(!v)throw Error(`Cảnh ${id} chưa có video trên máy. Hãy tải hoặc bỏ chọn cảnh này.`);return {sceneId:id,...library.findVersion(projectId,v.batchId,v.jobId)};});
}
class PostProduction{
 constructor({root,library,executable,log=()=>{}}){Object.assign(this,{root,library,executable,log});this.job=null;this.browser=null;this.busy=false;try{this.job=JSON.parse(fs.readFileSync(path.join(root,'postproduction.json'),'utf8'));if(this.job.status==='running'){this.job.status='interrupted';this.job.error='Tác vụ bị gián đoạn khi đóng ứng dụng. File gốc được giữ nguyên.';}}catch{}}
 start(data,providedClips){
  if(this.busy)throw Error('Đang có tác vụ hậu kỳ.');
  if(!['clean','merge','clean-merge'].includes(data?.mode))throw Error('Chế độ hậu kỳ không hợp lệ.');
  const clips=providedClips||planProject(this.library,data.projectId,data.sceneIds);
  const id=randomUUID(),directory=path.join(this.root,'projects',data.projectId,'postproduction',id);fs.mkdirSync(directory,{recursive:true});
  this.job={id,projectId:data.projectId,pipelineId:data.pipelineId||null,mode:data.mode,status:'running',progress:0,directory,outputs:[],warnings:[],startedAt:new Date().toISOString()};this.save();this.busy=true;
  this.completion=this.run(clips).catch(error=>{if(this.job.status==='running'){this.job.status='failed';this.job.error=error.message;this.log('error',error.message);}}).finally(()=>{this.busy=false;this.save();});return this.job;
 }
 save(){const json=JSON.stringify(this.job,null,2);fs.writeFileSync(path.join(this.job.directory,'manifest.json'),json);fs.writeFileSync(path.join(this.root,'postproduction.json'),json);}
 async cancel(){if(this.job?.status!=='running')return;this.job.status='cancelled';this.save();await this.browser?.close();}
 async run(clips){
  const job=this.job,engine=path.join(__dirname,'vendor/gwr/video-engine.js');let browser,server;
  try{
   server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<input type="file" multiple id="files"><script type="module">import * as engine from "/engine.js";window.engine=engine;</script>');}else if(req.url==='/engine.js'){res.setHeader('Content-Type','text/javascript');fs.createReadStream(engine).pipe(res);}else{res.statusCode=404;res.end();}});
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   if(!this.executable())throw Error('Cần cài Chrome hoặc Edge để xử lý video.');
   const {chromium}=require('playwright-core');
   browser=await chromium.launch({executablePath:this.executable(),headless:true});this.browser=browser;if(job.status!=='running')return;
   const page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(30*60*1000);
   await page.exposeFunction('postProgress',p=>{job.progress=p;});
   await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>!!window.engine);
   await page.locator('#files').setInputFiles(clips.map(c=>c.file));
   const result=await page.evaluate(async({mode})=>{
    const files=[...document.querySelector('#files').files],blobs=[],reports=[];
    for(let i=0;i<files.length;i++){
     let blob=files[i];const metadata=await engine.inspectGeminiVideoFile(blob);
     if(mode!=='merge'){
      const bitrate=Math.max(40000000,Math.ceil(blob.size*8/Math.max(metadata.duration||1,1)*1.5));
      const r=await engine.removeGeminiVideoWatermark(blob,{videoBitrate:bitrate,preserveAudio:true,allowLowConfidence:true,denoiseBackend:'none',onProgress:p=>window.postProgress((i+(p.progress||0))/files.length*.8)});
      blob=r.blob;reports.push({metadata:r.metadata,detection:{isConfident:r.detection.isConfident,watermarkKind:r.detection.watermarkKind,position:r.detection.position},audioCopied:r.audioCopied,audioSkipReason:r.audioSkipReason,videoBitrate:r.videoBitrate,processedFrames:r.processedFrames});
     }else reports.push({metadata});blobs.push(blob);
    }
    let strategy=null;
    if(mode!=='clean'){
     const merged=await engine.concatenateVideos(blobs,{onProgress:p=>window.postProgress(.8+p*.19),onStrategy:s=>{strategy=s;if(s!=='video-packet-copy')throw Error('Các cảnh khác cấu hình mã hóa hoặc kích thước. Hãy dùng các bản Flow cùng độ phân giải; dừng ghép để tránh giảm chất lượng.');}});
     window.postBlobs=[merged];
    }else window.postBlobs=blobs;
    return {reports,strategy,count:window.postBlobs.length};
   },{mode:job.mode});
   job.reports=result.reports;job.strategy=result.strategy;
   if(job.mode!=='clean')job.warnings.push('Ghép giữ nguyên luồng hình; âm thanh được chuẩn hóa stereo 48 kHz / 192 kbps.');
   for(const report of result.reports){if(report.detection&&!report.detection.isConfident)job.warnings.push('Nhận diện watermark độ tin cậy thấp; cần xem lại kết quả.');if(report.audioSkipReason&&report.audioSkipReason!=='no-audio-track')job.warnings.push('Âm thanh: '+report.audioSkipReason);}
   for(let i=0;i<result.count;i++){
    const file=path.join(job.directory,job.mode==='clean'?`scene-${String(clips[i].sceneId).padStart(3,'0')}-clean.mp4`:'final.mp4');
    const download=page.waitForEvent('download');await page.evaluate(i=>{const a=document.createElement('a');a.href=URL.createObjectURL(window.postBlobs[i]);a.download='result.mp4';a.click();},i);await (await download).saveAs(file);
    if(job.status!=='running')return;
    const metadata=require('./mp4.cjs').inspectMp4(file,{maxBytes:Infinity});const expected=job.mode==='clean'?clips[i].version.metadata:clips[0].version.metadata;if(metadata.width!==expected.width||metadata.height!==expected.height)throw Error('Kích thước video đầu ra không khớp nguồn.');job.outputs.push({file,metadata});
   }
   job.sources=clips.map(c=>({sceneId:c.sceneId,file:c.file}));job.progress=1;job.status='completed';job.completedAt=new Date().toISOString();this.log('info','Đã hoàn tất hậu kỳ.');
  }finally{await browser?.close().catch(()=>{});this.browser=null;if(server)await new Promise(resolve=>server.close(resolve));}
 }
}
module.exports={PostProduction,planProject};
