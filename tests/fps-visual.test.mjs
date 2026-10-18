import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";

const PORT=4175,ROOT="http://127.0.0.1:"+PORT+"/game-room/";
async function waitForServer(){
  for(let i=0;i<80;i++){
    try{const r=await fetch(ROOT);if(r.ok)return}catch{}
    await delay(350);
  }
  throw Error("Vite preview failed to start");
}

async function targetPixels(page,screenshot){
  // Pixel-level oracle: bright magenta 10-meter target must remain visible
  // in the center 65px radius even when the solid viewmodel overlays the world.
  // No baseline screenshot update can silently approve a blocked target.
  const base64=screenshot.toString("base64");
  return await page.evaluate(async encoded=>{
    const data=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const image=await createImageBitmap(new Blob([data],{type:"image/png"}));
    const canvas=document.createElement("canvas");
    canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(image,0,0);
    const cx=Math.floor(image.width/2),cy=Math.floor(image.height/2);
    const radius=Math.min(75,Math.floor(image.height*.08));
    const pixel=ctx.getImageData(cx-radius,cy-radius,radius*2,radius*2).data;
    let marked=0,total=0;
    for(let y=0;y<radius*2;y+=2){
      for(let x=0;x<radius*2;x+=2){
        // The center crosshair can cover a small part of the target.
        if(Math.abs(x-radius)<9&&Math.abs(y-radius)<9)continue;
        const i=(y*radius*2+x)*4;
        if(pixel[i]>150&&pixel[i+1]<95&&pixel[i+2]>95&&pixel[i+2]>pixel[i+1]*1.3)marked++;
        total++;
      }
    }
    return {fraction:marked/Math.max(1,total),marked,total};
  },base64);
}

