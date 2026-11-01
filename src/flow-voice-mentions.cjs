const selector='.ProseMirror[role="textbox"]';
function voiceSegments(prompt){
 const result=[];let start=0;
 for(const match of prompt.matchAll(/\[Flow voice: ([^\]\n]+)\]/g)){
  result.push({text:prompt.slice(start,match.index)},{voice:match[1]});start=match.index+match[0].length;
 }
 result.push({text:prompt.slice(start)});return result;
}
async function readVoiceMentions(page){
 return page.locator(selector+' .mention-chip[data-reference-type="audio"]').evaluateAll(nodes=>nodes.map(e=>({id:e.getAttribute('data-audio-id')||e.getAttribute('data-mention-id'),name:e.textContent.trim()})));
}
async function insertVoiceMentions(page,prompt,voices,report=()=>{}){
 const parts=voiceSegments(prompt),wanted=parts.filter(p=>p.voice).map(p=>p.voice);
 if(wanted.some(name=>!voices.includes(name)))throw Error('Giọng trong lời thoại không khớp chip giọng đã gắn.');
 if(!wanted.length)return [];
 const input=page.locator(selector);
 // Use a real editor transaction. fill('') changes the DOM but ProseMirror may
 // restore its old document when the next mention transaction is dispatched.
 await input.focus();await input.press('Control+A');await input.press('Backspace');
 await page.waitForFunction(selector=>!document.querySelector(selector)?.innerText.trim()&&!document.querySelector(selector+' .mention-chip'),selector,{timeout:3000});
 if((await input.innerText()).trim()||(await readVoiceMentions(page)).length)throw Error('Chưa xóa được bản nháp cũ trước khi chèn chip giọng.');
 for(const part of parts){
  if(part.text){await input.press('Control+End');await page.keyboard.insertText(part.text);}
  if(!part.voice)continue;
  report('flow.voice.mention','Chèn chip giọng trong prompt: '+part.voice);
  await input.press('Control+End');await input.pressSequentially('@');
  const search=page.getByRole('textbox',{name:/^(Tìm kiếm thành phần|Search ingredients)$/i});
  await search.waitFor({state:'visible',timeout:5000});
  await page.getByRole('tablist',{name:/^(Di chuyển theo danh mục|Navigate by category)$/i}).getByText(/^(Giọng nói|Voices)$/i).click();
  await search.fill(part.voice);
  const item=page.locator('.asset-list-viewport .asset-item').filter({has:page.getByText(part.voice,{exact:true})});
  // Select only an exact voice title; never silently substitute a base voice.
  await item.first().waitFor({state:'visible',timeout:5000});
  if(await item.count()!==1)throw Error('Không tìm thấy duy nhất giọng Flow: '+part.voice);
  const before=(await readVoiceMentions(page)).length;await item.click();
  if((await readVoiceMentions(page)).length===before){
   await page.getByRole('button',{name:/^(Thêm vào câu lệnh|Add to prompt)$/i}).click({timeout:5000});
  }
  await page.waitForFunction(({selector,before})=>document.querySelectorAll(selector+' .mention-chip[data-reference-type="audio"]').length===before+1,{selector,before},{timeout:5000});
  const chips=await readVoiceMentions(page),chip=chips[chips.length-1];
  if(!chip.id||chip.name!==part.voice)throw Error('Flow chèn sai chip giọng: '+part.voice);
 }
 const chips=await readVoiceMentions(page);
 if(chips.length!==wanted.length||chips.some((c,i)=>c.name!==wanted[i]||!c.id))throw Error('Chip giọng trong prompt chưa đầy đủ.');
 const expected=parts.map(p=>p.text??p.voice).join('');
 const clean=s=>s.replace(/\s+/g,' ').replace(/\s+([.,;:!?])/g,'$1').trim();
 if(clean(await input.innerText())!==clean(expected))throw Error('Nội dung prompt sau khi chèn chip không khớp; dừng để tránh gửi nội dung lặp hoặc thiếu.');
 return chips;
}
async function verifyVoiceMentions(page,expected){
 const current=await readVoiceMentions(page);
 if(JSON.stringify(current)!==JSON.stringify(expected))throw Error('Chip giọng trong prompt đã thay đổi; hãy chuẩn bị lại cảnh.');
}
module.exports={voiceSegments,readVoiceMentions,insertVoiceMentions,verifyVoiceMentions};
