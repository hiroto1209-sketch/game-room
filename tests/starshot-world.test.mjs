import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {StarshotRange,RANGE_ENTRY,RANGE_SHOTS,RANGE_SECONDS,RANGE_SPOTS} from "../src/world/StarshotRange.ts";
import {STOPS,routeInfo,mapCoord} from "../src/ui/WorldGuide.ts";
import {groundHeightAt} from "../shared/worldRules.js";

test("STARSHOT creates one actual outdoor scene graph with three shootable targets",()=>{
 const scene=new THREE.Scene(),range=new StarshotRange(scene,()=>0);
 try{
  assert.equal(scene.children.length,1);
  assert.equal(range.targets.length,3);
  assert.equal(RANGE_SHOTS,6);
  assert.equal(RANGE_SECONDS,30);
  assert.equal(range.running,false);
  assert.ok(range.group.children.some(obj=>obj.name==="STARSHOT_POST_0"));
 }finally{range.dispose()}
 assert.equal(scene.children.length,0);
});

test("STARSHOT enforces start, line of sight, timed round, and shot counts",()=>{
 let time=1_000;
 const scene=new THREE.Scene(),range=new StarshotRange(scene,()=>time);
 try{
  assert.equal(range.shoot({x:33,y:1.65,z:12},-Math.PI/2,0),"inactive");
  range.start();
  assert.equal(range.remaining,30);
  assert.equal(range.shoot({x:33,y:1.65,z:12},Math.PI/2,0),"miss");
  assert.equal(range.hits,0);
  for(let n=0;n<RANGE_SHOTS;n++){
   const spot=RANGE_SPOTS[range.activeTarget];
   const start={x:RANGE_ENTRY.x,y:1.65,z:spot.z};
   const endY=groundHeightAt(spot.x,spot.z)+1.92;
   const dx=spot.x-start.x;
   const pitch=Math.atan2(endY-start.y,dx);
   const hit=range.shoot(start,-Math.PI/2,pitch);
   assert.equal(hit,"hit","required non-obstructed target "+n+
     " at x="+spot.x+" z="+spot.z);
   assert.equal(range.hits,n+1);
   time+=700;
  }
  assert.equal(range.running,false);
  assert.equal(range.record,RANGE_SHOTS);
  assert.equal(range.shoot({x:33,y:1.65,z:12},-Math.PI/2,0),"inactive");
  range.start();time+=31_000;range.update(.016);
  assert.equal(range.running,false);
 }finally{range.dispose()}
});
test("STARSHOT misses cannot award points or modify shared PvP state",()=>{
 let time=10;
 const range=new StarshotRange(new THREE.Scene(),()=>time);
 try{
  range.start();
  assert.equal(range.shoot({x:0,y:1.65,z:0},-Math.PI/2,0),"miss");
  assert.equal(range.hits,0);
  assert.equal(range.record,0);
  assert.equal(range.attempts,1);
 }finally{range.dispose()}
});
test("World route guide gives distances and meaningful relative direction",()=>{
 assert.ok(STOPS.length>=5);
 const east=routeInfo({x:0,z:0},0,{id:"e",label:"E",x:10,z:0,symbol:"+"});
 assert.ok(east.distance===10);
 assert.ok(Math.abs(east.angleDeg-90)<1e-8);
 const forward=routeInfo({x:0,z:0},0,{id:"f",label:"F",x:0,z:-10,symbol:"+"});
 assert.ok(forward.angleDeg<.01||forward.angleDeg>359.99);
 assert.equal(forward.arrived,false);
 assert.equal(routeInfo({x:2,z:2},0,{id:"f",label:"F",x:2,z:2,symbol:"+"}).arrived,true);
 const p=mapCoord(0,0);
 assert.ok(p.x>0&&p.x<320&&p.y>0&&p.y<224);
});
