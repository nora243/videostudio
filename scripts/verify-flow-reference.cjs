const { chromium }=require('playwright-core');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'video-studio/workspace/workspace.json'),'utf8'));
 const browser=await chromium.connectOverCDP(`http://127.0.0.1:${state.browserPort}`);
 const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('flow.google.com/project/'));
 const flow=require('../src/flow.cjs');await flow.closeOverlays(page);
 const tile=page.locator('flow-grid-tile-container').first();await tile.hover();
 const video=tile.locator('video');await video.waitFor();
 await video.evaluate(async v=>{if(v.readyState<2)await new Promise(r=>v.addEventListener('loadeddata',r,{once:true}));v.pause();});
 const file=path.resolve('.test-runtime/flow-live/cat-reference.png');await video.screenshot({path:file});
 await page.getByRole('button',{name:'Thêm thành phần vào ô nhập câu lệnh',exact:true}).click();
 const pending=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'Tải nội dung nghe nhìn lên',exact:true}).click();
 await (await pending).setFiles(file);
 await page.waitForTimeout(1500);
 console.log(JSON.stringify(await page.locator('body').evaluate(body=>({
 tags:[...new Set([...body.querySelectorAll('*')].map(e=>e.tagName).filter(t=>/INGREDIENT|REFERENCE|CHIP|PROMPT/.test(t)))],
 composer:body.querySelector('.ProseMirror')?.parentElement?.parentElement?.outerHTML.slice(0,18000).replace(/https:\/\/[^" ]+/g,'[media URL]'),tail:body.innerText.slice(-2000)
 })),null,2));
 process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1);});
