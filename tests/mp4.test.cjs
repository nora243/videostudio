const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {inspectMp4}=require('../src/mp4.cjs');
test('rejects a non-video download even if it has an mp4 extension',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'video-mp4-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'invalid.mp4');fs.writeFileSync(file,'<html>'.repeat(500));
 assert.throws(()=>inspectMp4(file),/MP4/);
});

test('large assembled movies read metadata without loading the encoded payload',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'video-large-mp4-')),file=path.join(dir,'large.mp4');t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const box=(type,data)=>{const h=Buffer.alloc(8);h.writeUInt32BE(data.length+8);h.write(type,4);return Buffer.concat([h,data]);},mvhd=Buffer.alloc(100),tkhd=Buffer.alloc(84);mvhd.writeUInt32BE(1000,12);mvhd.writeUInt32BE(400000,16);tkhd.writeUInt32BE(1920*65536,76);tkhd.writeUInt32BE(1080*65536,80);const meta=Buffer.concat([box('ftyp',Buffer.alloc(16)),box('moov',Buffer.concat([box('mvhd',mvhd),box('trak',box('tkhd',tkhd))]))]),payload=513*1024*1024,header=Buffer.alloc(8);header.writeUInt32BE(payload);header.write('mdat',4);const fd=fs.openSync(file,'w');try{fs.writeSync(fd,meta);fs.writeSync(fd,header);fs.ftruncateSync(fd,meta.length+payload);}finally{fs.closeSync(fd);}assert.throws(()=>inspectMp4(file),/giới hạn/);const result=inspectMp4(file,{maxBytes:Infinity});assert.equal(result.width,1920);assert.equal(result.height,1080);assert.equal(result.duration,400);assert.ok(result.size>512*1024*1024);
});
