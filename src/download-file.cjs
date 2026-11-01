const fs=require('node:fs');
const path=require('node:path');

// CDP connections share Chrome's download destination. Another connection can
// leave it pointing at a deleted Playwright temporary directory. Own the path
// and track Chrome's GUID instead of assuming Playwright owns the source file.
async function beginDownload(page,filename){
 const directory=path.join(path.dirname(filename),'.downloads');
 fs.mkdirSync(directory,{recursive:true});
 const session=await page.context().newCDPSession(page);
 const started=new Map(),progress=new Map();
 const onStart=e=>started.set(e.guid,e),onProgress=e=>progress.set(e.guid,e);
 session.on('Browser.downloadWillBegin',onStart);
 session.on('Browser.downloadProgress',onProgress);
 try{await session.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:directory,eventsEnabled:true});}
 catch(error){await session.detach();throw error;}
 return {
  async save(download,timeout=180000,shouldStop=()=>false){
   const deadline=Date.now()+timeout;
   while(Date.now()<deadline){
    if(shouldStop())throw Error('Download paused; partial Chrome files are preserved.');
    const matches=[...started.values()].filter(e=>e.url===download.url());
    if(matches.length>1)throw Error('Có nhiều file tải cùng địa chỉ; dừng để tránh lưu nhầm.');
    const entry=matches[0],state=entry&&progress.get(entry.guid);
    if(state?.state==='canceled')throw Error('Chrome đã hủy tải video. Hãy đối soát / tải lại.');
    if(state?.state==='completed'){
     const source=path.join(directory,entry.guid);
     fs.copyFileSync(source,filename);fs.unlinkSync(source);
     return;
    }
    await new Promise(resolve=>setTimeout(resolve,100));
   }
   throw Error('Chưa tải xong video sau 3 phút. Hãy đối soát / tải lại; không tạo lại video.');
  },
  async close(){
   session.off('Browser.downloadWillBegin',onStart);session.off('Browser.downloadProgress',onProgress);
   await session.detach().catch(()=>{});
   // Chrome retains this destination after detaching. Keep the directory valid
   // for manual browser downloads too; preserve partial files on error.
  }
 };
}
module.exports={beginDownload};
