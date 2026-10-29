const { isServiceUrl } = require('./service-urls.cjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const stopPattern = /Ngừng tạo câu trả lời|Dừng tạo câu trả lời|Stop response|Stop generating/i;
const composerSelector = [
  'rich-textarea [contenteditable="true"]:visible',
  '[contenteditable="true"][role="textbox"]:visible',
  '.ql-editor[contenteditable="true"]:visible'
].join(', ');

async function waitForGeminiInput(page, timeout=30000) {
  const deadline=Date.now()+timeout;let count=0;
  await page.bringToFront?.();
  do {
    if(page.isClosed?.()||!isServiceUrl('gemini',page.url()))throw Error('Tab Gemini đã đóng hoặc chuyển trang. Hãy mở lại Gemini trong đúng profile.');
    const input=page.locator(composerSelector);count=await input.count();
    if(count===1&&await input.isVisible()&&(!input.isEditable||await input.isEditable()))return input;
    if(Date.now()>=deadline)break;
    await pause(Math.min(150,deadline-Date.now()));
  }while(Date.now()<=deadline);
  if(count>1)throw Error('Có nhiều ô nhập Gemini đang hiển thị. Tool dừng để tránh gửi nhầm cuộc trò chuyện.');
  throw Error('Ô nhập Gemini chưa sẵn sàng sau 30 giây. Kiểm tra trang Gemini trong đúng profile rồi bấm Tiếp tục; chưa gửi yêu cầu.');
}

async function responseSnapshot(page) {
  const responses = page.locator('model-response');
  const count = await responses.count();
  if (!count) return { count: 0, key: '', text: '', complete: false };
  const last = responses.last();
  const content = last.locator('message-content');
  if (!await content.count()) return { count, key: '', text: '', complete: false };
  const key = await content.last().getAttribute('id') || '';
  // Read only the answer body, excluding thinking UI and response action buttons.
  const text = await content.last().innerText({ timeout: 3000 });
  const complete = await last.getByRole('button', { name: /^(Sao chép|Sao chép câu trả lời|Copy|Copy response)$/i }).count() > 0;
  return { count, key, text, complete };
}

async function prepareGemini(page) {
  if (!isServiceUrl('gemini', page.url())) throw new Error('Tab hiện tại không phải Gemini. Hãy kết nối Gemini trước.');
  if (await page.getByRole('button', { name: stopPattern }).isVisible()) throw new Error('Gemini đang trả lời một yêu cầu khác. Hãy chờ hoàn tất.');
  const input = await waitForGeminiInput(page);
  if (await page.getByRole('button', { name: stopPattern }).isVisible()) throw new Error('Gemini đang trả lời một yêu cầu khác. Hãy chờ hoàn tất.');
  if ((await input.innerText()).trim()) throw new Error('Ô nhập Gemini đang có nội dung chưa gửi. Hãy gửi hoặc xóa bản nháp đó trước để tool không ghi đè.');
  return { input, baseline: await responseSnapshot(page) };
}

async function sendGemini(page, prompt, beforeSubmit) {
  const { input, baseline } = await prepareGemini(page);
  await input.fill(prompt);
  const send = page.getByRole('button', { name: /^(Gửi tin nhắn|Gửi|Send message|Send)$/i });
  await send.waitFor({ state: 'visible', timeout: 10000 });
  const deadline=Date.now()+10000;
  while(!await send.isEnabled()&&Date.now()<deadline)await pause(100);
  if (!await send.isEnabled()) throw new Error('Nút gửi Gemini chưa sẵn sàng. Nội dung vẫn nằm trong ô nhập.');
  // Persist BEFORE click so an uncertain click is never automatically retried.
  await beforeSubmit({ count: baseline.count, key: baseline.key });
  await send.click({ timeout: 10000 });
}

async function collectGemini(page, job, onProgress = () => {}, timeout = 180000) {
  const deadline = Date.now() + timeout;
  const started = Date.now();
  let previous = '', stableSince = 0;
  while (Date.now() < deadline) {
    if (page.isClosed() || !isServiceUrl('gemini', page.url())) throw new Error('Tab Gemini đã đóng hoặc chuyển trang. Kết nối lại rồi bấm Lấy lại phản hồi; tool sẽ không gửi lại prompt.');
    const queries = page.locator('user-query');
    const latestQuery = await queries.count() ? await queries.last().textContent() : '';
    if (!latestQuery?.includes(job.marker) && Date.now() - started > 15000) throw new Error('Không thấy yêu cầu này trong hội thoại hiện tại. Hãy mở đúng hội thoại Gemini rồi bấm Lấy lại phản hồi. Tool không gửi lại prompt.');
    if (latestQuery?.includes(job.marker)) {
      const snapshot = await responseSnapshot(page);
      const isNew = snapshot.key ? snapshot.key !== job.baseline.key : snapshot.count > job.baseline.count;
      if (isNew && snapshot.text.trim()) {
        await onProgress(snapshot.text);
        if (snapshot.text !== previous) { previous = snapshot.text; stableSince = Date.now(); }
        const stopped = !await page.getByRole('button', { name: stopPattern }).isVisible();
        // Require both the completed response toolbar and a stable answer.
        if (snapshot.complete && stopped && Date.now() - stableSince >= 2000) return snapshot.text;
      }
    }
    await pause(750);
  }
  throw new Error('Gemini chưa hoàn tất sau 3 phút. Bấm Lấy lại phản hồi để tiếp tục đọc; tool không tự gửi lại prompt.');
}

module.exports = { prepareGemini, sendGemini, collectGemini, responseSnapshot, waitForGeminiInput };
