const fs=require('node:fs'),path=require('node:path');const{bestMedia,resolution}=require('./media-quality.cjs');
function pipelineSteps({state,root,library,getRunner,ensureFlow,openGemini,generateScript,recoverScript,upscaler,postproduction,persist}){
 const currentBatch=job=>{let batch=state.flowBatch?.pipelineId===job.id?state.flowBatch:library.manifests().find(b=>b.pipelineId===job.id&&b.projectId===job.projectId);if(!batch)throw Error('Không tìm thấy hàng đợi của quy trình.');state.flowBatch=batch;return batch;};
 const batchClips=job=>{const batch=currentBatch(job);return job.sceneIds.map(sceneId=>{const video=batch.jobs.find(j=>j.sceneId===sceneId),media=video&&bestMedia(video,root);if(video?.status!=='downloaded'||!media)throw Error(`Cảnh ${sceneId} chưa có file video hợp lệ.`);return{sceneId,file:library.safeFile(media.file),version:{metadata:media.metadata}};});};
 const highClips=job=>{const clips=batchClips(job);if(clips.some(c=>resolution(c.version.metadata)<1080))throw Error('Còn cảnh chưa có bản 1080p. Chưa bắt đầu hậu kỳ.');return clips;};
 async function post(job,save,mode,clips,key){let cached;
  if(job[key])try{cached=JSON.parse(fs.readFileSync(path.join(root,'projects',job.projectId,'postproduction',job[key],'manifest.json'),'utf8'));}catch{}
  if(!cached&&postproduction.job?.pipelineId===job.id&&postproduction.job.mode===mode)cached=postproduction.job;
  if(cached?.status==='completed'&&cached.outputs.length===(mode==='clean'?clips.length:1)&&cached.outputs.every(o=>fs.existsSync(o.file))){job[key]=cached.id;save();return cached;}
  const result=postproduction.start({projectId:job.projectId,pipelineId:job.id,mode},clips);job[key]=result.id;save();await postproduction.completion;
  if(result.status!=='completed')throw Error(result.error||'Hậu kỳ đã dừng trước khi hoàn tất.');return result;
 }
 return {
 async script(job,save){
  let existing=state.geminiJob?.pipelineId===job.id?state.geminiJob:null;
  if(existing?.status!=='completed'){
   const page=await openGemini(existing);
   if(existing?.baseline)await recoverScript();
   else{if(existing?.prompt){const input=await require('./gemini.cjs').waitForGeminiInput(page);if((await input.innerText()).trim()===existing.prompt.trim())await input.fill('');}await generateScript({...job.input.project,pipelineId:job.id});}
  }
  existing=state.geminiJob;if(existing?.pipelineId!==job.id||existing.status!=='completed'||state.storyboard?.requestId!==existing.id)throw Error(existing?.error||'Gemini chưa trả kịch bản hợp lệ. Đăng nhập/kiểm tra phản hồi rồi bấm Tiếp tục.');
  job.sceneIds=state.storyboard.scenes.map(s=>s.id);job.storyboard=structuredClone(state.storyboard);save();return{requestId:existing.id,scenes:job.sceneIds.length};
 },
 async videos(job,save){
  let batch=state.flowBatch?.pipelineId===job.id?state.flowBatch:library.manifests().find(b=>b.pipelineId===job.id&&b.projectId===job.projectId);
  if(!batch){await ensureFlow();state.storyboard=structuredClone(job.storyboard);batch=getRunner().create(job.sceneIds,job.input.options,{pipelineId:job.id,references:job.input.references});}
  state.flowBatch=batch;job.batchId=batch.id;save();
  for(const item of batch.jobs)if(item.status==='preparing'&&!item.submittedAt)item.status='queued';
  if(batch.jobs.some(j=>['needs_review','submitting','generating','generated','downloading','download_failed'].includes(j.status))){await getRunner().run(true);if(batch.jobs.some(j=>!['downloaded','queued','failed'].includes(j.status)))throw Error(batch.error||'Có cảnh đã gửi chưa rõ kết quả. Kiểm tra Flow rồi bấm Tiếp tục để đối soát.');}
  if(job.pauseRequested)throw Error('Đã tạm dừng quy trình.');
  if(batch.jobs.some(j=>j.status!=='downloaded'))await getRunner().run();
  if(batch.jobs.some(j=>j.status!=='downloaded'))throw Error(batch.error||'Chưa tạo xong mọi cảnh. Kiểm tra Flow và bấm Tiếp tục.');
  batchClips(job);persist();return{batchId:batch.id,scenes:batch.jobs.length};
 },
 async upscale(job,save){const batch=currentBatch(job);
  for(const [index,sceneId]of job.sceneIds.entries()){
   if(job.pauseRequested)throw Error('Đã tạm dừng trước cảnh upscale tiếp theo.');const video=batch.jobs.find(j=>j.sceneId===sceneId);if(resolution(bestMedia(video,root)?.metadata)>=1080)continue;
   job.detail=`1080p · cảnh ${index+1}/${job.sceneIds.length}`;save();upscaler.start({projectId:job.projectId,sceneId,batchId:batch.id,jobId:video.id});await upscaler.run();
   if(resolution(bestMedia(video,root)?.metadata)<1080)throw Error(upscaler.queue.items.find(i=>i.error)?.error||`Cảnh ${sceneId} chưa có bản 1080p. Bấm Tiếp tục để thử lại bước tải này.`);
  }highClips(job);delete job.detail;return{scenes:job.sceneIds.length,resolution:'1080p'};
 },
 async cleanup(job,save){const result=await post(job,save,'clean',highClips(job),'cleanJobId');return{jobId:result.id,outputs:result.outputs,warnings:result.warnings};},
 async merge(job,save){const outputs=job.results.cleanup.outputs;if(outputs.length!==job.sceneIds.length)throw Error('Thiếu cảnh đã xóa watermark.');const clips=outputs.map((o,i)=>({sceneId:job.sceneIds[i],file:library.safeFile(o.file),version:{metadata:o.metadata}}));const result=await post(job,save,'merge',clips,'mergeJobId');job.output=result.outputs[0];return{jobId:result.id,output:job.output,warnings:result.warnings};}
 };
}
module.exports={pipelineSteps};
