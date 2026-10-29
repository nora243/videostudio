const {validateProduction,validateAudio,audioPrompt}=require('./production.cjs');
function validateProject(data) {
  if (!data || typeof data.title !== 'string' || typeof data.brief !== 'string' || data.title.length > 200 || !data.brief.trim() || data.brief.length > 20000) throw new Error('Hãy nhập ý tưởng video (tối đa 20.000 ký tự).');
  if (!Number.isInteger(data.scenes) || data.scenes < 1 || data.scenes > 50) throw new Error('Số cảnh tạo kịch bản phải từ 1 đến 50.');
  if (!['16:9', '9:16', '1:1'].includes(data.ratio)) throw new Error('Tỷ lệ khung hình không hợp lệ.');
  return { title: data.title.trim(), brief: data.brief.trim(), style: String(data.style || 'Điện ảnh').slice(0, 100), ratio: data.ratio, scenes: data.scenes, ...(data.production?{production:validateProduction(data.production)}:{}) };
}

function buildPrompt(data) {
  const p = validateProject(data);
  return `Bạn là biên kịch và đạo diễn video. Viết kịch bản tiếng Việt cho dự án ${JSON.stringify(p.title || 'Video mới')}.
Ý tưởng: ${p.brief}
Phong cách: ${p.style}. Tỷ lệ: ${p.ratio}. Chính xác ${p.scenes} cảnh, đề xuất 8 giây/cảnh.
${p.production?.direction==='review'?`TIÊU CHUẨN REVIEW CÓ GIÁ TRỊ (ưu tiên hơn công thức mẫu cũ):
Cảnh mở đầu dùng nghịch lý, rủi ro tài chính hoặc lật một hiểu lầm để tạo hook trong 1–2 giây, rồi hứa một lợi ích tư vấn cụ thể. Không chỉ lặp câu hỏi của đề bài, không giật tít bằng dữ kiện bịa.
Mỗi cảnh thân bài phải trả lời một câu hỏi khác nhau, có giải thích vì sao và một điều kiện/ngoại lệ hoặc bước kiểm tra thực tế. Viết câu nối nguyên nhân–hệ quả, tránh khẩu hiệu hoặc một câu chung chung rồi kết thúc. Cảnh cuối chốt checklist/hành động kiểm chứng thay vì chỉ hỏi người xem còn lo không.
Không khẳng định chung các mốc bảo hành, tỷ lệ chai pin, tuổi thọ hay giá sửa/thay cho mọi xe. Chỉ nêu số liệu khi có hãng/model, thị trường, thời điểm và nguồn được cung cấp hoặc thực sự kiểm chứng; nếu không, dùng lời tư vấn có điều kiện. Với chủ đề pin: tách thời hạn/km bảo hành với điều kiện dung lượng và loại trừ; giải thích chai pin khác hỏng pin, chẩn đoán/SOH trước quyết định, sửa/module/thay pack tùy thiết kế và chính sách hãng. Không hứa sửa module chỉ vài triệu hoặc mặc định 5 năm chai 10%. Chỉ yêu cầu Gemini kiểm chứng khi có khả năng tra cứu; không bịa nguồn.
Nhịp nói review nhanh vừa, rõ chữ và tự nhiên. Cảnh 8 giây hướng tới khoảng 28–36 đơn vị tách bằng khoảng trắng trong tiếng Việt (không phải số từ ngôn ngữ học), tính cả thoại và lời dẫn, giảm khi có đổi người nói hoặc hành động cần nghỉ. Đây là mục tiêu ước lượng, không nhồi chữ; ưu tiên đủ một ý tư vấn và đọc kịp thời lượng.`:''}
${p.production?`HỒ SƠ SẢN XUẤT (giữ nhất quán toàn dự án): ${JSON.stringify(p.production)}
${p.production.lockReference?`KHÓA NGOẠI HÌNH THEO ẢNH THAM CHIẾU — ƯU TIÊN HƠN CÁC MÔ TẢ NHÂN VẬT HOẶC TRANG PHỤC KHÁC TRONG ĐỀ BÀI:
Ảnh tham chiếu của nhân vật là nguồn duy nhất cho khuôn mặt, kiểu tóc, màu tóc, trang phục, màu sắc/chất liệu quần áo và phụ kiện. Không tự thiết kế, bổ sung, đổi đồ, đổi tóc, làm đẹp hoặc suy đoán chi tiết chưa thấy. Hồ sơ nhân vật bằng chữ chỉ dùng cho tính cách, vai trò và diễn xuất; mọi mô tả ngoại hình/trang phục trong đó phải nhường ưu tiên cho ảnh. Nếu bạn chưa được xem ảnh, không giả vờ đã xem hay tự đoán nội dung ảnh.
Trong description_vi chỉ gọi nhân vật theo ảnh tham chiếu, rồi mô tả hành động, nét mặt, góc máy, bối cảnh; không liệt kê lại trang phục, khuôn mặt hoặc kiểu tóc bằng chi tiết tự đặt. Trong MỖI video_prompt_en bắt buộc chỉ dẫn: "Use the exact same character from the provided reference image. Preserve the reference face identity, hairstyle, hair color, outfit and accessories exactly. Do not invent, replace, restyle or add clothing or accessories." Chỉ mô tả chuyển động, biểu cảm, môi trường và ánh sáng bên ngoài nhân vật. negative_prompt_en phải nhấn mạnh: "altered face identity, changed hairstyle, changed hair color, changed outfit, added accessories". Không dùng mô tả trang phục mặc định của thể loại review/gara.`:''}
Viết cho kênh này theo chỉ dẫn mẫu và ý tưởng tập. Không mặc định mọi người đều nói. voiceover_vi chỉ là lời dẫn ngoài hình; không trộn hội thoại vào đó. narration=false thì voiceover_vi="". dialogue=false thì danh sách dialogue=[].
Mỗi cảnh bổ sung audio theo schema: {"mode":"${p.production.audioMode}","narrator":"id người dẫn hoặc chuỗi rỗng","speakers":${JSON.stringify(p.production.speakers)},"dialogue":[{"speaker":"id trong speakers","text":"Nguyên văn câu thoại tiếng Việt"}],"ambience":"âm thanh môi trường hoặc chuỗi rỗng","music":"nhạc nền hoặc chuỗi rỗng"}. Giữ nguyên id, giới tính, vùng miền và mô tả giọng của từng người. Chỉ đưa người thực sự nói vào dialogue, lượt nói rõ ràng, không nói chồng. ${p.production.direction==='review'?'Dùng nhịp và mật độ lời nói theo tiêu chuẩn review phía trên; thể hiện nhịp nói nhanh vừa trong mô tả giọng của prompt video, không đổi bản sắc giọng.':'Một cảnh 8 giây khoảng 15–22 đơn vị tách bằng khoảng trắng, có khoảng nghỉ cho hành động và phản ứng hài.'} Nếu cần nhiều lời hơn hãy viết gọn, không tự thêm cảnh. video_prompt_en chỉ mô tả hình ảnh và nhịp diễn, không nhúng thoại hoặc nhạc để tránh mâu thuẫn với trường audio. Với mode=external, dành lời nói để lồng tiếng hậu kỳ, hình ảnh không yêu cầu nhép miệng. Với native, chỉ nhân vật đang nói được chuyển động miệng.`:''}
Chỉ trả về một đối tượng JSON hợp lệ, không giải thích, không dùng bảng hoặc Markdown:
{"title":"Tên phim","summary":"Tóm tắt","scenes":[{"id":1,"duration_seconds":8,"description_vi":"Mô tả hình ảnh tiếng Việt","voiceover_vi":"Lời dẫn tiếng Việt hoặc chuỗi rỗng","video_prompt_en":"English video generation prompt","negative_prompt_en":"English negative prompt or empty string"}]}
Mỗi cảnh phải có đủ các trường trên. id liên tiếp từ 1. Giữ nhất quán nhân vật, trang phục, địa điểm, thời gian và ánh sáng. Mỗi video_prompt_en độc lập, mô tả đầy đủ nhân vật, hành động, bối cảnh, camera, ánh sáng và âm thanh để dùng trong Google Flow. Không tạo chữ/logo nếu không được yêu cầu. Thời lượng là đề xuất, người dùng sẽ kiểm tra mô hình Flow trước khi tạo video.`;
}

