const {validateStoryboard,buildPrompt,parseStoryboard,sceneContinuityInstructions}=require('./storyboard.cjs');
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
 const connections=selected.map(id=>{const index=board.scenes.findIndex(s=>s.id===id);return{sceneId:id,position:index+1,previousId:board.scenes[index-1]?.id??null,nextId:board.scenes[index+1]?.id??null};});
 const continuity=`${project.production?.geminiPrompt?sceneContinuityInstructions:''}\nNỐI CẢNH KHI VIẾT LẠI: Dùng thứ tự dựng trong kịch bản hiện tại, không suy ra thứ tự từ mã id. Với cảnh trước không được chọn, lấy đúng trạng thái kết thúc làm START cho cảnh thay thế. Với cảnh sau không được chọn, thiết kế END của cảnh thay thế để nối được START của cảnh sau; không bắt cảnh không được chọn tự thay đổi để khớp. Nếu nhiều cảnh được chọn liên tiếp, viết lại chúng như một chuỗi chuyển động liền mạch. Phải mô tả bước chuyển từ trạng thái trước tới kết quả, không chỉ tả kết quả. Chỉ sửa cảnh được chọn; nếu không thể nối hợp lý trong thời lượng, đơn giản hóa hành động mà giữ hai đầu bàn giao.\nVỊ TRÍ CÁC CẢNH ĐƯỢC CHỌN: ${JSON.stringify(connections)}`;
 return `${buildPrompt({...project,scenes:selected.length,sceneDuration:'auto'})}\n${continuity}\nCHẾ ĐỘ VIẾT LẠI CẢNH ĐƯỢC CHỌN. Dưới đây là kịch bản đầy đủ theo thứ tự dựng hiện tại (id là mã cố định, không phải vị trí). Chỉ trả về ${selected.length} cảnh thay thế cho các mã ${JSON.stringify(selected)}, đúng thứ tự danh sách này. Trong JSON kết quả, đánh id liên tiếp từ 1 đến ${selected.length}; tool sẽ ánh xạ về mã gốc. Giữ nguyên vai trò mạch truyện và thời lượng của từng cảnh được thay. Không viết lại các cảnh ngoài danh sách, không đổi tiêu đề/tóm tắt dự án. Cảnh ở vị trí đầu toàn kịch bản phải có hook mạnh, các cảnh giữa cung cấp thông tin mới hữu ích thay vì nhắc lại, cảnh cuối kết luận có hành động cụ thể. Giữ liên kết tự nhiên với các cảnh trước/sau không được chọn. Không bắt đầu lại bằng hook nếu chỉ thay cảnh giữa.\nYêu cầu bổ sung: ${String(note).slice(0,3000)}\nKỊCH BẢN HIỆN TẠI:\n${JSON.stringify(board)}`;
}
function applyScriptResult(raw,job,current,{onAudioFallback}={}){
 if(job.sceneIds){
  if(JSON.stringify(current)!==JSON.stringify(job.baseStoryboard))throw new Error('Kịch bản đã thay đổi sau yêu cầu Gemini; không ghi đè bản mới.');
  const ids=selectedScenes(current,job.sceneIds);
  const result=parseStoryboard(raw,job.sceneIds.length,job.project.production,{
   audioFallbackScenes:ids.map(id=>current.scenes.find(s=>s.id===id)),
   onAudioFallback:index=>onAudioFallback?.(ids[index])
  });
  return {...validateEditedStoryboard(current),scenes:current.scenes.map(s=>ids.includes(s.id)?{...result.scenes[ids.indexOf(s.id)],id:s.id}:s)};
 }
 return parseStoryboard(raw,job.project.scenes,job.project.production,{sceneDuration:job.project.sceneDuration});
}
function scriptAppliedMessage(job,board,inherited=[]){
 const positions=job?.sceneIds?.map(id=>board.scenes.findIndex(s=>s.id===id)+1).join(', ');
 const message=positions?`Đã thay thế cảnh ${positions}; các cảnh khác được giữ nguyên.`:`Đã dựng ${board.scenes.length} cảnh từ JSON.`;
 return message+(inherited.length?' Gemini không gửi phần audio; đã giữ âm thanh, lời thoại và hồ sơ giọng của cảnh cũ.':'');
}
function scriptAttemptHistory(previous){
 if(!previous)return [];
 const {previousAttempts,...snapshot}=structuredClone(previous);
 return [...(previousAttempts||[]),snapshot].slice(-5);
}
function retryScriptJob(previous,current,{id,profileId,createdAt=new Date().toISOString()}){
 if(!previous?.prompt||!previous.marker||!['interrupted','failed','waiting','submitting','invalid_json'].includes(previous.status))throw Error('Không có yêu cầu Gemini bị gián đoạn để gửi lại.');
 if((previous.profileId||'default')!==profileId)throw Error('Chọn lại profile đã gửi yêu cầu Gemini trước khi gửi lại prompt.');
 if(previous.sceneIds&&JSON.stringify(current)!==JSON.stringify(previous.baseStoryboard))throw Error('Kịch bản đã thay đổi sau yêu cầu trước; hãy tạo yêu cầu viết lại mới.');
 const marker=`VIDEO_STUDIO_REQUEST_${id}`;
 if(!previous.prompt.includes(previous.marker))throw Error('Prompt cũ thiếu mã yêu cầu, không thể gửi lại.');
 return {id,marker,project:structuredClone(previous.project),profileId,pipelineId:previous.pipelineId||null,
  ...(previous.sceneIds?{sceneIds:[...previous.sceneIds],baseStoryboard:structuredClone(previous.baseStoryboard)}:{}),
  status:'preparing',prompt:previous.prompt.replace(previous.marker,marker),createdAt,raw:'',retryOf:previous.id,
  previousAttempts:scriptAttemptHistory(previous)};
}
module.exports={validateEditedStoryboard,selectedScenes,buildRewritePrompt,applyScriptResult,retryScriptJob,scriptAttemptHistory,scriptAppliedMessage};
