const{test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const{BulkRuntime,buildBulkScriptPrompt}=require('../src/bulk-runtime.cjs');
const{scriptPresets}=require('../src/script-presets.js');
function fixture(t){const base=fs.mkdtempSync(path.join(os.tmpdir(),'studio-bulk-runtime-'));t.after(()=>{if(path.dirname(path.resolve(base))!==path.resolve(os.tmpdir())||!path.basename(base).startsWith('studio-bulk-runtime-'))throw Error('Invalid test path');fs.rmSync(base,{recursive:true,force:true});});return base;}
function mp4(file,width=1080,height=1920){const box=(type,payload)=>{const h=Buffer.alloc(8);h.writeUInt32BE(8+payload.length);h.write(type,4);return Buffer.concat([h,payload]);},mvhd=Buffer.alloc(100),tkhd=Buffer.alloc(84);mvhd.writeUInt32BE(1000,12);mvhd.writeUInt32BE(8000,16);tkhd.writeUInt32BE(width*65536,76);tkhd.writeUInt32BE(height*65536,80);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.concat([box('ftyp',Buffer.alloc(16)),box('moov',Buffer.concat([box('mvhd',mvhd),box('trak',box('tkhd',tkhd))])),box('mdat',Buffer.alloc(2048))]));}
function runtime(root,report=()=>{},portrait){const project={title:'Review',brief:'Episode',style:'Everyday',ratio:'9:16',scenes:1,sceneDuration:8,production:scriptPresets.profile()};if(portrait)project.production.speakers[0].imagePath=portrait;return new BulkRuntime({root,item:{id:'test',project,options:{resolution:'720p',ratio:'9:16'},references:[]},profile:{id:'a'},browser:{contexts:()=>[]},executable:()=>null,recordBalance:()=>{},report,log:()=>{}});}
test('isolated runtime must execute all five stages before accepting final 1080p output',async t=>{
 const root=fixture(t),reports=[],r=runtime(root,x=>reports.push(x)),calls=[];
 try{for(const stage of ['script','videos','upscale','cleanup','merge'])r.pipeline.steps[stage]=async job=>{calls.push(stage);if(stage==='merge'){const file=path.join(root,'projects',r.state.activeProjectId,'final.mp4');mp4(file);job.output={file};}return {};};
 const result=await r.run();assert.deepEqual(calls,['script','videos','upscale','cleanup','merge']);assert.equal(result.output.metadata.width,1080);assert.equal(reports.at(-1).done.length,5);
 }finally{await r.close();}
});
test('retry resumes from failed stage without regenerating completed stages',async t=>{
 const root=fixture(t),r=runtime(root),calls=[];let first=true;
 try{for(const stage of ['script','videos','upscale','cleanup','merge'])r.pipeline.steps[stage]=async job=>{calls.push(stage);if(stage==='upscale'&&first){first=false;throw Error('temporary upscale failure');}if(stage==='merge'){const file=path.join(root,'projects',r.state.activeProjectId,'final.mp4');mp4(file);job.output={file};}return {};};
 await assert.rejects(r.run(),/temporary upscale failure/);await r.reconcile();await r.run();assert.deepEqual(calls,['script','videos','upscale','upscale','cleanup','merge']);
 }finally{await r.close();}
});
test('a 720p file is never accepted as a completed final output',async t=>{
 const root=fixture(t),r=runtime(root);
 try{const file=path.join(root,'projects',r.state.activeProjectId,'final.mp4');mp4(file,720,1280);r.state.productionPipeline={id:'done',projectId:r.state.activeProjectId,status:'completed',done:['script','videos','upscale','cleanup','merge'],output:{file},results:{cleanup:{},merge:{}}};await assert.rejects(r.run(),/1080p/);}finally{await r.close();}
});
test('two runtime workspaces have separate project IDs, state and managed portrait copies',async t=>{
 const root=fixture(t),portrait=path.join(root,'portrait.png');fs.writeFileSync(portrait,'test-image');const a=runtime(path.join(root,'a'),()=>{},portrait),b=runtime(path.join(root,'b'),()=>{},portrait);
 try{a.state.project.production.character='Only A';a.persist();assert.notEqual(a.state.activeProjectId,b.state.activeProjectId);assert.notEqual(b.state.project.production.character,'Only A');assert.notEqual(a.file,b.file);assert.ok(fs.existsSync(a.file)&&fs.existsSync(b.file));const ar=a.state.flowReferences.find(r=>r.managedPortrait),br=b.state.flowReferences.find(r=>r.managedPortrait);assert.notEqual(ar.path,br.path);assert.notEqual(ar.path,portrait);ar.assetId='only-a';assert.equal(br.assetId,undefined);}finally{await a.close();await b.close();}
});
test('current episode is explicit even when a saved custom prompt contains another topic',()=>{
 const p={title:'Current title',brief:'Current idea',style:'Everyday',ratio:'9:16',scenes:3,production:{...scriptPresets.profile(),geminiPrompt:'An older episode example'}};
 const prompt=buildBulkScriptPrompt(p,'marker-1');assert.match(prompt,/CURRENT EPISODE:.*Current idea/);assert.match(prompt,/overrides any example topic/);assert.match(prompt,/Request marker: marker-1/);
});
