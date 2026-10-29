const {references,orderedReferences}=require('./references.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

class FlowRunner {
  constructor({ state, persist, getPage, getAdapter, root, log=()=>{}, getSubmissionPage, switchForCredits, recordBalance }) {
    Object.assign(this, { state, persist, getPage, getAdapter, root, log, getSubmissionPage, switchForCredits, recordBalance }); this.busy = false;
    const batch = state.flowBatch;
    if (batch?.status === 'running') {
      batch.status = 'paused';
      for (const job of batch.jobs) if (['submitting', 'generating', 'downloading'].includes(job.status)) {
        job.status = job.assetId ? 'generated' : 'needs_review'; job.error = 'Ứng dụng vừa khởi động lại. Bấm Đối soát; không gửi lại cảnh.';
      } else if (job.status === 'preparing') job.status = 'queued';
      this.save();
    }
  }
  save() {
    this.persist();
    if (this.state.flowBatch) {
      const directory = path.join(this.root, 'batches', this.state.flowBatch.id); fs.mkdirSync(directory, { recursive:true });
      const target = path.join(directory,'manifest.json'), temp = target + '.tmp';
      fs.writeFileSync(temp, JSON.stringify(this.state.flowBatch,null,2)); fs.renameSync(temp,target);
    }
  }
  create(sceneIds, options, context={}) {
    if (this.busy) throw new Error('Hàng đợi Flow đang chạy.');
    if (this.state.flowBatch?.jobs.some(j => !['downloaded','cancelled'].includes(j.status))) throw new Error('Hàng đợi cũ chưa hoàn tất. Hãy tiếp tục/đối soát hoặc kết thúc hàng đợi cũ trước.');
    const adapter = this.getAdapter(); options = adapter.validateOptions(options);
    options.references=structuredClone(context.references||orderedReferences(references(this.state)));
    options.reference=null;
    if (!this.state.flowProject?.url) throw new Error('Hãy gắn dự án Flow trước.');
    if (!Array.isArray(sceneIds) || !sceneIds.length || new Set(sceneIds).size !== sceneIds.length) throw new Error('Chọn ít nhất một cảnh, không trùng.');
    const scenes = sceneIds.map(id => this.state.storyboard?.scenes.find(scene=>scene.id===id));
    for (const scene of scenes) adapter.compilePrompt(scene);
    const batch = { id:randomUUID(), projectId:this.state.activeProjectId||null,projectSnapshot:structuredClone(this.state.project||{}),storyboardSnapshot:structuredClone(this.state.storyboard),title:this.state.storyboard.title, createdAt:new Date().toISOString(), projectUrl:this.state.flowProject.url, options, spent:0, status:'paused', jobs:scenes.map(scene=>({ id:randomUUID(), sceneId:scene.id, scene:structuredClone(scene), status:'queued', projectUrl:this.state.flowProject.url })) };
    if(context.pipelineId)batch.pipelineId=context.pipelineId;
    if(this.state.activeBrowserProfileId)batch.profileId=this.state.activeBrowserProfileId;
    this.state.flowBatch = batch; this.save(); return batch;
  }
  pause() { if (this.state.flowBatch) { this.state.flowBatch.pauseRequested = true; this.save(); } }
  skip(id){
    if(this.busy)throw new Error('Hãy tạm dừng và chờ cảnh hiện tại hoàn tất.');
    const job=this.state.flowBatch?.jobs.find(j=>j.id===id);
    if(!job||!['failed','needs_review','download_failed','queued'].includes(job.status))throw new Error('Không thể bỏ qua tác vụ này.');
    job.status='cancelled';job.error='Đã bỏ qua trong tool; không hủy tác vụ trên Flow. Tín dụng dự trù vẫn được giữ.';this.save();
  }
  finish() {
    if (this.busy) throw new Error('Hãy tạm dừng và chờ cảnh đang chạy hoàn tất.');
    const batch = this.state.flowBatch; if (!batch) return;
    if (batch.jobs.some(j=>['submitting','generating','needs_review'].includes(j.status))) throw new Error('Còn tác vụ chưa xác định kết quả. Hãy đối soát trước khi kết thúc.');
    for (const job of batch.jobs) if (job.status === 'queued' || job.status === 'failed') job.status = 'cancelled';
    batch.status = 'finished'; this.save();
  }
  async run(recover = false) {
    if (this.busy) throw new Error('Hàng đợi Flow đang chạy.');
    const batch = this.state.flowBatch; if (!batch) throw new Error('Chưa có hàng đợi Flow.');
    if (!recover && batch.jobs.some(j=>['needs_review','submitting','generating','generated','downloading','download_failed'].includes(j.status))) throw new Error('Có tác vụ đã gửi. Bấm Đối soát / tải lại để tiếp tục, không gửi lại.');
    this.busy = true; batch.status = 'running'; batch.pauseRequested = false; delete batch.error; this.save();
    const log=(level,message,fields={})=>this.log(level,message,{action:'flow-runner',projectId:batch.projectId,batchId:batch.id,...fields});
    log('info',recover?'Bắt đầu đối soát hàng đợi':'Bắt đầu chạy hàng đợi',{stage:'queue.start'});
    try {
      const adapter = this.getAdapter();let page;
      for (const job of batch.jobs) {
        if (batch.pauseRequested) break;
        if (['downloaded','cancelled'].includes(job.status)) continue;
        if(recover&&['queued','failed'].includes(job.status))continue;
        let stage='flow.balance';const report=(step,message)=>{stage=step;log('info',message,{stage,sceneId:job.sceneId,jobId:job.id});};
        try {
          if(this.getSubmissionPage&&!recover&&['queued','failed'].includes(job.status))page=await this.getSubmissionPage(job);
          else page=await this.getPage(job.projectUrl||batch.projectUrl,job.profileId||batch.profileId);
          if (job.status === 'queued' || job.status === 'failed') {
            // Recovery is read/download only. It never starts a queued scene.
            if (recover) continue;
            job.status = 'preparing'; delete job.error; this.save();
            report('flow.balance','Đọc số dư tín dụng trước khi chuẩn bị cảnh');
            let credits = await adapter.balance(page);this.recordBalance?.(credits);
            this.state.flowBalance = { amount:credits, readAt:new Date().toISOString(), source:'Flow · giao diện trình duyệt' };
            let prepared = await adapter.prepare(page,job.scene,batch.options,this.state.flowPrepared?.prompt || '',report);
            const tried=new Set([this.state.activeBrowserProfileId]);
            while(prepared.cost>credits&&this.switchForCredits&&!batch.pauseRequested){
              report('flow.profile.switch','Tín dụng không đủ; tìm profile tiếp theo đã đăng nhập');
              const switched=await this.switchForCredits({cost:prepared.cost,exclude:[...tried],job,report});if(!switched)break;
              if(tried.has(switched.profileId))throw Error('Profile chuyển đổi bị lặp. Đã tạm dừng.');tried.add(switched.profileId);page=switched.page;credits=switched.credits;
              prepared=await adapter.prepare(page,job.scene,batch.options,'',report);
            }
            if(batch.pauseRequested)throw Error('Đã yêu cầu tạm dừng trước khi gửi cảnh.');
            Object.assign(job,prepared); this.state.flowPrepared = { ...prepared, sceneId:job.sceneId };
            if (prepared.cost > credits) throw new Error('Số dư tín dụng Flow không đủ cho cảnh tiếp theo. Dừng trước khi gửi.');
            if(this.getSubmissionPage){job.profileId=this.state.activeBrowserProfileId;job.projectUrl=this.state.flowProject.url;}
            // Budget reserves uncertain submissions too, even after a crash.
            batch.spent += prepared.cost; job.reserved = prepared.cost;
            report('flow.submit',`Gửi tạo video; dự trù ${prepared.cost} tín dụng`);
            await adapter.submit(page,job,()=>this.save());
          }
          report('flow.collect','Chờ và xác định kết quả video trên Flow');
          // An explicit recovery gets a fresh bounded read window, while retaining
          // the submission identity and retry count so it cannot create a duplicate.
          if(recover){job.generationWaitStartedAt=new Date().toISOString();this.save();}
          await adapter.collect(page,job,()=>this.save(),undefined,report);
          const folder=batch.projectId?path.join(this.root,'projects',batch.projectId,'videos',batch.id):path.join(this.root,'batches',batch.id);
          const file = path.join(folder,`scene-${String(job.sceneId).padStart(3,'0')}-${job.id}.mp4`);
          report('flow.download','Tải và kiểm tra file video');await adapter.download(page,job,file,()=>this.save());
          report('flow.download.done','Video đã tải và kiểm tra xong');
          try {
            const credits = await adapter.balance(page);
            this.recordBalance?.(credits,job.profileId);
            this.state.flowBalance = { amount:credits, readAt:new Date().toISOString(), source:'Flow · giao diện trình duyệt' };
          } catch (error) { log('warning',`Video đã tải; chưa đọc lại được tín dụng: ${error.message}`,{stage:'flow.balance.refresh',sceneId:job.sceneId,jobId:job.id,stack:error.stack}); }
          this.save();
        } catch (error) {
          if (!job.submittedAt && job.reserved) { batch.spent -= job.reserved; delete job.reserved; }
          job.error = error.message;
          job.status = job.assetId ? 'download_failed' : job.submittedAt ? 'needs_review' : 'failed';
          batch.error = `Cảnh ${job.sceneId}: ${error.message}`;log('error',error.message,{stage,sceneId:job.sceneId,jobId:job.id,status:job.status,stack:error.stack}); this.save(); break;
        }
      }
      batch.status = batch.jobs.every(j=>['downloaded','cancelled'].includes(j.status)) ? 'completed' : 'paused';
    } catch (error) { batch.status='paused'; batch.error=error.message;log('error',error.message,{stage:'queue.open',stack:error.stack}); }
    finally { this.busy=false; this.save();log('info',batch.status==='completed'?'Hàng đợi hoàn tất':'Hàng đợi đã dừng / tạm dừng',{stage:'queue.stop',status:batch.status}); }
    return batch;
  }
}
module.exports = { FlowRunner };
