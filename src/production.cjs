const text=(v,max=10000)=>String(v??'').trim().slice(0,max);
function validateProduction(p){
 if(!p)return undefined;
 if(typeof p!=='object'||!Array.isArray(p.speakers)||!p.speakers.length||p.speakers.length>8)throw new Error('Hồ sơ cần từ 1 đến 8 người nói.');
 const ids=new Set();
 const speakers=p.speakers.map(s=>{const id=text(s.id,40);if(!/^[a-z][a-z0-9_-]*$/i.test(id)||ids.has(id))throw new Error('Mã người nói phải duy nhất, không dấu.');ids.add(id);return{id,name:text(s.name,100),gender:['female','male','other'].includes(s.gender)?s.gender:'female',region:['north','central','south'].includes(s.region)?s.region:'south',description:text(s.description,1500)};});
 return {templateId:text(p.templateId,100),channel:text(p.channel,100),direction:text(p.direction,100),instructions:text(p.instructions),character:text(p.character,3000),lockReference:p.lockReference===true,audioMode:p.audioMode==='external'?'external':'native',narration:Boolean(p.narration),dialogue:Boolean(p.dialogue),ambience:text(p.ambience,1500),music:text(p.music,1500),speakers};
}
function validateAudio(audio){
 if(!audio||typeof audio!=='object'||!Array.isArray(audio.dialogue)||audio.dialogue.length>30)throw new Error('Âm thanh cảnh cần danh sách lời thoại hợp lệ.');
 return {mode:audio.mode==='external'?'external':'native',narrator:text(audio.narrator,40),dialogue:audio.dialogue.map(d=>({speaker:text(d.speaker,40),text:text(d.text,3000)})),ambience:text(audio.ambience,1500),music:text(audio.music,1500),speakers:validateProduction({speakers:audio.speakers}).speakers,...(audio.delivery==='brisk'?{delivery:'brisk'}:{})};
}
const regions={north:'Northern Vietnamese accent',central:'Central Vietnamese accent',south:'Southern Vietnamese accent'};
function audioPrompt(scene){
 const a=scene.audio;if(!a)return 'Audio: natural environmental sound only. No spoken dialogue, no voiceover. Narration will be added separately.';
 const sounds=`Environmental sound: ${a.ambience||'none'}. Background music: ${a.music||'none'}.`;
 if(a.mode==='external')return `${sounds}\nNo spoken dialogue or voiceover in this video. Speech is reserved for separate post-production; do not lip-sync.`;
 const voice=id=>{const s=a.speakers.find(s=>s.id===id);if(!s)throw new Error(`Không tìm thấy hồ sơ giọng: ${id}`);return `${s.id} (${s.name}; ${s.gender}; ${regions[s.region]}; ${s.description})`;};
 const lines=a.dialogue.filter(d=>d.text.trim()).map(d=>`${voice(d.speaker)} says in Vietnamese, exactly: ${JSON.stringify(d.text)}`);
 if(scene.voiceover_vi?.trim()){if(!a.narrator)throw new Error('Cảnh có lời dẫn nhưng chưa chọn người dẫn.');lines.unshift(`Off-screen narrator ${voice(a.narrator)}: ${JSON.stringify(scene.voiceover_vi)}`);}
 return `${sounds}\n${lines.length?lines.join('\n'):'No spoken dialogue or voiceover.'}\n${a.delivery==='brisk'?'Speaking delivery: brisk, clear Vietnamese review presentation. Maintain natural articulation and brief pauses; fit the exact lines in the clip without rushing or changing voice identity.':''}\nKeep each speaker voice identity and accent consistent across clips. Only the indicated speaker speaks each line. No extra speech, no translated dialogue, no subtitles. Avoid overlapping voices.`;
}
module.exports={validateProduction,validateAudio,audioPrompt};
