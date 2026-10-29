const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const state = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'video-studio/workspace/workspace.json'), 'utf8'));
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${state.browserPort}`);
  const page = browser.contexts().flatMap(c => c.pages()).find(p => { try { return new URL(p.url()).hostname === 'gemini.google.com'; } catch { return false; } });
  if (!page) throw new Error('Gemini tab not found');
  if (process.argv.includes('--send-prepared')) {
    const input = page.getByRole('textbox', { name: 'Nhập câu lệnh cho Gemini', exact: true });
    if (!(await input.innerText()).startsWith('Hãy viết kịch bản video điện ảnh về một buổi sáng ở Đà Lạt gồm 2 cảnh')) throw new Error('Prepared test prompt not found');
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await page.locator('model-response').first().waitFor({ timeout: 60000 });
    console.log('Response created');
  }
  if (process.argv.includes('--prepare')) {
    const input = page.getByRole('textbox', { name: 'Nhập câu lệnh cho Gemini', exact: true });
    if ((await input.innerText()).trim()) throw new Error('Gemini input contains an existing draft; leaving it unchanged.');
    await input.fill('Hãy viết kịch bản video điện ảnh về một buổi sáng ở Đà Lạt gồm 2 cảnh, mỗi cảnh 8 giây, tỷ lệ 16:9. Chỉ trả về JSON hợp lệ, không markdown, theo cấu trúc {"title":"...","summary":"...","scenes":[{"id":1,"duration_seconds":8,"description_vi":"...","voiceover_vi":"...","video_prompt_en":"...","negative_prompt_en":"..."}]}. Giữ nhân vật và bối cảnh nhất quán.');
  }
  console.log(JSON.stringify(await page.locator('textarea, [contenteditable="true"], button, [role="button"]').evaluateAll(elements => elements.filter(e => {const r=e.getBoundingClientRect();return r.width && r.height && !/Tài khoản Google|Google Account/.test(e.getAttribute('aria-label') || '');}).map(e => ({ tag:e.tagName, role:e.getAttribute('role'), label:e.getAttribute('aria-label'), placeholder:e.getAttribute('data-placeholder') || e.getAttribute('placeholder'), class:e.className, text:(e.innerText || '').slice(0,100) }))), null, 2));
  console.log('Response DOM:', await page.locator('model-response, message-content, .model-response-text, user-query').evaluateAll(elements => elements.map(e => ({tag:e.tagName,class:e.className,html:e.outerHTML.slice(0,350).replace(/>[^<]+</g,'>…<')}))));
  process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1);});
