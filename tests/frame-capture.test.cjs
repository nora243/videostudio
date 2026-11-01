const {test}=require('node:test'),assert=require('node:assert/strict');
const {listFrameSources,resolveFrameSource}=require('../src/frame-capture.cjs');
function fixture(){
 const version={id:'batch:job',batchId:'batch',jobId:'job',available:true,status:'downloaded',metadata:{width:720,height:1280,duration:8},quality:'720p'};
 const library={list:()=>({projects:[{id:'project',name:'Test',scenes:[{id:1,versions:[{...version,status:'failed'}]},{id:3,versions:[version,{...version,id:'missing',available:false}]}]}]}),readProject:()=>({storyboard:{scenes:[{id:3},{id:1}]}}),findVersion:(projectId,batchId,jobId)=>({file:'/safe/video.mp4',version})};
 return {library,version};
}
test('frame picker lists only completed available videos and respects storyboard order',()=>{
 const {library}=fixture(),sources=listFrameSources(library);
 assert.equal(sources.length,1);assert.equal(sources[0].sceneId,3);assert.equal(sources[0].scenePosition,1);
 assert.equal(sources[0].uri,'studio-media://video/project/batch/job');
 assert.equal(sources[0].metadata.width,720);
});
test('frame source resolves through safe library identities and rejects invalid time or missing video',()=>{
 const {library}=fixture(),request={sourceProjectId:'project',batchId:'batch',jobId:'job',selection:'time',seconds:3.25};
 assert.equal(resolveFrameSource(library,request).file,'/safe/video.mp4');
 for(const selection of ['first','last'])assert.equal(resolveFrameSource(library,{...request,selection,seconds:0}).selection,undefined);
 assert.throws(()=>resolveFrameSource(library,{...request,seconds:-1}),/không hợp lệ/);
 assert.throws(()=>resolveFrameSource(library,{...request,seconds:Infinity}),/không hợp lệ/);
 assert.throws(()=>resolveFrameSource(library,{...request,seconds:20}),/vượt thời lượng/);
 assert.throws(()=>resolveFrameSource(library,{...request,jobId:'foreign'}),/không còn trong thư viện/);
 assert.throws(()=>resolveFrameSource(library,{...request,selection:'anything'}),/không hợp lệ/);
});
