const {chromium}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {VideoLibrary}=require('../src/library.cjs'),{listFrameSources,resolveFrameSource}=require('../src/frame-capture.cjs');
(async()=>{
 const library=new VideoLibrary(path.join(process.env.APPDATA,'video-studio','workspace')),source=listFrameSources(library)[0];if(!source)throw Error('Test needs a completed downloaded video.');
 const resolved=resolveFrameSource(library,{sourceProjectId:source.projectId,batchId:source.batchId,jobId:source.jobId,selection:'first',seconds:0}),bytes=fs.readFileSync(resolved.file);
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://video.test/clip.mp4',route=>{
   const range=route.request().headers().range?.match(/bytes=(\d+)-(\d*)/);
   if(!range)return route.fulfill({contentType:'video/mp4',headers:{'Accept-Ranges':'bytes'},body:bytes});
   const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;
   return route.fulfill({status:206,contentType:'video/mp4',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${bytes.length}`},body:bytes.subarray(start,end+1)});
  });
  await page.setContent('<main></main>');
  for(const file of ['style.css','studio.css','references.css'])await page.addStyleTag({content:fs.readFileSync(path.join(__dirname,'../src',file),'utf8')});
  await page.evaluate(source=>{
   window.captureCalls=[];window.notices=[];window.pcCalls=0;
   window.workspaceUI={notify:message=>window.notices.push(message)};
   window.studio={frameSources:async()=>({ok:true,data:[{...source,uri:'https://video.test/clip.mp4'}]}),status:async()=>({ok:true,data:{activeProjectId:'target'}}),flowReferenceFrame:async data=>{window.captureCalls.push(data);return window.failCapture?{ok:false,error:'Không xử lý được watermark'}:{ok:true,data:{frameNotice:'Đã xóa watermark và gắn ảnh.'}};}};
   window.openPicker=()=>window.framePicker.open({role:'end_frame',sceneId:3,targetProjectId:'target'},{fromComputer:()=>window.pcCalls++,onApplied:data=>window.applied=data});
  },source);
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../src/frame-picker.js'),'utf8')});
  await page.evaluate(()=>window.openPicker());await page.click('#reference-source-computer');assert.equal(await page.evaluate(()=>window.pcCalls),1);
  async function open(){await page.evaluate(()=>window.openPicker());await page.click('#reference-source-video');await page.waitForFunction(()=>!document.querySelector('#frame-picker-use').disabled);}
  await open();await page.click('#frame-picker-last');await page.waitForFunction(()=>!document.querySelector('#frame-picker-use').disabled);
  assert.ok(await page.evaluate(()=>document.querySelector('#frame-picker-preview').currentTime>0));
  fs.mkdirSync(path.join(__dirname,'../.test-runtime'),{recursive:true});
  await page.screenshot({path:path.join(__dirname,'../.test-runtime/frame-picker-preview.png')});
  await page.click('#frame-picker-use');await page.waitForFunction(()=>!document.querySelector('#frame-picker-dialog').open);
  let calls=await page.evaluate(()=>window.captureCalls);assert.equal(calls[0].selection,'last');assert.equal(calls[0].sceneId,3);assert.equal(calls[0].role,'end_frame');assert.equal(calls[0].sourceProjectId,source.projectId);
  await open();await page.locator('#frame-picker-seek').evaluate(el=>{el.value='2.345';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForFunction(()=>!document.querySelector('#frame-picker-use').disabled);
  assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('#frame-picker-preview').currentTime)-2.345)<.01);
  await page.click('#frame-picker-first');await page.waitForFunction(()=>!document.querySelector('#frame-picker-use').disabled);assert.equal(await page.evaluate(()=>document.querySelector('#frame-picker-preview').currentTime),0);
  await page.evaluate(()=>window.failCapture=true);await page.click('#frame-picker-use');await page.waitForFunction(()=>document.querySelector('#frame-picker-feedback').textContent.includes('Không xử lý'));
  assert.equal(await page.isVisible('#frame-picker-dialog'),true);assert.equal(await page.isEnabled('#frame-picker-use'),true);
  await page.click('#frame-picker-close');assert.deepEqual(errors,[]);
  console.log('Verified computer source, real video preview, slider seek, exact first/last selection, target binding and visible processing failures.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
