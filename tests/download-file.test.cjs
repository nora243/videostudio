const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {beginDownload}=require('../src/download-file.cjs');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-download-'));
 const session=new EventEmitter();let options;
 session.send=async(method,args)=>{assert.equal(method,'Browser.setDownloadBehavior');options=args;};
 session.detach=async()=>{};
 return {root,session,page:{context:()=>({newCDPSession:async()=>session})},options:()=>options};
}
test('saves Chrome GUID file independently of missing Playwright artifact and keeps destination valid',async()=>{
 const f=fixture(),target=path.join(f.root,'scene.mp4');let transfer;
 try{
  transfer=await beginDownload(f.page,target);const directory=f.options().downloadPath;
  assert.equal(f.options().behavior,'allowAndName');
  f.session.emit('Browser.downloadWillBegin',{guid:'unrelated',url:'https://example.com/other'});
  f.session.emit('Browser.downloadProgress',{guid:'unrelated',state:'completed'});
  fs.writeFileSync(path.join(directory,'video-guid'),'video bytes');
  f.session.emit('Browser.downloadWillBegin',{guid:'video-guid',url:'https://example.com/video'});
  f.session.emit('Browser.downloadProgress',{guid:'video-guid',state:'completed'});
  await transfer.save({url:()=> 'https://example.com/video',saveAs:()=>{throw Error('missing artifact');}});
  assert.equal(fs.readFileSync(target,'utf8'),'video bytes');
  await transfer.close();assert.ok(fs.existsSync(directory));
  assert.equal(f.session.listenerCount('Browser.downloadProgress'),0);
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('canceled browser download does not overwrite a saved video',async()=>{
 const f=fixture(),target=path.join(f.root,'scene.mp4');let transfer;
 try{
  fs.writeFileSync(target,'original');transfer=await beginDownload(f.page,target);
  f.session.emit('Browser.downloadWillBegin',{guid:'failed',url:'https://example.com/video'});
  f.session.emit('Browser.downloadProgress',{guid:'failed',state:'canceled'});
  await assert.rejects(transfer.save({url:()=> 'https://example.com/video'}),/Chrome/);
  assert.equal(fs.readFileSync(target,'utf8'),'original');
 }finally{await transfer?.close();fs.rmSync(f.root,{recursive:true,force:true});}
});
