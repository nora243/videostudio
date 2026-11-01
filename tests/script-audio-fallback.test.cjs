const {test}=require('node:test'),assert=require('node:assert/strict');
const {applyScriptResult,scriptAppliedMessage}=require('../src/script-edit.cjs');
const {parseStoryboard,buildPrompt}=require('../src/storyboard.cjs');
const production=require('../src/script-presets.js').scriptPresets.catProfile();
const audio={mode:'native',narrator:'',speakers:production.speakers,dialogue:[{speaker:'ti_ho',text:'Kéo phụ anh mau!'}],ambience:'Gió, nước.',music:''};
const scene=id=>({id,duration_seconds:8,description_vi:'Cũ '+id,voiceover_vi:'',video_prompt_en:'Original '+id,negative_prompt_en:'',audio:structuredClone(audio)});
const board={title:'Đi câu',summary:'Giữ tóm tắt',scenes:[scene(1),scene(2),scene(3),scene(4)],updatedAt:'original'};
const project={title:'Đi câu',brief:'Kéo cần rồi ngã.',style:'Dân dã',ratio:'9:16',scenes:4,production};
const job={sceneIds:[3],project,baseStoryboard:structuredClone(board)};
const replacement={id:1,duration_seconds:8,description_vi:'Kéo mạnh rồi mất thăng bằng.',voiceover_vi:'',video_prompt_en:'Pull, lose tension, then tip backward.',negative_prompt_en:'static pose'};
const rawFor=scene=>JSON.stringify({title:'Không thay',summary:'Không thay',scenes:[scene]});

test('visual-only rewrite replaces selected scene and retains its original audio and voices',()=>{
 const before=structuredClone(board),inherited=[];
 const result=applyScriptResult('JSON\n'+rawFor(replacement),job,board,{onAudioFallback:id=>inherited.push(id)});
 assert.deepEqual(inherited,[3]);assert.equal(result.scenes[2].id,3);
 assert.equal(result.scenes[2].video_prompt_en,replacement.video_prompt_en);
 assert.deepEqual(result.scenes[2].audio,board.scenes[2].audio);
 for(const index of [0,1,3])assert.deepEqual(result.scenes[index],board.scenes[index]);
 assert.equal(result.title,board.title);assert.equal(result.summary,board.summary);assert.deepEqual(board,before);
 assert.match(scriptAppliedMessage(job,result,inherited),/Đã thay thế cảnh 3/);
 assert.match(scriptAppliedMessage(job,result,inherited),/giữ âm thanh, lời thoại và hồ sơ giọng/);
 assert.throws(()=>parseStoryboard(rawFor(replacement),1,production),/thiếu cấu trúc âm thanh/);
});

test('explicit audio is applied without fallback, and malformed audio is still rejected',()=>{
 const inherited=[],updated={...audio,dialogue:[{speaker:'ut_ngao',text:'Em kéo đây!'}]};
 const result=applyScriptResult(rawFor({...replacement,audio:updated}),job,board,{onAudioFallback:id=>inherited.push(id)});
 assert.deepEqual(inherited,[]);assert.deepEqual(result.scenes[2].audio.dialogue,updated.dialogue);
 assert.throws(()=>applyScriptResult(rawFor({...replacement,audio:null}),job,board),/thiếu cấu trúc/);
 assert.throws(()=>applyScriptResult(rawFor({...replacement,audio:{mode:'native'}}),job,board),/danh sách lời thoại/);
 const changed={...board,summary:'Đã sửa'};
 assert.throws(()=>applyScriptResult(rawFor(replacement),job,changed),/đã thay đổi/);
});

test('final schema example includes required audio instead of encouraging omission',()=>{
 const prompt=buildPrompt(project),start=prompt.indexOf('{"title":"Tên phim"'),end=prompt.indexOf('\n',start);
 const example=JSON.parse(prompt.slice(start,end));
 assert.ok(example.scenes[0].audio);assert.equal(example.scenes[0].audio.mode,'native');
 assert.equal(example.scenes[0].audio.speakers,undefined);
 assert.equal(parseStoryboard(JSON.stringify({...example,scenes:example.scenes.map(s=>({...s,audio:{...s.audio,dialogue:[]}}))}),1,production).scenes[0].audio.speakers.length,5);
});
