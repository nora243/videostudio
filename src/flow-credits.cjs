// Parse only explicit balance labels, never a bare number or a generation price.
function parseCredits(text) {
  const normalized = String(text).replace(/[\u00a0\u202f]/g, ' ');
  const number = '(\\d{1,3}(?:[., ]\\d{3})+|\\d+)';
  const patterns = [
    new RegExp('^\\s*' + number + '\\s+(?:tín dụng Google Flow|Google Flow credits|AI credits|tín dụng AI)\\s*$', 'gimu'),
    new RegExp('^\\s*(?:Google Flow credits|AI credits|Tín dụng Google Flow|Tín dụng AI)\\s*[:：]\\s*' + number + '\\s*$', 'gimu')
  ];
  const values = new Set();
  for (const pattern of patterns) for (const match of normalized.matchAll(pattern)) {
    const value = Number(match[1].replace(/[., ]/g, ''));
    if (Number.isSafeInteger(value) && value >= 0 && value <= 1000000) values.add(value);
  }
  return values.size === 1 ? [...values][0] : null;
}

async function readVisibleBalance(page) {
  const values = new Set();
  for (const frame of page.frames()) {
    try {
      // Account menus can live in an iframe. Exclude frames hidden by the page.
      if (frame !== page.mainFrame()) {
        const element = await frame.frameElement();
        try { if (!await element.isVisible()) continue; } finally { await element.dispose(); }
      }
      // Observed Flow DOM: <a class="credits-link"><span class="credits-count">…</span></a>.
      const balanceLabels = frame.locator('.credits-link .credits-count');
      const labels = await balanceLabels.count();
      for (let i = 0; i < labels; i++) {
        const label = balanceLabels.nth(i);
        if (!await label.isVisible()) continue;
        const amount = parseCredits(await label.innerText({ timeout: 1000 }));
        if (amount !== null) values.add(amount);
      }
      const value = parseCredits(await frame.locator('body').innerText({ timeout: 2000 }));
      if (value !== null) values.add(value);
    } catch { /* A menu/frame may close while reading. */ }
  }
  return values.size === 1 ? [...values][0] : null;
}

async function readFlowCredits(page) {
  let value = await readVisibleBalance(page);
  if (value !== null) return value;
  // Flow's own header overlays Google's underlying account link. Click the
  // visible Flow wrapper first; do not force-click through an overlay.
  const accounts = [
    page.locator('.header-user-button[role="button"]'),
    page.getByRole('button', { name: /^(Thông tin về tài khoản|Account information|Account info)$/i }),
    page.getByRole('button', { name: /Google Account|Tài khoản Google/i })
  ];
  for (const account of accounts) {
    if (await account.count() !== 1 || !await account.isVisible()) continue;
    try { await account.click({ timeout: 3000 }); }
    catch { continue; }
    for (let attempt = 0; attempt < 12; attempt++) {
      value = await readVisibleBalance(page);
      if (value !== null) return value;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    // A click succeeded. Do not toggle the same menu closed via another alias.
    break;
  }
  throw new Error('Chưa đọc được số dư. Trong Flow, hãy bấm ảnh đại diện góc trên bên phải để hiện dòng “tín dụng Google Flow”, giữ menu mở rồi bấm “Đọc tín dụng Flow” lần nữa. Số dư cũ được giữ nguyên.');
}

module.exports = { parseCredits, readFlowCredits };
