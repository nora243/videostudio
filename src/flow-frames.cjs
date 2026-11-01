const fs=require('node:fs');
const {referenceIdentity}=require('./reference-identity.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function frameControl(page,kind){return page.locator('flow-base-prompt-box .frame-trigger').nth(kind==='start'?0:1);}
async function frameState(page,kind){
 const control=frameControl(page,kind),count=await control.count();
 if(!count)return null;
 if(count!==1)throw Error('Flow có nhiều ô khung hình trùng nhãn; chưa gửi video.');
 const source=await control.evaluate(element=>{const image=element.querySelector('img');return image?.currentSrc||image?.src||'';});
 return source?(referenceIdentity(source)||'unrecognized-frame'):null;
}
async function removeFrame(page,kind){
 const control=frameControl(page,kind);
 // Remove only the image attached to this slot; never delete an asset from the library.
 const remove=control.locator('.hover-icon-overlay');
 if(await remove.count()!==1)throw Error('Chưa nhận diện được nút gỡ khung hình Flow. Hãy gỡ ảnh trong ô khung hình rồi chuẩn bị lại; chưa gửi video.');
 await control.hover();await remove.click();
 for(let i=0;i<30;i++){if(!await frameState(page,kind))return;await sleep(100);}
 throw Error('Flow chưa gỡ xong khung hình. Chưa gửi video.');
}
async function reconcileFrames(page,frames,owned=[]){
 for(const kind of ['start','end']){
  const current=await frameState(page,kind);if(!current)continue;
  const expected=frames?.[kind],url=page.url().split('?')[0],known=expected?.projectUrl===url?expected.assetId:expected?.bindings?.[url];
  if(current===known)continue;
  if(!owned.some(r=>r.assetId===current||r.bindings?.[url]===current))throw Error('Flow đang có khung hình ngoài cấu hình của tool. Hãy gỡ ảnh đó trước khi chuẩn bị.');
  await removeFrame(page,kind);
 }
}
async function attachFrame(page,kind,reference,report=()=>{}){
 const slot=frameControl(page,kind);
 if(await slot.count()!==1)throw Error('Không tìm thấy ô '+(kind==='start'?'Add start frame':'Add end frame')+' trong Flow. Chưa gửi video.');
 const url=page.url().split('?')[0],current=await frameState(page,kind),known=reference.projectUrl===url?reference.assetId:reference.bindings?.[url];
 if(current){if(current===known)return current;throw Error('Khung hình đang gắn khác ảnh đã chọn. Chưa gửi video.');}
 report('flow.frame.select','Chọn ảnh '+(kind==='start'?'khung hình đầu':'khung hình cuối'));
 await slot.click();
 const search=page.getByRole('textbox',{name:/^(Tìm kiếm thành phần|Search ingredients)$/i});
 await search.fill(reference.name);
 const option=page.getByRole('option').filter({hasText:reference.name});
 try{await option.first().waitFor({state:'visible',timeout:10000});}
 catch{
  const loading=page.locator('flow-add-menu-popover-content').getByRole('progressbar');
  if(await loading.count())await loading.first().waitFor({state:'hidden',timeout:30000});
  if(await option.count())throw Error('Thư viện khung hình chưa sẵn sàng; hãy chuẩn bị lại, chưa upload trùng.');
  if(!reference.path||!fs.existsSync(reference.path))throw Error('Không tìm thấy ảnh khung hình cục bộ.');
  report('flow.frame.upload','Tải ảnh khung hình lên thư viện Flow');
  const pending=page.waitForEvent('filechooser',{timeout:10000});pending.catch(()=>{});
  const upload=page.getByRole('button',{name:/^(Tải nội dung nghe nhìn lên|Upload media|Upload image|Tải ảnh lên)$/i});
  await upload.click();await (await pending).setFiles(reference.path);
  await option.first().waitFor({state:'visible',timeout:60000});
 }
 if(await option.count()!==1)throw Error('Có nhiều ảnh khung hình trùng tên trong Flow. Chưa gửi video.');
 let thumbnailId='';
 for(let i=0;i<120;i++){
  const image=await option.locator('img').evaluate(img=>({src:img.currentSrc||img.src,complete:img.complete,width:img.naturalWidth}));
  if(image.complete&&image.width&&referenceIdentity(image.src)){thumbnailId=referenceIdentity(image.src);break;}
  await sleep(500);
 }
 if(!thumbnailId)throw Error('Ảnh khung hình vẫn đang tải; chưa gửi video.');
 if(await frameState(page,kind))throw Error('Ô khung hình đã thay đổi trong lúc chọn ảnh. Chưa gửi video.');
 await option.click();
 const add=page.getByRole('button',{name:/^(Thêm vào câu lệnh|Add to prompt|Use image|Sử dụng ảnh)$/i});
 for(let i=0;i<100;i++){
  if(await frameState(page,kind))break;
  if(await add.isVisible()){
   try{await add.click({timeout:5000});}
   catch(error){const attached=await frameState(page,kind);if(!attached||attached==='unrecognized-frame')throw error;}
   break;
  }
  await sleep(100);
 }
 for(let i=0;i<120;i++){
  const id=await frameState(page,kind);
  if(id&&id!=='unrecognized-frame'){
   if(id.startsWith('asb:')===thumbnailId.startsWith('asb:')&&id!==thumbnailId)throw Error('Khung hình được gắn khác ảnh đã chọn. Chưa gửi video.');
   reference.assetId=id;reference.projectUrl=url;reference.bindings||={};reference.bindings[url]=id;return id;
  }
  await sleep(500);
 }
 throw Error('Ảnh khung hình chưa sẵn sàng hoặc Flow yêu cầu cắt ảnh. Hoàn tất trong Flow rồi chuẩn bị lại; chưa gửi video.');
}
async function attachFrames(page,frames,report){
 if(!frames?.start)throw Error('Chế độ Frames cần ảnh khung hình bắt đầu.');
 const result={start:await attachFrame(page,'start',frames.start,report),end:null};
 if(frames.end)result.end=await attachFrame(page,'end',frames.end,report);
 return result;
}
async function verifyFrames(page,expected){
 for(const kind of ['start','end'])if((await frameState(page,kind))!==(expected?.[kind]||null))throw Error('Khung hình đầu/cuối đã thay đổi trước khi gửi. Hãy chuẩn bị lại cảnh.');
}
module.exports={frameControl,frameState,removeFrame,reconcileFrames,attachFrame,attachFrames,verifyFrames};
