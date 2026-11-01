const {test}=require('node:test'),assert=require('node:assert/strict');
const {presets}=require('../src/script-presets.js').scriptPresets;
const {validateProduction}=require('../src/production.cjs');
const {buildPrompt,parseStoryboard}=require('../src/storyboard.cjs');
const {compilePrompt,sceneVoiceNames}=require('../src/flow.cjs');
const {referencePrompt}=require('../src/references.cjs');

test('cat series retains five identities and voices with rural continuity and feline reference lock',()=>{
 const preset=presets.find(p=>p.id==='cat-family'),raw=preset.production;
 const production=validateProduction(JSON.parse(JSON.stringify(raw)));
 assert.equal(production.character,raw.character);assert.equal(production.instructions,raw.instructions);
 assert.equal(production.speakers.length,5);assert.equal(production.lockReference,true);
 assert.deepEqual(production.speakers.map(s=>s.id),['bo_bu','me_muop','ti_ho','chi_na','ut_ngao']);
 assert.deepEqual(production.speakers.map(s=>s.flowVoice),['Charon','Aoede','Orus','Autonoe','Fenrir']);
 assert.equal(new Set(production.speakers.map(s=>s.description)).size,5);
 const prompt=buildPrompt({title:'Nhà mèo bất ổn',brief:'Út ăn vụng cá, Tí Hổ định đổ lỗi cho em nhưng bị mẹ phát hiện.',scenes:5,...preset.defaults,production});
 for(const term of ['Nhà mèo bất ổn','Bố Bự','Mẹ Mướp','Anh Tí Hổ','Chị Na','Út Ngáo','khuyết nhỏ tai phải','đốm đen quanh mắt phải','một ngôi nhà quê Việt Nam','tỷ lệ kích thước','amateur handheld smartphone footage','Út Ngáo nhỏ rõ rệt','Khẩu hình khớp chính xác lời tiếng Việt'])assert.ok(prompt.includes(term),term);
 assert.doesNotMatch(prompt,/TIÊU CHUẨN REVIEW|Nhân vật chính là người phụ nữ|Preserve the reference face identity, hairstyle/);
 const scene={id:1,duration_seconds:8,description_vi:'Bố Bự hỏi Út ở sân nhà.',voiceover_vi:'',video_prompt_en:'Bo Bu and Ut Ngao in a rural Vietnamese courtyard.',negative_prompt_en:'No identity swap.',audio:{mode:'native',narrator:'',speakers:production.speakers,dialogue:[{speaker:'bo_bu',text:'Ai ăn mất cá rồi?'},{speaker:'ut_ngao',text:'Con chỉ nếm thôi bố!'}],ambience:production.ambience,music:production.music}};
 const parsed=parseStoryboard(JSON.stringify({title:'Mất cá',summary:'Sân gạch, sáng nắng nhẹ.',scenes:[scene]}),1,production).scenes[0];
 assert.deepEqual(parsed.audio.speakers,production.speakers);
 const compiled=compilePrompt(parsed,[{name:'family.png',role:'character_group'}]);
 assert.match(compiled,/CHARACTER GROUP \/ FAMILY REFERENCE SHEET/);
 assert.match(compiled,/Flow voice: Charon/);
 assert.match(compiled,/Flow voice: Fenrir/);
 assert.match(compiled,/bo_bu \(Bố Bự\) uses \[Flow voice: Charon\]/);
 assert.deepEqual(sceneVoiceNames(parsed),['Charon','Fenrir']);
 assert.match(compiled,/Match lip movements to the exact dialogue/);
 assert.match(compiled,/silent characters keep their mouths closed/);
 assert.doesNotMatch(compiled,/Speaking delivery: brisk|No spoken dialogue/);
 assert.equal(compilePrompt({...parsed,audio:{...parsed.audio,mode:'external'}}).includes('Synchronize the visible'),false);
});

test('family sheet supports multiple characters rather than a single lead',()=>{
 const prompt=referencePrompt([{name:'cats.png',role:'character_group',description:'Rows: Bố Bự, Mẹ Mướp, Tí Hổ, Chị Na, Út Ngáo.'}]);
 assert.match(prompt,/multiple distinct characters/);assert.match(prompt,/relative body size/);
 assert.match(prompt,/Multiple views of one character are not extra characters/);
 assert.match(prompt,/Bố Bự/);assert.doesNotMatch(prompt,/use this image only for the female lead identity/);
});

test('video prompts require strict anatomical continuity and timestamped action sequence',()=>{
 const prompt=buildPrompt({title:'Test',brief:'Một tập mới.',ratio:'9:16',scenes:'auto',sceneDuration:'auto',production:require('../src/script-presets.js').scriptPresets.catProfile()});
 for(const term of [
  'CHARACTER CONSISTENCY',
  'STRICT ANATOMICAL AND OBJECT CONTINUITY',
  'ACTION SEQUENCE',
  'CAMERA AND PHYSICS',
  'ABSOLUTE NEGATIVE CONSTRAINTS',
  'No extra paws',
  'No limb duplication'
 ]) assert.ok(prompt.includes(term), term);
});

