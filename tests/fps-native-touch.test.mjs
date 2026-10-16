import test from "node:test";
import assert from "node:assert/strict";
import {FpsTouchBridge} from "../src/input/FpsTouchBridge.ts";
import {recoilDelta,recoilMagnitude,RECOIL_SCALE,RECOIL_UP_SHARE} from "../src/camera/recoilMath.ts";
const touch=(id,x,y)=>({identifier:id,clientX:x,clientY:y});
function send(target,name,points){
 const e=new Event(name,{bubbles:true,cancelable:true});
 Object.defineProperty(e,"changedTouches",{value:points});
 target.dispatchEvent(e);
 return e;
}
test("iPhone native FIRE and independent right-hand look drag coexist with left movement",()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 const screen=new EventTarget(),doc=new EventTarget(),fire=new EventTarget(),canvas=new EventTarget();
 screen.innerWidth=400;globalThis.window=screen;globalThis.document=doc;
 const calls=[],look=[];
 let started=0,stopped=0,nativeLook=false;
 const bridge=new FpsTouchBridge(fire,canvas,{
  canPlay:()=>true,
  fireStart:()=>started++,
  fireStop:()=>stopped++,
  fireLook:(dx,dy)=>calls.push([dx,dy]),
  freeLook:(dx,dy)=>look.push([dx,dy]),
  nativeLook:active=>{nativeLook=active}
 });
 try{
   send(fire,"touchstart",[touch(101,320,660)]);
   send(canvas,"touchstart",[touch(202,328,420)]);
   assert.equal(started,1);
   assert.equal(bridge.firingNative,true);
   assert.equal(nativeLook,true);
   send(screen,"touchmove",[touch(101,350,640),touch(202,300,400),touch(303,70,450)]);
   assert.deepEqual(calls,[[30,-20]]);
   assert.deepEqual(look,[[-28,-20]]);
   send(screen,"touchend",[touch(303,70,450)]); // moving thumb release
   assert.equal(stopped,0);assert.equal(bridge.firingNative,true);
   send(screen,"touchend",[touch(202,300,400)]);
   assert.equal(nativeLook,false);assert.equal(stopped,0);
   send(screen,"touchmove",[touch(101,370,630)]);
   assert.deepEqual(calls,[[30,-20],[20,-10]]);
   send(screen,"touchend",[touch(101,370,630)]);
   assert.equal(stopped,1);assert.equal(bridge.firingNative,false);
 }finally{
   bridge.dispose();
   if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
   if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
 }
});
test("native FIRE touch cancel stops shooting while unrelated look continues",()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 const screen=new EventTarget(),doc=new EventTarget(),fire=new EventTarget(),canvas=new EventTarget();
 screen.innerWidth=420;globalThis.window=screen;globalThis.document=doc;
 let stops=0;const bridge=new FpsTouchBridge(fire,canvas,{
  canPlay:()=>true,fireStart:()=>{},fireStop:()=>stops++,
  fireLook:()=>{},freeLook:()=>{},nativeLook:()=>{}
 });
 try{
  send(fire,"touchstart",[touch(11,350,690)]);
  send(canvas,"touchstart",[touch(12,330,480)]);
  send(screen,"touchcancel",[touch(11,350,690)]);
  assert.equal(stops,1);assert.equal(bridge.firingNative,false);
 }finally{
  bridge.dispose();
  if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
 }
});
test("recoil climbs upward at 80% of the old hip and ADS magnitudes",()=>{
  assert.equal(RECOIL_SCALE,.8);
  assert.equal(RECOIL_UP_SHARE,.7);
  const oldHip=Math.hypot(.027,.005),oldADS=Math.hypot(.006,.0015);
  assert.ok(Math.abs(recoilMagnitude(false)-oldHip*.8)<1e-12);
  assert.ok(Math.abs(recoilMagnitude(true)-oldADS*.8)<1e-12);
  const vectors=[0,.125,.25,.375,.5,.625,.75,.875].map(angle=>
    recoilDelta(false,()=>angle));
  for(const r of vectors){
    assert.ok(r.pitch>0,"pitch kick stays upward");
    const climb=recoilMagnitude(false)*RECOIL_UP_SHARE;
    assert.ok(r.pitch>climb*.8);
    assert.ok(Math.abs(r.yaw)<=recoilMagnitude(false)*(1-RECOIL_UP_SHARE)+1e-12);
  }
  assert.ok(vectors[0].yaw>0);
  assert.ok(vectors[4].yaw<0);
  assert.ok(recoilMagnitude(false)>recoilMagnitude(true)*3);
});
test("ADS and hip fire keep a smaller upward kick while yaw still varies",()=>{
  for(const ads of [false,true]){
    let minYaw=Infinity,maxYaw=-Infinity;
    for(let i=0;i<100;i++){
      const recoil=recoilDelta(ads,()=>i/100);
      assert.ok(Number.isFinite(recoil.yaw)&&Number.isFinite(recoil.pitch));
      assert.ok(recoil.pitch>0);
      minYaw=Math.min(minYaw,recoil.yaw);maxYaw=Math.max(maxYaw,recoil.yaw);
    }
    assert.ok(minYaw<0&&maxYaw>0);
  }
  assert.ok(recoilDelta(true,()=>0).pitch<recoilDelta(false,()=>0).pitch);
});
