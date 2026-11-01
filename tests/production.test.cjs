const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateProduction}=require('../src/production.cjs');
const {buildPrompt,parseStoryboard}=require('../src/storyboard.cjs');
const {compilePrompt}=require('../src/flow.cjs');
const {profile,presets}=require('../src/script-presets.js').scriptPresets;
const p=profile(),scene={id:1,duration_seconds:8,description_vi:'Cô gái trong gara.',voiceover_vi:'',video_prompt_en:'Woman in a garage.',negative_prompt_en:'No text.',audio:{mode:'native',narrator:'',speakers:p.speakers,dialogue:[{speaker:'em_gai',text:'Xe rung chưa chắc do động cơ đâu anh.'},{speaker:'khach',text:'Thế do em hồi hộp à?'}],ambience:'Quiet garage.',music:''}};
test('template prompt carries channel, cast, region, narration and dialogue policy',()=>{
 assert.equal(presets.length,3);assert.deepEqual(presets.map(p=>p.direction),['review','comedy','cat-family']);assert.ok(presets.every(p=>!p.brief));
 const prompt=buildPrompt({title:'Gara',brief:'Xe rung',style:'Điện ảnh',ratio:'9:16',scenes:2,production:p});
 for(const term of ['Em gái gara','em_gai','south','narration=false','audio','hook','Không tự bịa'])assert.ok(prompt.includes(term),term);
 assert.throws(()=>validateProduction({...p,speakers:[p.speakers[0],p.speakers[0]]}),/duy nhất/);
});
test('reference lock is optional, persisted and overrides invented appearance in every scene prompt',()=>{
 const project={title:'Gara',brief:'Review xe',style:'Điện ảnh',ratio:'9:16',scenes:2,production:{...p,lockReference:true}};
 assert.equal(validateProduction(project.production).lockReference,true);
 assert.equal(validateProduction(p).lockReference,false);
 assert.match(buildPrompt(project),/KHÓA NGOẠI HÌNH THEO ẢNH THAM CHIẾU/);
 assert.match(buildPrompt(project),/giữ ngoại hình, trang phục và tỷ lệ kích thước/);
 assert.doesNotMatch(buildPrompt({...project,production:p}),/KHÓA NGOẠI HÌNH THEO ẢNH THAM CHIẾU/);
});
test('structured scene audio survives parsing and is compiled without speech suppression',()=>{
 const parsed=parseStoryboard(JSON.stringify({title:'Gara',summary:'',scenes:[scene]}),1,p);
 assert.deepEqual(parsed.scenes[0],{...scene,audio:{...scene.audio,voiceStrategy:'text',delivery:'brisk'}});const prompt=compilePrompt(parsed.scenes[0]);assert.doesNotMatch(prompt,/AUTHENTIC NATIVE VIETNAMESE|Flow voice:|assigned voice chip/);
 assert.match(prompt,/Southern Vietnamese accent/);assert.match(prompt,/Xe rung chưa chắc/);assert.match(prompt,/khach/);assert.doesNotMatch(prompt,/No spoken dialogue/);
 const narrator={...scene,voiceover_vi:'Hôm nay ở gara.',audio:{...scene.audio,narrator:'em_gai',dialogue:[]}};assert.match(compilePrompt(narrator),/Off-screen narrator/);
 assert.match(compilePrompt({...scene,audio:{...scene.audio,mode:'external'}}),/No spoken dialogue/);
 assert.match(compilePrompt({...scene,audio:undefined}),/Narration will be added separately/);
 assert.throws(()=>parseStoryboard(JSON.stringify({title:'Gara',summary:'',scenes:[{...scene,audio:undefined}]}),1,p),/thiếu cấu trúc/);
 assert.throws(()=>parseStoryboard(JSON.stringify({title:'Gara',summary:'',scenes:[{...scene,audio:{...scene.audio,dialogue:[{speaker:'unknown',text:'Xin chào'}]}}]}),1,p),/hồ sơ giọng/);
 const drift={...scene,audio:{...scene.audio,mode:'external',speakers:scene.audio.speakers.map(s=>({...s,region:'north'}))}};
 const fixed=parseStoryboard(JSON.stringify({title:'Gara',summary:'',scenes:[drift]}),1,p).scenes[0];assert.equal(fixed.audio.mode,'native');assert.equal(fixed.audio.speakers[0].region,'south');
});

