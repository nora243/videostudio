const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8');
const fn=source.slice(source.indexOf('async function importScriptResponse()'),source.indexOf("$('import-script').addEventListener('click',importScriptResponse)"));
const feedback=source.slice(source.indexOf('function rawFeedback('),source.indexOf('async function call('));
function setup(ok){
 const nodes={},events=[],node=id=>nodes[id]||=( {disabled:false,value:'JSON response',dataset:{},setAttribute(name,value){this[name]=value;},close(){events.push('close');}});
 const context=vm.createContext({$:node,localGenerating:false,lastStatus:null,
  window:{studio:{importScript:async()=>ok?{ok:true,data:{geminiJob:{sceneIds:[3]},scriptNotice:'Đã thay thế cảnh 3.'}}:{ok:false,error:'Cảnh 1: thiếu cấu trúc âm thanh.'}},studioUI:{selectScene:id=>events.push(['select',id]),showTab:tab=>events.push(['tab',tab])}},
  call:async promise=>{const result=await promise;if(!result.ok)throw Error(result.error);return result.data;},
  renderStatus:()=>events.push('render'),storeDraft:()=>events.push('store'),notify:message=>events.push(['notify',message])});
 vm.runInContext(feedback+fn,context);
 return {context,nodes,events};
}
test('import error is visible inside modal and retry remains available',async()=>{
 const fixture=setup(false);await fixture.context.importScriptResponse();
 assert.match(fixture.nodes['raw-import-feedback'].textContent,/thiếu cấu trúc âm thanh/);
 assert.equal(fixture.nodes['raw-import-feedback'].hidden,false);
 assert.equal(fixture.nodes['raw-import-feedback'].role,'alert');
 assert.equal(fixture.nodes['import-script'].disabled,false);
 assert.equal(fixture.events.includes('close'),false);
});
test('successful import refreshes scenes, saves draft, selects target and reports replacement',async()=>{
 const fixture=setup(true);await fixture.context.importScriptResponse();
 assert.deepEqual(fixture.events,['render','store',['select',3],['tab','visual'],'close',['notify','Đã thay thế cảnh 3.']]);
 assert.equal(fixture.nodes['import-script'].disabled,false);
});
