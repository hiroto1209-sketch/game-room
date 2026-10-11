import test from "node:test";
import assert from "node:assert/strict";
import {FpsTouchBridge} from "../src/input/FpsTouchBridge.ts";
import {CameraController} from "../src/camera/CameraController.ts";
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
test("ADS has materially less camera recoil than hip fire, with pitch bounded",()=>{
 const cameraStub={};
 const hip=new CameraController(cameraStub),ads=new CameraController(cameraStub);
 hip.kickRecoil(false);ads.kickRecoil(true);
 assert.ok(hip.pitch>ads.pitch*3);
 assert.ok(Math.abs(hip.yaw)>Math.abs(ads.yaw));
 for(let i=0;i<1000;i++)hip.kickRecoil(false);
 assert.equal(hip.pitch,1.2);
});
