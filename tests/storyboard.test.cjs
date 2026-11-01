const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPrompt, parseStoryboard, validateStoryboard } = require('../src/storyboard.cjs');
const scene = { id: 1, duration_seconds: 8, description_vi: 'Bình minh trên hồ', voiceover_vi: '', video_prompt_en: 'A cinematic sunrise over a lake.', negative_prompt_en: '' };
const script = { title: 'Bình minh', summary: 'Một ngày mới', scenes: [scene] };

test('each built-in genre uses its own prompt rules, example and negative constraints',()=>{
 const {scriptPresets}=require('../src/script-presets.js');
 const project={title:'Kiểm tra mẫu',brief:'Ý tưởng riêng của tập',style:'Đời thường',ratio:'9:16',scenes:3,sceneDuration:8};
 for(const preset of scriptPresets.presets){
  const production={...(preset.production||scriptPresets.profile()),direction:preset.direction,templateId:preset.id,instructions:preset.instructions};
  const prompt=buildPrompt({...project,production});
  if(preset.direction==='cat-family'){
   assert.match(prompt,/five-row cat family reference sheet/);assert.match(prompt,/ut_ngao/);
   assert.doesNotMatch(prompt,/modest working vehicle repair garage/);
  }else{
   for(const term of ['five-row cat family','bo_bu','Bo_bu','ut_ngao','feline','paws','fur pattern','No human hands','bamboo daybed'])assert.ok(!prompt.includes(term),preset.id+': '+term);
   assert.match(prompt,/em_gai/);assert.match(prompt,/CHARACTER CONSISTENCY/);
   if(preset.direction==='review')assert.match(prompt,/modest working vehicle repair garage in Vietnam/);
  }
 }
 const generic=buildPrompt(project);assert.doesNotMatch(generic,/cat family|ut_ngao|feline|paws|repair garage/);
});
test('parses real-world JSON wrappers without evaluating content', () => {
  const json = JSON.stringify(script);
  for (const raw of [json, `\`\`\`json\n${json}\n\`\`\``, `JSON\n${json}`, `Kịch bản của bạn:\n${json}\nHoàn tất.`]) assert.deepEqual(parseStoryboard(raw, 1), script);
});
test('rejects incomplete, wrong scene count and invalid scene data', () => {
  assert.throws(() => parseStoryboard('{"title":', 1), /JSON/);
  assert.throws(() => parseStoryboard(JSON.stringify(script), 2), /2/);
  assert.throws(() => validateStoryboard({ ...script, scenes: [{ ...scene, id: 3 }] }), /id/);
  assert.throws(() => validateStoryboard({ ...script, scenes: [{ ...scene, duration_seconds: -1 }] }), /thời lượng/);
  assert.throws(() => validateStoryboard({ ...script, scenes: [{ ...scene, video_prompt_en: '' }] }), /prompt/);
  assert.throws(() => parseStoryboard('process.exit(1)'), /JSON/);
});
test('builds prompts from validated project settings', () => {
  const project = { title: 'Đà Lạt', brief: 'Buổi sáng', scenes: 2, ratio: '9:16', style: 'Điện ảnh' };
  assert.match(buildPrompt(project), /Chính xác 2 cảnh/);
  assert.match(buildPrompt(project), /9:16/);
  assert.throws(() => buildPrompt({ ...project, scenes: 0 }), /50/);
  assert.throws(() => buildPrompt({ ...project, brief: '' }), /ý tưởng/);
});

test('new scripts require action handoffs rather than skipping to static outcomes',()=>{
 const prompt=buildPrompt({title:'Đi câu',brief:'Hai mèo kéo được chiếc dép thay vì cá.',scenes:5,ratio:'9:16',style:'Dân dã'});
 for(const term of ['LIÊN KẾT CẢNH','nguyên nhân → hành động → kết quả','trạng thái đầu','trạng thái cuối','cảnh nối tiếp phải khớp','Không bỏ qua động tác quan trọng'])assert.ok(prompt.includes(term),term);
});

test('auto count and duration work independently and accept only the three duration choices',()=>{
 const project={title:'Auto',brief:'Câu chuyện ngắn',ratio:'9:16',scenes:'auto',sceneDuration:'auto'};
 const mixed={...script,scenes:[6,8,10].map((duration_seconds,i)=>({...scene,id:i+1,duration_seconds}))};
 assert.equal(parseStoryboard(JSON.stringify(mixed),'auto',undefined,{sceneDuration:'auto'}).scenes.length,3);
 for(const scenes of ['auto',3])for(const sceneDuration of ['auto',6,8,10]){
  const prompt=buildPrompt({...project,scenes,sceneDuration});
  assert.ok(prompt.includes(scenes==='auto'?'Auto số cảnh':'Chính xác 3 cảnh'));
  assert.ok(prompt.includes(sceneDuration==='auto'?'Auto thời lượng':'Mỗi cảnh đúng '+sceneDuration+' giây'));
 }
 assert.throws(()=>parseStoryboard(JSON.stringify(mixed),2,undefined,{sceneDuration:'auto'}),/yêu cầu 2/);
 assert.throws(()=>parseStoryboard(JSON.stringify(mixed),'auto',undefined,{sceneDuration:8}),/thời lượng/);
 assert.throws(()=>parseStoryboard(JSON.stringify({...script,scenes:[{...scene,duration_seconds:7}]}),'auto',undefined,{sceneDuration:'auto'}),/thời lượng/);
 assert.throws(()=>buildPrompt({...project,sceneDuration:7}),/Thời lượng/);
 assert.throws(()=>parseStoryboard(JSON.stringify({...script,scenes:[]}),'auto'),/1 đến 50/);
});
