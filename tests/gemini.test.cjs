const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sendGemini, collectGemini } = require('../src/gemini.cjs');

function mockComposer(draft = '') {
  const events = [];
  const input = { count: async () => 1, isVisible: async () => true, innerText: async () => draft, fill: async value => { events.push('filled'); draft = value; } };
  const send = { waitFor: async () => {}, isEnabled: async () => true, click: async () => { events.push('clicked'); } };
  const page = {
    url: () => 'https://gemini.google.com/app/123',
    locator: selector => selector === 'model-response' ? { count: async () => 0 } : input,
    getByRole: (_role, { name }) => name.source.includes('Ngừng') ? { isVisible: async () => false } : send
  };
  return { page, events, draft: () => draft };
}
test('persists submission baseline before clicking send exactly once', async () => {
  const { page, events } = mockComposer();
  await sendGemini(page, 'Test prompt', baseline => { assert.deepEqual(baseline, { count: 0, key: '' }); events.push('persisted'); });
  assert.deepEqual(events, ['filled', 'persisted', 'clicked']);
});
test('never overwrites an existing browser draft', async () => {
  const { page, events, draft } = mockComposer('My unsent text');
  await assert.rejects(sendGemini(page, 'Another prompt', () => {}), /bản nháp/);
  assert.deepEqual(events, []);
  assert.equal(draft(), 'My unsent text');
});
test('never imports an old answer as the new response', async () => {
  let progress = 0;
  const content = { count: async () => 1, last() { return this; }, getAttribute: async () => 'old-response', innerText: async () => '{"title":"Old answer"}' };
  const response = { locator: () => content, getByRole: () => ({ count: async () => 1 }) };
  const page = {
    url: () => 'https://gemini.google.com/app/123', isClosed: () => false,
    getByRole: () => ({ isVisible: async () => false }),
    locator: selector => selector === 'user-query' ? { count: async () => 1, last: () => ({ textContent: async () => 'TEST_REQUEST' }) } : { count: async () => 1, last: () => response }
  };
  await assert.rejects(collectGemini(page, { marker: 'TEST_REQUEST', baseline: { count: 1, key: 'old-response' } }, () => { progress++; }, 1), /không tự gửi lại/);
  assert.equal(progress, 0);
});

test('explicit resend can replace only the matching previous prompt left in composer',async()=>{
 const matching=mockComposer('Original prompt');
 await sendGemini(matching.page,'Retried prompt',()=>matching.events.push('persisted'),{allowedDraft:'Original prompt'});
 assert.deepEqual(matching.events,['filled','persisted','clicked']);
 assert.equal(matching.draft(),'Retried prompt');
 const other=mockComposer('Unrelated user draft');
 await assert.rejects(sendGemini(other.page,'Retried prompt',()=>{},{allowedDraft:'Original prompt'}),/bản nháp/);
 assert.deepEqual(other.events,[]);assert.equal(other.draft(),'Unrelated user draft');
});

test('explicit resend does not interrupt a Gemini response still generating',async()=>{
 const mock=mockComposer();mock.page.getByRole=()=>({isVisible:async()=>true});
 await assert.rejects(sendGemini(mock.page,'Retry',()=>{},{allowedDraft:'Original'}),/đang trả lời/);
 assert.deepEqual(mock.events,[]);
});
