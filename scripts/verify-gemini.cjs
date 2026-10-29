const { _electron } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const realState = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'video-studio/workspace/workspace.json'), 'utf8'));
  const previous = process.argv.includes('--recover') ? fs.readdirSync('.test-runtime').filter(name => /^gemini-\d+$/.test(name)).sort().at(-1) : null;
  const testRoot = path.resolve('.test-runtime', previous || `gemini-${Date.now()}`);
  fs.mkdirSync(path.join(testRoot, 'workspace'), { recursive: true });
  if (!previous) fs.writeFileSync(path.join(testRoot, 'workspace/workspace.json'), JSON.stringify({ browserPort: realState.browserPort }));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ['.', '--dev', `--user-data-dir=${testRoot}`], env });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('#script-nav');
    await page.click('#script-nav');
    const opened = await page.evaluate(() => window.studio.open('gemini'));
    assert.equal(opened.ok, true, opened.error);
    await page.fill('#title', 'Bình minh Đà Lạt — kiểm thử Gemini');
    await page.fill('#brief', 'Một người lữ khách ngắm bình minh bên hồ ở Đà Lạt. Hai cảnh liên tiếp có cùng nhân vật, trang phục và bối cảnh.');
    await page.fill('#scenes', '2');
    await page.click(previous ? '#recover-script' : '#generate-script');
    console.log(previous ? 'Recovering the existing request without resending…' : 'Submitted from Video Studio; waiting for Gemini response…');
    await page.waitForFunction(() => ['completed', 'invalid_json', 'interrupted', 'failed'].some(s => {
      const texts = {completed:'Đã nhận kịch bản',invalid_json:'Cần kiểm tra JSON',interrupted:'Cần lấy lại phản hồi',failed:'Chưa gửi được'};
      return document.getElementById('script-status').textContent === texts[s];
    }), null, { timeout: 220000 });
    const result = await page.evaluate(() => window.studio.status());
    assert.equal(result.data.geminiJob.status, 'completed', result.data.geminiJob.error);
    assert.equal(await page.locator('.scene-card').count(), 2);
    assert.equal(result.data.storyboard.scenes.length, 2);
    await page.click('#editor-tab-voice');await page.locator('.scene-card').first().locator('[data-field="voiceover_vi"]').fill('Lời dẫn đã chỉnh trong tool.');
    await page.click('#save-storyboard');
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('Đã lưu chỉnh sửa'));
    const stored = JSON.parse(fs.readFileSync(path.join(testRoot, 'workspace/workspace.json'), 'utf8'));
    assert.equal(stored.storyboard.scenes[0].voiceover_vi, 'Lời dẫn đã chỉnh trong tool.');
    await page.screenshot({ path: path.join(testRoot, 'gemini-result.png'), fullPage: true });
    console.log(`PASS: real Gemini send/receive → 2 editable scenes → save. Evidence: ${testRoot}`);
  } finally { await app.close(); }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
