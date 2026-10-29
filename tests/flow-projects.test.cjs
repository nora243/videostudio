const{test}=require('node:test');const assert=require('node:assert/strict');const{FlowProjects}=require('../src/flow-projects.cjs');
function fixture(options={}){
 const state={activeProjectId:'tool-project-one',project:{title:'Test project'},...options.state};const events=[];let page=null,count=0;
 const driver={
  findOwned:async()=>page,
  home:async()=>{events.push('home');page={location:'https://flow.google.com/',url(){return this.location;}};return page;},
  create:async p=>{assert.equal(state.flowProjectCreation.status,'submitting');events.push('create');p.location=`https://flow.google.com/project/new-${++count}`;return p.url();},
  rename:async(_p,name)=>{assert.ok(state.flowProject.url);events.push('rename');if(options.renameFails)throw Error('rename unavailable');},
  openLinked:async(_b,url)=>{events.push('open:'+url);return{url:()=>url};},...options.driver
 };
 const dependencies={state,connect:async()=>({}),persist:()=>events.push('save'),driver,owners:()=>options.owners||[]};
 return{state,driver,events,manager:new FlowProjects(dependencies),dependencies};
}
test('new tool project creates its own Flow project once even for concurrent requests',async()=>{
 const{state,manager,events}=fixture();await Promise.all([manager.ensure(),manager.ensure()]);assert.equal(events.filter(e=>e==='create').length,1);assert.equal(state.flowProject.toolProjectId,state.activeProjectId);assert.equal(state.flowProject.renamePending,false);
 await manager.ensure();assert.equal(events.filter(e=>e==='create').length,1);
});
test('saved binding reopens the exact URL after restart instead of adopting another tab',async()=>{
 const f=fixture({state:{flowProject:{url:'https://flow.google.com/project/existing'}}});await f.manager.ensure();const reopened=new FlowProjects(f.dependencies);await reopened.ensure();assert.equal(f.events.filter(e=>e==='create').length,0);assert.equal(f.events.filter(e=>e==='open:https://flow.google.com/project/existing').length,2);
});
test('renaming the tool project updates the owned Flow title without changing project identity',async()=>{
 const f=fixture();await f.manager.ensure();const url=f.state.flowProject.url;f.state.project.title='Renamed project';await f.manager.ensure();assert.equal(f.state.flowProject.url,url);assert.match(f.state.flowProject.name,/^Renamed project/);assert.equal(f.events.filter(e=>e==='create').length,1);assert.equal(f.events.filter(e=>e==='rename').length,2);
});
test('rename failure keeps the created URL and never creates a second project',async()=>{
 const f=fixture({renameFails:true});await f.manager.ensure();assert.equal(f.state.flowProject.renamePending,true);const url=f.state.flowProject.url;await f.manager.ensure();assert.equal(f.state.flowProject.url,url);assert.equal(f.events.filter(e=>e==='create').length,1);
});
test('recovers navigation after an uncertain create using its own marked tab',async()=>{
 let attempt=0;const f=fixture({driver:{create:async page=>{page.location='https://flow.google.com/project/recovered';attempt++;throw Error('lost after navigation');}}});await assert.rejects(f.manager.ensure(),/lost/);assert.equal(f.state.flowProjectCreation.status,'submitting');await f.manager.ensure();assert.equal(f.state.flowProject.url,'https://flow.google.com/project/recovered');assert.equal(attempt,1);
});
test('unknown creation with no original tab stops rather than creating duplicate projects',async()=>{
 const f=fixture({state:{flowProjectCreation:{status:'submitting',name:'Pending'}}});await assert.rejects(f.manager.ensure(),/không tự tạo trùng/);assert.ok(!f.events.includes('home'));assert.ok(!f.events.includes('create'));
});
test('a legacy binding shared with another tool project gets a separate new project',async()=>{
 const old='https://flow.google.com/project/shared';const f=fixture({state:{flowProject:{url:old},flowBatch:{projectUrl:old}},owners:[{id:'another-tool-project',url:old}]});await f.manager.ensure();assert.notEqual(f.state.flowProject.url,old);assert.equal(f.state.flowBatch.projectUrl,old);assert.equal(f.events.filter(e=>e==='create').length,1);
});
