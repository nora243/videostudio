const{test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const{userDataDirectory,portForDirectory,verifyBrowserDirectory}=require('../src/browser-profile-connection.cjs');
test('browser lookup matches the entire user-data directory, never the default-browser flag',()=>{
 const a=path.resolve('profile-a'),b=path.resolve('profile-b'),commands=[`chrome.exe "--user-data-dir=${b}" --remote-debugging-port=54159 --no-default-browser-check`,`chrome.exe --user-data-dir="${a}" --remote-debugging-port=60956`];
 assert.equal(userDataDirectory(commands[0]),b);assert.equal(portForDirectory(commands,a),60956);assert.equal(portForDirectory(commands,path.resolve('default')),null);assert.equal(portForDirectory([`chrome.exe "--user-data-dir=${a}" --remote-debugging-port=0`],a),null);
});
test('an endpoint belonging to another profile is rejected and only its inspection tab is closed',async()=>{
 const a=path.resolve('a'),b=path.resolve('b');let closed=0;
 const browser={contexts:()=>[{newPage:async()=>({goto:async()=>{},locator:()=>({innerText:async()=>path.join(b,'Default')}),close:async()=>{closed++;}})}]};
 await assert.rejects(verifyBrowserDirectory(browser,a),/profile khác/);assert.equal(closed,1);await verifyBrowserDirectory(browser,b);assert.equal(closed,2);
});
