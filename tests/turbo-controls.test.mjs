import test from "node:test";
import assert from "node:assert/strict";
import {PlayerController,WALK_SPEED,NEON777_SPEED_MULTIPLIER} from "../src/player/PlayerController.ts";
import {FpsTouchBridge} from "../src/input/FpsTouchBridge.ts";
import {withinMovementSpeed} from "../server/src/guards.js";
import {parseIncoming} from "../src/network/protocol.ts";

const run=(multiplier,colliders=[])=>{
  const player=new PlayerController(colliders);
  for(let i=0;i<12;i++)player.update(.016,{x:0,y:1},0,false,multiplier);
  return player.position.z;
};
test("NEON777 speed is exactly sixfold and base movement is unchanged",()=>{
  assert.equal(WALK_SPEED,4.2);
  assert.equal(NEON777_SPEED_MULTIPLIER,6);
  const normal=15-run(1),turbo=15-run(6);
  assert.ok(normal>0);
  assert.ok(Math.abs(turbo/normal-6)<.0001);
  assert.ok(turbo<4);
});
test("turbo substeps cannot tunnel through a thin local obstacle",()=>{
  const wall={x0:-2,x1:2,z0:12.3,z1:12.5};
  const player=new PlayerController([wall]);
  for(let i=0;i<55;i++)player.update(.04,{x:0,y:1},0,false,6);
  assert.ok(player.position.z>=12.5+player.radius-.001, "should stop before thin wall");
});
test("only server-allowed NEON777 movement is accepted",()=>{
  const from={x:0,y:1.65,z:15},target={x:0,y:1.65,z:12.6};
  assert.equal(withinMovementSpeed(from,target,110,false),false);
  assert.equal(withinMovementSpeed(from,target,110,true),true);
  assert.equal(withinMovementSpeed(from,{x:0,y:1.65,z:0},110,true),false);
});
test("network weapon_state contains a strict optional boost authority",()=>{
  assert.deepEqual(parseIncoming('{"type":"weapon_state","unlocked":true,"peaceful":false,"boosted":true}'),
    {type:"weapon_state",unlocked:true,peaceful:false,boosted:true});
  assert.equal(parseIncoming('{"type":"weapon_state","unlocked":true,"peaceful":false,"boosted":"true"}'),null);
});
test("native Safari ADS drag owns its finger independently of FIRE",()=>{
  const oldWindow=globalThis.window,oldDocument=globalThis.document;
  const screen=new EventTarget(),doc=new EventTarget(),fire=new EventTarget(),canvas=new EventTarget(),aim=new EventTarget();
  screen.innerWidth=400;globalThis.window=screen;globalThis.document=doc;
  const ev=(target,type,ids)=>{
    const e=new Event(type,{bubbles:true,cancelable:true});
    Object.defineProperty(e,"changedTouches",{value:ids.map(([identifier,clientX,clientY])=>({identifier,clientX,clientY}))});
    target.dispatchEvent(e);
  };
  let aiming=0,fireStarted=0,fireStopped=0;
  const movements=[],ended=[];
  const bridge=new FpsTouchBridge(fire,canvas,{
    canPlay:()=>true,fireStart:()=>fireStarted++,fireStop:()=>fireStopped++,
    fireLook:()=>{},freeLook:()=>{},nativeLook:()=>{},
    aimStart:()=>aiming++,aimLook:(dx,dy)=>movements.push([dx,dy]),
    aimStop:cancelled=>ended.push(cancelled)
  });
  try{
    bridge.bindAimButton(aim);
    ev(aim,"touchstart",[[111,320,500]]);
    ev(fire,"touchstart",[[222,350,690]]);
    assert.equal(bridge.aimingNative,true);
    assert.equal(bridge.firingNative,true);
    ev(screen,"touchmove",[[111,340,481],[222,370,680]]);
    assert.deepEqual(movements,[[20,-19]]);
    ev(screen,"touchend",[[222,370,680]]);
    assert.equal(fireStopped,1);
    assert.equal(bridge.aimingNative,true);
    ev(screen,"touchend",[[111,340,481]]);
    assert.equal(aiming,1);
    assert.deepEqual(ended,[false]);
  }finally{
    bridge.dispose();
    if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  }
});
