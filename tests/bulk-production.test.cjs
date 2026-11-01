const{test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const{validateBulkInput,sampleInput}=require('../src/bulk-input.cjs');
const{BulkRunner}=require('../src/bulk-runner.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-bulk-'));t.after(()=>{if(path.dirname(path.resolve(root))!==path.resolve(os.tmpdir())||!path.basename(root).startsWith('studio-bulk-'))throw Error('Invalid cleanup directory');fs.rmSync(root,{recursive:true,force:true});});return root;}
function input(root){const image=path.join(root,'lead.png');fs.writeFileSync(image,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64'));const raw=sampleInput();raw.projects=[raw.projects[0]];raw.projects[0].referenceImages[0].path='./lead.png';return raw;}
const profile=(id,amount=100,enabled=true,ready=true)=>({id,name:id,enabled,ready,balance:{amount}});
function plan(root,count=3){return {ok:true,outputDirectory:path.join(root,'output'),jobs:Array.from({length:count},(_,i)=>({id:'job-'+i,project:{title:'Project '+i},templateName:'Review',references:[],options:{}}))};}
function output(item){fs.mkdirSync(item.directory,{recursive:true});const file=path.join(item.directory,'result.mp4');fs.writeFileSync(file,'fake-verified-runtime-output');return {output:{file}};}
test('JSON sample resolves image paths and latest template settings, including per-genre voices',t=>{
 const root=fixture(t),raw=input(root),production=require('../src/script-presets.js').scriptPresets.profile();production.character='Latest saved character';
 const result=validateBulkInput(raw,{baseDirectory:root,savedTemplates:[{id:'gara-review',name:'Review updated',direction:'review',instructions:'Latest formula',production}]});
 assert.equal(result.ok,true);assert.equal(result.jobs[0].project.production.character,'Latest saved character');assert.equal(result.jobs[0].references[0].path,fs.realpathSync(path.join(root,'lead.png')));assert.equal(result.outputDirectory,path.join(root,'bulk-output'));assert.equal(result.policy.maxRetries,2);
});
test('duration imports accept numeric seconds, quoted seconds, unit suffixes and Auto',t=>{
 const root=fixture(t);
 for(const value of [6,8,10,'6','8','10','6s','8s','10s',' 8S ','8 giây','auto','Auto',' AUTO ']){
  const raw=input(root);raw.projects[0].sceneDuration=value;
  const result=validateBulkInput(raw,{baseDirectory:root});assert.equal(result.ok,true,JSON.stringify(value)+': '+result.errors.join('; '));
  assert.ok([6,8,10,'auto'].includes(result.jobs[0].project.sceneDuration));assert.equal(raw.projects[0].sceneDuration,value);
 }
 for(const value of [4,7,'7s','8.5s','8seconds','8s garbage',null,false]){
  const raw=input(root);raw.projects[0].sceneDuration=value;const result=validateBulkInput(raw,{baseDirectory:root});assert.equal(result.ok,false);assert.match(result.errors[0],/sceneDuration/);
 }
});
test('invalid import reports errors across projects without accepting a partial run',t=>{
 const root=fixture(t),raw=input(root);raw.projects.push({...raw.projects[0],templateId:'missing'});raw.projects[0].referenceImages[0].path='./missing.png';
 const result=validateBulkInput(raw,{baseDirectory:root});assert.equal(result.ok,false);assert.equal(result.errors.length,2);assert.equal(fs.existsSync(path.join(root,'bulk-output')),false);
});
test('missing setup, duplicate IDs, unknown presets and image roles are rejected',t=>{
 const root=fixture(t);for(const mutate of [r=>delete r.projects[0].brief,r=>r.projects[0].referenceImages=[],r=>r.projects[0].referenceImages[0].role='invalid',r=>r.projects[0].id='../escape',r=>r.projects[0].ratio='1:1',r=>r.projects[0].templateId='unknown']){const raw=input(root);mutate(raw);assert.equal(validateBulkInput(raw,{baseDirectory:root}).ok,false);}
});
test('Windows device names and case-only duplicate project folders are rejected before running',t=>{
 const root=fixture(t),raw=input(root);raw.projects[0].id='CON';assert.equal(validateBulkInput(raw,{baseDirectory:root}).ok,false);
 const duplicate=input(root);duplicate.projects.push({...duplicate.projects[0],id:duplicate.projects[0].id.toUpperCase()});assert.equal(validateBulkInput(duplicate,{baseDirectory:root}).ok,false);
});
test('every eligible profile runs concurrently, using live balances and no disabled profiles',async t=>{
 const root=fixture(t),profiles=[profile('a',5),profile('b'),profile('low'),profile('disabled',1000,false),profile('not-ready',1000,true,false)],probed=[],leases=[];let active=0,max=0;
 const runner=new BulkRunner({root,getProfiles:()=>profiles,probe:async p=>{probed.push(p.id);return p.id==='low'?99:100;},retryDelayMs:0,createRuntime:async({item,profile:p})=>({reconcile:async()=>{},run:async()=>{active++;max=Math.max(max,active);leases.push([item.id,p.id]);await new Promise(r=>setTimeout(r,15));active--;return output(item);},close:async()=>{}})});
 runner.start(plan(root,5));await runner.completion;assert.equal(max,2);assert.equal(runner.run.status,'completed');assert.equal(runner.run.items.every(i=>i.status==='completed'),true);assert.ok(!probed.includes('disabled'));assert.ok(!probed.includes('not-ready'));assert.ok(leases.every(([,id])=>['a','b'].includes(id)));assert.equal(fs.readdirSync(runner.run.successDirectory).length,5);
});
test('project failure reconciles twice then skips to the next project',async t=>{
 const root=fixture(t);let failures=0,reconciles=0;
 const runner=new BulkRunner({root,getProfiles:()=>[profile('a')],probe:async()=>150,retryDelayMs:0,createRuntime:async({item})=>({reconcile:async()=>{if(item.id==='job-0')reconciles++;},run:async()=>{if(item.id==='job-0'){failures++;throw Error('generation error');}return output(item);},close:async()=>{}})});
 runner.start(plan(root,2));await runner.completion;assert.equal(failures,3);assert.equal(reconciles,2);assert.equal(runner.run.items[0].status,'failed');assert.equal(runner.run.items[1].status,'completed');assert.equal(runner.run.status,'completed_with_errors');assert.equal(fs.readdirSync(runner.run.successDirectory).length,1);assert.equal(runner.run.events.filter(e=>e.attempt).length,3);
});
test('runtime startup errors also receive only two retries',async t=>{
 const root=fixture(t);let calls=0;const runner=new BulkRunner({root,getProfiles:()=>[profile('a')],probe:async()=>150,retryDelayMs:0,createRuntime:async()=>{calls++;throw Error('startup');}});
 runner.start(plan(root,1));await runner.completion;assert.equal(calls,3);assert.equal(runner.run.items[0].status,'failed');assert.equal(runner.busy,false);
});
test('pause finishes assigned projects but does not lease another project',async t=>{
 const root=fixture(t);let runner,release;const gate=new Promise(r=>release=r);
 runner=new BulkRunner({root,getProfiles:()=>[profile('a')],probe:async()=>100,retryDelayMs:0,createRuntime:async({item})=>({reconcile:async()=>{},run:async()=>{runner.pause();await gate;return output(item);},close:async()=>{}})});
 runner.start(plan(root,2));release();await runner.completion;assert.equal(runner.run.status,'paused');assert.equal(runner.run.items[0].status,'completed');assert.equal(runner.run.items[1].status,'queued');assert.equal(runner.busy,false);
});
test('profile dropping below 100 cannot claim a second project',async t=>{
 const root=fixture(t);let reads=0;const runner=new BulkRunner({root,getProfiles:()=>[profile('a')],probe:async()=>++reads===1?100:99,retryDelayMs:0,createRuntime:async({item})=>({reconcile:async()=>{},run:async()=>output(item),close:async()=>{}})});
 runner.start(plan(root,2));await runner.completion;assert.equal(runner.run.items[0].status,'completed');assert.equal(runner.run.items[1].status,'queued');assert.equal(runner.run.status,'paused');
});
test('no eligible live profile leaves the queue untouched and recoverable',async t=>{
 const root=fixture(t);const runner=new BulkRunner({root,getProfiles:()=>[profile('a')],probe:async()=>99,createRuntime:async()=>{throw Error('Must not create');}});
 runner.start(plan(root,1));await runner.completion;assert.equal(runner.run.status,'paused');assert.equal(runner.run.items[0].status,'queued');assert.match(runner.run.error,/100/);
});
test('restart preserves original profile ownership for interrupted paid work',async t=>{
 const root=fixture(t),p=plan(root,1),profiles=[profile('a'),profile('b')];let leased;
 const runner=new BulkRunner({root,getProfiles:()=>profiles,probe:async()=>100,createRuntime:async()=>{throw Error('unused');}});
 runner.run={id:'run-1',directory:path.join(root,'run-1'),outputDirectory:p.outputDirectory,successDirectory:path.join(root,'success'),status:'running',items:[{...p.jobs[0],directory:path.join(root,'job-0'),status:'running',profileId:'a',attempt:1}],profiles:[],events:[]};fs.mkdirSync(runner.run.directory);runner.save();
 const restored=new BulkRunner({root,getProfiles:()=>[profiles[1]],probe:async()=>100,createRuntime:async()=>{leased=true;throw Error('Wrong owner');}});
 assert.equal(restored.run.items[0].status,'interrupted');restored.resume();await restored.completion;assert.equal(leased,undefined);assert.equal(restored.run.status,'paused');assert.equal(restored.run.items[0].profileId,'a');
});
test('template snapshots survive restart while status payloads exclude large template contents',async t=>{
 const root=fixture(t),p=plan(root,1);p.jobs[0].project.production={character:'Frozen original character',geminiPrompt:'Saved formula'};
 const runner=new BulkRunner({root,getProfiles:()=>[profile('a')],probe:async()=>99,createRuntime:async()=>{throw Error('No eligible profile');}});
 runner.start(p);await runner.completion;assert.equal(runner.snapshot().run.items[0].project.production,undefined);
 const restored=new BulkRunner({root,getProfiles:()=>[profile('a')],probe:async()=>100,retryDelayMs:0,createRuntime:async({item})=>{assert.equal(item.project.production.character,'Frozen original character');return {run:async()=>output(item),reconcile:async()=>{},close:async()=>{}};}});
 assert.equal(restored.run.items[0].project.production.character,'Frozen original character');restored.resume();await restored.completion;assert.equal(restored.run.status,'completed');
});
test('skipping an active project preserves the queue and lets its profile take the next one',async t=>{
 const root=fixture(t);let signal,release,stops=0;const started=new Promise(r=>signal=r),gate=new Promise(r=>release=r);
 const runner=new BulkRunner({root,getProfiles:()=>[profile('a')],probe:async()=>100,retryDelayMs:0,createRuntime:async({item})=>({run:async()=>{if(item.id==='job-0'){signal();await gate;}return output(item);},stop:async()=>{stops++;release();},reconcile:async()=>{},close:async()=>{}})});
 runner.start(plan(root,2));await started;await runner.skip('job-0');await runner.completion;assert.equal(stops,1);assert.equal(runner.run.items[0].status,'skipped');assert.equal(runner.run.items[1].status,'completed');assert.equal(fs.readdirSync(runner.run.successDirectory).length,1);
});
