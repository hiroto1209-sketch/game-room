import test from 'node:test';import assert from 'node:assert/strict';
import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {mkdir} from 'node:fs/promises';import {setTimeout as delay} from 'node:timers/promises';
const PORT=4187,ROOT=`http://127.0.0.1:${PORT}/game-room/`;
for(const size of [{name:'portrait',width:390,height:844},{name:'landscape',width:844,height:390}])test(`resident models, collision, dialogue and roaming in phone ${size.name}`,{timeout:150000},async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(PORT),'--strictPort'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<80;i++){try{if((await fetch(ROOT)).ok)break;}catch{}await delay(250);}
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--enable-webgl','--use-gl=angle']});
  const page=await browser.newPage({viewport:{width:size.width,height:size.height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('RESIDENT PAGE ERROR',e.message);});
  await page.goto(ROOT+'?residentVisualTest=1');await page.locator('#loading').waitFor({state:'detached',timeout:40000});await page.locator('#start-button').click();
  await page.evaluate(async()=>{await window.__RESIDENT_QA__.load();window.__RESIDENT_QA__.time(1000,true);window.__RESIDENT_QA__.pose(14,15,0);});
  const initial=await page.evaluate(()=>window.__RESIDENT_QA__.data());assert.equal(initial.status,'ready');
  await mkdir('artifacts/residents-visual',{recursive:true});
  await page.screenshot({path:`artifacts/residents-visual/${size.name}-tokotoko.png`});
  await page.evaluate(()=>window.__RESIDENT_QA__.walk(1,{x:0,y:1},0));
  const blocked=await page.evaluate(()=>window.__RESIDENT_QA__.data());assert.ok(blocked.player.z>12.9,'do not walk through resident');
  await page.waitForFunction(()=>document.getElementById('interaction-text').textContent.includes('TOKOTOKO'));
  assert.equal(await page.locator('#interact-button').textContent(),'話す');
  await page.locator('#interact-button').click();await page.locator('#resident-dialogue').waitFor({state:'visible'});
  assert.ok((await page.locator('#resident-dialogue-title').textContent()).includes('TOKOTOKO'));
  const talking=await page.evaluate(()=>window.__RESIDENT_QA__.data());assert.equal(talking.paused,true);assert.equal(talking.inputEnabled,false);assert.ok(talking.camera.pitch< -.3,'frame the resident face during close conversation');
  const eyes=await page.evaluate(()=>window.__RESIDENT_QA__.eyePositions());assert.ok(eyes.every(p=>p&&Math.abs(p[0])<1&&Math.abs(p[1])<.2),'both eyes should remain visible above the dialogue card, including at body-collision distance');
  await page.evaluate(()=>window.__RESIDENT_QA__.time(5000));const held=await page.evaluate(()=>window.__RESIDENT_QA__.data());assert.equal(held.moving,false);assert.deepEqual(held.position,talking.position);
  await page.screenshot({path:`artifacts/residents-visual/${size.name}-conversation.png`});
  const rect=await page.locator('.resident-dialogue-card').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=size.width&&rect.y>=0&&rect.y+rect.height<=size.height);
  await page.locator('#resident-dialogue-next').click();assert.ok((await page.locator('#resident-dialogue-text').textContent()).includes('裏庭'));
  await page.locator('#resident-dialogue-close').click();const resumed=await page.evaluate(()=>window.__RESIDENT_QA__.data());assert.equal(resumed.inputEnabled,true);assert.equal(resumed.camera.pitch,0);
  await page.evaluate(()=>window.__RESIDENT_QA__.time(15000,true));const walking=await page.evaluate(()=>window.__RESIDENT_QA__.data());assert.equal(walking.moving,true);assert.ok(Math.hypot(walking.position[0]-14,walking.position[2]-12)>4);
  await page.evaluate(()=>{window.__RESIDENT_QA__.time(1000,true);window.__RESIDENT_QA__.pose(8,-5,-Math.PI/2);});
  await page.waitForFunction(()=>window.__RESIDENT_QA__.data().poko==='hidden');
  await page.evaluate(()=>window.__RESIDENT_QA__.pose(11.3,-5,-Math.PI/2));await page.waitForFunction(()=>window.__RESIDENT_QA__.data().poko==='idle',null,{timeout:15000});
  await page.evaluate(()=>{window.__RESIDENT_QA__.pose(16.4,-6.1,-Math.PI/2);window.__RESIDENT_QA__.walk(1,{x:0,y:1},-Math.PI/2);});
  assert.ok((await page.evaluate(()=>window.__RESIDENT_QA__.data())).player.x<17.1,'POKO must have a real body collider');
  await page.waitForFunction(()=>document.getElementById('interaction-text').textContent.includes('POKO'));
  await page.locator('#interact-button').click();await page.locator('#resident-dialogue').waitFor({state:'visible'});assert.ok((await page.locator('#resident-dialogue-title').textContent()).includes('POKO'));
  await page.keyboard.press('Escape');await page.locator('#resident-dialogue').waitFor({state:'hidden'});assert.equal((await page.evaluate(()=>window.__RESIDENT_QA__.data())).paused,false);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.kill('SIGTERM');}
});
