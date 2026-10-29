const { test }=require('node:test');
const assert=require('node:assert/strict');
const flow=require('../src/flow.cjs');
test('requires explicit project, supported settings, duration and non-ambiguous costs',()=>{
 assert.equal(flow.projectUrl('https://flow.google.com/project/abc-123?x=1'),'https://flow.google.com/project/abc-123');
 assert.throws(()=>flow.projectUrl('https://flow.google.com/'),/dự án/);
 assert.throws(()=>flow.validateOptions({resolution:'720p',ratio:'1:1',budget:12}),/16:9/);
 assert.throws(()=>flow.compilePrompt({duration_seconds:12,video_prompt_en:'test'}),/thời lượng/);
 assert.equal(flow.parseCost('Quá trình tạo sẽ tốn 6 tín dụng'),6);
 assert.equal(flow.parseCost('Generation will cost 12 credits'),12);
 assert.throws(()=>flow.parseCost('Quá trình tạo sẽ tốn 6 tín dụng\nQuá trình tạo sẽ tốn 12 tín dụng'),/chi phí/);
});
