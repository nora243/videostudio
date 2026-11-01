const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/production-ui.js'),'utf8');
function fixture(){
 const fields={'preset-save':{},'preset-name':{value:'Review mới'}};
 let draft={direction:'review',instructions:'Latest formula',speakers:[{id:'lead',description:'Latest voice'}]};
 const saved=[],messages=[];
 const context=vm.createContext({custom:[],chosen:{id:'gara-review',defaults:{ratio:'9:16'}},profile:null,structuredClone,scriptPresets:{presets:[{id:'gara-review',direction:'review'},{id:'cat-family',direction:'cat-family'}]},
  $:id=>fields[id],read:()=>structuredClone(draft),localStorage:{setItem:(_key,value)=>saved.push(JSON.parse(value))},
  refreshSummary:()=>{},choose:p=>{context.chosen=p;},feedback:m=>messages.push(m),window:{workspaceUI:{storeDraft:()=>{}}}});
 const helpers=source.slice(source.indexOf('function latestPreset('),source.indexOf('function choose('));vm.runInContext(helpers,context);
 const handler=source.slice(source.indexOf("$('preset-save').onclick="),source.indexOf("$('preset-delete').onclick="));vm.runInContext(handler,context);
 return {context,fields,saved,messages,setDraft:v=>{draft=v;}};
}
test('save updates selected built-in template in place across repeated saves',()=>{
 const f=fixture();f.fields['preset-save'].onclick();assert.equal(f.context.custom.length,1);assert.equal(f.context.chosen.id,'gara-review');
 f.setDraft({direction:'review',instructions:'Second revision',speakers:[]});f.fields['preset-save'].onclick();
 assert.equal(f.context.custom.length,1);assert.equal(f.saved.at(-1).length,1);assert.equal(f.context.custom[0].production.templateId,'gara-review');assert.equal(f.context.profile.instructions,'Second revision');
});
test('opening another project resolves latest template instead of its stale snapshot',()=>{
 const f=fixture();f.fields['preset-save'].onclick();
 const result=f.context.latestProfile({templateId:'gara-review',instructions:'Old project copy'});
 assert.equal(result.instructions,'Latest formula');result.speakers[0].description='Project edit';assert.equal(f.context.custom[0].production.speakers[0].description,'Latest voice');
 const other={templateId:'cat-family',instructions:'Cat settings'};assert.equal(f.context.latestProfile(other),other);
 assert.equal(f.context.latestPreset({id:'gara-review',name:'Factory name'}).name,'Review mới');
 assert.equal(f.context.latestProfile({direction:'review',instructions:'Legacy snapshot'}).instructions,'Latest formula');
});
test('existing custom template retains its ID and other saved templates',()=>{
 const f=fixture();f.context.chosen={id:'my-template'};f.context.custom=[{id:'cat-family',production:{direction:'cat-family'}}];f.fields['preset-save'].onclick();f.fields['preset-save'].onclick();
 assert.equal(f.context.custom.length,2);assert.equal(f.context.chosen.id,'my-template');assert.equal(f.context.custom.filter(p=>p.id==='cat-family').length,1);
});
