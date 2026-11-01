const{test}=require('node:test'),assert=require('node:assert/strict');
const{scriptPresets}=require('../src/script-presets.js');
const{resolveSceneVoices,validateAudio}=require('../src/production.cjs');
const{compilePrompt,sceneSpeakingSpeakers}=require('../src/flow.cjs');
function scene(p){return {id:1,duration_seconds:8,video_prompt_en:'A conversation.',audio:{mode:'native',speakers:structuredClone(p.speakers),dialogue:[{speaker:p.speakers[0].id,text:'Xin chào.'}],ambience:'',music:''}};}
test('review uses current speaker descriptions and regions without requiring a Flow voice',()=>{
 const p=scriptPresets.profile();p.speakers[0]={...p.speakers[0],flowVoice:undefined,customVoice:'Old custom voice',region:'south',description:'Warm mature female voice, steady delivery.'};
 const old=scene(p);old.audio.voiceStrategy='flow';old.audio.speakers[0]={...old.audio.speakers[0],region:'north',description:'Old voice'};
 const resolved=resolveSceneVoices(old,p),prompt=compilePrompt(resolved);
 assert.equal(validateAudio(resolved.audio).voiceStrategy,'text');assert.deepEqual(sceneSpeakingSpeakers(resolved),[]);
 assert.match(prompt,/Warm mature female voice/);assert.match(prompt,/Southern Vietnamese accent/);assert.match(prompt,/Xin chào/);assert.doesNotMatch(prompt,/Flow voice:|voice chip|Old custom voice|Northern Vietnamese/);
});
test('cat-family keeps Flow chips even if an old scene carries review delivery metadata',()=>{
 const p=scriptPresets.catProfile(),old=scene(p);old.audio.delivery='brisk';old.audio.voiceStrategy='text';
 const resolved=resolveSceneVoices(old,p),prompt=compilePrompt(resolved);
 assert.equal(resolved.audio.voiceStrategy,'flow');assert.equal(sceneSpeakingSpeakers(resolved).length,1);assert.match(prompt,/\[Flow voice: Charon\]/);assert.doesNotMatch(prompt,/Authentic native Northern Vietnamese accent/);
});
