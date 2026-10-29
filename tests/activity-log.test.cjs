const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');const {ActivityLog}=require('../src/activity-log.cjs');
function fixture(t,options){const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-logs-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return{root,log:new ActivityLog(root,options)};}
test('logs persist full error with correlation, latest step and project context',async t=>{
 const emitted=[],{root,log}=fixture(t,{onEntry:e=>emitted.push(e)});
 await log.run({action:'flow-prepare',projectId:'project-a',sceneId:4},async()=>{log.stage('flow.reference.attach','Nhấn Thêm vào câu lệnh');await Promise.resolve();log.error(Error('\x1b[2mlocator.click: Timeout 3000ms exceeded.\x1b[22m'));});
 const entries=new ActivityLog(root).list();assert.equal(entries.length,2);assert.equal(entries[1].stage,'flow.reference.attach');assert.equal(entries[1].sceneId,4);assert.equal(entries[1].operationId,entries[0].operationId);assert.equal(entries[1].message,'locator.click: Timeout 3000ms exceeded.');assert.match(entries[1].stack,/Error:.*locator.click/);assert.equal(emitted.length,2);
 assert.equal(log.list({level:'error',search:'Timeout',projectId:'project-a'}).length,1);assert.equal(log.list({projectId:'project-b'}).length,0);
});
test('rotates bounded files, tolerates incomplete final line and keeps recent events',t=>{
 const {root,log}=fixture(t,{maxBytes:1000,maxEntries:4});for(let i=0;i<15;i++)log.write('info','Event '+i+' '+'.'.repeat(120));assert.equal(log.list().length,4);assert.ok(fs.existsSync(log.previous));fs.appendFileSync(log.file,'{"incomplete":');const restored=new ActivityLog(root);assert.ok(restored.list().some(e=>e.message.startsWith('Event 14')));assert.ok(fs.statSync(log.file).size<1100);
});
test('disk write failure does not interrupt production and remains visible for diagnostics',t=>{
 const {log}=fixture(t);log.file=log.directory;assert.doesNotThrow(()=>log.write('error','Test error'));assert.ok(log.storageError);assert.equal(log.list()[0].message,'Test error');
});
