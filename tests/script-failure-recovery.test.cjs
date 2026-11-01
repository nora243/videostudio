const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {parseStoryboard}=require('../src/storyboard.cjs');
const {scriptAttemptHistory}=require('../src/script-edit.cjs');
const read=file=>fs.readFileSync(require.resolve('../src/'+file),'utf8');
const scene={id:3,duration_seconds:8,description_vi:'Đi câu',voiceover_vi:'',video_prompt_en:'Two cats fishing.',negative_prompt_en:''};
const board={title:'Đi câu',summary:'',scenes:[scene],updatedAt:'old'};
const job={id:'failed-job',status:'invalid_json',sceneIds:[3],raw:'Tôi không thể giúp bạn việc đó.',prompt:'Old prompt',baseStoryboard:structuredClone(board)};

test('non-JSON Gemini response gives an actionable error without changing existing scenes',()=>{
 assert.throws(()=>parseStoryboard(job.raw,1),/văn bản thay vì JSON/);
 assert.equal(board.scenes[0],scene);
 const history=scriptAttemptHistory(job);assert.equal(history[0].raw,job.raw);
 assert.deepEqual(job.baseStoryboard,board);
});

test('invalid JSON unlocks scene regeneration and editing; unresolved requests stay locked',()=>{
 const source=read('studio.js');
 const functionSource=source.slice(source.indexOf('function updateEditTools()'),source.indexOf('async function changeScene('));
 for(const status of ['invalid_json','failed','interrupted','waiting','submitting']){
  const nodes={},context=vm.createContext({cards:()=>[{dataset:{scene:'3'}}],activeScene:3,editing:false,undoScript:null,
   latest:{geminiJob:{...job,status},generatingScript:false,flowBusy:false},window:{workspaceUI:{scriptBusy:()=>false}},$:id=>nodes[id]||=( {})});
  vm.runInContext(functionSource+'\nupdateEditTools();',context);
  assert.equal(nodes['scene-regenerate'].disabled,['interrupted','waiting','submitting'].includes(status),status);
  assert.equal(nodes['scene-delete'].disabled,['interrupted','waiting','submitting'].includes(status),status);
 }
});

test('failed rewrite can save the current storyboard before starting another request',async()=>{
 const source=read('main.cjs'),start=source.indexOf("handle('save-storyboard',"),end=source.indexOf('let readingCredits',start);
 for(const status of ['invalid_json','waiting']){
  let handler,persisted=false;
  const state={geminiJob:{...job,status},storyboard:structuredClone(board),project:{scenes:1}};
  const context=vm.createContext({state,generatingScript:false,flowRunner:{busy:false},preparingFlow:false,
   handle:(_name,fn)=>handler=fn,validateEditedStoryboard:require('../src/script-edit.cjs').validateEditedStoryboard,persist:()=>persisted=true,status:()=>state});
  vm.runInContext(source.slice(start,end),context);
  if(status==='waiting'){await assert.rejects(handler(board),/đang chờ/);assert.equal(persisted,false);}
  else{await handler(board);assert.equal(persisted,true);assert.equal(state.geminiJob.raw,job.raw);}
 }
});

test('starting a new rewrite archives the rejected answer and snapshots the saved board',async()=>{
 const source=read('main.cjs'),start=source.indexOf("handle('generate-script',"),end=source.indexOf("handle('retry-script',",start);
 let handler,submitted;
 const state={geminiJob:structuredClone(job),storyboard:structuredClone(board),activeBrowserProfileId:'cats'};
 const context=vm.createContext({state,generatingScript:false,flowRunner:{busy:false},preparingFlow:false,structuredClone,
  handle:(_name,fn)=>handler=fn,randomUUID:()=> 'new-id',...require('../src/storyboard.cjs'),...require('../src/script-edit.cjs'),sendScript:value=>{submitted=value;}});
 vm.runInContext(source.slice(start,end),context);
 await handler({title:'Đi câu',brief:'Nối động tác kéo cần rồi ngã.',ratio:'9:16',scenes:1,sceneIds:[3]});
 assert.deepEqual(submitted.sceneIds,[3]);assert.deepEqual(submitted.baseStoryboard,board);
 assert.equal(submitted.previousAttempts[0].raw,job.raw);assert.equal(submitted.previousAttempts[0].id,job.id);
});
