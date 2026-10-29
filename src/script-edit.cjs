const {validateStoryboard,buildPrompt,parseStoryboard}=require('./storyboard.cjs');
function validateEditedStoryboard(value){
 if(!Array.isArray(value?.scenes)||value.scenes.length>50)throw new Error('Danh sách cảnh không hợp lệ.');
 const ids=value.scenes.map(s=>s.id);if(ids.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(ids).size!==ids.length)throw new Error('Mã cảnh phải duy nhất.');
 const placeholder={id:1,duration_seconds:8,description_vi:'Empty',voiceover_vi:'',video_prompt_en:'Empty',negative_prompt_en:''};
 const valid=validateStoryboard({...value,scenes:value.scenes.length?value.scenes.map((s,i)=>({...s,id:i+1})):[placeholder]});
 return {...valid,scenes:value.scenes.map((s,i)=>({...valid.scenes[i],id:s.id}))};
}
function selectedScenes(board,ids){
 if(!board?.scenes?.length||!Array.isArray(ids)||!ids.length||ids.some(id=>!Number.isInteger(id))||new Set(ids).size!==ids.length||ids.some(id=>!board.scenes.some(s=>s.id===id)))throw new Error('Hãy chọn ít nhất một cảnh hợp lệ để viết lại.');
 return board.scenes.filter(s=>ids.includes(s.id)).map(s=>s.id);
}
function buildRewritePrompt(project,board,ids,note=''){
 const selected=selectedScenes(board,ids);
 return `${buildPrompt({...project,scenes:selected.length})}\nCHẾ ĐỘ VIẾT LẠI CẢNH ĐƯỢC CHỌN. Dưới đây là kịch bản đầy đủ theo thứ tự dựng hiện tại (id là mã cố định, không phải vị trí). Chỉ trả về ${selected.length} cảnh thay thế cho các mã ${JSON.stringify(selected)}, đúng thứ tự danh sách này. Trong JSON kết quả, đánh id liên tiếp từ 1 đến ${selected.length}; tool sẽ ánh xạ về mã gốc. Giữ nguyên vai trò mạch truyện và thời lượng của từng cảnh được thay. Không viết lại các cảnh ngoài danh sách, không đổi tiêu đề/tóm tắt dự án. Cảnh ở vị trí đầu toàn kịch bản phải có hook mạnh, các cảnh giữa cung cấp thông tin mới hữu ích thay vì nhắc lại, cảnh cuối kết luận có hành động cụ thể. Giữ liên kết tự nhiên với các cảnh trước/sau không được chọn. Không bắt đầu lại bằng hook nếu chỉ thay cảnh giữa.\nYêu cầu bổ sung: ${String(note).slice(0,3000)}\nKỊCH BẢN HIỆN TẠI:\n${JSON.stringify(board)}`;
}
function applyScriptResult(raw,job,current){
 if(job.sceneIds){
  if(JSON.stringify(current)!==JSON.stringify(job.baseStoryboard))throw new Error('Kịch bản đã thay đổi sau yêu cầu Gemini; không ghi đè bản mới.');
  const result=parseStoryboard(raw,job.sceneIds.length,job.project.production),ids=selectedScenes(current,job.sceneIds);
  return {...validateEditedStoryboard(current),scenes:current.scenes.map(s=>ids.includes(s.id)?{...result.scenes[ids.indexOf(s.id)],id:s.id}:s)};
 }
 return parseStoryboard(raw,job.project.scenes,job.project.production);
}
module.exports={validateEditedStoryboard,selectedScenes,buildRewritePrompt,applyScriptResult};