test("ADS view remains unobstructed on portrait, landscape and desktop",async()=>{
  const server=spawn(process.execPath,["./node_modules/vite/bin/vite.js","preview",
    "--host","127.0.0.1","--port",String(PORT),"--strictPort"],{stdio:"ignore"});
  let browser;
  try{
    await waitForServer();
    browser=await chromium.launch({headless:true,args:[
      "--enable-unsafe-swiftshader","--enable-webgl","--use-gl=angle","--use-angle=swiftshader"
    ]});
    await mkdir("artifacts/fps-visual",{recursive:true});
    for(const viewport of [
      {name:"iphone-portrait",width:390,height:844},
      {name:"iphone-landscape",width:844,height:390},
      {name:"desktop",width:1280,height:720}
    ]){
      const context=await browser.newContext({
        viewport:{width:viewport.width,height:viewport.height},
        deviceScaleFactor:1,isMobile:viewport.name.startsWith("iphone"),hasTouch:viewport.name.startsWith("iphone")
      });
      const page=await context.newPage();
      const errors=[];
      page.on("pageerror",e=>errors.push(e.message));
      await page.addInitScript(()=>{sessionStorage.setItem("game-room-weapon-easteregg","1")});
      await page.goto(ROOT+"?fpsVisualTest=1",{waitUntil:"domcontentloaded"});
      await page.locator("#loading").waitFor({state:"detached",timeout:35000});
      await page.locator("#start-button").click();
      await page.locator("#shoot-button").waitFor({state:"visible",timeout:10000});
      await page.waitForTimeout(450);

      // Regression for overlapping mobile HUD text. This intentionally
      // simulates the worst case when zone+range+Othello+HP+compass all appear
      // at once, so a new future HUD cannot accidentally stack over them.
      const layout=await page.evaluate(()=>{
        const ids=["combat-hud","world-guide","zone-indicator","othello-panel"];
        const original=ids.map(id=>{
          const el=document.getElementById(id);
          return {el,hidden:el.classList.contains("hidden"),shown:el.classList.contains("show")};
        });
        try{
          for(const {el} of original){
            el.classList.remove("hidden");
            if(el.id==="zone-indicator")el.classList.add("show");
          }
          const rectangles=ids.map(id=>{
            const rect=document.getElementById(id).getBoundingClientRect();
            return {id,x:rect.left,y:rect.top,w:rect.width,h:rect.height};
          });
          const logo=document.querySelector("#top-bar .world-label").getBoundingClientRect();
          const emote=document.querySelector("#emote-button").getBoundingClientRect();
          const hint=getComputedStyle(document.querySelector("#tips")).display;
          return {rectangles,logo:{y:logo.bottom},emote:{
            x:emote.left,y:emote.top,w:emote.width,h:emote.height
          },hint};
        }finally{
          for(const {el,hidden,shown} of original){
            el.classList.toggle("hidden",hidden);
            if(el.id==="zone-indicator")el.classList.toggle("show",shown);
          }
        }
      });
      assert.equal(layout.hint,"none",
        viewport.name+" contextual hint overlaps the top HUD");
      const boxes=layout.rectangles;
      for(let i=0;i<boxes.length;i++){
        const a=boxes[i];
        assert.ok(a.h>0&&a.w>0,viewport.name+" "+a.id+" has zero size");
        assert.ok(a.x>=0&&a.y>=layout.logo.y+4,
          viewport.name+" "+a.id+" overlaps GAME ROOM header "+JSON.stringify(a));
        assert.ok(a.x+a.w<=viewport.width+1,
          viewport.name+" "+a.id+" extends past viewport");
        for(let j=i+1;j<boxes.length;j++){
          const b=boxes[j];
          const intersection=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*
            Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
          assert.ok(intersection<1,
            viewport.name+" "+a.id+" overlaps "+b.id+" by "+intersection+"px²");
        }
      }
      await page.screenshot({
        path:"artifacts/fps-visual/"+viewport.name+"-hud-layout.png"
      });

      const hip=await page.screenshot({
        path:"artifacts/fps-visual/"+viewport.name+"-hip.png"
      });
      const initial=await targetPixels(page,hip);
      assert.ok(initial.fraction>.12,
        viewport.name+" hip fire blocks center target "+JSON.stringify(initial));

      await page.locator("#aim-button").dispatchEvent("pointerdown",{
        pointerId:71,pointerType:"touch",clientX:viewport.width*.66,clientY:viewport.height*.74,
        bubbles:true,cancelable:true
      });
      await page.waitForTimeout(600);
      const before=await page.evaluate(()=>window.__GAME_ROOM_FPS_QA__&&({
        aiming:window.__GAME_ROOM_FPS_QA__.aiming(),
        clear:window.__GAME_ROOM_FPS_QA__.centerClear(),
        sightError:window.__GAME_ROOM_FPS_QA__.sightError(),
        drawCalls:window.__GAME_ROOM_FPS_QA__.fpsDrawCalls()
      }));
      assert.equal(before?.aiming,true,viewport.name+" ADS did not engage");
      assert.equal(before?.clear,true,viewport.name+" solid gun blocks central ray");
      assert.ok(before.sightError<.0001,viewport.name+" sight diverges from shot ray");
      const ads=await page.screenshot({
        path:"artifacts/fps-visual/"+viewport.name+"-ads.png"
      });
      const measured=await targetPixels(page,ads);
      assert.ok(measured.fraction>.12,
        viewport.name+" ADS obscures the target "+JSON.stringify(measured));

      // Fire while sighting: target must stay visible and the debug scene must
      // not gain a new large solid gun silhouette during recoil.
      await page.locator("#shoot-button").dispatchEvent("pointerdown",{
        pointerId:72,pointerType:"touch",clientX:viewport.width*.65,clientY:viewport.height*.82,
        bubbles:true,cancelable:true
      });
      await page.waitForTimeout(200);
      const firing=await page.screenshot({
        path:"artifacts/fps-visual/"+viewport.name+"-ads-firing.png"
      });
      assert.ok((await targetPixels(page,firing)).fraction>.1,
        viewport.name+" recoil/flash hides the central target");
      await page.locator("#shoot-button").dispatchEvent("pointerup",{
        pointerId:72,pointerType:"touch",bubbles:true
      });
      // The social studio is mobile first: the avatar preview remains
      // readable, selectable and non-blocking across all viewport shapes.
      await page.locator("#aim-button").dispatchEvent("pointerup",{
        pointerId:71,pointerType:"touch",bubbles:true
      });
      await page.locator("#menu-button").dispatchEvent("click");
      await page.locator("#open-avatar-studio").dispatchEvent("click");
      await page.locator("#avatar-overlay").waitFor({state:"visible",timeout:8000});
      await page.locator("#avatar-color").selectOption("mint");
      await page.locator("#avatar-hat").selectOption("crown");
      assert.equal(await page.locator("#avatar-preview-body").evaluate(el=>
        getComputedStyle(el).backgroundColor),"rgb(120, 229, 192)");
      const modalBounds=await page.locator(".avatar-studio").boundingBox();
      assert.ok(modalBounds&&modalBounds.y>=0&&
        modalBounds.y+modalBounds.height<=viewport.height+1,
        viewport.name+" avatar modal must fit into visible screen");
      // One representative portrait screenshot is enough; DOM+layout are
      // checked on landscape and desktop without extra expensive screenshots.
      if(viewport.name==="iphone-portrait"){
        await page.locator(".avatar-studio").screenshot({
          path:"artifacts/fps-visual/avatar-studio-portrait.png",
          timeout:12000
        });
      }
      await page.locator("#avatar-apply").dispatchEvent("click");
      await page.locator("#avatar-overlay").waitFor({state:"hidden"});
      const savedAvatar=await page.evaluate(()=>JSON.parse(
        localStorage.getItem("game-room-avatar-v1")));
      assert.deepEqual(savedAvatar,{color:"mint",hat:"crown"});
      await page.locator("#emote-button").dispatchEvent("click");
      assert.equal(await page.locator("#emote-picker [data-emote]").count(),3);
      await page.locator("#emote-picker [data-emote='wave']").dispatchEvent("click");
      assert.deepEqual(errors,[],viewport.name+" page errors: "+errors.join("; "));
      await context.close();
    }
  }finally{
    await browser?.close();
    server.kill("SIGTERM");
  }
},{timeout:360000});
