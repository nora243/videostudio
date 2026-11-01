(()=>{
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const labels={script:'Kịch bản Gemini',videos:'Tạo cảnh Flow',upscale:'Tải 1080p',cleanup:'Xóa watermark',merge:'Ghép thành phẩm'};
 const states={disabled:'Chưa bật',not_ready:'Chưa sẵn sàng',queued:'Chờ profile',running:'Đang chạy',checking:'Kiểm tra profile',reconciling:'Đối soát',retrying:'Chờ thử lại',interrupted:'Gián đoạn',failed:'Lỗi sau các lượt thử',skipped:'Đã bỏ qua',completed:'Hoàn tất',completed_with_errors:'Hoàn tất, có dự án lỗi',paused:'Đã dừng',pausing:'Đang dừng sau dự án',cancelled:'Đã kết thúc',eligible:'Sẵn sàng',insufficient:'Dưới 100 tín dụng',error:'Lỗi kết nối',idle:'Đã xong lượt'};
 const dialog=make('dialog',undefined,'studio-dialog bulk-dialog');dialog.id='bulk-dialog';
 dialog.innerHTML='<div class="dialog-heading"><div><div class="eyebrow">SẢN XUẤT NHIỀU DỰ ÁN</div><h2>Sản xuất hàng loạt theo profile</h2></div><button class="quiet-button" data-bulk="close">Đóng ✕</button></div><p class="production-help">Một dự án/profile cùng lúc. Chỉ profile đã bật, sẵn sàng và được đọc lại số dư ≥ 100 nhận dự án. Lỗi sẽ đối soát và thử tiếp tối đa 2 lượt, rồi chuyển dự án khác.</p><div class="bulk-toolbar"><button class="secondary" data-bulk="sample">Tải file JSON mẫu</button><button class="secondary" data-bulk="import">Nhập & kiểm tra file</button><button data-bulk="start" disabled>Chạy lô đã kiểm tra</button><button class="secondary" data-bulk="resume" hidden>Tiếp tục lô</button><button class="secondary" data-bulk="pause" hidden>Dừng sau dự án</button><button class="quiet-button" data-bulk="cancel" hidden>Kết thúc lô</button></div><p data-bulk="feedback" role="status" class="bulk-feedback"></p><div data-bulk="validation" class="bulk-validation" hidden></div><div data-bulk="summary" class="bulk-summary"></div><div data-bulk="profiles" class="bulk-profiles"></div><div class="bulk-table-scroll"><table class="queue-table"><thead><tr><th>Dự án / mẫu</th><th>Profile</th><th>Bước / tiến độ</th><th>Trạng thái / lượt</th><th>Thao tác</th></tr></thead><tbody data-bulk="rows"></tbody></table></div><div class="bulk-bottom"><section><h3>Chi tiết dự án</h3><div data-bulk="detail">Chọn một dự án để xem các cảnh và lỗi.</div></section><section><div class="bulk-log-head"><h3>Nhật ký theo thời gian</h3><button class="text-button" data-bulk="logs">Xuất toàn bộ log</button></div><pre data-bulk="events" class="bulk-events"></pre></section></div><div class="bulk-toolbar"><button class="secondary" data-bulk="folder">Mở thư mục lô</button><button class="secondary" data-bulk="success">Mở tất cả thành phẩm</button><span data-bulk="output" class="bulk-output"></span></div>';
 document.body.append(dialog);const $=id=>dialog.querySelector(`[data-bulk="${id}"]`);let plan=null,data=null,working=false,polling=false,selected=null,pageIndex=0;
 const catalog=make('details',undefined,'bulk-catalog');catalog.append(make('summary','Mã các mẫu kịch bản hiện có'));const catalogBody=make('div');catalog.append(catalogBody);$('validation').before(catalog);
 const listControls=make('div',undefined,'bulk-list-controls'),search=make('input'),filter=make('select'),previous=make('button','←','secondary'),next=make('button','→','secondary'),pageLabel=make('span');
 search.type='search';search.placeholder='Tìm tên hoặc mã dự án…';search.setAttribute('aria-label','Tìm dự án trong lô');filter.setAttribute('aria-label','Lọc trạng thái dự án');
 for(const [value,title]of [['all','Tất cả trạng thái'],['queued','Chờ / gián đoạn'],['active','Đang xử lý'],['completed','Thành công'],['failed','Lỗi / bỏ qua']]){const option=make('option',title);option.value=value;filter.append(option);}
 previous.setAttribute('aria-label','Trang dự án trước');next.setAttribute('aria-label','Trang dự án sau');listControls.append(search,filter,previous,pageLabel,next);dialog.querySelector('.bulk-table-scroll').before(listControls);
 search.oninput=filter.onchange=()=>{pageIndex=0;render();};previous.onclick=()=>{pageIndex--;render();};next.onclick=()=>{pageIndex++;render();};
 const buttons=[];
 for(const selector of ['#script-section .screen-head-actions','#flow-section .studio-page-head']){const host=document.querySelector(selector);if(!host)continue;const b=make('button','Sản xuất hàng loạt','secondary');host.append(b);b.onclick=()=>{dialog.showModal();void refresh();};buttons.push(b);}
 function templates(){try{const p=JSON.parse(localStorage.getItem('script-presets-v1')||'[]');return Array.isArray(p)?p:[];}catch{return [];}}
 async function api(promise){const r=await promise;if(!r.ok)throw Error(r.error);return r.data;}
 async function action(fn){if(working)return;working=true;render();try{await fn();}catch(e){$('feedback').textContent=e.message;}finally{working=false;await refresh();}}
 function render(){
  const run=data?.run,busy=data?.busy,items=plan?.jobs||run?.items||[];
  const query=search.value.trim().toLocaleLowerCase('vi'),filtered=items.filter(i=>(!query||(i.id+' '+i.project.title).toLocaleLowerCase('vi').includes(query))&&(filter.value==='all'||filter.value==='active'&&['running','reconciling','retrying'].includes(i.status)||filter.value==='queued'&&[undefined,'queued','interrupted'].includes(i.status)||filter.value==='completed'&&i.status==='completed'||filter.value==='failed'&&['failed','skipped'].includes(i.status))),pages=Math.max(1,Math.ceil(filtered.length/50));
  pageIndex=Math.max(0,Math.min(pageIndex,pages-1));pageLabel.textContent=`${pageIndex+1}/${pages} · ${filtered.length} dự án`;previous.disabled=pageIndex===0;next.disabled=pageIndex===pages-1;
  const presets=new Map([...(window.scriptPresets?.presets||[]),...templates()].map(p=>[p.id,p]));catalogBody.replaceChildren(...[...presets.values()].map(p=>make('p',p.id+' — '+p.name)));
  $('start').disabled=working||busy||!plan?.ok||!!run&&['paused','running','checking','pausing'].includes(run.status)&&run.items.some(i=>['queued','interrupted','running'].includes(i.status));
  for(const name of ['sample','import'])$(name).disabled=working||busy;
  $('resume').hidden=!run||busy||!run.items.some(i=>['queued','interrupted'].includes(i.status));$('resume').disabled=working;
  $('pause').hidden=!busy;$('pause').disabled=working||run?.pauseRequested;
  $('cancel').hidden=!run||busy||['completed','completed_with_errors','cancelled'].includes(run.status);
  $('summary').textContent=plan?`${plan.jobs.length} dự án trong file mới · ${plan.ok?'Đã kiểm tra dữ liệu':'Chưa hợp lệ'}. Số dư profile sẽ được đọc lại trước khi nhận dự án.`:run?`${states[run.status]||run.status} · ${run.items.filter(i=>i.status==='completed').length}/${run.items.length} thành phẩm · ${run.items.filter(i=>['running','reconciling','retrying'].includes(i.status)).length} dự án đang xử lý · ${run.items.filter(i=>['failed','skipped'].includes(i.status)).length} lỗi/bỏ qua`:'Chọn file JSON để kiểm tra trước khi chạy.';
  if(run?.error)$('summary').append(make('p',run.error,'bulk-error'));
  if(plan&&run&&['paused','running','checking','pausing'].includes(run.status)&&run.items.some(i=>['queued','interrupted','running'].includes(i.status)))$('summary').append(make('p','Còn lô cũ đang dở. Tiếp tục lô cũ hoặc Kết thúc lô trước khi chạy file mới.','bulk-error'));
  $('profiles').replaceChildren();for(const p of run?.profiles||[]){const balance=p.balance!==undefined?(p.status==='error'&&!p.checkedAt?' · số dư đã lưu: ':' · ')+p.balance+' tín dụng':p.cachedBalance!==undefined?' · số dư đã lưu: '+p.cachedBalance+' (chưa xác minh)':'';const chip=make('div',`${p.name}: ${states[p.status]||p.status}${balance}${p.itemId?' · '+p.itemId:''}`,'bulk-profile');if(p.error)chip.append(make('small',p.error));$('profiles').append(chip);}
  const scrollHost=dialog.querySelector('.bulk-table-scroll'),scrollTop=scrollHost.scrollTop;$('rows').replaceChildren();for(const item of filtered.slice(pageIndex*50,(pageIndex+1)*50)){
   const row=make('tr');if(item.id===selected)row.className='is-active';row.tabIndex=0;
   const title=make('td');title.append(make('strong',item.project.title),make('small',`${item.id} · ${item.templateName}`));
   const progress=make('td');progress.append(make('span',labels[item.stage]||'Chưa chạy'));const meter=make('progress');meter.max=5;meter.value=item.done?.length||0;meter.setAttribute('aria-label','Số bước đã xong');progress.append(meter,make('small',item.detail||`${item.done?.length||0}/5 bước · ${item.spent||0} tín dụng đã dùng/dự trù`));
   const state=make('td',states[item.status]||'Đã kiểm tra');state.append(make('small',item.attempt?`Lượt ${item.attempt}/3`:'Chưa gửi'));if(item.error)state.append(make('small',item.error,'bulk-error'));
   const actions=make('td');if(run&&!plan){const folder=make('button','Thư mục','text-button');folder.onclick=e=>{e.stopPropagation();void action(()=>api(window.studio.bulkFolder({itemId:item.id})));};actions.append(folder);if(!['completed','failed','skipped'].includes(item.status)){const skip=make('button','Bỏ qua','text-button');skip.onclick=e=>{e.stopPropagation();void action(async()=>{data=await api(window.studio.bulkSkip(item.id));});};actions.append(skip);}}
   if(['cleanup','merge'].includes(item.stage))progress.append(make('small',`Hậu kỳ: ${Math.round((item.postProgress||0)*100)}%`));
   if(item.scenes?.length)progress.append(make('small',`${item.scenes.filter(s=>s.status==='downloaded').length}/${item.scenes.length} cảnh đã tải`));
   row.append(title,make('td',item.profileName||'Tự phân bổ'),progress,state,actions);const select=()=>{selected=item.id;for(const tr of $('rows').children)tr.classList.toggle('is-active',tr===row);renderDetail();};row.onclick=select;row.onkeydown=e=>{if(e.key==='Enter')select();};$('rows').append(row);
  }
  scrollHost.scrollTop=scrollTop;
  $('output').textContent=plan?.outputDirectory||run?.outputDirectory||'';
  for(const b of buttons)b.textContent=busy?'Hàng loạt · đang chạy':'Sản xuất hàng loạt';renderDetail();
 }
 function renderDetail(){
  const run=plan?null:data?.run,item=(plan?.jobs||run?.items||[]).find(i=>i.id===selected);$('detail').replaceChildren();
  if(item){$('detail').append(make('strong',item.project.title),make('p',`Mẫu: ${item.templateName} · ${item.project.ratio} · ${item.project.scenes} cảnh · ${item.project.sceneDuration} giây/cảnh`),make('p',item.project.brief));if(item.flowProjectUrl)$('detail').append(make('p','Flow: '+item.flowProjectUrl));
   for(const image of item.references||[])$('detail').append(make('small',image.role+': '+image.path));
   for(const s of item.scenes||[])$('detail').append(make('p',`Cảnh ${s.sceneId}: ${s.status}${s.upscale?' · 1080p: '+s.upscale:''}${s.error?' · '+s.error:''}`));
   for(const warning of item.warnings||[])$('detail').append(make('p',warning,'bulk-error'));
  }else $('detail').textContent='Chọn một dự án để xem các cảnh và lỗi.';
  $('events').textContent=(run?.events||[]).filter(e=>!selected||!e.itemId||e.itemId===selected).slice(-150).map(e=>`${new Date(e.time).toLocaleTimeString('vi-VN')} [${e.level}] ${e.itemId||e.profileId||''} ${e.stage||''}: ${e.message}`).join('\n');
 }
 $('close').onclick=()=>dialog.close();
 $('sample').onclick=()=>action(async()=>{const r=await api(window.studio.bulkSample());if(!r.cancelled)$('feedback').textContent='Đã lưu mẫu: '+r.file;});
 $('import').onclick=()=>action(async()=>{const previousPlan=plan;plan=null;selected=null;const result=await api(window.studio.bulkImport({templates:templates()}));if(result.cancelled){plan=previousPlan;return;}plan=result;selected=null;pageIndex=0;search.value="";filter.value="all";$('validation').hidden=false;$('validation').replaceChildren(make('strong',result.ok?`File hợp lệ: ${result.jobs.length} dự án.`:'Chưa thể chạy; sửa các mục sau:'));for(const error of result.errors)$('validation').append(make('p',error,'bulk-error'));if(result.ok){$('validation').append(make('p',`Đầu ra: ${result.outputDirectory}`),make('p',result.jobs.map(j=>j.id+' · '+j.project.title+' · '+j.templateName).join('\n')));}$('feedback').textContent='Đã kiểm tra '+result.file;});
 $('start').onclick=()=>action(async()=>{data=await api(window.studio.bulkStart({templates:templates()}));plan=null;selected=null;pageIndex=0;search.value="";filter.value="all";$('feedback').textContent='Đang đọc lại số dư và kiểm tra đăng nhập từng profile. Chưa nhận dự án nếu dưới 100 tín dụng.';});
 $('resume').onclick=()=>action(async()=>{data=await api(window.studio.bulkResume());plan=null;});
 $('pause').onclick=()=>action(async()=>{data=await api(window.studio.bulkPause());$('feedback').textContent='Không nhận thêm dự án; các dự án đang chạy sẽ hoàn tất trước khi dừng.';});
 $('cancel').onclick=()=>action(async()=>{data=await api(window.studio.bulkCancel());});
 $('folder').onclick=()=>action(()=>api(window.studio.bulkFolder({})));
 $('success').onclick=()=>action(()=>api(window.studio.bulkFolder({success:true})));
 $('logs').onclick=()=>action(()=>api(window.studio.bulkLogsExport()));
 async function refresh(){if(polling)return;polling=true;try{data=await api(window.studio.bulkStatus());render();}catch(e){$('feedback').textContent=e.message;}finally{polling=false;}}
 setInterval(()=>{if(!working&&(dialog.open||data?.busy))void refresh();},1000);void refresh();
})();
