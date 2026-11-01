const fs=require('node:fs'),path=require('node:path');
function normalizedDirectory(directory){try{directory=fs.realpathSync(directory);}catch{}return path.resolve(directory).replace(/[\\/]+$/,'').toLowerCase();}
function userDataDirectory(command){
 const match=String(command||'').match(/"--user-data-dir=([^"]+)"|--user-data-dir="([^"]+)"|--user-data-dir=([^\s"]+)/i);
 return match&&(match[1]||match[2]||match[3]);
}
function portForDirectory(commands,directory){
 for(const command of commands){const actual=userDataDirectory(command),port=String(command).match(/--remote-debugging-port=(\d+)/)?.[1];if(actual&&normalizedDirectory(actual)===normalizedDirectory(directory)&&Number(port)>0&&Number(port)<=65535)return Number(port);}
 return null;
}
async function verifyBrowserDirectory(browser,directory){
 const context=browser.contexts()[0];if(!context)throw Error('Trình duyệt chưa có phiên làm việc.');
 const page=await context.newPage();
 try{await page.goto('chrome://version',{waitUntil:'domcontentloaded',timeout:10000});const actual=await page.locator('#profile_path').innerText({timeout:5000});if(normalizedDirectory(path.dirname(actual.trim()))!==normalizedDirectory(directory))throw Error('Cổng trình duyệt thuộc profile khác; không dùng kết nối này.');}
 finally{await page.close().catch(()=>{});}
}
module.exports={normalizedDirectory,userDataDirectory,portForDirectory,verifyBrowserDirectory};
