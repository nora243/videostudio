const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const flow = require('../src/flow.cjs');
(async () => {
  const state = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'video-studio/workspace/workspace.json'), 'utf8'));
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${state.browserPort}`);
  const page = browser.contexts().flatMap(c => c.pages()).find(p => { try { flow.projectUrl(p.url()); return true; } catch { return false; } });
  if (!page) throw new Error('Open a Flow project first');
  const scene = state.storyboard.scenes[0];
  const options = flow.validateOptions({ resolution:'360p', ratio:state.project.ratio, budget:6 });
  const directory = path.resolve('.test-runtime/flow-live'); fs.mkdirSync(directory,{recursive:true});
  const filename = path.join(directory,'job.json');
  let job;
  if (process.argv.includes('--recover')) {
    job = JSON.parse(fs.readFileSync(filename,'utf8'));
    await flow.collect(page, job, ()=>fs.writeFileSync(filename,JSON.stringify(job,null,2)));
    await flow.download(page,job,path.join(directory,'scene-001.mp4'),()=>fs.writeFileSync(filename,JSON.stringify(job,null,2)));
    console.log('PASS real Flow generation, prompt/config matching and download:', JSON.stringify(job.metadata));
  } else if (process.argv.includes('--submit')) {
    job = JSON.parse(fs.readFileSync(filename,'utf8'));
    if (job.status !== 'prepared') throw new Error('Job already submitted or not prepared; refusing duplicate');
    const credits = await flow.balance(page);
    const prepared = await flow.prepare(page, scene, options, job.prompt);
    if (prepared.cost > 6 || prepared.cost > credits) throw new Error('Test budget exceeded');
    Object.assign(job, prepared);
    await flow.submit(page,job,()=>fs.writeFileSync(filename,JSON.stringify(job,null,2)));
    console.log('Submitted one scene. Expected maximum 6 credits.');
  } else {
    if (fs.existsSync(filename) && JSON.parse(fs.readFileSync(filename,'utf8')).status !== 'prepared') throw new Error('Existing submission: inspect/recover, do not prepare another test.');
    const prepared = await flow.prepare(page,scene,options);
    job = { ...prepared, sceneId:scene.id, status:'prepared' };
    fs.writeFileSync(filename,JSON.stringify(job,null,2));
    console.log(JSON.stringify({status:job.status,cost:job.cost,configuration:job.configuration}));
  }
  process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1);});
