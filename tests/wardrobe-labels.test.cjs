const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compilePrompt}=require('../src/flow.cjs');
const {buildPrompt}=require('../src/storyboard.cjs');
const {scriptPresets}=require('../src/script-presets.js');
test('compiled prompts include each automatic appearance rule once',()=>{
 const scene={duration_seconds:8,video_prompt_en:'UNIQUE_SCENE_ACTION',negative_prompt_en:'text, logos, text'};
 const prompt=compilePrompt(scene,[{name:'lead.png',role:'female_lead'}]);
 for(const label of ['UNIQUE_SCENE_ACTION','REFERENCE WARDROBE AUTHORITY:','PROJECT HAIRSTYLE CONTINUITY:','MANDATORY CLEAN IMAGE:'])assert.equal(prompt.split(label).length-1,1,label);
 assert.ok(prompt.length<3000);
 assert.equal(prompt.match(/Constraints: ([^\n]+)/)[1].split(', ').filter(s=>s==='text').length,1);
});

test('character wardrobe overrides invented workwear and cast labels stay invisible',()=>{
 const scene={duration_seconds:8,video_prompt_en:'The female mechanic wears dark blue garage overalls. Em gái gara speaks to Khách.',negative_prompt_en:''};
 const prompt=compilePrompt(scene,[{name:'lead.png',role:'female_lead'}]);
 assert.match(prompt,/Attached character images override conflicting scene clothing/);
 assert.match(prompt,/never invent a mechanic uniform/);
 assert.match(prompt,/full-body outfit and portrait face as ONE person/);
 assert.match(prompt,/invisible metadata, never graphics or writing on clothing/);
 assert.match(prompt,/Spoken dialogue is audio only/);
 assert.ok(prompt.lastIndexOf('REFERENCE WARDROBE AUTHORITY')>prompt.indexOf(scene.video_prompt_en));
 assert.doesNotMatch(compilePrompt(scene,[{name:'garage.png',role:'setting'}]),/REFERENCE WARDROBE AUTHORITY/);
});

test('review script generation preserves referenced clothes without inventing a uniform',()=>{
 const production=scriptPresets.profile();
 const prompt=buildPrompt({title:'Bơm xăng',brief:'Giải thích bảo dưỡng bơm xăng',ratio:'9:16',scenes:3,production});
 assert.match(prompt,/preserve the exact outfit from the attached character reference/);
 assert.match(prompt,/TÊN NHÂN VẬT LÀ SIÊU DỮ LIỆU/);
 assert.doesNotMatch(production.character,/trang phục làm việc gọn gàng/);
});

test('hairstyle locks to the current project reference and overrides conflicting scene descriptions',()=>{
 for(const hair of ['long loose hair','a high ponytail']){
  const scene={duration_seconds:8,video_prompt_en:'The mechanic has '+hair+'.'};
  const prompt=compilePrompt(scene,[{name:'current-project-reference.png',role:'female_lead'}]);
  assert.match(prompt,/same length, color, parting, fringe, texture, tied\/untied state, tie height and accessories/);
  assert.match(prompt,/reference portrait overrides conflicting hair descriptions/);
  assert.match(prompt,/Other projects may use different hairstyles/);
  assert.ok(prompt.indexOf('PROJECT HAIRSTYLE CONTINUITY')>prompt.indexOf(scene.video_prompt_en));
 }
 const project={title:'Review xe',brief:'Giải thích bơm xăng',ratio:'9:16',scenes:3,production:scriptPresets.profile()};
 const prompt=buildPrompt(project);assert.match(prompt,/KHÓA KIỂU TÓC TRONG DỰ ÁN/);assert.match(prompt,/lặp nguyên mô tả đó trong từng video_prompt_en/);assert.match(prompt,/kể cả khi viết lại riêng cảnh/);
});
