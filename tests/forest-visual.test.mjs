import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
const PORT=4185,ROOT=`http://127.0.0.1:${PORT}/game-room/`;
for(const config of [{name:'iphone-portrait',width:390,height:844},{name:'iphone-landscape',width:844,height:390}]){
 test(`forest cleanup and supplied POKO welcome: ${config.name}`,{timeout:150000},async()=>{
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(PORT),'--strictPort'],{stdio:'ignore'});
  let browser;
  try{
   for(let i=0;i<80;i++){try{if((await fetch(ROOT)).ok)break;}catch{}await delay(250);}
   browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--enable-webgl','--use-gl=angle']});
   const page=await browser.newPage({viewport:{width:config.width,height:config.height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
   const errors=[],models=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(r.url().endsWith('/poko/poko.glb'))models.push(r.url());});
   await page.goto(ROOT+'?forestVisualTest=1');await page.locator('#loading').waitFor({state:'detached',timeout:40000});
   assert.equal(models.length,0,'do not download welcome model while inside');
   assert.equal(await page.locator('#exploration-journal').count(),0);
   await page.locator('#start-button').click();
   await page.evaluate(()=>window.__FOREST_QA__.pose(8,-5));
   await page.waitForFunction(()=>window.__FOREST_QA__.status()==='hidden',null,{timeout:30000});
   assert.equal(models.length,1);
   const hidden=await page.evaluate(()=>({clips:window.__FOREST_QA__.clips(),y:window.__FOREST_QA__.characterY(),targets:window.__FOREST_QA__.targetLabels()}));
   assert.deepEqual(hidden.clips.sort(),['Hide','Idle','PopUp']);assert.ok(hidden.y< -2);
   assert.ok(!hidden.targets.some(label=>/発見|記憶クリスタル|星印/.test(label)));
   await page.evaluate(()=>window.__FOREST_QA__.pose(11.3,-5));
   await page.waitForFunction(()=>window.__FOREST_QA__.status()==='emerging',null,{timeout:15000});
   await page.evaluate(()=>window.__FOREST_QA__.advance(1));
   await page.waitForFunction(()=>window.__FOREST_QA__.status()==='idle');
   assert.equal(await page.evaluate(()=>window.__FOREST_QA__.appearances()),1);
   const bounds=await page.evaluate(()=>window.__FOREST_QA__.screenBounds());
   assert.ok(bounds.minX> -1&&bounds.maxX<1&&bounds.minY> -1&&bounds.maxY<1,'show the whole supplied character after exiting, including phone portrait');
   await mkdir('artifacts/forest-visual',{recursive:true});
   await page.screenshot({path:`artifacts/forest-visual/${config.name}-poko.png`});
   await page.evaluate(()=>window.__FOREST_QA__.advance(4));
   assert.equal(await page.evaluate(()=>window.__FOREST_QA__.appearances()),1,'do not replay every frame');
   await page.evaluate(()=>window.__FOREST_QA__.pose(8,-5));
   await page.waitForFunction(()=>window.__FOREST_QA__.status()==='hiding');
   await page.evaluate(()=>window.__FOREST_QA__.advance(1));
   await page.waitForFunction(()=>window.__FOREST_QA__.status()==='hidden');
   await page.locator('#menu-button').click();await page.locator('#reduced-motion').check();await page.locator('#resume-button').click();
   await page.evaluate(()=>window.__FOREST_QA__.pose(11.3,-5));
   await page.waitForFunction(()=>window.__FOREST_QA__.status()==='idle');
   assert.equal(await page.evaluate(()=>window.__FOREST_QA__.appearances()),2);
   await page.evaluate(()=>window.__FOREST_QA__.pose(57,-27));
   await page.waitForTimeout(300);
   assert.ok(Math.abs((await page.evaluate(()=>window.__FOREST_QA__.position())).y-1.65)<.01,'pond remains traversable on shared ground');
   assert.deepEqual(errors,[]);
  }finally{await browser?.close();server.kill('SIGTERM');}
 });
}
