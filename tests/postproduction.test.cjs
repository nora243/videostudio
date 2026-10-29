const{test}=require('node:test'),assert=require('node:assert/strict');
const{planProject}=require('../src/postproduction.cjs');
const project={id:'p',scenes:[{id:1,preferredId:'old',versions:[{id:'old',available:true,batchId:'b',jobId:'j'}]},{id:7,preferredId:'new',versions:[{id:'new',available:true,batchId:'c',jobId:'k'}]},{id:9,versions:[]}]};
const library={list:()=>({projects:[project]}),readProject:()=>({storyboard:{scenes:[{id:7},{id:1},{id:9}]}}),findVersion:(p,b,j)=>({file:`${b}/${j}.mp4`,version:{metadata:{width:1920,height:1080}}})};
test('postproduction follows selected order and resolves preferred version through library highest rendition',()=>{assert.deepEqual(planProject(library,'p',[7,1]).map(c=>[c.sceneId,c.file]),[[7,'c/k.mp4'],[1,'b/j.mp4']]);});
test('postproduction requires available media for each selected scene',()=>{assert.throws(()=>planProject(library,'p'),/9/);assert.equal(planProject(library,'p',[1]).length,1);});
test('postproduction rejects unknown projects, duplicate and foreign scene ids',()=>{for(const ids of [[],[1,1],[3]])assert.throws(()=>planProject(library,'p',ids));assert.throws(()=>planProject(library,'other',[1]));});
