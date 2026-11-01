const {validateProduction,validateAudio,audioPrompt}=require('./production.cjs');
const sceneContinuityInstructions=`LIÊN KẾT CẢNH: Kể theo nguyên nhân → hành động → kết quả. Mỗi prompt độc lập, nêu trạng thái đầu, diễn biến và trạng thái cuối; cảnh nối tiếp phải khớp nhân vật, tư thế, đạo cụ, bối cảnh và ánh sáng. Không bỏ qua động tác quan trọng hoặc chỉ ghi "same as previous scene".`;
const visualPromptStructure = `TIÊU CHUẨN BẮT BUỘC CHO video_prompt_en (CHỐNG LỖI VẬT LÝ, DỊ DẠNG & MỌC THÊM CHI):
Mỗi video_prompt_en bằng tiếng Anh PHẢI được mô tả cực kỳ chi tiết, KHÔNG viết một đoạn văn ngắn sơ sài. BẮT BUỘC tuân thủ cấu trúc 6 phần sau trong MỌI cảnh:

1. DÒNG MỞ ĐẦU (Shot & Setting): [Orientation & Ratio], photorealistic amateur handheld smartphone video, continuous single shot. [Bối cảnh cụ thể], [Ánh sáng và nhiệt độ màu, ví dụ warm natural afternoon daylight 5500K].

2. **CHARACTER CONSISTENCY:**
- Chỉ thị tham chiếu: "Use the attached five-row cat family reference sheet. Preserve the exact feline identity, fur markings, eye colors, body proportions and size differences of each character." (hoặc ảnh chân dung/tham chiếu nhân vật của dự án).
- Liệt kê từng nhân vật CÓ MẶT trong cảnh: tên_id (vị trí/Hàng trong reference sheet): mô tả nhận diện cốt lõi (màu lông, màu mắt, vết khuyết tai/đốm mắt đặc trưng...) và so sánh tỷ lệ kích thước rõ rệt giữa các nhân vật (ví dụ: ut_ngao (Row 5): Tiny black-and-white kitten, blue eyes, dark patch around right eye, short legs. Significantly smaller than bo_bu). Tuyệt đối không thêm nhân vật vắng mặt.

3. **STRICT ANATOMICAL AND OBJECT CONTINUITY:**
- Khóa chặt số lượng chi giải phẫu cho nhân vật hoạt động trong cảnh để chống lỗi AI mọc thêm chi hoặc biến dạng: Nêu rõ số chi (ví dụ: Bo_bu has exactly FOUR feline limbs: TWO front paws and TWO hind legs. No additional limbs under any circumstances. Với người: exactly FOUR human limbs: TWO arms and TWO legs).
- Phân định rõ chức năng từng chi:
  + Chi cầm đạo cụ: RIGHT FRONT PAW (hoặc chi cụ thể): Nắm chắc đạo cụ gì (ví dụ chiếc quạt/cái chảo...), giữ chặt suốt cả video. Đạo cụ KHÔNG BAO GIỜ rời chi này, KHÔNG biến mất, KHÔNG đổi hình dạng, KHÔNG chuyển sang chi khác.
  + Chi làm động tác / chi rỗng: LEFT FRONT PAW: Hoàn toàn rỗng (EMPTY), là chi DUY NHẤT được phép thực hiện cử chỉ (swat, vẫy, chỉ trỏ...).
  + Các chi còn lại / chân sau: Nêu trạng thái cố định (ví dụ: BOTH HIND LEGS: Remain relaxed and stationary on the bamboo daybed throughout the scene).
- Khẳng định: Each paw/limb performs only its assigned action. No limb duplication, no object teleportation, no sudden changes in grip.

4. **ACTION SEQUENCE:**
- Phân đoạn thời gian theo giây khớp với thời lượng cảnh duration_seconds (ví dụ cảnh 8s chia 0–2s:, 2–4s:, 4–6s:, 6–8s:; cảnh 6s chia 0–2s:, 2–4s:, 4–6s:; cảnh 10s chia 0–2s:, 2–5s:, 5–8s:, 8–10s:).
- Trong từng mốc giây: Mô tả chi tiết chuyển động máy quay, hành động cụ thể của từng nhân vật và sự duy trì liên tục của các chi/đạo cụ (chi nào tiếp tục giữ đạo cụ, chi nào cử động cử chỉ nhỏ, không đột ngột thay đổi vị trí hay buông đồ vật).

5. **CAMERA AND PHYSICS:**
- Single continuous handheld shot, no cuts, no sudden camera jumps.
- Giữ góc máy thấy rõ phần thân trên và CẢ HAI chi trước/bàn chân khi làm động tác; tránh che khuất hay đè chồng các chi lên nhau.
- Realistic feline/human anatomy, natural weight distribution, believable joint movement, physically consistent object interaction, realistic fur and shadows.

6. **ABSOLUTE NEGATIVE CONSTRAINTS:**
- Liệt kê các điều cấm vật lý cụ thể cho cảnh đó: No extra paws, no third front arm, no duplicated limbs, no disappearing [tên đạo cụ], no floating objects, no switching [tên đạo cụ] between paws, no human hands, no anatomical morphing, no sudden object appearance, no impossible movements, no cartoon physics.

TRƯỜNG negative_prompt_en: Luôn điền các từ khóa phủ định bằng tiếng Anh:
identity swap, fur pattern drift, eye color change, size drift, extra limbs, duplicated paws, third arm, disappearing objects, floating objects, human hands, human face, cartoon, glossy CGI, morphing, reference sheet grid, labels, lighting discontinuity, speaking mouth on silent character, subtitles, text.`;
function validateProject(data) {
  if (!data || typeof data.title !== 'string' || typeof data.brief !== 'string' || data.title.length > 200 || !data.brief.trim() || data.brief.length > 20000) throw new Error('Hãy nhập ý tưởng video (tối đa 20.000 ký tự).');
  if (data.scenes !== 'auto' && (!Number.isInteger(data.scenes) || data.scenes < 1 || data.scenes > 50)) throw new Error('Số cảnh tạo kịch bản phải từ 1 đến 50.');
  if(data.sceneDuration !== undefined && ![6,8,10,'auto'].includes(data.sceneDuration))throw new Error('Thời lượng cảnh phải là 6s, 8s, 10s hoặc Auto.');
  if (!['16:9', '9:16', '1:1'].includes(data.ratio)) throw new Error('Tỷ lệ khung hình không hợp lệ.');
  return { title: data.title.trim(), brief: data.brief.trim(), style: String(data.style || 'Điện ảnh').slice(0, 100), ratio: data.ratio, scenes: data.scenes, sceneDuration:data.sceneDuration ?? 8, ...(data.production?{production:validateProduction(data.production)}:{}) };
}

