const{projectUrl,closeOverlays}=require('./flow.cjs');
const{isServiceUrl}=require('./service-urls.cjs');

const browserDriver={
 async findOwned(browser,marker){
  for(const page of browser.contexts().flatMap(c=>c.pages())){
   if(page.isClosed()||!isServiceUrl('flow',page.url()))continue;
   try{if(await page.evaluate(()=>window.name)===marker)return page;}catch{}
  }
  return null;
 },
 async openLinked(browser,url){
  let page=browser.contexts().flatMap(c=>c.pages()).find(p=>{try{return !p.isClosed()&&projectUrl(p.url())===url;}catch{return false;}});
  if(!page){page=await browser.contexts()[0].newPage();await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});}
  await page.locator('.ProseMirror[role="textbox"], .page-layout, .preset-card, flow-character-tile').first().waitFor({state:'visible',timeout:30000});
  if(projectUrl(page.url())!==url)throw Error('Project Flow đã liên kết không truy cập được. Hãy kiểm tra tài khoản đăng nhập; tool giữ nguyên liên kết.');
  await page.bringToFront();return page;
 },
 async home(browser,marker){
  const page=await browser.contexts()[0].newPage();
  await page.goto('https://flow.google.com/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.evaluate(value=>window.name=value,marker);
  try{await page.getByRole('button',{name:/Dự án mới|New project/i}).waitFor({state:'visible',timeout:30000});}
  catch{throw Error('Chưa tìm thấy nút tạo project. Hãy hoàn tất đăng nhập Flow trong trình duyệt rồi thử lại.');}
  return page;
 },
 async create(page){
  await closeOverlays(page);
  await page.getByRole('button',{name:/Dự án mới|New project/i}).click({timeout:10000});
  await page.waitForURL(url=>{try{projectUrl(url.toString());return true;}catch{return false;}},{timeout:45000});
  return projectUrl(page.url());
 },
 async rename(page,name){
  await page.getByRole('button',{name:/^(Các lựa chọn khác cho dự án|More project options)$/i}).waitFor({state:'visible',timeout:30000});
  const input=page.locator('input.editable-text-input');
  if(await input.count()===1&&await input.inputValue()===name)return;
  await closeOverlays(page);
  await page.getByRole('button',{name:/^(Các lựa chọn khác cho dự án|More project options)$/i}).click();
  await page.getByRole('menuitem',{name:/^(Đổi tên|Rename)$/i}).click();
  await input.fill(name);await input.press('Enter');
  if(await input.inputValue()!==name)throw Error('Flow chưa nhận tên project.');
 }
};

class FlowProjects{
 constructor({state,persist,connect,onPage=()=>{},owners=()=>[],driver=browserDriver}){Object.assign(this,{state,persist,connect,onPage,owners,driver});this.pending=null;}
 ensure(){
  if(this.pending)return this.pending;
  this.pending=this.ensureOnce().finally(()=>{this.pending=null;});return this.pending;
 }
 async open(url){return this.driver.openLinked(await this.connect(),projectUrl(url));}
 async ensureOnce(){
  const id=this.state.activeProjectId;if(!id)throw Error('Chưa có dự án trong tool.');
  const browser=await this.connect(),marker=`VideoStudioFlow:${id}`;
  const desiredName=`${(this.state.project?.title||this.state.storyboard?.title||'Video Studio').trim().slice(0,150)} · VS-${id.slice(0,8)}`;
  let link=this.state.flowProject;
  // New bindings are never inferred from whichever project happens to be open.
  if(link?.url){
   const url=projectUrl(link.url);
   const shared=this.owners().some(owner=>owner.id!==id&&owner.url===url);
   if(!shared&&(!link.toolProjectId||link.toolProjectId===id)){
    const page=await this.driver.openLinked(browser,url);
    if(link.createdByTool&&link.name!==desiredName){link.name=desiredName;link.renamePending=true;}
    link.toolProjectId=id;this.persist();this.onPage(page);
    if(link.renamePending)await this.finishName(page,link);
    return page;
   }
   this.state.flowProject=null;this.state.flowPrepared=null;this.state.flowProjectCreation=null;this.persist();
  }
  const intent=this.state.flowProjectCreation;
  let page=await this.driver.findOwned(browser,marker),url;
  if(page)try{url=projectUrl(page.url());}catch{}
  if(!url&&intent?.status==='submitting')throw Error('Lần tạo project trước chưa xác định kết quả. Giữ tab Flow do tool vừa mở và thử lại để khôi phục; tool không tự tạo trùng.');
  const name=intent?.name||desiredName;
  if(!url){
   if(!page)page=await this.driver.home(browser,marker);
   this.state.flowProjectCreation={toolProjectId:id,name,marker,status:'submitting',startedAt:new Date().toISOString()};this.persist();
   url=await this.driver.create(page);
  }
  if(this.state.activeProjectId!==id)throw Error('Dự án trong tool đã thay đổi khi tạo Flow project.');
  link={url:projectUrl(url),toolProjectId:id,name,boundAt:new Date().toISOString(),createdByTool:true,renamePending:true};
  this.state.flowProject=link;this.state.flowPrepared=null;this.state.flowProjectCreation={...this.state.flowProjectCreation,status:'linked',url:link.url,name};
  // Save the actual URL before rename. Rename failure cannot create a duplicate.
  this.persist();this.onPage(page);await this.finishName(page,link);return page;
 }
 async finishName(page,link){
  try{await this.driver.rename(page,link.name);link.renamePending=false;delete link.warning;}
  catch{link.warning='Đã liên kết project Flow; chưa đổi được tên, tool sẽ thử lại ở lần mở tiếp theo.';}
  this.persist();
 }
}
module.exports={FlowProjects,browserDriver};
