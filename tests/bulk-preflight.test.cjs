const{test}=require('node:test'),assert=require('node:assert/strict');
const{readFreshBulkBalance}=require('../src/bulk-preflight.cjs');
test('cold-start preflight waits for a rendered account before reading credit balance',async()=>{
 let ready=false;const page={locator:()=>({first:()=>({waitFor:async()=>{ready=true;}})})};
 assert.equal(await readFreshBulkBalance(page,async()=>{assert.equal(ready,true);return 744;}),744);
});
test('a transient account load is retried without accepting any cached balance',async()=>{
 let reads=0,escapes=0,waits=0;const page={locator:()=>({first:()=>({waitFor:async()=>{}})}),keyboard:{press:async()=>{escapes++;}}};
 const amount=await readFreshBulkBalance(page,async()=>{if(++reads<3)throw Error('Loading account');return 1050;},{wait:async()=>{waits++;}});
 assert.equal(amount,1050);assert.equal(reads,3);assert.equal(escapes,2);assert.equal(waits,2);
});
test('failure after retries is explicit, never falling back to stored credits',async()=>{
 const page={locator:()=>({first:()=>({waitFor:async()=>{}})}),keyboard:{press:async()=>{}}};let reads=0;
 await assert.rejects(readFreshBulkBalance(page,async()=>{reads++;throw Error('No live balance');},{wait:async()=>{}}),/3 lần/);assert.equal(reads,3);
});
