const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FlowRunner}=require('../src/flow-runner.cjs');
function fixture(t,overrides={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'video-flow-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const state={flowProject:{url:'https://flow.google.com/project/abc'},storyboard:{title:'Test',scenes:[{id:1,duration_seconds:8,video_prompt_en:'Scene 1'},{id:2,duration_seconds:8,video_prompt_en:'Scene 2'}]}};
 const calls=[];
 const adapter={validateOptions:o=>o,compilePrompt:s=>{if(!s)throw Error('Missing scene');return s.video_prompt_en;},balance:async()=>100,prepare:async(_p,s,o)=>({prompt:s.video_prompt_en,cost:6,configuration:o}),submit:async(_p,j,save)=>{j.submittedAt='now';j.status='submitting';save();calls.push('submit');},collect:async(_p,j)=>{j.assetId='asset-'+j.sceneId;j.status='generated';calls.push('collect');},download:async(_p,j)=>{j.status='downloaded';calls.push('download');},...overrides};
 const runner=new FlowRunner({state,root,persist:()=>{},getPage:async()=>({}),getAdapter:()=>adapter});
 return{runner,state,calls,root};
}
test('stops before submitting a scene when the live credit balance is insufficient',async t=>{
 let reads=0;const{runner,state,calls}=fixture(t,{balance:async()=>++reads<=2?100:0});runner.create([1,2],{});await runner.run();
 assert.deepEqual(calls,['submit','collect','download']);assert.equal(state.flowBatch.spent,6);assert.equal(state.flowBatch.jobs[1].status,'failed');
});
test('legacy batch credit ceilings no longer limit production when live balance is sufficient',async t=>{const{runner,state,calls}=fixture(t);runner.create([1,2],{budget:1});await runner.run();assert.equal(state.flowBatch.status,'completed');assert.equal(state.flowBatch.spent,12);assert.equal(calls.filter(c=>c==='submit').length,2);});
test('unknown click result is reserved and never auto-submitted on recovery',async t=>{
 const{runner,state,calls}=fixture(t,{submit:async(_p,j,save)=>{j.submittedAt='now';j.status='submitting';save();throw Error('connection lost after click');}});
 runner.create([1,2],{budget:12});await runner.run();assert.equal(state.flowBatch.jobs[0].status,'needs_review');assert.equal(state.flowBatch.spent,6);
 await runner.run(true);assert.deepEqual(calls,['collect','download']);assert.equal(state.flowBatch.jobs[1].status,'queued');
});
test('download failure preserves asset and recovers without another generation',async t=>{
 let failed=true;
 const{runner,state,calls}=fixture(t,{download:async(_p,j)=>{if(failed){failed=false;throw Error('download failed');}j.status='downloaded';calls.push('download');}});
 runner.create([1],{budget:6});await runner.run();assert.equal(state.flowBatch.jobs[0].status,'download_failed');
 await runner.run(true);assert.equal(state.flowBatch.jobs[0].status,'downloaded');assert.equal(calls.filter(x=>x==='submit').length,1);
});
test('restores uncertain in-flight tasks as review, never queued',t=>{
 const{runner,state,root}=fixture(t);runner.create([1],{budget:6});state.flowBatch.status='running';state.flowBatch.jobs[0].status='submitting';
 new FlowRunner({state,root,persist:()=>{},getPage:()=>{},getAdapter:()=>{}});
 assert.equal(state.flowBatch.status,'paused');assert.equal(state.flowBatch.jobs[0].status,'needs_review');
});
test('pause waits for current scene and leaves later scenes queued',async t=>{
 let runner;
 const f=fixture(t,{collect:async(_p,j)=>{j.assetId='asset';j.status='generated';runner.pause();}});runner=f.runner;
 runner.create([1,2],{budget:12});await runner.run();assert.equal(f.state.flowBatch.jobs[0].status,'downloaded');assert.equal(f.state.flowBatch.jobs[1].status,'queued');
});
test('preparation error logs last browser step and scene without submitting a video',async t=>{
 const records=[];const{runner,state,calls}=fixture(t,{prepare:async(_p,_s,_o,_previous,report)=>{report('flow.reference.attach','Nhấn Thêm vào câu lệnh');throw Error('locator.click: Timeout 3000ms exceeded.');}});
 runner.log=(level,message,fields)=>records.push({level,message,...fields});runner.create([1],{budget:12});await runner.run();
 const error=records.find(e=>e.level==='error');assert.equal(error.stage,'flow.reference.attach');assert.equal(error.sceneId,1);assert.ok(error.jobId);assert.match(error.stack,/Timeout 3000ms/);assert.equal(state.flowBatch.jobs[0].status,'failed');assert.deepEqual(calls,[]);
});

test('generation failure after two UI retries pauses queue and leaves remaining scenes unsent',async t=>{
 let f;f=fixture(t,{collect:async(_p,j)=>{j.retryCount=2;throw Error('Flow vẫn báo lỗi sau 2 lần thử lại. Đã tạm dừng hàng đợi.');}});f.runner.create([1,2],{});await f.runner.run();assert.equal(f.state.flowBatch.status,'paused');assert.equal(f.runner.busy,false);assert.equal(f.state.flowBatch.jobs[0].retryCount,2);assert.equal(f.state.flowBatch.jobs[0].status,'needs_review');assert.equal(f.state.flowBatch.jobs[1].status,'queued');assert.deepEqual(f.calls,['submit']);
});

test('insufficient balance switches profile before submitting and preserves per-job account and project',async t=>{
 let f;const pages={a:{name:'a'},b:{name:'b'}},submissions=[];f=fixture(t,{balance:async p=>p===pages.a?0:100,prepare:async(_p,s)=>({prompt:s.video_prompt_en,cost:6,configuration:{}}),submit:async(p,j)=>{submissions.push({page:p.name,profileId:j.profileId,url:j.projectUrl});j.submittedAt='now';}});f.state.activeBrowserProfileId='a';f.state.flowProject={url:'https://flow.google.com/project/a'};f.runner.getSubmissionPage=async()=>pages[f.state.activeBrowserProfileId];f.runner.switchForCredits=async({cost,exclude})=>{assert.equal(cost,6);assert.ok(exclude.includes('a'));f.state.activeBrowserProfileId='b';f.state.flowProject={url:'https://flow.google.com/project/b'};return {page:pages.b,profileId:'b',credits:100};};f.runner.create([1,2],{});await f.runner.run();assert.equal(f.state.flowBatch.status,'completed');assert.deepEqual(submissions,[{page:'b',profileId:'b',url:'https://flow.google.com/project/b'},{page:'b',profileId:'b',url:'https://flow.google.com/project/b'}]);assert.equal(f.state.flowBatch.spent,12);
});
test('uncertain submitted job is collected on its owning profile and never rotated or resubmitted',async t=>{
 const f=fixture(t),opened=[];f.runner.create([1],{});const job=f.state.flowBatch.jobs[0];Object.assign(job,{status:'needs_review',submittedAt:'now',profileId:'a',projectUrl:'https://flow.google.com/project/a'});f.state.activeBrowserProfileId='b';f.runner.getPage=async(url,profileId)=>{opened.push({url,profileId});return{};};f.runner.switchForCredits=async()=>{throw Error('Must not switch');};await f.runner.run(true);assert.equal(job.status,'downloaded');assert.deepEqual(opened,[{url:job.projectUrl,profileId:'a'}]);assert.deepEqual(f.calls,['collect','download']);
});
test('all accounts exhausted pauses before submission and does not reserve extra credits',async t=>{
 const f=fixture(t,{balance:async()=>0});f.runner.switchForCredits=async()=>null;f.runner.create([1,2],{});await f.runner.run();assert.equal(f.state.flowBatch.status,'paused');assert.equal(f.state.flowBatch.spent,0);assert.equal(f.state.flowBatch.jobs[1].status,'queued');assert.deepEqual(f.calls,[]);
});
