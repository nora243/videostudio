const{_electron,chromium}=require('playwright-core');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const{randomUUID}=require('node:crypto');
(async()=>{
 const real=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'video-studio/workspace/workspace.json'),'utf8'));
 const root=path.resolve('.test-runtime',`flow-link-${Date.now()}`),id=randomUUID();fs.mkdirSync(path.join(root,'workspace'),{recursive:true});
 const title='Video Studio · Kiểm thử tự liên kết';
 const scene={id:1,duration_seconds:8,description_vi:'Mèo bên cửa sổ',voiceover_vi:'',video_prompt_en:'A ginger tabby cat resting by a sunlit window. Slow cinematic camera movement.',negative_prompt_en:'No text or logos.'};
 fs.writeFileSync(path.join(root,'workspace/workspace.json'),JSON.stringify({activeProjectId:id,browserPort:real.browserPort,project:{title,brief:'Kiểm tra chuẩn bị cảnh, không tạo video.',ratio:'16:9',style:'Điện ảnh',scenes:1,credits:425,cost:6},storyboard:{title,summary:'',scenes:[scene],updatedAt:new Date().toISOString()}}));
 const browser=await chromium.connectOverCDP(`http://127.0.0.1:${real.browserPort}`);
 const flowPages=()=>browser.contexts().flatMap(c=>c.pages()).filter(p=>p.url().startsWith('https://flow.google.com/project/'));
 const oldUrls=new Set(flowPages().map(p=>p.url().split('?')[0]));
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 let app=await _electron.launch({args:['.','--dev',`--user-data-dir=${root}`],env});
 try{
  let page=await app.firstWindow();await page.waitForSelector('#flow-nav');
  await page.click('#flow-nav');
  assert.equal(await page.locator('#flow-prepare').isEnabled(),true);
  await page.click('#flow-prepare');
  await page.waitForFunction(()=>document.getElementById('flow-prepared-info').textContent.includes('tín dụng theo Flow'),null,{timeout:120000}).catch(async error=>{console.error(await page.textContent('#toast'));throw error;});
  let status=(await page.evaluate(()=>window.studio.status())).data;
  const url=status.flowProject.url;assert.equal(oldUrls.has(url),false);assert.equal(status.flowProject.toolProjectId,id);assert.equal(status.flowProject.renamePending,false);assert.equal(status.flowPrepared.projectUrl,url);
  const count=flowPages().length;
  await page.click('#flow-prepare');await page.waitForFunction(()=>!document.getElementById('flow-prepare').disabled);
  status=(await page.evaluate(()=>window.studio.status())).data;assert.equal(status.flowProject.url,url);assert.equal(flowPages().length,count);
  await page.locator('#flow-section').screenshot({path:path.join(root,'automatic-link.png')});
  console.log('PASS: prepare directly creates a separate Flow project, renames and links it; repeat does not duplicate.');
  await app.close();app=null;
  const created=flowPages().find(p=>p.url().split('?')[0]===url);await created.close();
  app=await _electron.launch({args:['.','--dev',`--user-data-dir=${root}`],env});page=await app.firstWindow();await page.waitForSelector('#flow-nav');
  const result=await page.evaluate(()=>window.studio.open('flow'));assert.equal(result.ok,true,result.error);assert.equal(result.data.flowProject.url,url);
  const reopened=flowPages().find(p=>p.url().split('?')[0]===url);assert.ok(reopened);
  const name=await reopened.locator('input.editable-text-input').inputValue();assert.equal(name,`${title} · VS-${id.slice(0,8)}`);
  assert.equal(flowPages().length,count);
  console.log('PASS: app restart and closed tab reopen the exact saved Flow project; persisted name verified. No video generation. Evidence:',root);
 }finally{if(app)await app.close();}
 process.exit(0);
})().catch(error=>{console.error(error);process.exit(1);});
