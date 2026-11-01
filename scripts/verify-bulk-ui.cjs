const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{chromium}=require('playwright-core');
(async()=>{
 const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);if(!executable)throw Error('Install Chrome/Edge for the UI smoke check.');
 const browser=await chromium.launch({executablePath:executable,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html><head><meta charset="utf-8"></head><body><section id="script-section"><div class="screen-head-actions"></div></section><section id="flow-section"><div class="studio-page-head"></div></section></body></html>');
  for(const file of ['style.css','studio.css'])await page.addStyleTag({path:path.join(__dirname,'../src',file)});
  await page.evaluate(()=>{
   const project={title:'Đợi đèn xăng sáng mới đổ?',brief:'Giải thích bơm xăng trong gara Việt Nam.',ratio:'9:16',scenes:6,sceneDuration:8};
   const items=['completed','running','reconciling','failed','queued'].map((status,i)=>({id:'video-'+i,project:{...project,title:i%2?'Nhà mèo · Tranh nhau xem tivi':project.title},templateName:i%2?'Nhà mèo bất ổn':'Review & kiến thức xe',profileName:i%2?'Profile B':'Profile A',status,attempt:status==='queued'?0:status==='failed'?3:1,stage:status==='running'?'cleanup':'videos',done:status==='completed'?['script','videos','upscale','cleanup','merge']:['script','videos'],spent:84,scenes:[{sceneId:1,status:'downloaded',upscale:'completed'},{sceneId:2,status:'needs_review',error:'Không xác định kết quả, đã đối soát.'}],references:[{role:'female_lead',path:'E:/Images/lead.png'}],error:status==='failed'?'Đã đối soát và thử lại 2 lần; Flow chưa trả kết quả.':null}));
   window.testBulk={busy:true,run:{id:'preview',status:'running',items,outputDirectory:'E:/Videos/Production',profiles:[{id:'a',name:'Profile A',status:'running',balance:185,itemId:'video-1'},{id:'b',name:'Profile B',status:'running',balance:210,itemId:'video-2'},{id:'c',name:'Profile C',status:'insufficient',balance:99}],events:[{time:new Date().toISOString(),level:'info',stage:'bulk.preflight',message:'Đã đọc số dư trực tiếp: 2 profile hợp lệ.'},{time:new Date().toISOString(),level:'warning',itemId:'video-3',stage:'flow.collect',message:'Đối soát và thử lại 2/2.'}]}};
   const ok=data=>Promise.resolve({ok:true,data});window.studio={bulkStatus:()=>ok(window.testBulk),bulkSample:()=>ok({file:'sample.json'}),bulkImport:()=>ok({ok:true,jobs:[items[0]],errors:[],outputDirectory:'E:/NewOutput',file:'new-batch.json'}),bulkStart:()=>{window.testBulk.busy=true;window.testBulk.run.status='running';return ok(window.testBulk);},bulkPause:()=>{window.testBulk.busy=false;window.testBulk.run.status='paused';return ok(window.testBulk);},bulkFolder:()=>ok(null),bulkLogsExport:()=>ok({}),bulkSkip:()=>ok(window.testBulk)};
  });
  await page.addScriptTag({path:path.join(__dirname,'../src/bulk-ui.js')});
  await page.locator('#script-section .screen-head-actions button').click();
  await page.locator('#bulk-dialog').waitFor({state:'visible'});assert.equal(await page.locator('[data-bulk="rows"] tr').count(),5);
  await page.locator('[data-bulk="rows"] tr').nth(3).click();assert.match(await page.locator('[data-bulk="detail"]').innerText(),/Cảnh 2/);assert.match(await page.locator('[data-bulk="events"]').innerText(),/2\/2/);
  const sizes=await page.locator('#bulk-dialog').evaluate(e=>({width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));assert.ok(sizes.width<=1500);assert.ok(sizes.scrollWidth<=sizes.clientWidth+2);
  const directory=path.join(__dirname,'../.test-runtime');fs.mkdirSync(directory,{recursive:true});await page.screenshot({path:path.join(directory,'bulk-ui-preview.png'),fullPage:true});
  await page.evaluate(()=>{const first=window.testBulk.run.items[0];window.testBulk.run.items=Array.from({length:60},(_,i)=>({...first,id:'video-'+i,status:'queued'}));});
  await page.waitForTimeout(1100);assert.equal(await page.locator('[data-bulk="rows"] tr').count(),50);await page.getByRole('button',{name:'Trang dự án sau',exact:true}).click();assert.equal(await page.locator('[data-bulk="rows"] tr').count(),10);
  await page.getByRole('searchbox',{name:'Tìm dự án trong lô'}).fill('video-59');assert.equal(await page.locator('[data-bulk="rows"] tr').count(),1);
  await page.locator('[data-bulk="pause"]').click();await page.locator('[data-bulk="import"]').click();await page.waitForTimeout(100);assert.equal(await page.locator('[data-bulk="rows"] tr').count(),1);assert.match(await page.locator('[data-bulk="output"]').innerText(),/NewOutput/);
  assert.deepEqual(errors,[]);console.log('Bulk UI verified: progress table, per-project scenes/logs, 50-row pagination, search, pause, new import preview, no horizontal overflow or renderer errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
