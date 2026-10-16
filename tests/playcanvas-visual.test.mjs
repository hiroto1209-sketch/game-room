import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';
const layouts=[['iphone-portrait',390,844],['iphone-landscape',844,390],['ipad-portrait',820,1180],['ipad-landscape',1180,820]];
for(const [index,[name,width,height]] of layouts.entries()){
const PORT=4192+index,ROOT='http://127.0.0.1:'+PORT+'/game-room/';
test('original FPS scene: '+name+' lazy loading, source meshes and walkable entrance',{timeout:180000},async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(PORT),'--strictPort'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<80;i++){try{if((await fetch(ROOT)).ok)break;}catch{}await wait(250);}
  browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
  await mkdir('artifacts/playcanvas',{recursive:true});
   const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});const page=await context.newPage(),errors=[],stageRequests=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/stage\.glb|playcanvasCollisionData/.test(r.url()))stageRequests.push(r.url());});
   await page.goto(ROOT+'?stageVisualTest=1');await page.locator('#loading').waitFor({state:'detached'});await page.locator('#start-button').click();
   await page.waitForTimeout(350);assert.deepEqual(stageRequests,[],'lobby must not fetch stage payloads');
   await page.evaluate(()=>__FPS_STAGE_QA__.pose(118,1.65,-5,-Math.PI/2,0));
   await page.waitForFunction(()=>__FPS_STAGE_QA__.status()==='ready',null,{timeout:30000});
   assert.equal(await page.evaluate(()=>__FPS_STAGE_QA__.materials()),16,'14 source material batches plus path and sign');
   await page.screenshot({path:'artifacts/playcanvas/'+name+'-entrance.png'});
   // Walk using the real input/player/collision chain through the cut door.
   await page.keyboard.down('w');await page.evaluate(()=>__FPS_STAGE_QA__.advance(1));await page.keyboard.up('w');
   const pose=await page.evaluate(()=>__FPS_STAGE_QA__.position());assert.ok(pose.x<126&&Math.abs(pose.z+5)<.1);
   await page.evaluate(()=>__FPS_STAGE_QA__.pose(128,1.65,15,0,0));await page.waitForTimeout(150);
   await page.screenshot({path:'artifacts/playcanvas/'+name+'-interior.png'});
   assert.deepEqual(errors,[]);await context.close();
 }finally{await browser?.close();server.kill();}
});
}
