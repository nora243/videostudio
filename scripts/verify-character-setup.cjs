
const {_electron}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve('.test-runtime','character-setup-'+Date.now());fs.mkdirSync(path.join(root,'workspace'),{recursive:true});
 const production=require('../src/script-presets.js').scriptPresets.catProfile();production.speakers=production.speakers.map(({flowVoice,...s})=>s);
 fs.writeFileSync(path.join(root,'workspace','workspace.json'),JSON.stringify({activeProjectId:'character-ui-test',project:{title:'Character test',brief:'Cats talk.',style:'Điện ảnh',ratio:'9:16',scenes:2,sceneDuration:8,credits:100,cost:6,production}}));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;let app;
 try{
 app=await _electron.launch({args:['.','--user-data-dir='+root],env});const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>window.workspaceUI?.status()?.activeProjectId==='character-ui-test');
 const fixture=path.join(root,'portrait.png');const png=await app.evaluate(({nativeImage,dialog},file)=>{const bytes=Buffer.alloc(96*96*4);for(let i=0;i<bytes.length;i+=4){bytes[i]=80;bytes[i+1]=155;bytes[i+2]=220;bytes[i+3]=255;}dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});return nativeImage.createFromBitmap(bytes,{width:96,height:96}).toPNG().toString('base64');},fixture);fs.writeFileSync(fixture,Buffer.from(png,'base64'));
 await page.click('#script-nav');await page.click('#script-presets');
 const rows=page.locator('#production-speakers .production-speaker');assert.equal(await rows.count(),5);
 assert.deepEqual(await rows.locator('[data-speaker="flowVoice"]').evaluateAll(nodes=>nodes.map(n=>n.value)),['Charon','Aoede','Puck','Autonoe','Fenrir']);
 assert.match(await rows.first().locator('[data-speaker="flowVoice"] option:checked').innerText(),/Nam/);
 await rows.first().locator('.speaker-photo-pick').click();await page.waitForFunction(()=>document.querySelector('.speaker-photo-status').textContent==='Đã lưu vào dự án');
 let status=await page.evaluate(async()=> (await window.studio.status()).data);const imagePath=status.project.production.speakers[0].imagePath;assert.ok(imagePath);assert.equal(status.flowReferences.filter(r=>r.role==='character_portrait').length,1);
 assert.equal(await rows.first().locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
 await rows.first().locator('.speaker-photo-pick').click();await page.waitForFunction(()=>document.querySelector('.speaker-photo-status').textContent==='Đã lưu vào dự án');
 status=await page.evaluate(async()=> (await window.studio.status()).data);assert.equal(status.project.production.speakers[0].imagePath,imagePath);assert.equal(status.flowReferences.filter(r=>r.role==='character_portrait').length,1);
 await page.reload();await page.waitForFunction(()=>window.workspaceUI?.status()?.activeProjectId==='character-ui-test');await page.click('#script-nav');await page.click('#script-presets');
 await page.waitForFunction(()=>{const img=document.querySelector('.speaker-photo-preview img');return !img.hidden&&img.complete&&img.naturalWidth>0;});
 await page.locator('.speaker-profile-layout').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,'character-setup.png')});
 await page.locator('.speaker-photo-clear').first().click();await page.waitForFunction(()=>document.querySelector('.speaker-photo-preview img').hidden);
 await page.waitForFunction(async()=>!(await window.studio.status()).data.project.production.speakers[0].imagePath);
 status=await page.evaluate(async()=> (await window.studio.status()).data);assert.equal(status.flowReferences.filter(r=>r.role==='character_portrait').length,0);assert.deepEqual(errors,[]);
 console.log('PASS: default voices, gender labels, image auto-save, deduplication, persistent thumbnail and removal. Screenshot: '+path.join(root,'character-setup.png'));
 }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
