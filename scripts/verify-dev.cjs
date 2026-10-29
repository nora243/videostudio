const { _electron } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const port = Number(process.argv[2]);
  const testRoot = path.resolve('.test-runtime', `dev-${Date.now()}`);
  fs.mkdirSync(path.join(testRoot, 'workspace'), { recursive: true });
  fs.writeFileSync(path.join(testRoot, 'workspace/workspace.json'), JSON.stringify({ browserPort: port }));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ['.', '--dev', `--user-data-dir=${testRoot}`], env });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('#read-credits');
    const opened = await page.evaluate(() => window.studio.open('flow'));
    assert.equal(opened.ok, true, opened.error);
    // Ensure the test covers opening the menu, rather than just reading an open one.
    const { chromium } = require('playwright-core');
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const flow = browser.contexts().flatMap(c => c.pages()).find(p => new URL(p.url()).hostname === 'flow.google.com');
    const close = flow.getByRole('button', { name: 'Đóng bảng điều khiển tài khoản', exact: true });
    if (await close.isVisible()) await close.click();
    await page.click('[data-confirm="flow"]');
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('Số dư:'));
    const balance = Number(await page.inputValue('#credits'));
    assert.equal(balance, 431);
    console.log(`PASS: confirming Flow automatically opens menu and applies actual balance ${balance}`);
    await page.fill('#brief', 'Draft survives development reload');
    const loaded = page.waitForEvent('domcontentloaded');
    const css = path.resolve('src/style.css');
    const now = new Date(); fs.utimesSync(css, now, now);
    await loaded;
    await page.waitForFunction(() => document.getElementById('brief').value === 'Draft survives development reload');
    assert.equal(await page.inputValue('#credits'), '431');
    console.log('PASS: automatic UI reload preserves draft and credit balance');
  } finally { await app.close(); }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
