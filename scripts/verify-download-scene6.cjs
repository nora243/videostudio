const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path');
(async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'video-studio/workspace/workspace.json'),'utf8'));
 const job=structuredClone(state.flowBatch.jobs.find(j=>j.sceneId===6));if(!job?.submittedAt||!job.assetId)throw Error('Scene 6 must already exist');
 const browser=await chromium.connectOverCDP(`http://127.0.0.1:${state.browserPort}`);
 const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().split('?')[0]===job.projectUrl);if(!page)throw Error('Flow project tab missing');
 const root=path.resolve('.test-runtime','download-scene6-'+Date.now());fs.mkdirSync(root,{recursive:true});
 const metadata=await require('../src/flow.cjs').download(page,job,path.join(root,'scene-006.mp4'),async()=>{});
 console.log(JSON.stringify({metadata,file:job.file,status:job.status,noGenerate:true,workspaceUnmodified:true}));process.exit(0);
})().catch(e=>{console.error(e.stack);process.exit(1);});
