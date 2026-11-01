const catVoices={bo_bu:'Charon',me_muop:'Aoede',ti_ho:'Orus',chi_na:'Autonoe',ut_ngao:'Fenrir'};
const text=(v,max=10000)=>String(v??'').trim().slice(0,max);
function validateProduction(p){
 if(!p)return undefined;
 if(typeof p!=='object'||!Array.isArray(p.speakers)||!p.speakers.length||p.speakers.length>8)throw new Error('Hồ sơ cần từ 1 đến 8 người nói.');
 const ids=new Set();
 const speakers=p.speakers.map(s=>{const id=text(s.id,40);if(!/^[a-z][a-z0-9_-]*$/i.test(id)||ids.has(id))throw new Error('Mã người nói phải duy nhất, không dấu.');ids.add(id);const item={id,name:text(s.name,100),gender:['female','male','other'].includes(s.gender)?s.gender:'female',region:['north','central','south'].includes(s.region)?s.region:'south',description:text(s.description,1500)};if(s.flowVoice)item.flowVoice=text(s.flowVoice,100);else if(p.direction==='cat-family'&&catVoices[id])item.flowVoice=catVoices[id];if(s.customVoice)item.customVoice=text(s.customVoice,100);if(s.imagePath)item.imagePath=text(s.imagePath,2000);return item;});
 if(p.geminiPrompt && (typeof p.geminiPrompt!=='string'||p.geminiPrompt.length>100000))throw new Error('Prompt Gemini tối đa 100.000 ký tự.');
 return {geminiPrompt:text(p.geminiPrompt,100000),templateId:text(p.templateId,100),channel:text(p.channel,100),direction:text(p.direction,100),instructions:text(p.instructions),character:text(p.character,3000),lockReference:p.lockReference===true,audioMode:p.audioMode==='external'?'external':'native',narration:Boolean(p.narration),dialogue:Boolean(p.dialogue),ambience:text(p.ambience,1500),music:text(p.music,1500),speakers};
}
function voiceStrategy(audio){return audio?.voiceStrategy==='text'||(!audio?.voiceStrategy&&audio?.delivery==='brisk')?'text':'flow';}
function validateAudio(audio){
 if(!audio||typeof audio!=='object'||!Array.isArray(audio.dialogue)||audio.dialogue.length>30)throw new Error('Âm thanh cảnh cần danh sách lời thoại hợp lệ.');
 return {mode:audio.mode==='external'?'external':'native',narrator:text(audio.narrator,40),dialogue:audio.dialogue.map(d=>({speaker:text(d.speaker,40),text:text(d.text,3000)})),ambience:text(audio.ambience,1500),music:text(audio.music,1500),speakers:validateProduction({speakers:audio.speakers}).speakers,...(audio.voiceStrategy?{voiceStrategy:voiceStrategy(audio)}:{}),...(audio.delivery==='brisk'?{delivery:'brisk'}:{})};
}
const regions={
 north:'Authentic native Northern Vietnamese accent (thuần âm điệu Bắc Bộ, phát âm chuẩn thanh điệu tiếng Việt, không lai Tây)',
 central:'Authentic native Central Vietnamese accent (thuần âm điệu miền Trung, phát âm chuẩn tiếng Việt)',
 south:'Authentic native Southern Vietnamese accent (thuần âm điệu miền Nam, phát âm chuẩn tiếng Việt)'
};
function audioPrompt(scene){
 const a=scene.audio;if(!a)return 'Audio: natural environmental sound only. No spoken dialogue, no voiceover. Narration will be added separately.';
 const sounds=`Environmental sound: ${a.ambience||'none'}. Background music: ${a.music||'none'}.`;
 if(a.mode==='external')return `${sounds}\nNo spoken dialogue or voiceover in this video. Speech is reserved for separate post-production; do not lip-sync.`;
 const speakerVoice=s=>s&&(s.customVoice||s.customVoiceName||s.flowVoice);
 const used=[...new Set([...(a.dialogue||[]).filter(d=>d.text.trim()).map(d=>d.speaker),...(scene.voiceover_vi?.trim()?[a.narrator]:[])])];
 const descriptive=voiceStrategy(a)==='text';
 const assignments=used.map(id=>{const s=a.speakers.find(s=>s.id===id);if(!s)throw new Error('Không tìm thấy hồ sơ giọng: '+id);if(descriptive)return `${id} (${s.name}): ${s.gender}; ${regions[s.region]||regions.south}. ${s.description||'Natural, clear Vietnamese speech.'} Keep this same voice identity throughout the project.`;const name=speakerVoice(s);if(!name)throw new Error('Chưa chọn giọng Flow: '+id);return id+' ('+s.name+') uses [Flow voice: '+name+'].';});
 const lines=a.dialogue.filter(d=>d.text.trim()).map(d=>d.speaker+' says in Vietnamese, exactly: '+JSON.stringify(d.text));
 if(scene.voiceover_vi?.trim()){if(!a.narrator)throw new Error('Missing narrator.');lines.unshift('Off-screen narrator '+a.narrator+' says in Vietnamese, exactly: '+JSON.stringify(scene.voiceover_vi));}
 return sounds+'\n'+assignments.join('\n')+'\n'+(lines.length?lines.join('\n'):'No spoken dialogue or voiceover.')+'\n'+(descriptive?'Use only the voice descriptions above; keep each speaker distinct and consistent.':'Use each assigned voice chip without redesigning its voice or accent.')+' Only the indicated speaker speaks each line. Match lip movements to the exact dialogue; silent characters keep their mouths closed. No extra speech, overlapping voices or subtitles.';

}
function resolveSceneVoices(scene,production){
 if(!scene?.audio||!production)return scene;
 const profile=validateProduction(production);
 return {...scene,audio:{...scene.audio,voiceStrategy:profile.direction==='review'?'text':'flow',speakers:scene.audio.speakers.map(s=>{const prodSpeaker=profile.speakers.find(p=>p.id===s.id);const voice=production.speakers?.find(p=>p.id===s.id)?.flowVoice||s.flowVoice||prodSpeaker?.flowVoice;const customVoice=prodSpeaker?.customVoice||s.customVoice;return {...s,...prodSpeaker,...(voice?{flowVoice:voice}:{}),...(customVoice?{customVoice}:{})};})}};
}
module.exports={validateProduction,validateAudio,audioPrompt,resolveSceneVoices,voiceStrategy};
