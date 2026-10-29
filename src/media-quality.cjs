const fs=require('node:fs'),path=require('node:path');
const resolution=metadata=>Math.min(Number(metadata?.width)||0,Number(metadata?.height)||0);
function availableMedia(job,root){
 const items=[{file:job.file,metadata:job.metadata||{},quality:job.configuration?.resolution||'original',downloadedAt:job.downloadedAt},...Object.entries(job.renditions||{}).map(([quality,value])=>({...value,quality}))];
 const seen=new Set();return items.filter(item=>{try{if(!item.file||seen.has(item.file))return false;const file=fs.realpathSync(item.file);if(root){const relative=path.relative(fs.realpathSync(root),file);if(!relative||relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))return false;}const stat=fs.statSync(file);if(!stat.isFile()||!stat.size||path.extname(file).toLowerCase()!=='.mp4')return false;item.file=file;item.size=stat.size;seen.add(file);return true;}catch{return false;}}).sort((a,b)=>resolution(b.metadata)-resolution(a.metadata));
}
const bestMedia=(job,root)=>availableMedia(job,root)[0]||null;
function inspect1080(file,job){const metadata=require('./mp4.cjs').inspectMp4(file),duration=job.metadata?.duration||job.configuration?.duration||job.scene?.duration_seconds;
 if(resolution(metadata)!==1080||!duration||Math.abs(metadata.duration-duration)>1)throw Error('File tải về không đúng 1080p/thời lượng. Bản gốc được giữ nguyên; file kiểm tra chưa được dùng cho hậu kỳ.');
 const original=job.metadata;if(original?.width&&original?.height&&Math.abs(metadata.width/metadata.height-original.width/original.height)>.03)throw Error('Bản 1080p có tỷ lệ khung hình khác bản gốc.');return metadata;
}
module.exports={resolution,availableMedia,bestMedia,inspect1080};
