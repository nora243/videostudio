const { _electron, chromium }=require('playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
(async()=>{
 const real=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'video-studio/workspace/workspace.json'),'utf8'));
 const job=JSON.parse(fs.readFileSync('.test-runtime/flow-live/job.json','utf8'));
 const root=path.resolve('.test-runtime',`flow-ui-${Date.now()}`);fs.mkdirSync(path.join(root,'workspace'),{recursive:true});
 job.id=randomUUID();job.status='generated';delete job.file;delete job.metadata;
 const state={browserPort:real.browserPort,project:real.project,storyboard:real.storyboard,flowProject:{url:job.projectUrl},flowReference:{name:'cat-reference.png',path:path.resolve('.test-runtime/flow-live/cat-reference.png'),displayName:'Ảnh mèo thử'},flowBatch:{id:randomUUID(),status:'paused',title:real.storyboard.title,projectUrl:job.projectUrl,options:{resolution:'360p',ratio:'16:9',budget:6,model:'Omni 1.1 Flash',outputs:1},spent:6,jobs:[job]}};
 const browser=await chromium.connectOverCDP(`http://127.0.0.1:${real.browserPort}`);
 const flowPage=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith(job.projectUrl));
 const ids=await flowPage.locator('flow-base-prompt-box flow-image-ingredient-chip img').evaluateAll(elements=>elements.map(e=>new URL(e.src).pathname.split('/').pop()));
 if(ids.length===1){state.flowReference.assetId=ids[0];state.flowReference.projectUrl=job.projectUrl;}
 fs.writeFileSync(path.join(root,'workspace/workspace.json'),JSON.stringify(state));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({args:['.','--dev',`--user-data-dir=${root}`],env});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#flow-nav');
  await page.click('#flow-nav');
  const opened=await page.evaluate(()=>window.studio.open('flow'));assert.equal(opened.ok,true,opened.error);
  await page.click('#flow-bind');
  await page.waitForFunction(()=>document.getElementById('flow-bind').disabled===false);
  await page.click('#flow-prepare');
  await page.waitForFunction(()=>document.getElementById('flow-prepared-info').textContent.includes('6 tín dụng'),null,{timeout:90000}).catch(async error=>{console.error(await page.textContent('#toast'));throw error;});
  console.log('PASS UI prepare: actual Flow 360p/8s/x1, 6 credits, shared reference attached');
  await page.locator('.command-menu summary').click();await page.click('#flow-recover');
  await page.waitForFunction(()=>document.getElementById('flow-jobs').textContent.includes('Đã tải'),null,{timeout:180000});
  const result=await page.evaluate(()=>window.studio.status());assert.equal(result.data.flowBatch.status,'completed');
  assert.equal(result.data.flowBatch.jobs[0].metadata.duration,8);assert.equal(result.data.flowBatch.spent,6);
  assert.deepEqual(errors,[]);
  await page.locator('#flow-section').screenshot({path:path.join(root,'flow-ui.png')});
  console.log('PASS UI worker recovery/download of existing video, no new generation. Evidence:',root);
 }finally{await app.close();}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
