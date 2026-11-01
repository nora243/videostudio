const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/production-ui.js'),'utf8');
const refreshSource=source.slice(source.indexOf('async function refreshPrompt()'),source.indexOf("$('preset-prompt-refresh').onclick"));
function setup(brief){
 const field={value:''},calls=[],messages=[];
 const context=vm.createContext({promptRevision:0,generatedPrompt:null,chosen:{defaults:{ratio:'9:16'}},$:()=>field,
  feedback:message=>messages.push(message),read:()=>({speakers:[],geminiPrompt:'Old override'}),
  window:{workspaceUI:{readProject:()=>({brief,ratio:'16:9'})},studio:{previewPrompt:async project=>{calls.push(project);return {ok:true,data:'Full prompt'};}}}});
 vm.runInContext(refreshSource,context);
 return {context,field,calls,messages};
}
test('opening preset or refreshing without an episode idea does not invoke preview validation',async()=>{
 for(const brief of ['', '   ',undefined]){
  const fixture=setup(brief);await fixture.context.refreshPrompt();
  assert.equal(fixture.calls.length,0);assert.equal(fixture.field.value,'');
  assert.match(fixture.field.placeholder,/Nhập ý tưởng video/);
  assert.match(fixture.messages[0],/cấu hình mẫu trước/);
 }
});
test('existing custom prompt survives refresh without an idea; valid ideas still preview',async()=>{
 const fixture=setup('');fixture.field.value='My custom prompt';
 await fixture.context.refreshPrompt();assert.equal(fixture.field.value,'My custom prompt');
 const ready=setup('Út ăn vụng cá');await ready.context.refreshPrompt();
 assert.equal(ready.calls.length,1);assert.equal(ready.calls[0].production.geminiPrompt,'');
 assert.equal(ready.calls[0].ratio,'9:16');assert.equal(ready.field.value,'Full prompt');
 assert.equal(ready.context.generatedPrompt,'Full prompt');
});
