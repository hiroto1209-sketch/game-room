import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir } from "node:fs/promises";
const PORT=4173;
async function waitForServer(){
  for(let i=0;i<55;i++){
    try{const res=await fetch("http://127.0.0.1:"+PORT+"/game-room/");if(res.ok)return;}
    catch{ /* preview starting */ }
    await delay(400);
  }
  throw Error("Vite preview did not become ready");
}
test("mobile Game Room boots and retains start, two-finger controls and menu",async()=>{
  const process=spawn("npm",["run","preview","--","--host","127.0.0.1","--port",String(PORT),"--strictPort"],{stdio:"pipe"});
  let browser;
  try{
    await waitForServer();
    browser=await chromium.launch({headless:true,args:["--enable-unsafe-swiftshader","--enable-webgl"]});
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:"+PORT+"/game-room/",{waitUntil:"domcontentloaded"});
    await page.locator("#loading").waitFor({state:"detached",timeout:30000});
    await page.locator("#start-button").waitFor({state:"visible"});
    assert.equal(await page.locator("#start-button").innerText().then(t=>t.includes("スタート")),true);
    await mkdir("artifacts",{recursive:true});
    await page.screenshot({path:"artifacts/game-room-start.png"});
    await page.locator("#start-button").click();
    await page.locator("#hud").waitFor({state:"visible"});
    await page.evaluate(()=>{
      const scene=document.querySelector("#scene");
      const fire=(type,id,x,y)=>scene.dispatchEvent(new PointerEvent(type,{
        bubbles:true,pointerId:id,pointerType:"touch",clientX:x,clientY:y
      }));
      fire("pointerdown",101,90,520);
      fire("pointerdown",202,305,500);
      fire("pointermove",101,128,470);
      fire("pointermove",202,270,475);
    });
    assert.equal(await page.locator("#joystick").evaluate(el=>el.classList.contains("active")),true);
    await page.screenshot({path:"artifacts/game-room-playing.png"});
    await page.evaluate(()=>{
      const scene=document.querySelector("#scene");
      for(const id of [101,202])scene.dispatchEvent(new PointerEvent("pointerup",{pointerId:id,pointerType:"touch",bubbles:true}));
    });
    assert.equal(await page.locator("#joystick").evaluate(el=>el.classList.contains("active")),false);
    await page.locator("#menu-button").click();
    await page.locator("#menu-overlay").waitFor({state:"visible"});
    await page.locator("#resume-button").click();
    await page.locator("#menu-button").click();
    await page.locator("#return-title").click();
    await page.locator("#start-button").waitFor({state:"visible"});
    assert.deepEqual(errors,[]);
    await context.close();
  }finally{
    await browser?.close();
    process.kill("SIGTERM");
  }
});
