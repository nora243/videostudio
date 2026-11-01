
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8');
const fn=source.slice(source.indexOf('async function runScript('),source.indexOf("$('generate-script').addEventListener"));
function setup(fail=false){
 const nodes={},requests=[],saves=[],renders=[],notices=[];
 const node=id=>nodes[id]||=( {value:'Rewrite note',disabled:false,reportValidity:()=>true});
 const production={geminiPrompt:'Old idea override',speakers:[{id:'cat'}]},project={title:'New title',brief:'New idea',scenes:'auto',sceneDuration:6,production};
 const board={title:'Old title',scenes:[{id:1},{id:2}]};
 const data={project,storyboard:{title:'New title',scenes:[{id:1}]}};
 const context=vm.createContext({$:node,localGenerating:false,lastStatus:{},currentStoryboard:board,
  readProject:()=>project,readStoryboard:()=>board,renderScriptStatus:()=>{},renderStatus:d=>renders.push(d),storeDraft:()=>{},notify:m=>notices.push(m),
  call:async promise=>{const r=await promise;if(!r.ok)throw Error(r.error);return r.data;},
  window:{libraryUI:{workspace:()=>{}},productionUI:{apply:()=>{}},studioUI:{selectedIds:()=>[],refreshControls:()=>{},selectScene:()=>{}},studio:{
   save:async p=>{saves.push(p);return {ok:true,data:{}};},saveStoryboard:async()=>{throw Error('Must not save selected scenes');},
   generateScript:async p=>{requests.push(p);return fail?{ok:false,error:'Gemini unavailable'}:{ok:true,data};},status:async()=>({ok:true,data:{storyboard:board}})
  }}});
 vm.runInContext(fn,context);return {context,requests,saves,renders,notices,production,board};
}
test('new script uses changed idea and settings without selected scene IDs or old prompt',async()=>{
 const f=setup();await f.context.runScript(false,null,false,true);
 assert.equal(f.requests.length,1);assert.equal(f.requests[0].brief,'New idea');assert.equal(f.requests[0].scenes,'auto');assert.equal(f.requests[0].sceneDuration,6);
 assert.equal(f.requests[0].sceneIds,undefined);assert.equal(f.requests[0].rewriteNote,undefined);assert.equal(f.requests[0].production.geminiPrompt,'');assert.equal(f.production.geminiPrompt,'Old idea override');
assert.equal(f.saves[0].brief,'New idea');
});
test('failed new script retains the existing storyboard',async()=>{
 const f=setup(true);await f.context.runScript(false,null,false,true);assert.equal(f.requests.length,1);assert.equal(f.renders.at(-1).storyboard,f.board);assert.deepEqual(f.board.scenes,[{id:1},{id:2}]);assert.ok(f.notices.includes('Gemini unavailable'));
});
test('selected-scene action still requires a selection',async()=>{const f=setup();await f.context.runScript();assert.equal(f.requests.length,0);assert.equal(f.notices.length,1);});
