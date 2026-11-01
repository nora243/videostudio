const {test}=require('node:test'),assert=require('node:assert/strict');const{referenceIdentity}=require('../src/reference-identity.cjs');
const {attachReference}=require('../src/flow.cjs');
function browserFixture(confirm=false, clickRace=false){
 const mediaId='b4aeead9-dd5a-4678-8bb5-5d5444c46ec9',name='vs-ref-reference.png',url='https://flow.google.com/project/test-project';let chips=[],confirmVisible=false,selects=0,opens=0;
 const attach=()=>{chips=[`https://flow-content.google/image/${mediaId}`];confirmVisible=false;};
 const option={filter(){return this;},first(){return this;},waitFor:async()=>{},count:async()=>1,locator:()=>({evaluate:async fn=>fn({src:'https://flow.google.com/asb/ANqvLOY-OpaqueReferenceThumbnail_12345=s512-rw',complete:true,naturalWidth:512})}),click:async()=>{selects++;if(confirm)confirmVisible=true;else attach();}};
 const page={url:()=>url,locator:selector=>selector.endsWith(' img')?{evaluateAll:async fn=>fn(chips.map(src=>({src})))}:{count:async()=>0},getByRole:(role,{name:label}={})=>{if(role==='tablist')return{getByText:()=>({click:async()=>{}})};if(role==='option')return option;if(role==='textbox')return{fill:async()=>{}};if(label.test('Thêm thành phần vào ô nhập câu lệnh'))return{click:async()=>{opens++;}};return{isVisible:async()=>confirmVisible,click:async()=>{if(clickRace){if(clickRace!=='missing')attach();throw new Error('confirmation disappeared');}attach();}};}};
 return{page,reference:{name,path:'unused'},mediaId,selected:()=>selects,opened:()=>opens,clear:()=>{chips=[];},setForeign:()=>{chips=['https://flow-content.google/image/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];}};
}
test('recognizes both legacy UUID media URLs and new Flow ASB thumbnails',()=>{
 const id='6bfefac9-3794-460a-9f9d-2c82be6bf8ca';assert.equal(referenceIdentity(`https://flow.google.com/media/${id}?token=ignored`),id);
 const token='ANqvLOY-TestOpaqueMediaIdentity_12345';assert.equal(referenceIdentity(`https://flow.google.com/asb/${token}=s512-rw`),'asb:'+token);assert.equal(referenceIdentity(`https://flow.google.com/asb/${token}=s64-rw?size=64`),'asb:'+token);
 assert.notEqual(referenceIdentity('https://flow.google.com/asb/ANqvLOY-OtherOpaqueMediaIdentity_12345=s64-rw'),'asb:'+token);
});
test('does not treat local upload previews, filenames, invalid media and lookalike hosts as ready media',()=>{
 for(const source of ['blob:https://flow.google.com/upload','data:image/png;base64,test','https://flow.google.com/asb/short','https://evil.example/asb/ANqvLOY-TestOpaqueMediaIdentity_12345=s512-rw','https://flow.google.com/files/vs-ref-6bfefac9-3794-460a-9f9d-2c82be6bf8ca.png','not a URL'])assert.equal(referenceIdentity(source),null,source);
});
for(const confirm of [false,true])test(`attaches ASB thumbnail to canonical UUID chip, ${confirm?'with confirmation':'immediately on selection'}`,async()=>{
 const f=browserFixture(confirm),stages=[];assert.equal(await attachReference(f.page,f.reference,step=>stages.push(step)),f.mediaId);assert.equal(f.reference.assetId,f.mediaId);assert.equal(f.selected(),1);assert.equal(stages.includes('flow.reference.attach'),confirm);
 // Existing canonical UUID must not be used to filter ASB thumbnail URLs on the next preparation.
 assert.equal(await attachReference(f.page,f.reference),f.mediaId);assert.equal(f.opened(),1);assert.equal(f.selected(),1);
 f.clear();assert.equal(await attachReference(f.page,f.reference),f.mediaId);assert.equal(f.opened(),2);assert.equal(f.selected(),2);
});
test('does not replace an unconfirmed image already in the composer',async()=>{const f=browserFixture();f.setForeign();await assert.rejects(attachReference(f.page,f.reference),/gỡ ảnh/);assert.equal(f.opened(),0);assert.equal(f.selected(),0);});

test('accepts attachment when Flow removes confirmation during click',async()=>{
 const f=browserFixture(true,true);assert.equal(await attachReference(f.page,f.reference),f.mediaId);assert.equal(f.selected(),1);assert.equal(f.opened(),1);
});
test('preserves confirmation failure when no reference was attached',async()=>{
 const f=browserFixture(true,'missing');await assert.rejects(attachReference(f.page,f.reference),/confirmation disappeared/);assert.equal(f.reference.assetId,undefined);
});
