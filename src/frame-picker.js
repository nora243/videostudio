(() => {
const $=id=>document.getElementById(id);
const sourceDialog=document.createElement('dialog');sourceDialog.id='reference-source-dialog';sourceDialog.className='studio-dialog reference-source-dialog';
sourceDialog.innerHTML='<div class="dialog-heading"><h2>Chọn nguồn ảnh</h2><button id="reference-source-close" class="quiet-button">Đóng ✕</button></div><div class="reference-source-options"><button id="reference-source-computer">Chọn ảnh từ máy tính</button><button id="reference-source-video" class="secondary">Tách khung hình từ video đã tạo</button></div><p>Khung hình tách từ video sẽ tự động được kiểm tra và xóa watermark trước khi gắn vào cảnh.</p>';
const dialog=document.createElement('dialog');dialog.id='frame-picker-dialog';dialog.className='studio-dialog frame-picker-dialog';
dialog.innerHTML='<div class="dialog-heading"><h2>Chọn khung hình từ video</h2><button id="frame-picker-close" class="quiet-button">Đóng ✕</button></div><div class="frame-picker-body"><div class="frame-picker-selects"><label>Dự án nguồn<select id="frame-picker-project" aria-label="Dự án nguồn"></select></label><label>Video đã tạo thành công<select id="frame-picker-source" aria-label="Video nguồn"></select></label></div><video id="frame-picker-preview" muted playsinline preload="metadata" aria-label="Xem trước khung hình được chọn"></video><label>Vị trí khung hình<input id="frame-picker-seek" type="range" min="0" max="0" value="0" step="0.001" aria-label="Chọn khung hình"></label><div class="frame-picker-quick"><button id="frame-picker-first" class="secondary">Khung hình đầu</button><button id="frame-picker-last" class="secondary">Khung hình cuối</button><span id="frame-picker-time"></span></div></div><div class="frame-picker-footer"><p id="frame-picker-feedback" role="status" aria-live="polite"></p><button id="frame-picker-use" disabled>Tách ảnh, xóa watermark & sử dụng</button></div>';
document.querySelector('main').append(sourceDialog,dialog);
const video=$('frame-picker-preview'),seek=$('frame-picker-seek');
let target=null,callbacks=null,sources=[],selected=null,selection='first',selectedSeconds=0,processing=false,ready=false,loading=false,revision=0;
const message=(text,error=false)=>{const node=$('frame-picker-feedback');node.textContent=text;node.dataset.error=String(error);node.setAttribute('role',error?'alert':'status');};
const time=value=>(Number(value)||0).toFixed(3)+'s';
function controls(){
 for(const id of ['frame-picker-project','frame-picker-source','frame-picker-close'])$(id).disabled=processing||loading;
 for(const id of ['frame-picker-first','frame-picker-last','frame-picker-seek'])$(id).disabled=processing||loading||!selected||!Number.isFinite(video.duration);
 $('frame-picker-use').disabled=processing||loading||!selected||!ready;
 $('frame-picker-use').textContent=processing?'Đang tách ảnh và xóa watermark…':'Tách ảnh, xóa watermark & sử dụng';
 $('frame-picker-time').textContent=selected?`${time(selectedSeconds)} / ${time(video.duration||selected.metadata?.duration)}${selection==='last'?' · Khung cuối':selection==='first'?' · Khung đầu':''}`:'';
}
function previewReady(){ready=video.readyState>=2&&!video.seeking&&Boolean(selected);controls();}
function seekTo(seconds,kind='time'){
 if(!selected||processing||!Number.isFinite(video.duration))return;
 video.pause();selection=kind;selectedSeconds=Math.max(0,Math.min(seconds,Math.max(0,video.duration-.001)));
 seek.value=selectedSeconds;ready=false;video.currentTime=selectedSeconds;previewReady();
 message('Xem trước khung hình đã chọn. Khi sử dụng, ảnh sẽ được xử lý watermark và lưu thành PNG.');
}
function loadSource(){
 const current=++revision;video.pause();ready=false;selection='first';selectedSeconds=0;
 selected=sources.find(s=>s.versionId===$('frame-picker-source').value&&s.projectId===$('frame-picker-project').value)||null;
 if(!selected){video.removeAttribute('src');video.load();message('Chưa có video tạo thành công và đã tải về trong dự án này.');controls();return;}
 video.onloadedmetadata=()=>{if(current!==revision)return;seek.max=video.duration;seek.value=0;seekTo(0,'first');};
 video.onloadeddata=()=>{if(current===revision)previewReady();};video.onseeked=()=>{if(current===revision)previewReady();};
 video.onerror=()=>{if(current!==revision)return;ready=false;message('Không đọc được video nguồn. Hãy chọn video khác hoặc kiểm tra file đã tải.',true);controls();};
 video.src=selected.uri;video.load();message('Đang tải video xem trước…');controls();
}
function renderSources(){
 const list=sources.filter(s=>s.projectId===$('frame-picker-project').value);$('frame-picker-source').replaceChildren();
 for(const [index,source]of list.entries()){
  const option=document.createElement('option');option.value=source.versionId;option.textContent=`Cảnh ${source.scenePosition} · ${source.metadata?.width||'?'}×${source.metadata?.height||'?'} · ${time(source.metadata?.duration)} · ${source.quality||'gốc'} · bản ${index+1}`;$('frame-picker-source').append(option);
 }
 loadSource();
}
async function openVideo(){
 sourceDialog.close();dialog.showModal();loading=true;ready=false;selected=null;message('Đang đọc danh sách video đã tải…');controls();
 try{
  const result=await window.studio.frameSources();if(!result.ok)throw Error(result.error);sources=result.data;
  $('frame-picker-project').replaceChildren();
  const projects=[...new Map(sources.map(s=>[s.projectId,s.projectName])).entries()];
  for(const [id,name]of projects){const option=document.createElement('option');option.value=id;option.textContent=name;$('frame-picker-project').append(option);}
  if(projects.some(([id])=>id===target.targetProjectId))$('frame-picker-project').value=target.targetProjectId;
  renderSources();
 }catch(error){message(error.message,true);}
 finally{loading=false;controls();}
}
async function useFrame(){
 if(processing||!selected||!ready)return;
 const source=selected,request={...target,sourceProjectId:source.projectId,batchId:source.batchId,jobId:source.jobId,selection,seconds:selectedSeconds};
 processing=true;video.pause();message('Đang tách khung hình đúng độ phân giải gốc và tự động xóa watermark. Video nguồn được giữ nguyên.');controls();
 try{
  const result=await window.studio.flowReferenceFrame(request);if(!result.ok)throw Error(result.error);
  const fresh=await window.studio.status(),data=fresh.ok?fresh.data:result.data;
  callbacks?.onApplied(data);dialog.close();video.removeAttribute('src');video.load();
  window.workspaceUI.notify(result.data.frameNotice||'Đã gắn ảnh khung hình vào cảnh.');
 }catch(error){message(error.message,true);}
 finally{processing=false;controls();}
}
$('reference-source-computer').onclick=()=>{sourceDialog.close();callbacks?.fromComputer();};
$('reference-source-video').onclick=openVideo;$('reference-source-close').onclick=()=>sourceDialog.close();
$('frame-picker-close').onclick=()=>{if(processing||loading)return;revision++;video.pause();video.removeAttribute('src');video.load();dialog.close();};
dialog.addEventListener('cancel',event=>{if(processing||loading)event.preventDefault();else{revision++;video.pause();video.removeAttribute('src');video.load();}});
$('frame-picker-project').onchange=renderSources;$('frame-picker-source').onchange=loadSource;
seek.oninput=()=>seekTo(Number(seek.value),'time');$('frame-picker-first').onclick=()=>seekTo(0,'first');$('frame-picker-last').onclick=()=>seekTo(video.duration,'last');$('frame-picker-use').onclick=useFrame;
window.framePicker={open(data,handlers){if(processing)return;target={...data};callbacks=handlers;sourceDialog.showModal();}};
})();