function buildPrompt(data) {
 const p=validateProject(data),pr=p.production;
 const catFamily=pr?.direction==='cat-family';
 const neutralStructure=`TIÊU CHUẨN BẮT BUỘC CHO video_prompt_en:
Mỗi prompt tiếng Anh độc lập, chi tiết, đúng thể loại và ý tưởng hiện tại. Gồm 6 phần:
1. Shot & Setting: tỷ lệ, phong cách hình ảnh theo dự án, bối cảnh và ánh sáng cụ thể.
2. CHARACTER CONSISTENCY: chỉ mô tả nhân vật thực sự có mặt theo hồ sơ và ảnh tham chiếu của dự án. Giữ ngoại hình, trang phục, tỷ lệ; không thêm nhân vật từ mẫu khác. Nếu không có nhân vật thì mô tả tính nhất quán của chủ thể.
3. STRICT ANATOMICAL AND OBJECT CONTINUITY: đúng giải phẫu của chủ thể; với người là hai tay, hai chân. Nêu tay nào cầm dụng cụ, tay nào thao tác; giữ số lượng, hình dạng và vị trí đạo cụ, không nhân bản hoặc làm biến mất đồ vật.
4. ACTION SEQUENCE: chia mốc giây khớp duration_seconds, hành động rõ nguyên nhân và kết quả, thao tác liên tục.
5. CAMERA AND PHYSICS: camera theo phong cách đã chọn, chuyển động và tương tác vật lý hợp lý, giữ thấy rõ thao tác quan trọng.
6. ABSOLUTE NEGATIVE CONSTRAINTS: các lỗi cần tránh riêng cho cảnh; không thêm chi, biến dạng, vật thể lơ lửng, chữ, logo hoặc phụ đề. Không cấm bàn tay hay khuôn mặt người khi nhân vật là người.
negative_prompt_en: dùng các lỗi phù hợp chủ thể và thể loại hiện tại; không lấy mô tả hoặc ví dụ từ kịch bản khác.`;
 const timing=(p.scenes==='auto'?'Auto số cảnh: tự chọn từ 1 đến 50 cảnh, vừa đủ kể trọn ý tưởng, tránh kéo dài.':'Chính xác '+p.scenes+' cảnh.')+' '+(p.sceneDuration==='auto'?'Auto thời lượng: tự chọn 6, 8 hoặc 10 giây cho từng cảnh theo hành động và thoại.':'Mỗi cảnh đúng '+p.sceneDuration+' giây.');
 const referenceText=text=>{
  let result=String(text||'').replace(/Flow: dùng @ID chính xác trong video_prompt_en[^\n]*?Không tự tạo ID hoặc thêm nhân vật vắng mặt\./g,'').replace(/FLOW CHARACTER REFERENCES:[^\n]*/g,'');
  for(const speaker of pr?.speakers||[])result=result.replace(new RegExp('@'+speaker.id+'(?![a-zA-Z0-9_-])','g'),speaker.name);
  return result.trim();
 };
 const cast=pr?.speakers.map(({imagePath,...speaker})=>speaker);
 const catVisualExample = `Vertical ${p.ratio || '9:16'}, photorealistic amateur handheld smartphone video, continuous single shot. Rural Vietnamese house courtyard, warm natural afternoon daylight 5500K.\n\n**CHARACTER CONSISTENCY:**\nUse the attached five-row cat family reference sheet. Preserve the exact feline identity, fur markings, eye colors, body proportions and size differences of each character.\n- bo_bu (Row 1): Massive orange tabby father cat, broad face, amber eyes, small notch on right ear.\n- ut_ngao (Row 5): Tiny black-and-white kitten, blue eyes, dark patch around right eye, short legs. Significantly smaller than bo_bu.\n\n**STRICT ANATOMICAL AND OBJECT CONTINUITY:**\nBo_bu has exactly FOUR feline limbs: TWO front paws and TWO hind legs. No additional limbs under any circumstances.\n- RIGHT FRONT PAW: Holds the wooden handle of ONE dry woven palm-leaf fan throughout the ENTIRE video. The paw remains physically wrapped around the handle with a consistent grip. The fan NEVER leaves this paw, NEVER disappears, NEVER changes shape, and NEVER transfers to another paw.\n- LEFT FRONT PAW: Remains completely EMPTY throughout the video. This is the ONLY paw allowed to perform the dismissive gesture.\n- BOTH HIND LEGS: Remain relaxed and stationary on the bamboo daybed throughout the scene.\nEach paw performs only its assigned action. No limb duplication, no object teleportation, no sudden changes in grip.\n\n**ACTION SEQUENCE:**\n0–2s: Handheld smartphone camera follows ut_ngao running upright on his two hind legs from the living room doorway toward the sunny brick courtyard. Bo_bu is already visible lying lazily on a rustic bamboo daybed beside a ceramic teapot set. His RIGHT front paw is already holding the palm-leaf fan, slowly fanning himself with small, gentle wrist movements.\n2–4s: Ut_ngao stops beside the daybed, looking frustrated. He complains animatedly while gesturing with his two small front paws. Bo_bu remains sleepy, eyes half-closed. His RIGHT front paw continues holding the SAME fan without releasing it.\n4–6s: Bo_bu lazily lifts ONLY his EMPTY LEFT front paw a short distance above the daybed and makes ONE small dismissive sideways waving gesture toward ut_ngao. His RIGHT front paw continues securely holding the fan. The fan may briefly stop moving but MUST remain firmly gripped in the RIGHT paw.\n6–8s: Bo_bu lowers his LEFT front paw back onto the daybed, closes his eyes, and resumes gently fanning himself using ONLY his RIGHT front paw. Ut_ngao stares at his father in disbelief.\n\n**CAMERA AND PHYSICS:**\nSingle continuous handheld shot, no cuts, no sudden camera jumps. Keep bo_bu's upper body and BOTH front paws clearly visible whenever he gestures. Avoid overlapping or obscuring his paws.\nRealistic feline anatomy, natural weight distribution, believable joint movement, physically consistent object interaction, realistic fur and shadows.\n\n**ABSOLUTE NEGATIVE CONSTRAINTS:**\nNo extra paws, no third front arm, no duplicated limbs, no disappearing fan, no floating objects, no switching the fan between paws, no human hands, no anatomical morphing, no sudden object appearance, no impossible movements, no cartoon physics.`;
 const visualExample=catFamily?catVisualExample:[
 'Shot & Setting: '+(p.ratio||'9:16')+'. '+(pr?.direction==='review'?'A modest working vehicle repair garage in Vietnam, concrete floor, practical repair tools, natural light.':'Describe the setting and visual style specified in the current project.'),
 'CHARACTER CONSISTENCY: '+(cast?.length?'Only the specified project characters are present: '+cast.map(s=>s.name+' ('+s.id+')').join(', ')+'. Preserve their appearance from project references.':'Describe only the subjects required by this scene.'),
 'STRICT ANATOMICAL AND OBJECT CONTINUITY: Maintain correct anatomy and stable object geometry. Assign each hand a clear task and preserve tool grip throughout the action.',
 'ACTION SEQUENCE: Divide the selected clip duration into timed actions that demonstrate the episode idea.',
 'CAMERA AND PHYSICS: Keep the main action visible and physically plausible. Follow the project camera style.',
 'ABSOLUTE NEGATIVE CONSTRAINTS: No duplicated limbs, disappearing tools, impossible movement, text, subtitles or logos.'
 ].join('\n\n');
 const negativeExample=catFamily?'identity swap, fur pattern drift, eye color change, size drift, extra limbs, duplicated paws, human hands, morphing, cartoon, CGI, text, labels, subtitles':'identity swap, extra limbs, duplicated hands, disappearing tools, object morphing, text, logos, subtitles';
 const schema={title:'Tên phim',summary:'Tóm tắt',scenes:[{id:1,duration_seconds:p.sceneDuration==='auto'?8:p.sceneDuration,description_vi:'Mô tả cảnh tiếng Việt',voiceover_vi:'',video_prompt_en:visualExample,negative_prompt_en:negativeExample,...(pr?{audio:{mode:pr.audioMode,narrator:'',dialogue:pr.dialogue?[{speaker:cast[0].id,text:'Nguyên văn lời thoại tiếng Việt'}]:[],ambience:pr.ambience,music:pr.music}}:{})}]};
 const rules=[timing,sceneContinuityInstructions,catFamily?visualPromptStructure:neutralStructure,'Mỗi description_vi bằng tiếng Việt. Không chữ, phụ đề, logo hoặc nhãn ID trên hình. Thoại vừa thời lượng, có khoảng nghỉ; không nhồi lời.'];
 rules.push('TÌNH HUỐNG DỄ HIỂU: Rõ ai làm gì, muốn gì, nguyên nhân và kết quả. Cho thấy đạo cụ then chốt, hành động gây hiểu lầm và phản ứng dẫn tới cú chốt; không bỏ mắt xích để người xem tự đoán. Thoại đáp đúng hành động/câu trước. Quá thời lượng thì giản lược tình huống hoặc chia cảnh khi số cảnh là Auto.');
 if(pr?.direction==='cat-family')rules.push('THOẠI GIA ĐÌNH QUÊ VIỆT NAM: Mộc mạc, đậm chất dân dã; xưng hô bố/mẹ/con, anh/chị/em đúng vai và vùng giọng. Câu ngắn rõ ý, trách yêu, trêu hoặc chống chế hợp tính cách. Thành ngữ/từ quê dùng vừa phải, đúng cảnh; tránh văn viết, lời dịch, tiếng lóng mạng, chửi tục và nhồi phương ngữ. Giữ tình thân khi cãi vui.');
 if(pr){
 if(pr.direction==='review')rules.push('GIỌNG REVIEW XE: Dùng mô tả giọng bằng chữ trong hồ sơ từng nhân vật, giữ đúng vùng giọng và bản sắc xuyên suốt dự án. Không dùng chip giọng Flow, @Voice hoặc tên giọng mẫu làm chỉ dẫn phát âm. Giữ lời thoại trong audio.dialogue; ứng dụng ghép mô tả giọng của đúng người nói khi chuẩn bị video.');
 rules.push('KHÓA KIỂU TÓC TRONG DỰ ÁN: Mỗi nhân vật giữ duy nhất một kiểu tóc trong mọi cảnh của dự án này. Nếu có ảnh tham chiếu, kiểu tóc trong ảnh chân dung là chuẩn; giữ độ dài, màu, ngôi, tóc mái, trạng thái xõa/buộc, độ cao vị trí buộc và phụ kiện. Không tự buộc tóc vì bối cảnh gara hay nghề thợ máy. Nếu chưa thấy ảnh, viết preserve the exact hairstyle from the attached character reference; không tự suy diễn tóc buộc cao hoặc tóc xõa. Khi không có ảnh, xác lập kiểu tóc một lần theo hồ sơ dự án rồi lặp nguyên mô tả đó trong từng video_prompt_en. Không tự đổi kiểu tóc giữa cảnh, kể cả khi viết lại riêng cảnh. Quy tắc chỉ có hiệu lực trong dự án hiện tại, không áp một kiểu tóc cố định cho mọi kịch bản.');
 rules.push('TRANG PHỤC THEO ẢNH: Khi dự án dùng ảnh tham chiếu nhân vật, giữ nguyên toàn bộ trang phục, màu sắc, kiểu dáng, giày và phụ kiện theo ảnh. Không tự suy diễn đồng phục từ nghề nghiệp hoặc bối cảnh; gara không đồng nghĩa mặc đồ bảo hộ hay quần áo thợ máy. Nếu chưa nhìn thấy ảnh, chỉ yêu cầu preserve the exact outfit from the attached character reference; không bịa chi tiết quần áo. Với ảnh ghép, ảnh toàn thân quy định trang phục và ảnh chân dung quy định khuôn mặt của cùng một người.', 'TÊN NHÂN VẬT LÀ SIÊU DỮ LIỆU: Tên và mã chỉ dùng gán vai, ảnh và giọng nói; tuyệt đối không yêu cầu chữ tên nhân vật trên hình, bảng tên, chữ trên áo, lower-third hay phụ đề. Hội thoại chỉ là âm thanh, không hiển thị nguyên văn thành chữ.');
 rules.push('Kênh: '+pr.channel+'. Hồ sơ nhân vật: '+pr.character,'Chỉ dẫn thể loại: '+referenceText(pr.instructions).replace(/NỐI HÀNH ĐỘNG:[\s\S]*?(?=GIỌNG VÀ KHẨU HÌNH:)/,''),'Nhân vật và giọng (giữ nguyên): '+JSON.stringify(cast),'NHÂN VẬT QUA ẢNH THAM CHIẾU: Dùng ảnh nhân vật hoặc ảnh nhóm được đính kèm trong Flow làm chuẩn nhận dạng. Trong video_prompt_en, gọi tên và mô tả đặc điểm nhận diện của nhân vật có mặt để đối chiếu đúng ảnh; với ảnh nhóm, chỉ rõ hàng/vị trí tương ứng. Giữ ngoại hình và tỷ lệ kích thước, không thêm nhân vật vắng mặt. Mã người nói chỉ dùng để gán lời thoại trong audio.');
 const portraits=pr.speakers.filter(s=>s.imagePath);
 if(portraits.length)rules.push('Ảnh chân dung riêng được gắn theo tên: '+portraits.map(s=>s.id+' = '+s.name).join('; ')+'. Trong video_prompt_en, dùng đúng tên và yêu cầu giữ nhận dạng từ ảnh chân dung của nhân vật đó; ảnh riêng ưu tiên hơn ảnh nhóm cho nhân vật này. Không thêm nhân vật vắng mặt chỉ vì có ảnh.');
 if(pr.lockReference)rules.push('KHÓA NGOẠI HÌNH THEO ẢNH THAM CHIẾU: ảnh là chuẩn nhận dạng; giữ ngoại hình, trang phục và tỷ lệ kích thước. Không tráo, trộn hoặc nhân bản nhân vật; không sao chép ô ảnh/nhãn/nền reference sheet. Không đoán chi tiết ảnh chưa xem.');
 rules.push('Âm thanh: mode='+pr.audioMode+', narration='+pr.narration+', dialogue='+pr.dialogue+'. voiceover_vi chỉ dành cho lời dẫn ngoài hình, tắt lời dẫn thì để rỗng. Hội thoại chỉ đặt trong audio.dialogue, không chép vào video_prompt_en; tắt hội thoại thì dialogue=[]. narrator là ID người dẫn hoặc rỗng. Chỉ người đang nói cử động miệng, người nghe im lặng; không nói chồng. '+(pr.audioMode==='external'?'Lời nói dành cho hậu kỳ, không yêu cầu nhép miệng.':'Khẩu hình khớp chính xác lời tiếng Việt.'),'Mỗi cảnh bắt buộc có audio, kể cả cảnh không thoại. Hồ sơ speakers được ứng dụng gắn lại; không cần lặp trong JSON.');
 }
 if(p.style.includes('Dân dã'))rules.push('Hình ảnh: amateur handheld smartphone footage, ánh sáng tự nhiên, đời thường.');
 const content=pr?.geminiPrompt?referenceText(pr.geminiPrompt):'Viết kịch bản cho '+JSON.stringify(p.title||'Video mới')+'. Ý tưởng: '+p.brief+'\nPhong cách: '+p.style+'. Tỷ lệ: '+p.ratio+'.';
 return content+'\n'+rules.join('\n')+'\nChỉ trả JSON hợp lệ theo mẫu sau; id liên tiếp từ 1. Điền đủ trường, dialogue=[] khi không ai nói:\n'+JSON.stringify(schema)+'\n';
}

