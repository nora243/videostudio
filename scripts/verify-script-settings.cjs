
const {_electron}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve('.test-runtime','script-settings-'+Date.now());fs.mkdirSync(root,{recursive:true});
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;let app;
 try{
  app=await _electron.launch({args:['.','--user-data-dir='+root],env});const page=await app.firstWindow();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.workspaceUI?.status()?.activeProjectId);
  await page.click('#script-nav');
  assert.equal(await page.locator('#generate-new-script').isVisible(),true);
  assert.equal(await page.locator('#generate-new-script').isEnabled(),true);
  await page.fill('#brief','Một câu chuyện gia đình ngắn.');await page.selectOption('#scenes','auto');await page.selectOption('#sceneDuration','auto');
  let project=await page.evaluate(()=>window.workspaceUI.readProject());assert.equal(project.scenes,'auto');assert.equal(project.sceneDuration,'auto');
  const saved=await page.evaluate(async p=>window.studio.save(p),project);assert.equal(saved.ok,true,JSON.stringify(saved));assert.equal(saved.data.project.sceneDuration,'auto');assert.equal(saved.data.project.scenes,'auto');
  const preview=await page.evaluate(async p=>window.studio.previewPrompt(p),project);assert.equal(preview.ok,true);assert.match(preview.data,/Auto số cảnh/);assert.match(preview.data,/Auto thời lượng/);
  await page.reload();await page.waitForFunction(()=>window.workspaceUI?.readProject()?.scenes==='auto');
  assert.equal(await page.inputValue('#sceneDuration'),'auto');await page.click('#script-nav');
  await page.selectOption('#scenes','3');await page.selectOption('#sceneDuration','6');
  project=await page.evaluate(()=>window.workspaceUI.readProject());assert.equal(project.scenes,3);assert.equal(project.sceneDuration,6);
  const fixed=await page.evaluate(async p=>window.studio.previewPrompt(p),project);assert.equal(fixed.ok,true);assert.match(fixed.data,/Mỗi cảnh đúng 6 giây/);
  assert.equal(await page.locator('#sceneDuration').isVisible(),true);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(root,'settings.png')});console.log('Script settings UI and IPC passed. Screenshot: '+path.join(root,'settings.png'));
 }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
