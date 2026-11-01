const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/main.cjs'),'utf8');
const start=source.indexOf("handle('flow-reference-frame',"),end=source.indexOf("handle('flow-reference-update',",start);
function fixture(fail=false){
 let handler;const events=[];
 const existing=[{id:'common',name:'common.png',role:'character_group'},{id:'old',name:'old.png',role:'end_frame',sceneId:3},{id:'other',name:'other.png',role:'end_frame',sceneId:4}];
 const state={activeProjectId:'target',storyboard:{scenes:[{id:3},{id:4}]},flowReferences:structuredClone(existing)};
 const report={actualSeconds:2.333,width:720,height:1280,watermarkChecked:true,watermarkRemoved:true};
 const context=vm.createContext({state,library:{},root:'/test',ROLES:{character_group:{}},FRAME_ROLES:{start_frame:{},end_frame:{}},assertSceneImageChoice:require('../src/references.cjs').assertSceneImageChoice,path:require('node:path'),randomUUID:()=> 'generated-id',
  handle:(_name,fn)=>handler=fn,editReferences:fn=>fn(),findBrowser:()=> 'chrome',activity:{stage:()=>{}},nativeImage:{createFromPath:()=>({isEmpty:()=>false})},
  references:()=>state.flowReferences,detachOwnedReferences:async()=>events.push('detach'),persist:()=>events.push('persist'),status:async()=>state,
  require:()=>({resolveFrameSource:()=>({file:'/safe/video.mp4',projectId:'source',sceneId:1,scenePosition:1,batchId:'batch',jobId:'job'}),extractFrameToPng:async()=>{events.push('clean');if(fail)throw Error('Cleanup failed');return report;}})});
 vm.runInContext(source.slice(start,end),context);
 return {handler,state,existing,events};
}
const request={role:'end_frame',sceneId:3,targetProjectId:'target',sourceProjectId:'source',batchId:'batch',jobId:'job',selection:'time',seconds:2.34};
test('captured image binds to exactly the intended slot only after watermark processing',async()=>{
 const f=fixture();const result=await f.handler(request);
 assert.deepEqual(f.events,['clean','detach','persist']);
 assert.deepEqual(structuredClone(f.state.flowReferences.filter(r=>r.id==='common'||r.id==='other')),[f.existing[0],f.existing[2]]);
 const image=f.state.flowReferences.find(r=>r.id==='generated-id');
 assert.equal(image.role,'end_frame');assert.equal(image.sceneId,3);assert.equal(image.source.actualSeconds,2.333);assert.equal(image.source.watermarkRemoved,true);
 assert.equal(f.state.flowReferences.some(r=>r.id==='old'),false);assert.match(result.frameNotice,/xóa watermark/);
});
test('failed cleanup leaves old image untouched and stale target projects are rejected',async()=>{
 const f=fixture(true);await assert.rejects(f.handler(request),/Cleanup failed/);
 assert.deepEqual(f.state.flowReferences,f.existing);assert.deepEqual(f.events,['clean']);
 const stale=fixture();await assert.rejects(stale.handler({...request,targetProjectId:'other-project'}),/đã thay đổi/);
 assert.deepEqual(stale.events,[]);assert.deepEqual(stale.state.flowReferences,stale.existing);
});
