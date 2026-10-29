const { chromium } = require('playwright-core');
(async () => {
  const port = Number(process.argv[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Provide the local Video Studio Chrome port.');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = browser.contexts().flatMap(c => c.pages()).find(p => new URL(p.url()).hostname === 'flow.google.com');
  if (!page) throw new Error('Flow tab not found');
  if (process.argv.includes('--attach-test-reference')) {
    await page.getByRole('option',{name:/^cat-reference\.png/}).click();
    await page.getByRole('button',{name:'Thêm vào câu lệnh',exact:true}).click();
  }
  if (process.argv.includes('--attachment-controls')) {
    console.log(JSON.stringify(await page.locator('flow-add-menu-popover-content').evaluate(e=>({
      tags:[...new Set([...e.querySelectorAll('*')].map(x=>x.tagName))],
      controls:[...e.querySelectorAll('[role],button,input')].map(x=>({tag:x.tagName,role:x.getAttribute('role'),label:x.getAttribute('aria-label'),text:(x.innerText||'').slice(0,100),class:x.className})),
      references:[...e.querySelectorAll('*')].filter(x=>x.childElementCount===0 && x.textContent.includes('cat-reference')).map(x=>x.parentElement.parentElement.outerHTML.slice(0,15000).replace(/https:\/\/[^" ]+/g,'[media URL]'))
    })),null,2));process.exit(0);
  }
  if (process.argv.includes('--composer')) {
    console.log(await page.locator('flow-base-prompt-box').evaluate(e=>e.outerHTML.replace(/https:\/\/[^" ]+/g,'[media URL]')));process.exit(0);
  }
  if (process.argv.includes('--attachments')) {
    await require('../src/flow.cjs').closeOverlays(page);
    await page.getByRole('button',{name:'Thêm thành phần vào ô nhập câu lệnh',exact:true}).click();
    console.log(JSON.stringify(await page.locator('body').evaluate(body=>({
      files:[...body.querySelectorAll('input[type="file"]')].map(e=>({accept:e.accept,multiple:e.multiple,html:e.outerHTML})),
      overlays:[...body.querySelectorAll('.cdk-overlay-pane')].map(e=>({text:e.innerText,html:e.outerHTML.slice(0,12000)}))
    })),null,2));process.exit(0);
  }
  if (process.argv.includes('--assets')) {
    if (process.argv.includes('--tile-details')) await page.locator('flow-grid-tile-container').first().locator('button.footer-left').click();
    if (process.argv.includes('--tile-menu')) {
      await page.keyboard.press('Escape');
      const tile = page.locator('flow-grid-tile-container').first(); await tile.hover();
      await tile.getByRole('button', { name: 'Tuỳ chọn khác', exact:true }).click();
    }
    if (process.argv.includes('--download-menu')) await page.getByRole('menuitem', { name: /Tải xuống/ }).click();
    if (process.argv.includes('--concise')) {
      console.log(JSON.stringify(await page.locator('body').evaluate(body=>({
        tiles:[...body.querySelectorAll('flow-grid-tile-container')].map(e=>({label:e.getAttribute('aria-label'),media:[...e.querySelectorAll('img,video')].map(m=>({tag:m.tagName,path:new URL(m.src).pathname}))})),
        overlays:[...body.querySelectorAll('.cdk-overlay-pane')].map(e=>({text:e.innerText,html:e.outerHTML.slice(0,12000)}))
      })),null,2)); process.exit(0);
    }
    console.log(JSON.stringify(await page.locator('body').evaluate(body => {
      const all = [...body.querySelectorAll('*')];
      const tags = [...new Set(all.map(e=>e.tagName).filter(t=>/ASSET|MEDIA|TILE|VIDEO|GENERATION|CARD/.test(t)))];
      const anchors = all.filter(e=>e.matches('video, [role="progressbar"], [data-asset-id]'));
      return {tags,tiles:[...body.querySelectorAll('flow-grid-tile-container')].map(e=>e.outerHTML.slice(0,1500).replace(/https:\/\/[^" ]+/g,'[media URL]')),tail:body.innerText.slice(-7000),overlays:[...body.querySelectorAll('.cdk-overlay-pane')].map(e=>e.outerHTML.slice(0,20000).replace(/https:\/\/[^" ]+/g,'[media URL]'))};
    }), null, 2));
    process.exit(0);
  }
  if (process.argv.includes('--project')) {
    if (process.argv.includes('--models')) await page.getByRole('button', { name: 'Chọn nhóm mô hình', exact: true }).click();
    const snapshot = await page.locator('textarea, [contenteditable="true"], button, [role="button"], [role="combobox"]').evaluateAll(elements => elements.filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !/Tài khoản Google|Google Account/.test(e.getAttribute('aria-label') || '');
    }).map(e => ({ tag:e.tagName, role:e.getAttribute('role'), label:e.getAttribute('aria-label'), checked:e.getAttribute('aria-checked'), pressed:e.getAttribute('aria-pressed'), placeholder:e.getAttribute('placeholder') || e.getAttribute('data-placeholder'), class:typeof e.className === 'string' ? e.className : '', text:(e.innerText || '').slice(0,140) })));
    const body = await page.locator('body').innerText();
    const cost = body.match(/[^\n]*(?:tốn|cost)[^\n]*\n?[^\n]*(?:tín dụng|credits)[^\n]*/gi);
    console.log(JSON.stringify({ url:page.url(), cost, controls:snapshot }, null, 2));
    process.exit(0);
  }
  const controls = await page.locator('[role="button"], button').evaluateAll(elements => elements.filter(e => /account|tài khoản/i.test(e.getAttribute('aria-label') || '')).map(e => ({tag:e.tagName, role:e.getAttribute('role'), label:(e.getAttribute('aria-label') || '').replace(/[\w.+-]+@[\w.-]+/g, '[email]'), class:e.className})));
  console.log(JSON.stringify({controls}, null, 2));
  if (process.argv.includes('--read')) {
    const { readFlowCredits } = require('../src/flow-credits.cjs');
    console.log('Flow credits:', await readFlowCredits(page));
  } else if (process.argv.includes('--menu')) {
    await page.getByRole('button', { name: 'Thông tin về tài khoản', exact: true }).click();
    for (const frame of page.frames()) {
      const matches = await frame.locator('a, button, [role="link"]').evaluateAll(elements => elements.filter(e => /tín dụng Google Flow|Google Flow credits/i.test(e.innerText || '')).map(e => ({tag:e.tagName, class:e.className, text:e.innerText, html:e.outerHTML.slice(0,2000)})));
      if (matches.length) console.log(JSON.stringify({creditsElements:matches}, null, 2));
    }
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
