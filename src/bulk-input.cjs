const fs=require('node:fs'),path=require('node:path');
const {validateProject}=require('./storyboard.cjs');
const {ROLES}=require('./references.cjs');
const {scriptPresets}=require('./script-presets.js');
const MIN_CREDITS=100;
const TEMPLATE_IDS=['gara-review','gara-comedy','cat-family'];
function normalizeSceneDuration(value){
 let result=value;
 if(typeof value==='string'){
  const token=value.trim().toLowerCase();
  if(token==='auto')result='auto';
  else if(/^(6|8|10)\s*(?:s|giây)?$/u.test(token))result=Number(token.match(/^\d+/)[0]);
 }
 if(![6,8,10,'auto'].includes(result))throw Error('sceneDuration phải là 6, 8, 10 hoặc "auto". Cũng chấp nhận chuỗi "8", "8s" (tương tự 6s, 10s).');
 return result;
}
function templateCatalog(saved=[]){
 const map=new Map(scriptPresets.presets.map(p=>[p.id,{...p,production:p.production||{...scriptPresets.profile(),direction:p.direction,instructions:p.instructions}}]));
 for(const p of saved){if(p&&typeof p.id==='string'&&p.production)map.set(p.id,p);}
 return map;
}
function imageFile(file){
 if(!fs.statSync(file).isFile())throw Error('Không phải file ảnh.');
 const fd=fs.openSync(file,'r'),head=Buffer.alloc(16);try{fs.readSync(fd,head,0,16,0);}finally{fs.closeSync(fd);}
 if(!(head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||head[0]===255&&head[1]===216&&head[2]===255||head.toString('ascii',0,4)==='RIFF'&&head.toString('ascii',8,12)==='WEBP'))throw Error('Ảnh phải là PNG, JPG hoặc WebP hợp lệ.');
 if(fs.statSync(file).size>30*1024*1024)throw Error('Ảnh vượt 30 MB.');
 return fs.realpathSync(file);
}
function validateBulkInput(raw,{baseDirectory,savedTemplates=[]}={}){
 const errors=[],jobs=[],catalog=templateCatalog(savedTemplates),base=path.resolve(baseDirectory||'.');
 if(!raw||raw.version!==1||!Array.isArray(raw.projects)||!raw.projects.length||raw.projects.length>5000)return {ok:false,errors:['File phải có version: 1 và projects gồm 1–5000 dự án.'],jobs:[]};
 let outputDirectory;
 if(typeof raw.outputDirectory!=='string'||!raw.outputDirectory.trim())errors.push('Thiếu outputDirectory.');
 else{
  outputDirectory=path.resolve(base,raw.outputDirectory);
  try{let parent=outputDirectory;while(!fs.existsSync(parent)){const next=path.dirname(parent);if(next===parent)throw Error('Không tìm thấy thư mục cha.');parent=next;}if(!fs.statSync(parent).isDirectory())throw Error('Đường dẫn không phải thư mục.');fs.accessSync(parent,fs.constants.W_OK);}catch(e){errors.push('outputDirectory: '+e.message);}
 }
 const ids=new Set();
 for(const [index,input]of raw.projects.entries()){
  const prefix=`Dự án ${index+1}${input?.id?' ('+input.id+')':''}: `;
  try{
   if(!input||typeof input.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(input.id)||['__proto__','constructor','prototype'].includes(input.id))throw Error('id phải gồm chữ không dấu, số, dấu gạch, tối đa 80 ký tự.');
   if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(input.id))throw Error('id trùng tên thiết bị dành riêng của Windows.');
   if(ids.has(input.id.toLowerCase()))throw Error('id bị trùng (không phân biệt hoa/thường).');ids.add(input.id.toLowerCase());
   if(typeof input.title!=='string'||!input.title.trim())throw Error('Thiếu title.');
   const preset=catalog.get(input.templateId);if(!preset)throw Error('Không tìm thấy mẫu templateId: '+input.templateId);
   for(const field of ['brief','style','ratio','scenes','sceneDuration'])if(input[field]===undefined||input[field]==='')throw Error('Thiếu '+field+'.');
   const production=structuredClone(preset.production);production.templateId=preset.id;production.direction=preset.direction;production.instructions=preset.instructions;
   const project=validateProject({...input,sceneDuration:normalizeSceneDuration(input.sceneDuration),production});
   if(project.production.audioMode==='external'&&(project.production.narration||project.production.dialogue))throw Error('Mẫu yêu cầu lồng tiếng hậu kỳ riêng. Hàng loạt hiện cần âm thanh native để ra thành phẩm đầy đủ tự động.');
   if(!['9:16','16:9'].includes(project.ratio))throw Error('Flow cần ratio 9:16 hoặc 16:9.');
   const resolution=input.resolution||'720p';if(!['360p','720p'].includes(resolution))throw Error('resolution phải là 360p hoặc 720p.');
   if(!Array.isArray(input.referenceImages)||!input.referenceImages.length)throw Error('Thiếu referenceImages: cần ít nhất một ảnh tham chiếu chung.');
   const references=input.referenceImages.map((r,i)=>{
    if(!r||!ROLES[r.role]||typeof r.path!=='string'||!r.path.trim())throw Error(`Ảnh ${i+1}: thiếu path hoặc role không hợp lệ.`);
    const file=imageFile(path.resolve(base,r.path));return {path:file,role:r.role,description:String(r.description||'').slice(0,5000)};
   });
   for(const s of project.production.speakers)if(s.imagePath)s.imagePath=imageFile(path.resolve(base,s.imagePath));
   jobs.push({id:input.id,project,options:{ratio:project.ratio,resolution},references,templateName:preset.name});
  }catch(e){errors.push(prefix+e.message);}
 }
 return {ok:!errors.length,errors,jobs,outputDirectory,policy:{minCredits:MIN_CREDITS,maxRetries:2,finalResolution:'1080p',stages:['script','videos','upscale','cleanup','merge']}};
}
function sampleInput(){return {version:1,outputDirectory:'./bulk-output',projects:[
 {id:'review-bom-xang',title:'Đợi đèn xăng sáng mới đổ?',brief:'Giải thích dễ hiểu về bơm xăng, thói quen sử dụng và cách chăm sóc xe; ví dụ thực tế trong gara.',templateId:'gara-review',style:'Dân dã, đời thường — tự quay bằng điện thoại',ratio:'9:16',scenes:'auto',sceneDuration:'auto',resolution:'720p',referenceImages:[{path:'./images/em-gai-gara.png',role:'female_lead',description:'Ảnh toàn thân quy định trang phục; chân dung quy định khuôn mặt và kiểu tóc.'}]},
 {id:'nha-meo-tivi',title:'Tranh nhau xem tivi',brief:'Cả nhà mèo tranh điều khiển tivi; Út Ngáo gây một hiểu lầm vui, kết thúc ấm áp.',templateId:'cat-family',style:'Dân dã, đời thường — tự quay bằng điện thoại',ratio:'9:16',scenes:6,sceneDuration:8,resolution:'720p',referenceImages:[{path:'./images/gia-dinh-meo.png',role:'character_group',description:'Năm hàng: Bố Bự, Mẹ Mướp, Tí Hổ, Chị Na, Út Ngáo.'}]}
 ]};}
module.exports={validateBulkInput,sampleInput,templateCatalog,imageFile,normalizeSceneDuration,MIN_CREDITS,TEMPLATE_IDS};
