
const {test}=require('node:test'),assert=require('node:assert/strict');
const {references,sceneInputs,referencePrompt}=require('../src/references.cjs');
const {buildPrompt}=require('../src/storyboard.cjs');
const production=require('../src/script-presets.js').scriptPresets.catProfile();
function fixture(){return {project:{production:{...production,speakers:production.speakers.map(s=>({...s,imagePath:'E:/references/'+s.id+'.png'}))}}};}
test('portraits retain Flow bindings through saves and replace only changed or removed images',()=>{
 const state=fixture(),first=references(state);assert.equal(first.length,5);first[0].bindings={project:'asset'};first[0].assetId='asset';
 assert.equal(references(state)[0],first[0]);assert.equal(references(state)[0].bindings.project,'asset');
 state.project.production.speakers[0].imagePath='E:/references/new.png';const changed=references(state);assert.equal(changed[0].assetId,undefined);assert.equal(changed[1],first[1]);
 delete state.project.production.speakers[1].imagePath;assert.equal(references(state).length,4);
});
test('only characters in the scene get portraits and prompts assign each image to its own character',()=>{
 const state=fixture(),scene={id:1,description_vi:'Tí Hổ và Út Ngáo',video_prompt_en:'ti_ho and ut_ngao argue.',audio:{dialogue:[]}};
 const inputs=sceneInputs(references(state),1,scene);assert.deepEqual(inputs.references.map(r=>r.speakerId),['ti_ho','ut_ngao']);
 const prompt=referencePrompt(inputs.references);assert.match(prompt,/Identity reference for ti_ho/);assert.match(prompt,/Identity reference for ut_ngao/);assert.doesNotMatch(prompt,/bo_bu/);
 const gemini=buildPrompt({title:'Cats',brief:'Cats argue.',ratio:'9:16',scenes:1,production:state.project.production});assert.match(gemini,/Ảnh chân dung riêng/);assert.equal(gemini.includes('E:/references'),false);
});

test('character portraits are not silently dropped when a scene uses frame anchors',()=>{
 const state=fixture(),scene={id:1,video_prompt_en:'ti_ho speaks.'};
 const items=[...references(state),{id:'start',name:'start.png',role:'start_frame',sceneId:1}];
 assert.throws(()=>sceneInputs(items,1,scene),/gỡ khung hình đầu/);
});
