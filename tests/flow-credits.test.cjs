const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCredits, readFlowCredits } = require('../src/flow-credits.cjs');
test('reads explicit Vietnamese and English account balances, including zero', () => {
  for (const [text, value] of [
    ['Google\n431 tín dụng Google Flow\nNâng cấp', 431],
    ['1.050 tín dụng Google Flow', 1050], ['1,050 Google Flow credits', 1050],
    ['1\u202f050 tín dụng Google Flow', 1050], ['0 Google Flow credits', 0],
    ['AI credits: 431', 431], ['431 AI credits', 431]
  ]) assert.equal(parseCredits(text), value, text);
});
test('rejects prices, promotions, ambiguous balances and malformed content', () => {
  for (const text of ['20 credits per video', 'Nâng cấp nhận 1000 tín dụng Google Flow', '431', '', '431 Google Flow credits\n500 Google Flow credits', '1.5 Google Flow credits', '1000001 Google Flow credits']) {
    assert.equal(parseCredits(text), null, text);
  }
});

function mockPage({ text = '', menuText = '', hidden = false, opensMenu = false, overlay = false } = {}) {
  let opened = !opensMenu;
  let clicks = 0;
  const main = { locator: () => ({ count: async () => 0, innerText: async () => text }) };
  const menu = {
    frameElement: async () => ({ isVisible: async () => !hidden && opened, dispose: async () => {} }),
    locator: () => ({ count: async () => 0, innerText: async () => menuText })
  };
  return {
    frames: () => [main, menu], mainFrame: () => main,
    locator: () => ({ count: async () => overlay ? 1 : 0, isVisible: async () => true, click: async () => { clicks++; opened = true; } }),
    getByRole: (_role, {name}) => ({ count: async () => opensMenu && name.source.includes('Google Account') ? 1 : 0, isVisible: async () => true, click: async () => { if (overlay) throw Error('Flow wrapper intercepts pointer events'); clicks++; opened = true; } }),
    clicks: () => clicks
  };
}

test('reads the account iframe without clicking an already open menu', async () => {
  const page = mockPage({ menuText: 'Google\n431 tín dụng Google Flow\nNâng cấp' });
  assert.equal(await readFlowCredits(page), 431);
  assert.equal(page.clicks(), 0);
});

test('opens a clearly labelled account menu when necessary', async () => {
  const page = mockPage({ menuText: '0 Google Flow credits', opensMenu: true });
  assert.equal(await readFlowCredits(page), 0);
  assert.equal(page.clicks(), 1);
});

test('ignores hidden account frames and gives actionable failure', async () => {
  const page = mockPage({ menuText: '999 Google Flow credits', hidden: true });
  await assert.rejects(readFlowCredits(page), /giữ menu mở/);
  assert.equal(page.clicks(), 0);
});

test('clicks the Flow wrapper rather than the covered Google account anchor', async () => {
  const page = mockPage({ menuText: '431 tín dụng Google Flow', opensMenu: true, overlay: true });
  assert.equal(await readFlowCredits(page), 431);
  assert.equal(page.clicks(), 1);
});
