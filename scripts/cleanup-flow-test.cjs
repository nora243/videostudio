const {chromium}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const real=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'video-studio/workspace/workspace.json'),'utf8'));
 const job=JSON.parse(fs.readFileSync('.test-runtime/flow-live/job.json','utf8'));
 const last=fs.readdirSync('.test-runtime').filter(x=>/^flow-ui-\d+$/.test(x)).sort().at(-1);
 const test=JSON.parse(fs.readFileSync(path.join('.test-runtime',last,'workspace/workspace.json'),'utf8'));
 const browser=await chromium.connectOverCDP(`http://127.0.0.1:${real.browserPort}`);
 const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith(job.projectUrl));
 const flow=require('../src/flow.cjs');
 await flow.removeReference(page,test.flowReference.assetId);
 const input=page.locator('.ProseMirror[role="textbox"]');
 const normalize=s=>s.replace(/\s+/g,' ').trim();
 if(normalize(await input.innerText())===normalize(job.prompt))await input.fill('');
 console.log('PASS remove reference; cleared only the known test prompt. Generated clip remains in Flow.');
 process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1);});
