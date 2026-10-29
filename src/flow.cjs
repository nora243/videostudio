const {orderedReferences,referencePrompt}=require('./references.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { isServiceUrl } = require('./service-urls.cjs');
const { readFlowCredits } = require('./flow-credits.cjs');
const {referenceIdentity}=require('./reference-identity.cjs');
const{videoIdentity,assetSelector,normalizeVideoId}=require('./video-identity.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalize = value => String(value).replace(/\s+/g, ' ').trim();
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_GENERATION_RETRIES = 2;

function projectUrl(value) {
  if (!isServiceUrl('flow', value)) throw new Error('Trang hiện tại không phải Flow.');
  const url = new URL(value);
  if (!/^\/project\/[a-z0-9-]+\/?$/i.test(url.pathname)) throw new Error('Trang hiện tại chưa phải dự án Flow.');
  return url.origin + url.pathname.replace(/\/$/, '');
}
function validateOptions(options) {
  if (!options || !['360p', '720p'].includes(options.resolution) || !['16:9', '9:16'].includes(options.ratio)) throw new Error('Flow hiện hỗ trợ cấu hình 360p/720p và 16:9/9:16.');
  return { resolution: options.resolution, ratio: options.ratio, model: 'Omni 1.1 Flash', outputs: 1 };
}
function compilePrompt(scene, references=[]) {
  if (!scene || ![4, 6, 8, 10].includes(scene.duration_seconds) || !scene.video_prompt_en?.trim()) throw new Error('Mỗi cảnh cần prompt video và thời lượng 4, 6, 8 hoặc 10 giây.');
  return `${scene.video_prompt_en.trim()}\n\nConstraints: ${scene.negative_prompt_en?.trim() || 'No text or watermark.'}\n${require('./production.cjs').audioPrompt(scene)}${references.length?'\n\n'+referencePrompt(references):''}`;
}
function parseCost(text) {
  const matches = [...String(text).matchAll(/(?:Quá trình tạo sẽ tốn|Generation will cost|This generation (?:will )?costs?)\s*(\d+)\s*(?:tín dụng|credits)/gi)];
  const values = new Set(matches.map(m => Number(m[1])));
  if (values.size !== 1) throw new Error('Không đọc được chi phí Flow. Dừng trước khi gửi.');
  return [...values][0];
}
async function closeOverlays(page) {
  const close = page.getByRole('button', { name: /^(Đóng bảng điều khiển tài khoản|Close account panel)$/i });
  if (await close.isVisible()) await close.click();
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape');
  await sleep(200);
  const backdrop=page.locator('.cdk-overlay-backdrop.cdk-overlay-backdrop-showing');
  if(await backdrop.first().isVisible()){try{await backdrop.first().click({position:{x:2,y:2},timeout:3000});}catch(error){if(await backdrop.first().isVisible())throw error;}}
}
async function balance(page) {
  await closeOverlays(page);
  const amount = await readFlowCredits(page);
  await closeOverlays(page); return amount;
}
async function chooseRadio(page, name) {
  const control = page.getByRole('radio', { name });
  await control.waitFor({ state: 'visible', timeout: 5000 });
  if (await control.count() !== 1) throw new Error(`Không tìm thấy lựa chọn Flow: ${name}`);
  if (await control.getAttribute('aria-checked') !== 'true') await control.click({ timeout: 5000 });
  for (let i = 0; i < 20; i++) {
    if (await control.getAttribute('aria-checked') === 'true') return;
    await sleep(100);
  }
  throw new Error(`Flow chưa chọn đúng ${name}.`);
}
async function configure(page, options, duration, report=()=>{}) {
  report('flow.settings','Kiểm tra mô hình, tỷ lệ, độ phân giải và thời lượng');
  projectUrl(page.url());
  await closeOverlays(page);
  const agent = page.locator('button.agent-mode-chip');
  if (await agent.getAttribute('aria-pressed') === 'true') await agent.click();
  if (await agent.getAttribute('aria-pressed') !== 'false') throw new Error('Không xác định được trạng thái Tác nhân Flow.');
  if (!await page.getByRole('radio', { name: /Video$/i }).isVisible()) await page.locator('button.settings-trigger-button').click();
  await chooseRadio(page, /Video$/i);
  const model = page.getByRole('button', { name: /^(Chọn nhóm mô hình|Select model family)$/i });
  if (!(await model.innerText()).includes(options.model)) throw new Error('Hãy chọn Omni 1.1 Flash trong Flow trước; bản đầu chỉ tự động hóa mô hình đã kiểm thử này.');
  await chooseRadio(page, /^(?:chrome_extension\s*)?(?:Thành phần|Ingredients)$/i);
  await chooseRadio(page, new RegExp(`${options.ratio}$`));
  await chooseRadio(page, new RegExp(`^${options.resolution}(?:\\s|$)`));
  await chooseRadio(page, new RegExp(`^${duration} (?:giây|seconds?|s)$`));
  await chooseRadio(page, /^x1$/i);
  const cost = parseCost(await page.locator('body').innerText());
  await closeOverlays(page);
  return cost;
}
async function prepare(page, scene, options, previousPrompt = '', report=()=>{}) {
  report('flow.prompt.check','Kiểm tra bản nháp trong ô nhập Flow');
  const refs=orderedReferences(options.references|| (options.reference?[{...options.reference,role:options.reference.role||'female_lead'}]:[]));
  const prompt = compilePrompt(scene,refs);
  await closeOverlays(page);
  const input = page.locator('.ProseMirror[role="textbox"]');
  const existing = (await input.innerText()).trim();
  if (existing && normalize(existing) !== normalize(previousPrompt) && normalize(existing) !== normalize(prompt)) throw new Error('Ô nhập Flow đang có bản nháp khác. Hãy xử lý bản nháp trước để tool không ghi đè.');
  let cost = await configure(page, options, scene.duration_seconds,report);
  report('flow.prompt.fill','Điền prompt cho cảnh');
  await input.fill(prompt);
  const referenceIds = await attachReferences(page, refs,report);
  const referenceId=referenceIds[0]||null;
  if(referenceIds.length)cost=await configure(page,options,scene.duration_seconds,report);
  report('flow.cost',`Đã xác nhận cấu hình và chi phí: ${cost} tín dụng`);
  return { prompt, cost, referenceId, referenceIds, projectUrl: projectUrl(page.url()), configuration: { ...options, references:refs, duration: scene.duration_seconds } };
}
async function referenceIds(page) {
  const sources=await page.locator('flow-base-prompt-box flow-image-ingredient-chip img').evaluateAll(elements=>elements.map(e=>e.currentSrc||e.src));
  return sources.map(source=>referenceIdentity(source)||'unrecognized-reference');
}
async function attachReference(page, reference, report=()=>{}, before=[]) {
  report('flow.reference.check','Kiểm tra ảnh tham chiếu đang gắn');
  const current = await referenceIds(page);
  if (!reference) {
    if (current.length) throw new Error('Flow đang gắn ảnh tham chiếu ngoài tool. Hãy chọn ảnh trong tool hoặc gỡ ảnh đó trước.');
    return null;
  }
  if (reference.projectUrl === projectUrl(page.url()) && reference.assetId && current.length === before.length+1 && before.every((id,i)=>current[i]===id) && current[before.length] === reference.assetId) return reference.assetId;
  if(current.length!==before.length||before.some((id,i)=>current[i]!==id))throw new Error('Flow đang gắn ảnh chưa được xác nhận cho dự án này. Hãy gỡ ảnh đó rồi chuẩn bị lại; tool không tự thay ảnh đang có.');
  report('flow.reference.search','Mở thư viện và tìm ảnh tham chiếu');
  await page.getByRole('button', { name:/^(Thêm thành phần vào ô nhập câu lệnh|Add ingredients to prompt)$/i }).click();
  const search=page.getByRole('textbox',{name:/^(Tìm kiếm thành phần|Search ingredients)$/i});
  await search.fill(reference.name);
  let option=page.getByRole('option').filter({ hasText:reference.name });
  try { await option.first().waitFor({state:'visible',timeout:10000}); }
  catch {
    const loading=page.locator('flow-add-menu-popover-content').getByRole('progressbar');
    if(await loading.count())await loading.first().waitFor({state:'hidden',timeout:30000});
    if(await option.count())throw new Error('Danh sách ảnh chưa sẵn sàng. Hãy thử chuẩn bị lại; không upload trùng.');
    if (!reference.path || !fs.existsSync(reference.path)) throw new Error('Không tìm thấy ảnh tham chiếu cục bộ.');
    report('flow.reference.upload','Tải ảnh tham chiếu lên thư viện Flow');
    const pending=page.waitForEvent('filechooser',{timeout:10000}); pending.catch(()=>{});
    await page.getByRole('button',{name:/^(Tải nội dung nghe nhìn lên|Upload media)$/i}).click();
    await (await pending).setFiles(reference.path);
    await option.first().waitFor({state:'visible',timeout:60000});
  }
  if (await option.count() !== 1) throw new Error('Có nhiều ảnh trùng tên trong Flow. Hãy chọn ảnh với tên riêng.');
  let id='';
  report('flow.reference.ready','Chờ ảnh tham chiếu sẵn sàng');
  for(let i=0;i<120;i++){
    const image=await option.locator('img').evaluate(img=>({source:img.currentSrc||img.src,complete:img.complete,width:img.naturalWidth}));
    const candidate=referenceIdentity(image.source);
    if(candidate&&image.complete&&image.width>0){id=candidate;break;}
    if(!candidate&&image.complete&&image.width>0)throw new Error('Ảnh đã tải nhưng định dạng đường dẫn ảnh Flow chưa được hỗ trợ. Tool chưa gửi video; hãy gửi nhật ký để kiểm tra bộ nhận diện ảnh.');
    await sleep(500);
  }
  if(!id)throw new Error('Ảnh tham chiếu vẫn đang upload. Thử chuẩn bị lại sau; tool chưa gửi video.');
  const thumbnailId=id;
  {
    const starting=await referenceIds(page);if(starting.length!==before.length||before.some((id,i)=>starting[i]!==id))throw new Error('Ảnh trong ô prompt đã thay đổi khi đang chọn. Tool dừng để tránh gắn nhầm ảnh.');
    report('flow.reference.select','Chọn ảnh trong thư viện Flow');
    await option.click();
    const add=page.getByRole('button',{name:/^(Thêm vào câu lệnh|Add to prompt)$/i});
    // Some Flow versions attach immediately when selecting the result; others show a confirmation.
    for(let i=0;i<100;i++){
      if((await referenceIds(page)).length>before.length)break;
      if(await add.isVisible()){
        report('flow.reference.attach','Nhấn Thêm vào câu lệnh');
        try { await add.click({timeout:10000}); }
        catch(error) {
          // Flow may attach the image and remove confirmation during the click.
          // The final identity check below still rejects a wrong attachment.
          const attached=await referenceIds(page);
          if(attached.length!==before.length+1 || attached[before.length]==='unrecognized-reference'||before.some((id,i)=>attached[i]!==id))throw error;
          report('flow.reference.attach','Flow đã tự gắn ảnh; kiểm tra lại ảnh trong ô prompt');
        }
        break;
      }
      await sleep(100);
    }
    report('flow.reference.verify','Kiểm tra ảnh đã gắn vào ô prompt');
    for (let i=0;i<60;i++) {
      const ids=await referenceIds(page);
      const loading=await page.locator('flow-base-prompt-box flow-image-ingredient-chip button[aria-busy="true"]').count();
      if (ids.length===before.length+1 && ids[before.length]!=='unrecognized-reference' && before.every((id,i)=>ids[i]===id) && !loading) break;
      await sleep(500);
    }
    const ids=await referenceIds(page);if(ids.length!==before.length+1||ids[before.length]==='unrecognized-reference'||before.some((id,i)=>ids[i]!==id))throw new Error('Ảnh chưa được gắn vào câu lệnh Flow hoặc chưa nhận diện được mã ảnh.');
    if(ids[before.length].startsWith('asb:')===thumbnailId.startsWith('asb:')&&ids[before.length]!==thumbnailId)throw new Error('Ảnh được gắn khác ảnh đã chọn. Tool chưa gửi video.');
    id=ids[before.length];
  }
  reference.assetId=id;reference.projectUrl=projectUrl(page.url());reference.bindings||={};reference.bindings[reference.projectUrl]=id;
  report('flow.reference.done','Đã gắn đúng ảnh tham chiếu');
  return id;
}
async function attachReferences(page, refs, report=()=>{}) {
  const current=await referenceIds(page),url=projectUrl(page.url());
  const known=refs.map(r=>r.projectUrl===url?r.assetId:r.bindings?.[url]||null);
  if(current.length>refs.length||current.some((id,i)=>!known[i]||known[i]!==id))throw Error('Flow đang gắn ảnh chưa được xác nhận hoặc khác thứ tự. Hãy gỡ ảnh đó trước khi chuẩn bị.');
  const attached=[...current];
  for(let i=0;i<current.length;i++){refs[i].assetId=current[i];refs[i].projectUrl=url;}
  for(let i=current.length;i<refs.length;i++){
    report('flow.reference.role',`Gắn ảnh ${i+1}/${refs.length}: ${refs[i].role} · ${refs[i].displayName||refs[i].name}`);
    const id=await attachReference(page,refs[i],report,[...attached]);
    if(attached.includes(id))throw Error('Hai vai trò đang dùng cùng một ảnh Flow. Kiểm tra lại ảnh tham chiếu trước khi gửi.');attached.push(id);
  }
  return attached;
}
async function removeReference(page, id){
  if(!id)return;
  await closeOverlays(page);
  const ids=await referenceIds(page),index=ids.indexOf(id);
  if(index<0)return;
  const chip=page.locator('flow-base-prompt-box flow-image-ingredient-chip').nth(index);
  await chip.hover();await chip.locator('.hover-icon-overlay').click({timeout:5000});
  for(let i=0;i<20;i++){if(!(await referenceIds(page)).includes(id))return;await sleep(100);}
  throw new Error('Chưa gỡ được ảnh khỏi Flow. Hãy bấm dấu x trên ảnh rồi thử lại.');
}

// Asset and download locators are verified against the first real generation.
async function snapshotAssets(page) {
  const read=async()=>{const items=await page.locator('flow-grid-tile-container').evaluateAll(elements => elements.map((e, index) => {
    const media = e.querySelector('video[src]')||e.querySelector('img[src]');
    e.dataset.studioTileKey ||= crypto.randomUUID();
    const text=e.innerText||'';
    return {source:media?.src||'',index,key:e.dataset.studioTileKey,title:e.getAttribute('aria-label'),failed:/(?:Không thành công|Không thể tạo|Failed|Generation failed|Couldn't generate|Could not generate)/i.test(text),failureText:text.slice(0,2000),video:Boolean(e.querySelector('flow-video-tile')),resolution:e.querySelector('.resolution-badge')?.textContent?.trim()||''};
  }));return items.map(({source,...asset})=>({...asset,id:videoIdentity(source)||''}));};
  let assets=await read();
  // Fresh Flow pages initially render only proxy thumbnails. Hover loads the canonical video URL.
  for(let index=0;index<assets.length;index++)if(assets[index].video&&!assets[index].id&&!assets[index].failed){
    try{await page.locator('flow-grid-tile-container').nth(index).hover({timeout:3000});for(let attempt=0;attempt<10;attempt++){await sleep(150);assets=await read();if(!assets[index]?.video||assets[index]?.id)break;}}catch{assets=await read();}
  }
  return assets;
}
async function tileFor(page, id) {
  const selector=assetSelector(id);
  await snapshotAssets(page);
  const tile=page.locator('flow-grid-tile-container').filter({has:page.locator(selector)});
  if(await tile.count()!==1)throw Error('Không tìm thấy duy nhất video đã ghi nhận. Hãy mở đúng project Flow và hiển thị các video.');
  return tile;
}
function matchesAssetDetails(details,job){return normalize(details).includes(normalize(job.prompt))&&details.includes(job.configuration.model)&&details.includes(job.configuration.ratio)&&details.includes(job.configuration.resolution)&&new RegExp(`${job.configuration.duration} (?:giây|seconds?)`).test(details);}
async function verifyAsset(page, job, asset, report=()=>{}) {
  await closeOverlays(page);
  const tile = await tileFor(page, asset.id);
  // Let Flow dispose its previous hover overlay before opening the next one.
  await page.mouse.move(5,5);await sleep(500);
  const detailsButton=tile.locator('button.footer-left');
  let box=await detailsButton.boundingBox();if(!box){await tile.hover({timeout:5000});box=await detailsButton.boundingBox();}if(!box)throw Error('Chưa thấy nút thông tin của video.');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await sleep(250);
  // Activate the exact read-only details button without waiting for its moving hitbox to settle.
  await detailsButton.evaluate(button=>button.click());report('flow.asset.open','Đã mở bảng thông tin của video cần đối chiếu');
  let details = '';
  try{for (let i = 0; i < 50; i++) {
    details = (await page.locator('.cdk-overlay-pane').allInnerTexts()).join('\n');
    if (matchesAssetDetails(details,job)||/(?:Độ phân giải|Resolution)\s*:\s*\d+p/i.test(details)&&/\d+ (?:giây|seconds?)/i.test(details)) break;
    await sleep(100);
  }}finally{await closeOverlays(page);}
  if(!details.trim())throw Error('Bảng thông tin video chưa mở ổn định; cần thử đọc lại.');
  const valid=matchesAssetDetails(details,job);if(!valid)report('flow.asset.pending','Thông tin chưa khớp đầy đủ; tiếp tục chờ và đối chiếu, không gửi lại video');return valid;
}
function newFailure(assets, job) {
  const baseline=job.baseline||[],oldKeys=new Set(baseline.map(a=>a.key).filter(Boolean));
  const failed=assets.filter(a=>a.failed&&!oldKeys.has(a.key));
  // A rerender of an old failure must never trigger a new paid request.
  const candidates=failed.filter(a=>assets.filter(b=>b.failed&&b.failureText===a.failureText).length>baseline.filter(b=>b.failed&&b.failureText===a.failureText).length);
  if(candidates.length>1)throw Error('Có nhiều thẻ lỗi mới trên Flow. Tool tạm dừng để tránh thử lại nhầm cảnh.');
  return candidates[0]||null;
}
async function retryFailure(page,job,asset,persist,report) {
  if(job.retryPending)throw Error('Lần bấm Thử lại trước chưa xác định kết quả. Tool tạm dừng để tránh gửi trùng.');
  if((job.retryCount||0)>=MAX_GENERATION_RETRIES)throw Error('Flow vẫn báo lỗi sau 2 lần thử lại. Đã tạm dừng hàng đợi.');
  const tile=page.locator(`flow-grid-tile-container[data-studio-tile-key="${asset.key}"]`);
  const buttons=await tile.locator('button').evaluateAll(elements=>elements.map((b,index)=>({index,label:[b.getAttribute('aria-label'),b.getAttribute('title'),b.innerText,b.querySelector('mat-icon,.material-icons,.google-symbols')?.textContent].filter(Boolean).join(' ').trim()})));
  const matches=buttons.filter(b=>/(?:thử lại|thử tạo lại|retry|try again|\brefresh\b|\breplay\b|\brestart_alt\b)/i.test(b.label));
  if(matches.length!==1)throw Error('Không tìm thấy duy nhất nút Thử lại trên thẻ lỗi của cảnh. Đã tạm dừng hàng đợi.');
  job.retryCount=(job.retryCount||0)+1;job.retryPending=true;job.lastFlowError=asset.failureText;await persist();
  report('flow.generation.retry',`Flow báo lỗi; bấm Thử lại lần ${job.retryCount}/2`);
  await tile.locator('button').nth(matches[0].index).click({timeout:5000});
  // Confirm that the failed card leaves its failed state before allowing another retry.
  await page.waitForFunction(key=>{
    const e=document.querySelector(`[data-studio-tile-key="${key}"]`);
    return !e||!/(?:Không thành công|Không thể tạo|Failed|Generation failed|Couldn't generate|Could not generate)/i.test(e.innerText||'');
  },asset.key,{timeout:10000});
  job.retryPending=false;job.generationWaitStartedAt=new Date().toISOString();job.status='generating';await persist();
}
async function collect(page, job, persist, timeout = GENERATION_TIMEOUT_MS, report=()=>{}) {
  timeout=Math.min(timeout,GENERATION_TIMEOUT_MS);
  const savedStart=Date.parse(job.generationWaitStartedAt||job.submittedAt);
  let deadline=(Number.isFinite(savedStart)?savedStart:Date.now())+timeout;
  const timeoutError=()=>new Error(`Chưa xác định được kết quả sau ${timeout>=60000?Math.round(timeout/60000)+' phút':Math.round(timeout/1000)+' giây'}. Đã tạm dừng; bấm Đối soát để đọc lại, không tự gửi lại khi chưa thấy thẻ lỗi.`);
  const readWithinDeadline=async read=>{
    let timer;
    try{return await Promise.race([read(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(timeoutError()),Math.max(1,deadline-Date.now()));})]);}
    finally{clearTimeout(timer);}
  };
  const old = new Set((job.baseline || []).map(a => normalizeVideoId(a.id)).filter(Boolean));
  // Recovery gets one short read to recognize an existing error, not another five-minute wait.
  if(deadline<=Date.now())deadline=Date.now()+Math.min(timeout,1000);
  while (true) {
    if (projectUrl(page.url()) !== job.projectUrl) throw new Error('Flow đã chuyển dự án. Mở đúng dự án rồi Đối soát; không tự gửi lại.');
    const snapshot=await readWithinDeadline(()=>snapshotAssets(page));
    const available=snapshot.filter(a=>a.id&&a.video&&!a.failed),requested=normalizeVideoId(job.assetId),known=requested&&available.some(a=>a.id===requested);
    const assets=available.filter(a=>known?a.id===requested:job.assetId?true:!old.has(a.id));
    const matches = [];
    for (const asset of assets){let valid=false;for(let attempt=1;attempt<=3;attempt++){try{report('flow.asset.verify',`Đối chiếu prompt và cấu hình của video${attempt>1?' · lần '+attempt:''}`);valid=await readWithinDeadline(()=>verifyAsset(page,job,asset,report));break;}catch(error){if(Date.now()>=deadline)throw timeoutError();if(attempt===3)throw error;report('flow.asset.retry','Thông tin video chưa ổn định; thử đọc lại, không gửi lại video');await sleep(Math.min(300,Math.max(0,deadline-Date.now())));}}if(valid)matches.push(asset);}
    if (matches.length > 1) throw new Error('Có nhiều clip mới cùng prompt. Cần kiểm tra thủ công để tránh lấy nhầm.');
    if (matches.length === 1) {
      job.assetId = matches[0].id; job.status = 'generated'; job.generatedAt ||= new Date().toISOString(); await persist(); return matches[0];
    }
    const failure=!job.assetId&&newFailure(snapshot,job);
    if(failure){await retryFailure(page,job,failure,persist,report);deadline=Date.now()+timeout;continue;}
    if(Date.now()>=deadline)break;
    await sleep(Math.min(2500,deadline-Date.now()));
  }
  throw timeoutError();
}
async function download(page, job, filename, persist) {
  if(!(await snapshotAssets(page)).some(a=>a.id===job.assetId&&a.video))await collect(page,job,persist,120000);
  await closeOverlays(page);
  const tile = await tileFor(page, job.assetId);
  await tile.hover();
  await tile.getByRole('button', { name: /^(Tuỳ chọn khác|Tùy chọn khác|More options)$/i }).click();
  await page.getByRole('menuitem', { name: /^(Tải xuống|Download)$/i }).click();
  const original = page.getByRole('menuitem', { name: new RegExp(`^${job.configuration.resolution}\\s`) });
  await original.waitFor({ state:'visible', timeout:5000 });
  job.status = 'downloading'; await persist();
  // Install the listener before clicking. SaveAs waits for the completed file.
  const transfer=await require('./download-file.cjs').beginDownload(page,filename);
  try {
  const pending = page.waitForEvent('download', { timeout:90000 });
  pending.catch(() => {});
  await original.click();
  const result = await pending;
  fs.mkdirSync(path.dirname(filename), { recursive:true });
  await transfer.save(result);
  } finally { await transfer.close(); }
  const metadata = require('./mp4.cjs').inspectMp4(filename);
  const expectedHeight = Number.parseInt(job.configuration.resolution,10);
  const shortSide = Math.min(metadata.width, metadata.height);
  if (Math.abs(metadata.duration - job.configuration.duration) > 1 || shortSide !== expectedHeight) throw new Error('Clip tải về có thời lượng/độ phân giải khác cấu hình. File được giữ để kiểm tra.');
  job.file = filename; job.metadata = metadata; job.status = 'downloaded'; job.downloadedAt = new Date().toISOString(); delete job.error; await persist();
  return metadata;
}
async function download1080(page,job,filename,persist,report=()=>{},timeout=600000){
 if(projectUrl(page.url())!==job.projectUrl)throw Error('Flow không ở đúng project của video cần tải 1080p.');
 if(!(await snapshotAssets(page)).some(a=>a.id===job.assetId&&a.video))await collect(page,job,persist,120000,report);
 await closeOverlays(page);report('upscale.menu','Mở menu tải của đúng video Flow');const tile=await tileFor(page,job.assetId);await tile.hover();
 await tile.getByRole('button',{name:/^(Tuỳ chọn khác|Tùy chọn khác|More options)$/i}).click();await page.getByRole('menuitem',{name:/^(Tải xuống|Download)$/i}).click();
 const item=page.getByRole('menuitem',{name:/^1080p(?:\s|$)/i});await item.waitFor({state:'visible',timeout:10000});if(!await item.isEnabled()||await item.getAttribute('aria-disabled')==='true')throw Error('Flow chưa cho phép tải 1080p cho video này.');
 const transfer=await require('./download-file.cjs').beginDownload(page,filename+'.part.mp4');
 let result=null,closed=false;const onDownload=value=>{result=value;},onClose=()=>{closed=true;};page.on('download',onDownload);page.on('close',onClose);
 try{
  job.upscale={status:'requesting',requestedAt:new Date().toISOString()};await persist();report('upscale.request','Chọn tải bản nâng độ phân giải 1080p');await item.click({timeout:10000});job.upscale.status='waiting';await persist();report('upscale.wait','Chờ Flow chuẩn bị bản 1080p và bắt đầu tải');
  const deadline=Date.now()+timeout;while(!result){if(closed)throw Error('Tab Flow đã đóng khi chờ tải 1080p.');if(projectUrl(page.url())!==job.projectUrl)throw Error('Flow đã chuyển project khi chờ tải 1080p.');
   const dialogs=page.getByRole('dialog');for(let i=0;i<await dialogs.count();i++)if(await dialogs.nth(i).isVisible())throw Error('Flow yêu cầu xác nhận thêm khi nâng độ phân giải. Tool dừng, chưa tự chấp nhận hộp thoại. Nội dung: '+(await dialogs.nth(i).innerText()).slice(0,1000));
   if(Date.now()>=deadline)throw Error('Flow chưa trả file 1080p sau 10 phút. Không tự yêu cầu lại; kiểm tra Flow rồi thử tải riêng cảnh.');await sleep(300);
  }
  report('upscale.download','Đang tải file 1080p');job.upscale.status='downloading';await persist();fs.mkdirSync(path.dirname(filename),{recursive:true});const temporary=filename+'.part.mp4';
  // Save into the same staging file used by MP4 validation.
  await transfer.save(result);
  report('upscale.validate','Kiểm tra MP4, độ phân giải và thời lượng');const metadata=require('./media-quality.cjs').inspect1080(temporary,job);
  fs.renameSync(temporary,filename);job.renditions||={};job.renditions['1080p']={file:filename,metadata,downloadedAt:new Date().toISOString(),source:'Flow upscale'};job.upscale={...job.upscale,status:'completed',completedAt:new Date().toISOString()};job.status='downloaded';job.downloadedAt||=new Date().toISOString();delete job.error;await persist();report('upscale.done','Đã lưu bản 1080p hợp lệ; ưu tiên cho hậu kỳ');return metadata;
 }finally{page.off('download',onDownload);page.off('close',onClose);await transfer.close();}
}
async function submit(page, job, persist) {
  if (projectUrl(page.url()) !== job.projectUrl) throw new Error('Flow đã chuyển sang dự án khác.');
  const latestCost=await configure(page,job.configuration,job.configuration.duration);
  if(latestCost!==job.cost)throw new Error('Chi phí Flow vừa thay đổi. Dừng trước khi gửi; hãy chuẩn bị lại cảnh.');
  const input = page.locator('.ProseMirror[role="textbox"]');
  if (normalize(await input.innerText()) !== normalize(job.prompt)) throw new Error('Prompt Flow đã thay đổi. Hãy chuẩn bị lại cảnh.');
  const references=await referenceIds(page);
  const expected=job.referenceIds||(job.referenceId?[job.referenceId]:[]);
  if (references.length!==expected.length||expected.some((id,i)=>references[i]!==id)) throw new Error('Ảnh tham chiếu đã thay đổi trước khi gửi.');
  job.baseline = await snapshotAssets(page);
  if(job.baseline.some(asset=>asset.video&&!asset.id&&!asset.failed))throw new Error('Có video khác chưa hoàn tất trong dự án Flow. Hãy chờ trước khi gửi cảnh mới.');
  job.retryCount=0;delete job.retryPending;job.generationWaitStartedAt=new Date().toISOString();
  job.status = 'submitting'; job.submittedAt = new Date().toISOString(); await persist();
  await page.getByRole('button', { name: /^(Bắt đầu tạo|Generate)$/i }).click({ timeout: 10000 });
  job.status = 'generating'; await persist();
}

module.exports = { projectUrl, validateOptions, compilePrompt, parseCost, prepare, configure, balance, submit, snapshotAssets, collect, download,download1080, closeOverlays, sleep, attachReference,attachReferences,removeReference,referenceIds, newFailure, GENERATION_TIMEOUT_MS, MAX_GENERATION_RETRIES };