test('character image survives validation and prompts use image references instead of mentions',()=>{
 const production={...p,speakers:p.speakers.map(s=>({...s,imagePath:'E:/private/cat.png'}))};
 assert.equal(validateProduction(production).speakers[0].imagePath,'E:/private/cat.png');
 const project={title:'Gara',brief:'Xe rung',style:'?i?n ?nh',ratio:'9:16',scenes:2,production};
 for(const custom of ['', 'Custom prompt']){const prompt=buildPrompt({...project,production:{...production,geminiPrompt:custom}});assert.doesNotMatch(prompt,/@ID|@em_gai|@khach/);assert.match(prompt,/NHÂN VẬT QUA ẢNH THAM CHIẾU/);assert.doesNotMatch(prompt,/private\/cat/);}
});

test('legacy saved character mention instructions are removed when building image reference prompts',()=>{
 const geminiPrompt='Câu chuyện mới.\nFlow: dùng @ID chính xác trong video_prompt_en cho nhân vật có mặt: @em_gai = Em gái gara; @khach = Khách. Không tự tạo ID hoặc thêm nhân vật vắng mặt.\n@em_gai enters the garage.';
 const prompt=buildPrompt({title:'Gara',brief:'Xe rung',style:'Điện ảnh',ratio:'9:16',scenes:2,production:{...p,geminiPrompt}});
 assert.doesNotMatch(prompt,/@ID|@em_gai|@khach/);assert.match(prompt,/Em gái gara enters the garage/);assert.match(prompt,/ảnh nhóm được đính kèm/);
});

test('custom Flow voices override base voices in prompt tags and summaries', () => {
 const customScene = {
  ...scene,
  audio: {
   ...scene.audio,
   speakers: scene.audio.speakers.map(s => s.id === 'em_gai' ? { ...s, customVoice: 'Em gái gara tuỳ chỉnh' } : s)
  }
 };
 const prompt = compilePrompt(customScene);
 assert.match(prompt, /\[Flow voice: Em gái gara tuỳ chỉnh\]/);
 assert.match(prompt, /Flow voice: Em gái gara tuỳ chỉnh/);
 assert.match(prompt, /em_gai \(Em gái gara\) uses \[Flow voice: Em gái gara tuỳ chỉnh\]/);
});

test('flow voices: matchSpeakerToCustomVoice matches character names and base voices', () => {
 const { matchSpeakerToCustomVoice } = require('../src/flow-voices.cjs');
 const customVoices = ['Út Ngáo tuỳ chỉnh', 'Bố Bự tuỳ chỉnh', 'Mẹ Mướp tuỳ chỉnh', 'Chị Na tuỳ chỉnh', 'Orus tuỳ chỉnh'];
 assert.equal(matchSpeakerToCustomVoice({ id: 'ut_ngao', name: 'Út Ngáo', flowVoice: 'Fenrir' }, customVoices), 'Út Ngáo tuỳ chỉnh');
 assert.equal(matchSpeakerToCustomVoice({ id: 'bo_bu', name: 'Bố Bự', flowVoice: 'Sadaltager' }, customVoices), 'Bố Bự tuỳ chỉnh');
 assert.equal(matchSpeakerToCustomVoice({ id: 'ti_ho', name: 'Anh Tí Hổ', flowVoice: 'Orus' }, customVoices), 'Orus tuỳ chỉnh');
 assert.equal(matchSpeakerToCustomVoice({ id: 'unknown', name: 'Người lạ', flowVoice: 'Zephyr' }, customVoices), null);
});
