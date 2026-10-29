const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{AsyncLocalStorage}=require('node:async_hooks');
const clean=value=>String(value??'').replace(/\x1b\[[0-9;]*m/g,'').slice(0,40000);
class ActivityLog{
 constructor(root,{maxBytes=5*1024*1024,maxEntries=2000,onEntry=()=>{}}={}){
  this.directory=path.join(root,'logs');this.file=path.join(this.directory,'activity.jsonl');this.previous=path.join(this.directory,'activity.previous.jsonl');this.maxBytes=maxBytes;this.maxEntries=maxEntries;this.onEntry=onEntry;this.context=new AsyncLocalStorage();this.entries=[];
  fs.mkdirSync(this.directory,{recursive:true});
  for(const file of [this.previous,this.file]){try{for(const line of fs.readFileSync(file,'utf8').split('\n')){try{const entry=JSON.parse(line);if(entry.id&&entry.time&&entry.message)this.entries.push(entry);}catch{}}}catch{}}
  this.entries=this.entries.slice(-maxEntries);this.bytes=fs.existsSync(this.file)?fs.statSync(this.file).size:0;
 }
 run(context,fn){return this.context.run({...context,operationId:randomUUID()},fn);}
 write(level,message,fields={}){
  const ctx=this.context.getStore()||{};
  const entry={...ctx,...fields,id:randomUUID(),time:new Date().toISOString(),level:['info','warning','error'].includes(level)?level:'info',message:clean(message)};
  if(entry.stack)entry.stack=clean(entry.stack);this.entries.push(entry);this.entries=this.entries.slice(-this.maxEntries);
  try{const line=JSON.stringify(entry)+'\n',size=Buffer.byteLength(line);if(this.bytes&&this.bytes+size>this.maxBytes){fs.renameSync(this.file,this.previous);this.bytes=0;}fs.appendFileSync(this.file,line);this.bytes+=size;this.storageError=null;}catch(error){this.storageError=error.message;}
  try{this.onEntry(entry);}catch{}return entry;
 }
 stage(stage,message,fields={}){const ctx=this.context.getStore();if(ctx)ctx.stage=stage;return this.write('info',message,{...fields,stage});}
 error(error,fields={}){return this.write('error',error?.message||String(error),{...fields,stack:error?.stack||String(error)});}
 list({limit=500,projectId,level,search}={}){const q=clean(search).toLowerCase();return this.entries.filter(e=>(!projectId||!e.projectId||e.projectId===projectId)&&(!level||e.level===level)&&(!q||JSON.stringify(e).toLowerCase().includes(q))).slice(-Math.min(this.maxEntries,Math.max(1,Number(limit)||500)));}
}
module.exports={ActivityLog};
