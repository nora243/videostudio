const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PostProduction,planProject}=require('../src/postproduction.cjs');
const {inspectMp4}=require('../src/mp4.cjs');
(async()=>{
 const root=path.resolve('.test-runtime/postproduction-'+Date.now());fs.mkdirSync(root,{recursive:true});
 const source=path.resolve('E:/Projects/gemini-watermark-remover/src/assets/video-samples/20260615.mp4'),file=path.join(root,'source.mp4');fs.copyFileSync(source,file);const metadata=inspectMp4(file),hash=()=>require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash();
 const project={id:'sample',scenes:[{id:2,preferredId:'v2',versions:[{id:'v2',available:true,batchId:'b',jobId:'j2'}]},{id:1,preferredId:'v1',versions:[{id:'v1',available:true,batchId:'b',jobId:'j1'}]}]};
 const library={list:()=>({projects:[project]}),readProject:()=>({storyboard:{scenes:[{id:2},{id:1}]}}),findVersion:()=>({file,version:{metadata}})};
 assert.deepEqual(planProject(library,'sample').map(c=>c.sceneId),[2,1]);assert.throws(()=>planProject(library,'sample',[1,1]));
 const runner=new PostProduction({root,library,executable:()=> 'C:/Program Files/Google/Chrome/Application/chrome.exe',log:console.log});
 for(const mode of ['merge','clean-merge']){
  runner.start({projectId:'sample',mode});while(runner.busy)await new Promise(r=>setTimeout(r,500));console.log(mode,runner.job.status,runner.job.error||'',runner.job.outputs);assert.equal(runner.job.status,'completed');assert.equal(runner.job.outputs[0].metadata.width,metadata.width);assert.ok(Math.abs(runner.job.outputs[0].metadata.duration-metadata.duration*2)<.3);assert.equal(hash(),before);
 }
 console.log('PASS real video cleanup + merge, source preservation, timeline order. Evidence:',root);
})().catch(e=>{console.error(e);process.exitCode=1;});
