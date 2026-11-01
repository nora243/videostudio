const {test}=require('node:test'),assert=require('node:assert/strict');
const {retryScriptJob,applyScriptResult}=require('../src/script-edit.cjs');
const {buildPrompt}=require('../src/storyboard.cjs');
const project={title:'Hai anh em đi câu',brief:'Tí Hổ và Út Ngáo ra bờ sông.',style:'Dân dã',ratio:'9:16',scenes:1};
const scene={id:1,duration_seconds:8,description_vi:'Bờ sông quê.',voiceover_vi:'',video_prompt_en:'Two cats fishing.',negative_prompt_en:''};
const board={title:'Đi câu',summary:'',scenes:[scene]};
const previous={id:'old',marker:'VIDEO_STUDIO_REQUEST_old',project,profileId:'cats',status:'interrupted',prompt:buildPrompt(project)+'\nMã yêu cầu: VIDEO_STUDIO_REQUEST_old. Không đưa mã này vào JSON.',baseline:{count:1,key:'old-response'},conversationUrl:'https://gemini.google.com/app/cats',raw:'',error:'Không thấy yêu cầu này trong hội thoại hiện tại.'};

test('explicit resend preserves prompt and original attempt but starts with fresh response identity',()=>{
 const before=structuredClone(previous),retry=retryScriptJob(previous,null,{id:'new',profileId:'cats'});
 assert.deepEqual(previous,before);
 assert.equal(retry.prompt.replace(retry.marker,previous.marker),previous.prompt);
 assert.equal(retry.status,'preparing');assert.equal(retry.raw,'');assert.equal(retry.retryOf,previous.id);
 assert.equal(retry.baseline,undefined);assert.equal(retry.error,undefined);
 assert.deepEqual(retry.previousAttempts,[before]);assert.deepEqual(retry.project,project);
 const output=applyScriptResult(JSON.stringify(board),retry,null);assert.equal(output.scenes.length,1);
 assert.throws(()=>retryScriptJob({...previous,status:'completed'},null,{id:'new',profileId:'cats'}),/gián đoạn/);
 assert.throws(()=>retryScriptJob(previous,null,{id:'new',profileId:'other'}),/profile/);
});

test('resending a partial rewrite preserves selected scenes and rejects changed script',()=>{
 const current={...board,scenes:[scene,{...scene,id:3,description_vi:'Cảnh khác.'}]};
 const rewrite={...previous,sceneIds:[3],baseStoryboard:structuredClone(current),raw:'partial answer',pipelineId:'pipeline-1'};
 const retry=retryScriptJob(rewrite,current,{id:'again',profileId:'cats'});
 assert.deepEqual(retry.sceneIds,[3]);assert.deepEqual(retry.baseStoryboard,current);assert.equal(retry.pipelineId,'pipeline-1');
 assert.equal(retry.previousAttempts[0].raw,'partial answer');
 const updated=applyScriptResult(JSON.stringify({...board,scenes:[{...scene,description_vi:'Mới'}]}),retry,current);
 assert.deepEqual(updated.scenes[0],scene);assert.equal(updated.scenes[1].id,3);assert.equal(updated.scenes[1].description_vi,'Mới');
 assert.throws(()=>retryScriptJob(rewrite,{...current,summary:'Changed'},{id:'again',profileId:'cats'}),/đã thay đổi/);
});

test('repeated retries keep bounded history without nesting attempts',()=>{
 let job=structuredClone(previous);
 for(let i=0;i<8;i++)job={...retryScriptJob(job,null,{id:'retry-'+i,profileId:'cats'}),status:'interrupted'};
 assert.equal(job.previousAttempts.length,5);
 assert.ok(job.previousAttempts.every(attempt=>!attempt.previousAttempts));
 assert.ok(job.previousAttempts.every(attempt=>attempt.prompt&&attempt.id));
});
