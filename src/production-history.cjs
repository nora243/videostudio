function productionHistory(batches,current,projectId,storyboard){
 const map=new Map(batches.filter(b=>b.projectId===projectId).map(b=>[b.id,b]));if(current)map.set(current.id,current);
 const ordered=[...map.values()].sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')||a.id.localeCompare(b.id));
 if(current){const index=ordered.findIndex(b=>b.id===current.id);if(index>=0)ordered.push(...ordered.splice(index,1));}
 const scenes=new Map(),takes=new Map();for(const batch of ordered)for(const job of batch.jobs||[]){takes.set(job.sceneId,(takes.get(job.sceneId)||0)+1);const index=storyboard?.scenes?.findIndex(s=>s.id===job.sceneId)??-1,original=batch.storyboardSnapshot?.scenes?.findIndex(s=>s.id===job.sceneId)??-1;scenes.set(job.sceneId,{...job,batchId:batch.id,projectId,projectUrl:job.projectUrl||batch.projectUrl,position:index>=0?index+1:original>=0?original+1:job.sceneId});}
 const jobs=[...scenes.values()].map(j=>({...j,takeCount:takes.get(j.sceneId)})).sort((a,b)=>a.position-b.position||a.sceneId-b.sceneId);
 return{jobs,spent:ordered.reduce((sum,b)=>sum+(Number(b.spent)||0),0),batches:ordered.length};
}
module.exports={productionHistory};