test('storyboard parses detailed physics and anatomical video prompts successfully',()=>{
 const production=require('../src/script-presets.js').scriptPresets.catProfile();
 const detailedPrompt=`Vertical 9:16, photorealistic amateur handheld smartphone video, continuous single shot. Rural Vietnamese house courtyard, warm natural afternoon daylight 5500K.

**CHARACTER CONSISTENCY:**
Use the attached five-row cat family reference sheet. Preserve the exact feline identity, fur markings, eye colors, body proportions and size differences of each character.

- bo_bu (Row 1): Massive orange tabby father cat, broad face, amber eyes, small notch on right ear.
- ut_ngao (Row 5): Tiny black-and-white kitten, blue eyes, dark patch around right eye, short legs. Significantly smaller than bo_bu.

**STRICT ANATOMICAL AND OBJECT CONTINUITY:**

Bo_bu has exactly FOUR feline limbs: TWO front paws and TWO hind legs. No additional limbs under any circumstances.

- RIGHT FRONT PAW: Holds the wooden handle of ONE dry woven palm-leaf fan throughout the ENTIRE video. The paw remains physically wrapped around the handle with a consistent grip. The fan NEVER leaves this paw, NEVER disappears, NEVER changes shape, and NEVER transfers to another paw.
- LEFT FRONT PAW: Remains completely EMPTY throughout the video. This is the ONLY paw allowed to perform the dismissive gesture.
- BOTH HIND LEGS: Remain relaxed and stationary on the bamboo daybed throughout the scene.

Each paw performs only its assigned action. No limb duplication, no object teleportation, no sudden changes in grip.

**ACTION SEQUENCE:**

0–2s: Handheld smartphone camera follows ut_ngao running upright on his two hind legs from the living room doorway toward the sunny brick courtyard. Bo_bu is already visible lying lazily on a rustic bamboo daybed beside a ceramic teapot set. His RIGHT front paw is already holding the palm-leaf fan, slowly fanning himself with small, gentle wrist movements.

2–4s: Ut_ngao stops beside the daybed, looking frustrated. He complains animatedly while gesturing with his two small front paws. Bo_bu remains sleepy, eyes half-closed. His RIGHT front paw continues holding the SAME fan without releasing it.

4–6s: Bo_bu lazily lifts ONLY his EMPTY LEFT front paw a short distance above the daybed and makes ONE small dismissive sideways waving gesture toward ut_ngao. His RIGHT front paw continues securely holding the fan. The fan may briefly stop moving but MUST remain firmly gripped in the RIGHT paw.

6–8s: Bo_bu lowers his LEFT front paw back onto the daybed, closes his eyes, and resumes gently fanning himself using ONLY his RIGHT front paw. Ut_ngao stares at his father in disbelief.

**CAMERA AND PHYSICS:**

Single continuous handheld shot, no cuts, no sudden camera jumps. Keep bo_bu's upper body and BOTH front paws clearly visible whenever he gestures. Avoid overlapping or obscuring his paws.

Realistic feline anatomy, natural weight distribution, believable joint movement, physically consistent object interaction, realistic fur and shadows.

**ABSOLUTE NEGATIVE CONSTRAINTS:**

No extra paws, no third front arm, no duplicated limbs, no disappearing fan, no floating objects, no switching the fan between paws, no human hands, no anatomical morphing, no sudden object appearance, no impossible movements, no cartoon physics.`;

 const scene={
  id:1,
  duration_seconds:8,
  description_vi:'Út Ngáo chạy ra mách bố Bự nhưng bố lười chỉ phe phẩy quạt.',
  voiceover_vi:'',
  video_prompt_en:detailedPrompt,
  negative_prompt_en:'identity swap, fur pattern drift, extra limbs, duplicate paws, human hands, morphing, cartoon, text',
  audio:{mode:'native',narrator:'',speakers:production.speakers,dialogue:[{speaker:'ut_ngao',text:'Bố ơi anh Tí Hổ bắt nạt con!'}],ambience:production.ambience,music:production.music}
 };
 const parsed=parseStoryboard(JSON.stringify({title:'Mách bố',summary:'Sân gạch nhà quê',scenes:[scene]}),1,production);
 assert.equal(parsed.scenes[0].video_prompt_en,detailedPrompt);
 const compiled=compilePrompt(parsed.scenes[0],[{name:'family.png',role:'character_group'}]);
 assert.ok(compiled.includes('STRICT ANATOMICAL AND OBJECT CONTINUITY'));
 assert.ok(compiled.includes('CHARACTER GROUP / FAMILY REFERENCE SHEET'));
});

test('clear situations and rural family dialogue apply to saved and custom cat prompts',()=>{
 const production=require('../src/script-presets.js').scriptPresets.catProfile();
 for(const geminiPrompt of ['', 'Ý tưởng đã lưu']){
  const prompt=buildPrompt({title:'Tập mới',brief:'Út giấu cá.',ratio:'9:16',scenes:'auto',sceneDuration:'auto',production:{...production,geminiPrompt}});
  for(const term of ['TÌNH HUỐNG DỄ HIỂU','hành động gây hiểu lầm','THOẠI GIA ĐÌNH QUÊ VIỆT NAM','bố/mẹ/con','đúng vai và vùng giọng','tránh văn viết'])assert.ok(prompt.includes(term),term);
 }
});
