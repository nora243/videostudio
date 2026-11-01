const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
function listFrameSources(library){
 return library.list().projects.flatMap(project=>{
  const order=library.readProject?.(project.id)?.storyboard?.scenes?.map(s=>s.id)||project.scenes.map(s=>s.id);
  return project.scenes.flatMap((scene,index)=>scene.versions.filter(v=>v.available&&v.status==='downloaded').map(v=>({projectId:project.id,projectName:project.name,sceneId:scene.id,scenePosition:order.includes(scene.id)?order.indexOf(scene.id)+1:index+1,batchId:v.batchId,jobId:v.jobId,versionId:v.id,quality:v.quality,createdAt:v.createdAt,metadata:v.metadata,uri:`studio-media://video/${encodeURIComponent(project.id)}/${encodeURIComponent(v.batchId)}/${encodeURIComponent(v.jobId)}`})));
 });
}
function resolveFrameSource(library,data){
 if(!['time','first','last'].includes(data?.selection)||!Number.isFinite(data.seconds)||data.seconds<0)throw Error('Vị trí khung hình không hợp lệ.');
 const source=listFrameSources(library).find(s=>s.projectId===data.sourceProjectId&&s.batchId===data.batchId&&s.jobId===data.jobId);
 if(!source)throw Error('Video nguồn chưa tạo thành công, chưa tải về hoặc không còn trong thư viện.');
 if(data.selection==='time'&&data.seconds>source.metadata.duration+.1)throw Error('Vị trí khung hình vượt thời lượng video.');
 return {...source,...library.findVersion(source.projectId,source.batchId,source.jobId)};
}
async function extractFrameToPng({file,target,executable,selection,seconds}){
 let browser,server;
 try{
  server=http.createServer((req,res)=>{
   if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<input id="file" type="file"><script type="module">import * as engine from "/frame-engine.js";window.engine=engine;</script>');}
   else if(req.url==='/frame-engine.js'){res.setHeader('Content-Type','text/javascript');fs.createReadStream(path.join(__dirname,'vendor/gwr/frame-engine.js')).pipe(res);}
   else{res.statusCode=404;res.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  if(!executable)throw Error('Cần Chrome hoặc Edge để tách khung hình.');
  browser=await require('playwright-core').chromium.launch({executablePath:executable,headless:true});
  const page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(120000);
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>!!window.engine);
  await page.locator('#file').setInputFiles(file);
  const report=await page.evaluate(async request=>{const result=await window.engine.extractCleanVideoFrame(document.querySelector('#file').files[0],request);window.frameBlob=result.blob;return result.report;},{selection,seconds});
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const pending=page.waitForEvent('download');await page.evaluate(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(window.frameBlob);a.download='frame.png';a.click();});
  await (await pending).saveAs(target+'.tmp');
  if(fs.statSync(target+'.tmp').size>20*1024*1024)throw Error('Ảnh tách vượt giới hạn 20 MB.');
  fs.renameSync(target+'.tmp',target);return report;
 }catch(error){try{fs.unlinkSync(target+'.tmp');}catch{}throw error;}
 finally{await browser?.close().catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve));}
}
module.exports={listFrameSources,resolveFrameSource,extractFrameToPng};
