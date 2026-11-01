const ROLES={character_portrait:{label:'Ảnh nhân vật',prompt:'CHARACTER PORTRAIT: preserve the exact identity, features and appearance of the named character assigned to this image. This is one character, not an extra cast member.'},character_group:{label:'Gia đình / nhóm nhân vật',prompt:'CHARACTER GROUP / FAMILY REFERENCE SHEET: this image contains multiple distinct characters, possibly shown from several angles. Match each named character to its assigned row or region using the scene and reference description. Preserve each individual identity, fur markings, eye color, anatomy and relative body size. Multiple views of one character are not extra characters. Do not blend or swap identities, duplicate characters, copy text, grid lines, labels or the studio background. Only include characters called for by the scene.'},female_lead:{label:'Nữ chính',prompt:'FEMALE LEAD: use this image only for the female lead identity, face, hair, clothing and accessories. Keep her appearance consistent; do not transfer her identity or outfit to the male lead.'},male_lead:{label:'Nam chính',prompt:'MALE LEAD: use this image only for the male lead identity, face, hair, clothing and accessories. Keep his appearance consistent; do not transfer his identity or outfit to the female lead.'},setting:{label:'Bối cảnh',prompt:'SETTING / LOCATION: use this image for the environment, architecture, spatial layout, materials and lighting. Do not use people or objects in this image as character or product identity references.'},product:{label:'Sản phẩm',prompt:'PRODUCT: use this image for the exact product identity, shape, colors, materials, proportions and visible design details. Do not replace the product with another model or apply product styling to a character.'}};
function syncCharacterReferences(state){
 const speakers=state.project?.production?.speakers||[];
 const list=Array.isArray(state.flowReferences)?state.flowReferences:state.flowReference?[{...state.flowReference,id:state.flowReference.id||state.flowReference.name,role:'female_lead'}]:[];
 const portraits=speakers.filter(s=>s.imagePath).map(s=>{
  const name=require('node:path').basename(s.imagePath),id='character-'+s.id+'-'+name;
  const old=list.find(r=>r.id===id&&r.path===s.imagePath);
  return Object.assign(old||{},{id,name,path:s.imagePath,role:'character_portrait',managedPortrait:true,speakerId:s.id,speakerName:s.name,displayName:'Ảnh '+s.name,description:'Identity reference for '+s.id+' ('+s.name+'). Use this portrait for this character only; it takes priority over group-sheet appearance for this character.'});
 });
 if(portraits.length||list.some(r=>r.managedPortrait))state.flowReferences=[...list.filter(r=>!r.managedPortrait),...portraits];
 return state.flowReferences||list;
}
function references(state){syncCharacterReferences(state);const list=Array.isArray(state.flowReferences)?state.flowReferences:state.flowReference?[{...state.flowReference,id:state.flowReference.id||state.flowReference.name,role:'female_lead'}]:[];return list;}
function orderedReferences(items=[]){if(!Array.isArray(items))throw Error('Danh sách ảnh tham chiếu không hợp lệ.');for(const r of items)if(!ROLES[r.role]||!r.name)throw Error('Vai trò ảnh tham chiếu không hợp lệ.');return Object.keys(ROLES).flatMap(role=>items.filter(r=>r.role===role));}
function referencePrompt(items=[]){const list=orderedReferences(items);if(!list.length)return '';return 'REFERENCE IMAGE ASSIGNMENTS (attached in this exact order):\n'+list.map((r,i)=>`Image ${i+1} [${r.name}]: ${ROLES[r.role].prompt}${r.description?.trim()?` Additional instructions for this reference: ${r.description.trim()}`:''}`).join('\n')+'\nUse each attached image only for its assigned role. Multiple images in the same role describe the same subject from different views; do not create additional characters or duplicate products. Follow the scene actions and dialogue while preserving referenced identity and design. Do not swap the female and male leads. A reference defines appearance; it does not introduce a subject into a scene that does not call for it.';}
const FRAME_ROLES={start_frame:{label:'Khung hình bắt đầu'},end_frame:{label:'Khung hình kết thúc'}};
function assertSceneImageChoice(items,sceneId,role,excludeId){
 if(sceneId==null)return;
 const frame=Boolean(FRAME_ROLES[role]),local=items.filter(r=>r.sceneId===sceneId&&(r.id||r.name)!==excludeId);
 if(local.some(r=>frame?ROLES[r.role]:FRAME_ROLES[r.role]))throw Error(frame?'Hãy gỡ hết ảnh tham chiếu riêng của cảnh trước khi chọn khung hình đầu/cuối.':'Hãy gỡ hết khung hình đầu/cuối của cảnh trước khi chọn ảnh tham chiếu riêng.');
}
function sceneInputs(items=[],sceneId,scene){
 if(scene){const text=[scene.description_vi,scene.video_prompt_en,...(scene.audio?.dialogue||[]).map(d=>d.speaker)].join(' ').toLowerCase();items=items.filter(r=>!r.managedPortrait||[r.speakerId,r.speakerName].some(v=>v&&text.includes(v.toLowerCase())));}

 const local=items.filter(r=>r.sceneId===sceneId),overrides=new Set(local.filter(r=>ROLES[r.role]).map(r=>r.role));
 if(['start_frame','end_frame'].some(role=>local.filter(r=>r.role===role).length>1))throw Error('Mỗi cảnh chỉ được có một ảnh bắt đầu và một ảnh kết thúc.');
 const ingredients=orderedReferences([...items.filter(r=>r.sceneId==null&&ROLES[r.role]&&!overrides.has(r.role)),...local.filter(r=>ROLES[r.role])]);
 const frames={start:local.find(r=>r.role==='start_frame')||null,end:local.find(r=>r.role==='end_frame')||null};
 if((frames.start||frames.end)&&local.some(r=>ROLES[r.role]))throw Error('Cảnh đang có cả khung hình và ảnh tham chiếu riêng. Hãy gỡ hết một nhóm trước khi tạo video.');
 if(frames.end&&!frames.start)throw Error('Cảnh có khung hình kết thúc nhưng chưa có khung hình bắt đầu. Hãy thêm ảnh bắt đầu.');
 if(frames.start&&ingredients.some(r=>r.managedPortrait))throw Error('Cảnh có ảnh nhân vật riêng và khung hình đầu/cuối. Hãy gỡ khung hình đầu/cuối để Flow dùng ảnh nhân vật làm tham chiếu; hai chế độ không dùng đồng thời.');
 return {references:frames.start?[]:ingredients,frames,generationMode:frames.start?'frames':'ingredients'};
}
function allOrderedReferences(items=[]){
 if(!Array.isArray(items)||items.some(r=>(!ROLES[r.role]&&!FRAME_ROLES[r.role])||!r.name))throw Error('Vai trò ảnh tham chiếu không hợp lệ.');
 return [...orderedReferences(items.filter(r=>ROLES[r.role])),...items.filter(r=>FRAME_ROLES[r.role])];
}
module.exports={syncCharacterReferences,ROLES,FRAME_ROLES,references,orderedReferences,allOrderedReferences,sceneInputs,referencePrompt,assertSceneImageChoice};