function validateStoryboard(value, expectedScenes, production, sceneDuration) {
  if(production)production=validateProduction(production);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Kịch bản phải là một đối tượng JSON.');
  const string = (v, field, limit = 20000, empty = false) => {
    if (typeof v !== 'string' || v.length > limit || (!empty && !v.trim())) throw new Error(`Trường ${field} không hợp lệ.`);
    return v.trim();
  };
  if (!Array.isArray(value.scenes) || value.scenes.length < 1 || value.scenes.length > 50) throw new Error('Kịch bản cần có từ 1 đến 50 cảnh.');
  if (expectedScenes && expectedScenes !== 'auto' && value.scenes.length !== expectedScenes) throw new Error(`Gemini trả về ${value.scenes.length} cảnh; dự án yêu cầu ${expectedScenes}. Có thể chỉnh JSON rồi dựng lại.`);
  return {
    title: string(value.title, 'title', 500), summary: string(value.summary, 'summary', 10000, true),
    scenes: value.scenes.map((scene, index) => {
      if(sceneDuration !== undefined && (![6,8,10].includes(scene?.duration_seconds) || (sceneDuration !== 'auto' && scene.duration_seconds !== sceneDuration)))throw new Error('Cảnh '+(index+1)+': thời lượng không đúng lựa chọn 6s, 8s, 10s hoặc Auto.');
      if(production&&!scene?.audio)throw new Error(`Cảnh ${index+1}: thiếu cấu trúc âm thanh theo hồ sơ dự án.`);
      if(production){
        scene={...scene,audio:{...scene.audio,speakers:production.speakers,mode:production.audioMode,...(production.direction==='review'?{voiceStrategy:'text',delivery:'brisk'}:scene.audio.voiceStrategy?{voiceStrategy:'flow'}:{})}};
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

function parseStoryboard(raw, expectedScenes, production, {audioFallbackScenes=[],onAudioFallback,sceneDuration}={}) {
  if (typeof raw !== 'string' || raw.length > 1000000) throw new Error('Phản hồi quá dài hoặc không hợp lệ.');
  const text = raw.trim();
  if(!text.includes('{'))throw new Error('Gemini trả lời bằng văn bản thay vì JSON kịch bản. Phản hồi gốc được giữ lại; bạn có thể bấm Tạo lại cảnh hoặc Gửi lại prompt để thử lại.');
  const candidates = [text];
  for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(match[1].trim());
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const candidate of candidates) {
    let data;
    try { data = JSON.parse(candidate); } catch { continue; }
    const inherited=[];
    if(Array.isArray(data?.scenes))data={...data,scenes:data.scenes.map((scene,index)=>{
      if(scene&&scene.audio===undefined&&audioFallbackScenes[index]?.audio){
        inherited.push(index);
        return {...scene,audio:structuredClone(audioFallbackScenes[index].audio)};
      }
      return scene;
    })};
    const validated=validateStoryboard(data, expectedScenes, production, sceneDuration);
    for(const index of inherited)onAudioFallback?.(index);
    return validated;
  }
  throw new Error('Phản hồi chưa phải JSON hợp lệ. Kết quả gốc được giữ lại để bạn chỉnh và dựng lại.');
}

module.exports = { validateProject, buildPrompt, validateStoryboard, parseStoryboard, sceneContinuityInstructions };
