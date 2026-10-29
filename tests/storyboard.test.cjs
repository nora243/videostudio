const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPrompt, parseStoryboard, validateStoryboard } = require('../src/storyboard.cjs');
const scene = { id: 1, duration_seconds: 8, description_vi: 'Bình minh trên hồ', voiceover_vi: '', video_prompt_en: 'A cinematic sunrise over a lake.', negative_prompt_en: '' };
const script = { title: 'Bình minh', summary: 'Một ngày mới', scenes: [scene] };
test('parses real-world JSON wrappers without evaluating content', () => {
  const json = JSON.stringify(script);
  for (const raw of [json, `\`\`\`json\n${json}\n\`\`\``, `JSON\n${json}`, `Kịch bản của bạn:\n${json}\nHoàn tất.`]) assert.deepEqual(parseStoryboard(raw, 1), script);
});
test('rejects incomplete, wrong scene count and invalid scene data', () => {
  assert.throws(() => parseStoryboard('{"title":', 1), /JSON/);
  assert.throws(() => parseStoryboard(JSON.stringify(script), 2), /2/);
  assert.throws(() => validateStoryboard({ ...script, scenes: [{ ...scene, id: 3 }] }), /id/);
  assert.throws(() => validateStoryboard({ ...script, scenes: [{ ...scene, duration_seconds: -1 }] }), /thời lượng/);
  assert.throws(() => validateStoryboard({ ...script, scenes: [{ ...scene, video_prompt_en: '' }] }), /prompt/);
  assert.throws(() => parseStoryboard('process.exit(1)'), /JSON/);
});
test('builds prompts from validated project settings', () => {
  const project = { title: 'Đà Lạt', brief: 'Buổi sáng', scenes: 2, ratio: '9:16', style: 'Điện ảnh' };
  assert.match(buildPrompt(project), /Chính xác 2 cảnh/);
  assert.match(buildPrompt(project), /9:16/);
  assert.throws(() => buildPrompt({ ...project, scenes: 0 }), /50/);
  assert.throws(() => buildPrompt({ ...project, brief: '' }), /ý tưởng/);
});
