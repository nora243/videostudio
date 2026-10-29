const{_electron}=require('playwright-core');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve('.test-runtime',`studio-ui-${Date.now()}`),workspace=path.join(root,'workspace');fs.mkdirSync(workspace,{recursive:true});
 const source=path.resolve('.test-runtime/flow-live/scene-001.mp4'),projectId='studio-project',batchId='studio-batch';
 const scenes=Array.from({length:32},(_,i)=>({id:i+1,duration_seconds:8,description_vi:`Cảnh ${i+1}: chú mèo khám phá khu vườn ngập nắng. Máy quay theo chuyển động tự nhiên, giữ ngoại hình nhân vật nhất quán.`,voiceover_vi:`Lời dẫn cảnh ${i+1}.`,video_prompt_en:`Scene ${i+1}. A ginger tabby cat exploring a sunlit garden. Cinematic photography, slow camera movement, natural lighting.`,negative_prompt_en:'No text, no logos, no deformed anatomy.'}));
 const storyboard={title:'Một ngày của Miu',summary:'Hành trình 32 cảnh',scenes,updatedAt:'2026-10-28T01:00:00Z'};
 const directory=path.join(workspace,'batches',batchId);fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'scene-001.mp4');fs.copyFileSync(source,file);
 const jobs=scenes.map((scene,i)=>({id:`job-${i+1}`,sceneId:scene.id,scene,status:i===0?'downloaded':i===1?'failed':i===2?'generating':'queued',configuration:{model:'Omni 1.1 Flash',resolution:'360p',duration:8,ratio:'16:9'},prompt:scene.video_prompt_en,error:i===1?'Mất kết nối khi kiểm tra cấu hình, chưa gửi cảnh.':undefined,file:i===0?file:undefined,metadata:i===0?{duration:8,width:640,height:360}:undefined,cost:i<3?6:undefined}));
 const batch={id:batchId,projectId,title:storyboard.title,status:'paused',createdAt:'2026-10-28T02:00:00Z',projectUrl:'https://flow.google.com/project/studio-test',options:{budget:200,resolution:'360p',ratio:'16:9'},spent:12,storyboardSnapshot:storyboard,jobs};
 fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(batch));fs.writeFileSync(path.join(workspace,'workspace.json'),JSON.stringify({activeProjectId:projectId,project:{title:storyboard.title,brief:'Câu chuyện của một chú mèo trong vườn.',style:'Điện ảnh',ratio:'16:9',scenes:32,credits:425,cost:6},storyboard,flowBatch:batch}));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const app=await _electron.launch({args:['.','--dev',`--user-data-dir=${root}`],env});
 try{
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1366,900));await page.waitForSelector('#script-nav');await page.click('#script-nav');
  await page.waitForSelector('.outline-row');assert.equal(await page.locator('.outline-row').count(),32);assert.equal(await page.locator('.scene-card:visible').count(),1);
  const noPageScroll=async()=>{const value=await page.evaluate(()=>({height:innerHeight,scroll:document.documentElement.scrollHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));assert.ok(value.scroll<=value.height+2,JSON.stringify(value));assert.ok(value.scrollWidth<=value.width+2,JSON.stringify(value));};
  await page.click('#overview-nav');await page.waitForSelector('#overview-section');assert.equal(await page.locator('#project').isVisible(),false);
  await page.click('#overview-budget');await page.waitForSelector('#budget-dialog[open]');await page.click('[data-close-dialog="budget-dialog"]');
  const geometry=()=>page.evaluate(()=>[...document.querySelectorAll('body>aside,.brand,aside nav>div,body>main>header')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height,getComputedStyle(e).fontSize];}));
  for(const size of [[1366,900],[1050,760]]){
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),size);let baseline;
   for(const nav of ['overview-nav','script-nav','flow-nav','library-nav']){await page.click('#'+nav);const g=await geometry();if(baseline)assert.deepEqual(g,baseline,nav);else baseline=g;await noPageScroll();}
   await page.click('#overview-nav');await page.screenshot({path:path.join(root,'overview-'+size[0]+'.png')});
  }
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1366,900));await page.click('#script-nav');
  await noPageScroll();await page.click('[data-select-scene="25"]');assert.equal(await page.locator('.scene-card.is-active').getAttribute('data-scene'),'25');
  await page.locator('.scene-card.is-active [data-field="description_vi"]').fill('Hình ảnh cảnh 25 đã được chỉnh.');await page.click('#editor-tab-voice');await page.locator('.scene-card.is-active [data-field="voiceover_vi"]').fill('Lời dẫn cảnh 25 đã được chỉnh.');
  await page.click('#editor-tab-prompt');await page.locator('.scene-card.is-active [data-field="negative_prompt_en"]').fill('No text, no logos. Updated scene 25.');
  await page.click('#save-storyboard');await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Đã lưu chỉnh sửa'));
  const status=await page.evaluate(()=>window.studio.status());assert.equal(status.data.storyboard.scenes[24].voiceover_vi,'Lời dẫn cảnh 25 đã được chỉnh.');assert.equal(await page.locator('.scene-card.is-active').getAttribute('data-scene'),'25');
  await page.click('#script-select-none');await page.locator('[data-flow-scene="25"]').check();await page.locator('[data-flow-scene="26"]').check();assert.match(await page.textContent('#script-selection-summary'),/^2\/32/);
  await page.screenshot({path:path.join(root,'script-1366.png')});
  await page.click('#flow-nav');await noPageScroll();await page.click('#queue-tab-plan');assert.equal(await page.locator('#flow-jobs tr').count(),32);await page.selectOption('#queue-filter','selected');assert.equal(await page.locator('#flow-jobs tr').count(),2);
  assert.equal(await page.textContent('#flow-start'),'Đối soát tác vụ');
  await page.click('#queue-tab-jobs');await page.selectOption('#queue-filter','issues');assert.equal(await page.locator('#flow-jobs tr').count(),1);await page.locator('#flow-jobs tr').click();assert.equal(await page.locator('#queue-job-detail').isVisible(),true);assert.match(await page.textContent('#queue-job-detail'),/Mất kết nối/);
  await page.selectOption('#queue-filter','downloaded');await page.locator('#flow-jobs tr').click();assert.equal(await page.locator('#queue-job-detail').isVisible(),true);await page.waitForFunction(()=>document.getElementById('queue-preview')?.readyState>=2,null,{timeout:20000});assert.equal(await page.locator('#queue-preview').evaluate(v=>v.videoWidth),640);
  await page.selectOption('#queue-filter','all');await page.locator('[data-queue-row="job-3"]').click();await page.screenshot({path:path.join(root,'queue-1366.png')});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1050,760));await noPageScroll();
  const onScreen=async selector=>assert.equal(await page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}),true,selector);
  await onScreen('#flow-start');await onScreen('#flow-pause');await page.screenshot({path:path.join(root,'queue-1050.png')});
  await page.click('#script-nav');await noPageScroll();await onScreen('#save-storyboard');await onScreen('#generate-script');assert.equal(await page.locator('.scene-card.is-active').getAttribute('data-scene'),'3');await page.click('[data-select-scene="25"]');
  await page.click('#editor-tab-voice');assert.equal(await page.locator('.scene-card.is-active [data-field="voiceover_vi"]').inputValue(),'Lời dẫn cảnh 25 đã được chỉnh.');
  await page.screenshot({path:path.join(root,'script-1050.png')});
  await page.reload();await page.waitForSelector('.scene-card.is-active');assert.equal(await page.locator('.scene-card.is-active').getAttribute('data-scene'),'25');assert.match(await page.textContent('#script-selection-summary'),/^2\/32/);await noPageScroll();
  assert.deepEqual(errors,[]);console.log('PASS: 32-scene editor, tabs, save, shared selections, queue filters/details, real video preview, pinned controls and no page overflow at 1366/1050 widths, restored after reload. Evidence:',root);
 }finally{await app.close();}
 process.exit(0);
})().catch(error=>{console.error(error);process.exit(1);});
