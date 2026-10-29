const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateEditedStoryboard,selectedScenes,buildRewritePrompt,applyScriptResult}=require('../src/script-edit.cjs');
const scene=id=>({id,duration_seconds:8,description_vi:'Nội dung '+id,voiceover_vi:'Lời '+id,video_prompt_en:'Garage scene '+id,negative_prompt_en:''});
const board={title:'Xe điện',summary:'Pin',scenes:[scene(3),scene(1),scene(6)],updatedAt:'revision-1'};
const project={title:'Xe điện',brief:'Giải thích bảo hành và sửa pin',style:'Điện ảnh',ratio:'9:16',scenes:3};
test('editing retains stable IDs across reorder, delete and empty board',()=>{
 assert.deepEqual(validateEditedStoryboard(board).scenes.map(s=>s.id),[3,1,6]);
 assert.deepEqual(validateEditedStoryboard({...board,scenes:[scene(6)]}).scenes.map(s=>s.id),[6]);
 assert.deepEqual(validateEditedStoryboard({...board,scenes:[]}).scenes,[]);
 assert.throws(()=>validateEditedStoryboard({...board,scenes:[scene(1),scene(1)]}),/duy nhất/);
});
test('rewrite prompt includes entire current context, selected scenes in timeline order and revision note',()=>{
 assert.deepEqual(selectedScenes(board,[6,3]),[3,6]);
 const prompt=buildRewritePrompt(project,board,[6,3],'Tăng giá trị tư vấn');
 for(const term of ['[3,6]','Nội dung 1','Không viết lại các cảnh ngoài danh sách','Tăng giá trị tư vấn'])assert.ok(prompt.includes(term),term);
 assert.throws(()=>selectedScenes(board,[]),/chọn/);assert.throws(()=>selectedScenes(board,[2]),/chọn/);
});
test('partial regeneration merges only selected scenes and rejects stale or wrong-count results',()=>{
 const job={project,sceneIds:[3,6],baseStoryboard:structuredClone(board)},response={title:'Không thay tiêu đề',summary:'Không thay tóm tắt',scenes:[{...scene(1),description_vi:'Viết lại 3'},{...scene(2),description_vi:'Viết lại 6'}]};
 const result=applyScriptResult(JSON.stringify(response),job,board);assert.equal(result.title,board.title);assert.equal(result.summary,board.summary);assert.deepEqual(result.scenes.map(s=>s.id),[3,1,6]);assert.equal(result.scenes[0].description_vi,'Viết lại 3');assert.deepEqual(result.scenes[1],board.scenes[1]);assert.equal(result.scenes[2].description_vi,'Viết lại 6');
 assert.throws(()=>applyScriptResult(JSON.stringify(response),job,{...board,updatedAt:'newer'}),/đã thay đổi/);
 assert.throws(()=>applyScriptResult(JSON.stringify({...response,scenes:[scene(1)]}),job,board),/yêu cầu 2/);
});
