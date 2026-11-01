const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const{chromium}=require('playwright-core');
const{verifyBrowserDirectory}=require('../src/browser-profile-connection.cjs');
(async()=>{
 const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);if(!executable)throw Error('Chrome/Edge unavailable');
 const root=path.join(__dirname,'../.test-runtime');fs.mkdirSync(root,{recursive:true});const base=fs.mkdtempSync(path.join(root,'cold-profiles-')),children=[],connections=[];
 try{
  const profiles=await Promise.all(['a','b'].map(async id=>{
   const directory=path.join(base,id);fs.mkdirSync(directory);const child=spawn(executable,['--headless=new','--no-sandbox','--disable-gpu',`--user-data-dir=${directory}`,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});children.push(child);let port;
   const deadline=Date.now()+20000;while(Date.now()<deadline){try{port=Number(fs.readFileSync(path.join(directory,'DevToolsActivePort'),'utf8').split('\n')[0]);if(port>0)break;}catch{}await new Promise(r=>setTimeout(r,100));}
   assert.ok(port>0);const browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);connections.push(browser);await verifyBrowserDirectory(browser,directory);return {browser,directory,port};
  }));
  assert.notEqual(profiles[0].port,profiles[1].port);await assert.rejects(verifyBrowserDirectory(profiles[0].browser,profiles[1].directory),/profile khác/);
  console.log('Cold start verified: two fresh profiles started concurrently, distinct Chrome-reserved ports, correct profile ownership, cross-profile connection rejected. No user profiles or video generation used.');
 }finally{
  await Promise.allSettled(connections.map(async b=>{try{const session=await b.newBrowserCDPSession();await session.send('Browser.close');}catch{}}));
  for(const child of children)if(child.exitCode===null)child.kill();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