function validateStoryboard(value, expectedScenes, production) {
  if(production)production=validateProduction(production);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Kịch bản phải là một đối tượng JSON.');
  const string = (v, field, limit = 20000, empty = false) => {
    if (typeof v !== 'string' || v.length > limit || (!empty && !v.trim())) throw new Error(`Trường ${field} không hợp lệ.`);
    return v.trim();
  };
  if (!Array.isArray(value.scenes) || value.scenes.length < 1 || value.scenes.length > 50) throw new Error('Kịch bản cần có từ 1 đến 50 cảnh.');
  if (expectedScenes && value.scenes.length !== expectedScenes) throw new Error(`Gemini trả về ${value.scenes.length} cảnh; dự án yêu cầu ${expectedScenes}. Có thể chỉnh JSON rồi dựng lại.`);
  return {
    title: string(value.title, 'title', 500), summary: string(value.summary, 'summary', 10000, true),
    scenes: value.scenes.map((scene, index) => {
      if(production&&!scene?.audio)throw new Error(`Cảnh ${index+1}: thiếu cấu trúc âm thanh theo hồ sơ dự án.`);
      if(production){
        scene={...scene,audio:{...scene.audio,speakers:production.speakers,mode:production.audioMode,...(production.direction==='review'?{delivery:'brisk'}:{})}};
        if(!production.narration&&scene.voiceover_vi?.trim())throw new Error(`Cảnh ${index+1}: dự án đã tắt lời dẫn ngoài hình.`);
        if(!production.dialogue&&scene.audio.dialogue?.some(d=>d.text?.trim()))throw new Error(`Cảnh ${index+1}: dự án đã tắt hội thoại.`);
      }
      if(scene?.audio){const audio=validateAudio(scene.audio);audioPrompt({...scene,audio});}
      if (!scene || scene.id !== index + 1 || !Number.isFinite(scene.duration_seconds) || scene.duration_seconds < 1 || scene.duration_seconds > 120) throw new Error(`Cảnh ${index + 1}: id phải liên tiếp, thời lượng từ 1 đến 120 giây.`);
      return { id: index + 1, duration_seconds: scene.duration_seconds,
        description_vi: string(scene.description_vi, `cảnh ${index + 1}: mô tả`),
        voiceover_vi: string(scene.voiceover_vi, `cảnh ${index + 1}: lời dẫn`, 10000, true),
        video_prompt_en: string(scene.video_prompt_en, `cảnh ${index + 1}: prompt video`),
        negative_prompt_en: string(scene.negative_prompt_en, `cảnh ${index + 1}: negative prompt`, 10000, true), ...(scene.audio?{audio:validateAudio(scene.audio)}:{}) };
    })
  };
}

function parseStoryboard(raw, expectedScenes, production) {
  if (typeof raw !== 'string' || raw.length > 1000000) throw new Error('Phản hồi quá dài hoặc không hợp lệ.');
  const text = raw.trim();
  const candidates = [text];
  for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(match[1].trim());
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const candidate of candidates) {
    let data;
    try { data = JSON.parse(candidate); } catch { continue; }
    return validateStoryboard(data, expectedScenes, production);
  }
  throw new Error('Phản hồi chưa phải JSON hợp lệ. Kết quả gốc được giữ lại để bạn chỉnh và dựng lại.');
}

module.exports = { validateProject, buildPrompt, validateStoryboard, parseStoryboard };
