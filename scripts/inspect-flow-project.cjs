const{chromium}=require('playwright-core');const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const state=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'video-studio/workspace/workspace.json'),'utf8'));
 const browser=await chromium.connectOverCDP(`http://127.0.0.1:${state.browserPort}`),context=browser.contexts()[0];
 const marker='VideoStudioProjectInspection';let page;
 for(const candidate of context.pages())try{if(await candidate.evaluate(()=>window.name)===marker){page=candidate;break;}}catch{}
 if(!page){page=await context.newPage();await page.goto('https://flow.google.com/',{waitUntil:'domcontentloaded'});await page.evaluate(value=>window.name=value,marker);}
 if(process.argv.includes('--new')){if(page.url().includes('/project/'))throw Error('Inspection project already created; not creating another');await page.getByRole('button',{name:/Dự án mới|New project/i}).click();await page.waitForURL(/\/project\/[a-z0-9-]+/i,{timeout:30000});}
 if(process.argv.includes('--menu'))await page.getByRole('button',{name:'Các lựa chọn khác cho dự án',exact:true}).click();
 if(process.argv.includes('--rename')){
  const rename=page.getByRole('menuitem',{name:/^Đổi tên$/});if(!await rename.isVisible())await page.getByRole('button',{name:'Các lựa chọn khác cho dự án',exact:true}).click();
  await page.getByRole('menuitem',{name:/^Đổi tên$/}).click();
  const input=page.getByRole('textbox',{name:'Văn bản có thể chỉnh sửa',exact:true});await input.fill('Video Studio · Kiểm tra liên kết tự động [probe]');await input.press('Enter');
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Các lựa chọn khác cho dự án',exact:true}).waitFor();
 }
 console.log(JSON.stringify({url:page.url(),controls:await page.locator('button,input,[role="button"],[role="menuitem"],[contenteditable="true"]').evaluateAll(elements=>elements.filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&!/Tài khoản Google|Google Account/.test(e.getAttribute('aria-label')||'');}).map(e=>({tag:e.tagName,role:e.getAttribute('role'),label:e.getAttribute('aria-label'),text:(e.innerText||'').slice(0,160),placeholder:e.getAttribute('placeholder'),value:e.value,class:typeof e.className==='string'?e.className:''})))},null,2));
 process.exit(0);
})().catch(error=>{console.error(error.message);process.exit(1);});
