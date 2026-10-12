import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {spawn} from "node:child_process";
import {setTimeout as delay} from "node:timers/promises";
const port=4187,root="http://127.0.0.1:"+port+"/game-room/";
async function ready(){
  for(let i=0;i<80;i++){try{const r=await fetch(root);if(r.ok)return}catch{}await delay(350)}
  throw Error("HUD Vite preview failed to start");
}
test("in-game HUD editor saves independent iPhone/iPad profiles and prevents gameplay touches",async()=>{
  const srv=spawn(process.execPath,["./node_modules/vite/bin/vite.js","preview",
    "--host","127.0.0.1","--port",String(port),"--strictPort"],{stdio:"ignore"});
  let browser;
  try{
    await ready();
    browser=await chromium.launch({headless:true,args:["--enable-unsafe-swiftshader",
      "--enable-webgl","--use-gl=angle"]});
    const ctx=await browser.newContext({viewport:{width:390,height:844},
      isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const page=await ctx.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(root+"?fpsVisualTest=1",{waitUntil:"domcontentloaded"});
    await page.locator("#loading").waitFor({state:"detached",timeout:35000});
    await page.locator("#start-button").click();
    await page.locator("#shoot-button").waitFor({state:"visible",timeout:10000});
    await page.locator("#menu-button").click();
    await page.locator("#open-hud-editor").click();
    await page.locator("#hud-editor-stage").waitFor({state:"visible"});
    assert.equal(await page.locator("#hud-editor-ghosts").count(),0);
    assert.equal(await page.locator(".hud-editor-ghost").count(),5);
    assert.equal(await page.locator("#menu-overlay").isVisible(),false);
    // Preview touch operations must not send game actions.
    const dragged=page.locator('[data-hud-id="fire"]');
    await dragged.click();
    await page.locator("#hud-editor-size").fill("73");
    await page.locator("#hud-editor-device").selectOption("padLandscape");
    await page.locator("#hud-editor-opacity").fill("76");
    await page.locator("#hud-editor-save").click();
    assert.equal(await page.locator("#hud-editor-overlay").isVisible(),false);
    assert.equal(await page.locator("#menu-overlay").isVisible(),true);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("game-room-hud-layout-v1")));
    assert.equal(saved.version,1);
    assert.equal(saved.profiles.phonePortrait.fire.sizePx,73);
    assert.equal(saved.profiles.padLandscape.fire.opacity,.76);
    assert.equal(saved.profiles.phoneLandscape.fire.sizePx,67);
    await page.locator("#resume-button").click();
    await page.reload({waitUntil:"domcontentloaded"});
    await page.locator("#loading").waitFor({state:"detached",timeout:35000});
    assert.equal(await page.evaluate(()=>document.querySelector("#shoot-button").style.width),"73px");
    await page.setViewportSize({width:1180,height:820});
    await page.waitForTimeout(300);
    // Touch-capability remains set in mobile context; tablet layout picks saved iPad preset.
    assert.equal(await page.evaluate(()=>document.querySelector("#shoot-button").style.width),"87px");
    assert.deepEqual(errors,[]);
    await ctx.close();
  }finally{await browser?.close();srv.kill("SIGTERM")}
});
