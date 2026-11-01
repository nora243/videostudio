const {test}=require('node:test'),assert=require('node:assert/strict');
const {voiceSegments,insertVoiceMentions,verifyVoiceMentions}=require('../src/flow-voice-mentions.cjs');
const {audioPrompt}=require('../src/production.cjs');
test('voice assignments are concise and only include speaking characters',()=>{
 const scene={audio:{mode:'native',speakers:[{id:'lead',name:'Lead',flowVoice:'Aoede',customVoice:'Lead custom',description:'Long voice description',region:'north'},{id:'silent',name:'Silent',flowVoice:'Charon'}],dialogue:[{speaker:'lead',text:'Xin chào.'}]}};
 const prompt=audioPrompt(scene);assert.match(prompt,/lead \(Lead\) uses \[Flow voice: Lead custom\]/);assert.match(prompt,/Xin chào/);assert.doesNotMatch(prompt,/Long voice description|Northern|PRONUNCIATION MANDATE|silent \(Silent\)/);
 assert.deepEqual(voiceSegments('A [Flow voice: Lead custom].'),[{text:'A '},{voice:'Lead custom'},{text:'.'}]);
});
test('unattached voices fail before modifying the editor',async()=>{
 await assert.rejects(insertVoiceMentions({},'[Flow voice: Missing]',['Aoede']),/không khớp/);
});
test('voice chip IDs and order must match before submission, not just plain text',async()=>{
 const expected=[{id:'voice-1',name:'Lead'}];let chips=expected;
 const page={locator:()=>({evaluateAll:async()=>chips})};
 await verifyVoiceMentions(page,expected);chips=[{id:'voice-2',name:'Lead'}];await assert.rejects(verifyVoiceMentions(page,expected),/đã thay đổi/);
});
