const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isServiceUrl } = require('../src/service-urls.cjs');

test('Flow recognizes the redirected signed-in URL and legacy routes', () => {
  for (const url of ['https://flow.google.com/?pli=1', 'https://flow.google.com/project/123', 'https://labs.google/fx/tools/flow', 'https://labs.google/fx/vi/tools/flow/project/123']) {
    assert.equal(isServiceUrl('flow', url), true, url);
  }
});

test('Flow rejects sign-in, other Labs tools and lookalike domains', () => {
  for (const url of ['https://accounts.google.com/ServiceLogin', 'https://labs.google/fx/tools/whisk', 'https://labs.google/fx/tools/flow-fake', 'https://flow.google.com.evil.test/', 'https://evil.test/flow.google.com', 'http://flow.google.com/', 'https://flow.google.com:1234/', 'invalid']) {
    assert.equal(isServiceUrl('flow', url), false, url);
  }
});

test('Gemini matching stays isolated from Flow and Google sign-in', () => {
  assert.equal(isServiceUrl('gemini', 'https://gemini.google.com/app/123'), true);
  assert.equal(isServiceUrl('gemini', 'https://flow.google.com/'), false);
  assert.equal(isServiceUrl('gemini', 'https://accounts.google.com/'), false);
});
