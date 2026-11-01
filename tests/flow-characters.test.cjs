const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalize, checkFlowCharacters } = require('../src/flow-characters.cjs');

test('flow characters: normalize removes diacritics and trims', () => {
  assert.equal(normalize('Bố Bự'), 'bo bu');
  assert.equal(normalize('  Mẹ Mướp  '), 'me muop');
  assert.equal(normalize('Út Ngáo'), 'ut ngao');
  assert.equal(normalize('ti_ho'), 'ti_ho');
});

test('flow characters: checkFlowCharacters matches existing characters correctly', async () => {
  const fakePage = {
    url: () => 'https://flow.google.com/project/test-project',
    evaluate: async (fn) => {
      // Mock listProjectCharacters DOM query
      return [
        { index: 0, name: 'bo_bu', thumbnailSrc: 'https://cdn/bo_bu.jpg' },
        { index: 1, name: 'Mẹ Mướp', thumbnailSrc: 'https://cdn/me_muop.jpg' }
      ];
    },
    $: async () => null,
    waitForTimeout: async () => {}
  };

  const speakers = [
    { id: 'bo_bu', name: 'Bố Bự', flowVoice: 'Charon' },
    { id: 'me_muop', name: 'Mẹ Mướp', flowVoice: 'Aoede' },
    { id: 'ti_ho', name: 'Anh Tí Hổ', flowVoice: 'Orus' }
  ];

  const result = await checkFlowCharacters(fakePage, speakers);
  assert.equal(result.totalExpected, 3);
  assert.equal(result.totalExisting, 2);
  assert.equal(result.allSynced, false);

  const bobu = result.characters.find(c => c.id === 'bo_bu');
  assert.equal(bobu.exists, true);
  assert.equal(bobu.flowName, 'bo_bu');

  const memuop = result.characters.find(c => c.id === 'me_muop');
  assert.equal(memuop.exists, true);
  assert.equal(memuop.flowName, 'Mẹ Mướp');

  const tiho = result.characters.find(c => c.id === 'ti_ho');
  assert.equal(tiho.exists, false);
  assert.equal(tiho.flowName, null);
});

test('character status carries each selected image and does not match a partial ID',async()=>{
 const page={url:()=> 'https://flow.google.com/project/test',evaluate:async()=>[{name:'bo_bu_extra'}],$:async()=>null,waitForTimeout:async()=>{}};
 const result=await checkFlowCharacters(page,[{id:'bo_bu',name:'B? B?',imagePath:'portrait.png'}]);
 assert.equal(result.characters[0].imagePath,'portrait.png');assert.equal(result.characters[0].exists,false);
});
