const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {attachFrames,verifyFrames,reconcileFrames}=require('../src/flow-frames.cjs');
function fixture(t,race=false){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vs-frame-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const start={path:path.join(root,'start.png'),name:'start.png'},end={path:path.join(root,'end.png'),name:'end.png'};
 fs.writeFileSync(start.path,'fixture');fs.writeFileSync(end.path,'fixture');
 const sources={start:'',end:''},events=[];let kind,search;
 const ids={start:'11111111-1111-4111-8111-111111111111',end:'22222222-2222-4222-8222-222222222222'};
 const slot=key=>({count:async()=>1,evaluate:async()=>sources[key],hover:async()=>{},click:async()=>{kind=key;},locator:()=>({count:async()=>1,click:async()=>{sources[key]='';events.push('remove-'+key);}})});
 const option={filter(){return this;},first(){return this;},waitFor:async()=>{},count:async()=>1,
  locator:()=>({evaluate:async fn=>fn({src:'https://flow-content.google/image/'+ids[search==='start.png'?'start':'end'],complete:true,naturalWidth:100})}),
  click:async()=>{const key=search==='start.png'?'start':'end';assert.equal(kind,key);if(!race)sources[key]='https://flow-content.google/image/'+ids[key];events.push(key);}};
 const page={url:()=> 'https://flow.google.com/project/frames',locator:()=>({nth:index=>slot(index===0?'start':'end')}),
  getByRole:role=>role==='option'?option:role==='textbox'?{fill:async value=>{search=value;}}:{isVisible:async()=>{if(race){sources[kind]='https://flow-content.google/image/'+ids[kind];return true;}return false;},click:async()=>{throw Error('Confirmation disappeared during attachment');}}};
 return {page,start,end,sources,events,ids};
}
test('start/end images bind to distinct slots and are verified before generation',async t=>{
 const f=fixture(t),ids=await attachFrames(f.page,{start:f.start,end:f.end});
 assert.deepEqual(ids,f.ids);assert.deepEqual(f.events,['start','end']);
 await verifyFrames(f.page,ids);await attachFrames(f.page,{start:f.start,end:f.end});
 assert.deepEqual(f.events,['start','end']);
 f.sources.end='https://flow-content.google/image/'+f.ids.start;
 await assert.rejects(verifyFrames(f.page,ids),/đã thay đổi/);
});
test('switching scenes removes only owned frame images and rejects unknown ones',async t=>{
 const f=fixture(t);await attachFrames(f.page,{start:f.start});
 await assert.rejects(reconcileFrames(f.page,null,[]),/ngoài cấu hình/);
 await reconcileFrames(f.page,null,[f.start]);assert.equal(f.sources.start,'');
 assert.deepEqual(f.events,['start','remove-start']);
});
test('immediate frame attachment survives confirmation disappearing during click',async t=>{
 const f=fixture(t,true),ids=await attachFrames(f.page,{start:f.start,end:f.end});
 assert.deepEqual(ids,f.ids);await verifyFrames(f.page,ids);
});
