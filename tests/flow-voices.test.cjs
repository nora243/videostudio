
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateProduction,resolveSceneVoices}=require('../src/production.cjs');
const {sceneVoiceNames,compilePrompt}=require('../src/flow.cjs');
const profile=require('../src/script-presets.js').scriptPresets.catProfile();
const legacy={...profile,speakers:profile.speakers.map(({flowVoice,...s})=>s)};
const scene={id:1,duration_seconds:8,video_prompt_en:'Cats talking.',audio:{mode:'native',speakers:legacy.speakers,dialogue:[{speaker:'ut_ngao',text:'Anh cho em xem với!'},{speaker:'ti_ho',text:'Chờ anh một tí.'}]}};
test('legacy cat voices are restored for both dialogue speakers before Flow preparation',()=>{
 const result=resolveSceneVoices(scene,legacy);assert.deepEqual(sceneVoiceNames(result),['Fenrir','Orus']);assert.match(compilePrompt(result),/Flow voice: Fenrir/);assert.match(compilePrompt(result),/Flow voice: Orus/);assert.equal(scene.audio.speakers[0].flowVoice,undefined);
});
test('explicit voice configuration wins and unrelated speakers do not get guessed voices',()=>{
 const result=validateProduction({...legacy,speakers:legacy.speakers.map(s=>s.id==='ti_ho'?{...s,flowVoice:'Charon'}:s)});assert.equal(result.speakers.find(s=>s.id==='ti_ho').flowVoice,'Charon');
 assert.throws(()=>sceneVoiceNames(scene),/Chưa chọn giọng Flow/);assert.deepEqual(sceneVoiceNames({...scene,audio:{...scene.audio,mode:'external'}}),[]);
});
test('silent lines are ignored and an off-screen narrator is included',()=>{
 const result=resolveSceneVoices({...scene,voiceover_vi:'Một buổi trưa.',audio:{...scene.audio,narrator:'bo_bu',dialogue:[{speaker:'ti_ho',text:' '}]}},legacy);assert.deepEqual(sceneVoiceNames(result),['Charon']);
});

test('saved scene voice is retained when the legacy project has no explicit selection',()=>{
 const changed={...scene,audio:{...scene.audio,speakers:scene.audio.speakers.map(s=>s.id==='ti_ho'?{...s,flowVoice:'Charon'}:s)}};
 assert.deepEqual(sceneVoiceNames(resolveSceneVoices(changed,legacy)),['Fenrir','Charon']);
});

test('flow voices module provides authentic Northern Vietnamese defaults and checks custom voices',()=>{
 const flowVoices=require('../src/flow-voices.cjs');
 assert.equal(typeof flowVoices.DEFAULT_SAMPLE_DIALOGUES.ti_ho, 'string');
 assert.equal(typeof flowVoices.DEFAULT_PERFORMANCE_DESCRIPTIONS.ti_ho, 'string');
 assert.match(flowVoices.DEFAULT_PERFORMANCE_DESCRIPTIONS.ti_ho, /Authentic native Northern Vietnamese accent/);
 assert.match(flowVoices.DEFAULT_PERFORMANCE_DESCRIPTIONS.bo_bu, /thuần âm điệu Bắc Bộ/);
});
