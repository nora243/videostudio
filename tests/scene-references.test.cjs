const {test}=require('node:test'),assert=require('node:assert/strict');
const {sceneInputs,allOrderedReferences}=require('../src/references.cjs');
const {compilePrompt}=require('../src/flow.cjs');
const {assertSceneImageChoice}=require('../src/references.cjs');
const ref=(id,role,sceneId)=>({id,name:id+'.png',role,...(sceneId==null?{}:{sceneId})});
test('per-scene frames and ingredients exclude each other without locking inherited shared images',()=>{
 const shared=ref('common','character_group'),frame=ref('start','start_frame',3),local=ref('local','setting',3);
 assert.doesNotThrow(()=>assertSceneImageChoice([shared],3,'start_frame'));
 assert.doesNotThrow(()=>assertSceneImageChoice([frame],3,'end_frame'));
 assert.doesNotThrow(()=>assertSceneImageChoice([local],3,'character_group'));
 assert.throws(()=>assertSceneImageChoice([local],3,'end_frame'),/gỡ hết ảnh tham chiếu riêng/);
 assert.throws(()=>assertSceneImageChoice([frame],3,'setting'),/gỡ hết khung hình/);
 assert.doesNotThrow(()=>assertSceneImageChoice([local],4,'start_frame'));
 assert.throws(()=>sceneInputs([shared,frame,local],3),/cả khung hình và ảnh tham chiếu riêng/);
});
test('scene references override only matching shared roles and never leak into another scene',()=>{
 const refs=[ref('family','character_group'),ref('home','setting'),ref('scene-three-family','character_group',3),ref('scene-four-location','setting',4)];
 assert.deepEqual(sceneInputs(refs,3).references.map(r=>r.id),['scene-three-family','home']);
 assert.deepEqual(sceneInputs(refs,4).references.map(r=>r.id),['family','scene-four-location']);
 assert.deepEqual(sceneInputs(refs,5).references.map(r=>r.id),['family','home']);
});
test('frames are separate anchors, not ingredients; last frame needs a start frame',()=>{
 const refs=[ref('family','character_group'),ref('start','start_frame',3),ref('end','end_frame',3)];
 const inputs=sceneInputs(allOrderedReferences(refs),3);
 assert.equal(inputs.generationMode,'frames');assert.deepEqual(inputs.references,[]);
 assert.equal(inputs.frames.start.id,'start');assert.equal(inputs.frames.end.id,'end');
 assert.equal(sceneInputs(refs,4).generationMode,'ingredients');
 assert.equal(sceneInputs(refs.slice(0,2),3).frames.end,null);
 assert.throws(()=>sceneInputs([refs[2]],3),/chưa có khung hình bắt đầu/);
 assert.throws(()=>sceneInputs([...refs,ref('another-start','start_frame',3)],3),/một ảnh bắt đầu/);
});

test('scene images and frame slots survive project storage and queue snapshots',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vs-scene-images-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const refs=[ref('common','character_group'),ref('start','start_frame',3),ref('end','end_frame',3)];
 const state={activeProjectId:'project-a',project:{title:'A'},flowReferences:refs,storyboard:{title:'A',scenes:[{id:3,duration_seconds:8,video_prompt_en:'Action'}]},flowProject:{url:'https://flow.google.com/project/a'}};
 const {VideoLibrary}=require('../src/library.cjs'),library=new VideoLibrary(root);library.bootstrap(state);
 state.activeProjectId='project-b';state.project={title:'B'};state.flowReferences=[];library.saveWorkspace(state);
 assert.deepEqual(new VideoLibrary(root).readProject('project-a').flowReferences,refs);
 state.activeProjectId='project-a';state.flowReferences=refs;
 const {FlowRunner}=require('../src/flow-runner.cjs');
 const adapter={validateOptions:()=>({resolution:'720p',ratio:'9:16'}),compilePrompt:()=>''};
 const runner=new FlowRunner({state,root,persist:()=>{},getAdapter:()=>adapter});
 const batch=runner.create([3],{});refs[1].name='changed-after-queue.png';
 assert.equal(sceneInputs(batch.options.references,3).frames.start.name,'start.png');
});
test('no-text constraints apply even to old scenes with names and nonempty negative prompts',()=>{
 const scene={id:3,duration_seconds:8,video_prompt_en:'ti_ho stands next to ut_ngao.',negative_prompt_en:'blur'};
 const prompt=compilePrompt(scene,[ref('family','character_group')]);
 for(const text of ['No visible text','invisible metadata','Ignore writing in references','character name labels','readable calendar','blur'])assert.ok(prompt.includes(text),text);
 const frames=compilePrompt(scene,[],{start:ref('start','start_frame',3),end:ref('end','end_frame',3)});
 assert.match(frames,/exact initial composition/);assert.match(frames,/target final composition/);
 assert.match(frames,/No character reference sheet or ingredient images are attached/);
});
