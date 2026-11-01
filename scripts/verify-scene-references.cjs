const {chromium}=require('playwright-core'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({executablePath:executable,headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<main><section id="script-section"><div class="settings-block"><p id="flow-reference-info"></p><button id="flow-reference">Add</button><button id="flow-clear-reference">Clear</button></div></section><section id="flow-section"><div id="queue-settings"><div class="settings-block"><select id="flow-scene"></select></div></div></section></main>');
  await page.evaluate(()=>{
   window.testState={activeProjectId:'test',storyboard:{scenes:[{id:1},{id:3},{id:5}]},flowReferences:[{id:'common',name:'common.png',role:'character_group',description:''}]};window.testCalls=[];
   window.workspaceUI={status:()=>window.testState,updateStatus:data=>window.referencesUI.render(data),notify:message=>window.testCalls.push({error:message})};
   window.studioUI={selectScene:id=>window.referencesUI.selectScene(id)};
   window.studio={status:async()=>({ok:true,data:window.testState}),flowClearReference:async data=>{window.testState.flowReferences=window.testState.flowReferences.filter(r=>r.id!==data.id);return{ok:true,data:window.testState};},flowReference:async data=>{window.testCalls.push(data);window.testState.flowReferences.push({id:'frame',name:'frame.png',role:data.role,sceneId:data.sceneId,description:''});return{ok:true,data:window.testState};}};
  });
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../src/frame-picker.js'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../src/references-ui.js'),'utf8')});
  assert.equal(await page.locator('#queue-settings #scene-reference-settings').count(),1);
  assert.equal(await page.locator('#script-section #scene-reference-settings').count(),0);
  assert.equal(await page.locator('#script-section #reference-groups').count(),1);
  await page.selectOption('#scene-reference-scene','3');
  await page.click('[data-add-role="start_frame"]');
  await page.click('#reference-source-computer');
  await page.waitForFunction(()=>document.querySelector('[data-reference-id="frame"]'));
  assert.deepEqual(await page.evaluate(()=>window.testCalls[0]),{role:'start_frame',sceneId:3});
  assert.match(await page.textContent('#scene-reference-settings'),/Chế độ Frames/);
  assert.equal(await page.locator('#reference-groups [data-reference-id="frame"]').count(),0);
  assert.equal(await page.isDisabled('#scene-reference-settings [data-add-role="character_group"]'),true);
  assert.equal(await page.isDisabled('[data-add-role="end_frame"]'),false);
  assert.equal(await page.isDisabled('#reference-groups [data-add-role="character_group"]'),false);
  await page.click('[data-remove-reference="frame"]');
  await page.waitForFunction(()=>!document.querySelector('#scene-reference-settings [data-add-role="character_group"]').disabled);
  await page.click('#scene-reference-settings [data-add-role="character_group"]');await page.click('#reference-source-computer');
  await page.waitForFunction(()=>document.querySelector('[data-add-role="start_frame"]').disabled);
  assert.equal(await page.isDisabled('[data-add-role="end_frame"]'),true);
  await page.click('[data-remove-reference="frame"]');
  await page.waitForFunction(()=>!document.querySelector('[data-add-role="start_frame"]').disabled);
  await page.evaluate(()=>{window.testState.flowReferences.push({id:'legacy-frame',name:'old-start.png',role:'start_frame',sceneId:3},{id:'legacy-ingredient',name:'old-ref.png',role:'setting',sceneId:3});window.referencesUI.render(window.testState);});
  assert.equal(await page.isDisabled('[data-add-role="start_frame"]'),true);
  assert.equal(await page.isDisabled('#scene-reference-settings [data-add-role="setting"]'),true);
  assert.equal(await page.isEnabled('[data-remove-reference="legacy-frame"]'),true);
  assert.equal(await page.isEnabled('[data-remove-reference="legacy-ingredient"]'),true);
  await page.selectOption('#scene-reference-scene','5');
  assert.equal(await page.locator('#scene-reference-settings [data-reference-id="frame"]').count(),0);
  await page.evaluate(()=>window.referencesUI.selectScene(3));
  assert.equal(await page.inputValue('#scene-reference-scene'),'3');
  await page.evaluate(()=>window.referencesUI.render({...window.testState,flowBusy:true}));
  assert.equal(await page.isDisabled('[data-add-role="end_frame"]'),true);
  assert.deepEqual(errors,[]);console.log('Verified per-scene reference UI, stable scene IDs, separate frames, shared references and busy lock.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
