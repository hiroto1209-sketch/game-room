import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";

const PORT=4178,ROOT="http://127.0.0.1:"+PORT+"/game-room/";
async function waitForPreview(){
  for(let i=0;i<75;i++){
    try{const response=await fetch(ROOT);if(response.ok)return}catch{}
    await delay(350);
  }
  throw Error("Vite exploration preview did not start");
}
test("exploration world renders cave, trail and lookout on phone + desktop",async()=>{
  const server=spawn(process.execPath,["./node_modules/vite/bin/vite.js","preview",
    "--host","127.0.0.1","--port",String(PORT),"--strictPort"],{stdio:"ignore"});
  let browser;
  try{
    await waitForPreview();
    browser=await chromium.launch({headless:true,args:[
      "--enable-unsafe-swiftshader","--enable-webgl","--use-gl=angle"
    ]});
    await mkdir("artifacts/exploration-visual",{recursive:true});
    const setups=[
      {name:"iphone-portrait-grotto",width:390,height:844,area:"grotto"},
      {name:"iphone-landscape-grotto",width:844,height:390,area:"grotto"},
      {name:"iphone-landscape-trail",width:844,height:390,area:"trail"},
      {name:"iphone-portrait-vista",width:390,height:844,area:"vista"},
      {name:"desktop-vista",width:1280,height:720,area:"vista"}
    ];
    for(const config of setups){
      const context=await browser.newContext({
        viewport:{width:config.width,height:config.height},
        isMobile:config.name.startsWith("iphone"),hasTouch:config.name.startsWith("iphone"),
        deviceScaleFactor:1
      });
      const page=await context.newPage();
      const errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      await page.goto(ROOT+"?exploreVisualTest="+config.area,{waitUntil:"domcontentloaded"});
      await page.locator("#loading").waitFor({state:"detached",timeout:35000});
      await page.locator("#start-button").click();
      await page.waitForTimeout(700);
      const data=await page.evaluate(()=>{
        const debug=window.__EXPLORATION_QA__;
        if(!debug)return null;
        return {
          scene:debug.scene,
          terrain:debug.terrainCount(),
          visible:debug.hiddenVisible(),
          instances:debug.instancedGroups(),
          drawCalls:debug.drawCalls(),
          ground:debug.playerGround(),expected:debug.expectedGround()
        };
      });
      assert.ok(data,"exploration debug fixture not initialized");
      assert.equal(data.scene,config.area);
      assert.equal(data.terrain,1,"must render exactly one continuous terrain sheet");
      assert.equal(data.visible,true,"nearby cave/lookout should be visible");
      assert.ok(data.instances>=4&&data.instances<=9,
        "mobile scenery needs a bounded number of instanced draw groups");
      assert.ok(data.drawCalls>0,"WebGL renderer did not draw the scene");
      assert.ok(Math.abs(data.ground-data.expected)<.000001,
        "visual QA player must stand on the Worker-approved ground");
      await page.screenshot({
        path:"artifacts/exploration-visual/"+config.name+".png"
      });
      assert.deepEqual(errors,[],config.name+" JavaScript rendering errors");
      await context.close();
    }
  }finally{
    await browser?.close();
    server.kill("SIGTERM");
  }
},{timeout:190000});
