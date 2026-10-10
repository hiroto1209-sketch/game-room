import test from "node:test";
import assert from "node:assert/strict";
import {
  OUTDOOR,DOOR,POND,chunkData,hashCell,groundHeightAt,insidePond,
  validWorldPosition,validWorldStep,worldBlocked,crossesClosedEastWall,shotObstructed
} from "../shared/worldRules.js";
import {PlayerController} from "../src/player/PlayerController.ts";
import {withinMovementSpeed} from "../server/src/guards.js";

test("world chunks are deterministic and boundaries do not require asset downloads",()=>{
  const first=chunkData(3,2),again=chunkData(3,2),other=chunkData(4,2);
  assert.ok(first&&again&&other);
  assert.deepEqual(first,again);
  assert.notDeepEqual(first,other);
  assert.equal(hashCell(3,2),hashCell(3,2));
  assert.equal(chunkData(-1,0),null);
  assert.equal(chunkData(OUTDOOR.columns,0),null);
});
test("east door allows passage in both directions but solid wall stays blocked",()=>{
  const from={x:9.35,y:1.65,z:-5},to={x:10.7,y:1.65,z:-5};
  assert.equal(crossesClosedEastWall(from,to),false);
  assert.equal(validWorldStep(from,to),true);
  assert.equal(validWorldStep(to,from),true);
  const leftWall={x:9.35,y:1.65,z:-10},outside={x:10.7,y:1.65,z:-10};
  assert.equal(crossesClosedEastWall(leftWall,outside),true);
  assert.equal(validWorldStep(leftWall,outside),false);
  assert.ok(DOOR.minZ<-5&&DOOR.maxZ>-5);
});
test("pond and far exterior boundaries reject walking through water or off map",()=>{
  assert.equal(insidePond(POND.x,POND.z),true);
  assert.equal(worldBlocked(POND.x,POND.z,.36),true);
  assert.equal(worldBlocked(12,-5,.36),false);
  assert.equal(validWorldPosition({x:105,y:1.65,z:0}),false);
  assert.equal(validWorldStep({x:49,y:1.65,z:-27},{x:57,y:1.65,z:-27}),false);
  assert.ok(groundHeightAt(55,-10)>=0);
  assert.equal(groundHeightAt(55,-5),0);
});
test("original indoor position and corridor spawn remain valid",()=>{
  assert.equal(validWorldPosition({x:0,y:1.65,z:15}),true);
  assert.equal(validWorldPosition({x:7,y:1.65,z:-9}),true);
  assert.equal(validWorldPosition({x:65,y:1.65,z:12}),true);
  assert.equal(validWorldPosition({x:999,y:1.65,z:12}),false);
});
test("existing movement, jump, blocking and outdoor walking coexist",()=>{
  const controller=new PlayerController([],worldBlocked,groundHeightAt);
  controller.position.x=12;controller.position.z=-5;
  for(let i=0;i<35;i++)controller.update(.016,{x:1,y:0},0);
  assert.ok(controller.position.x>13);
  controller.jump();
  const x=controller.position.x;
  for(let i=0;i<20;i++)controller.update(.016,{x:1,y:0},0);
  assert.ok(controller.position.y>1.65);
  assert.ok(controller.position.x>x);
  controller.position.x=POND.x-POND.rx-1.4;
  controller.position.z=POND.z;
  // A player walking toward the edge stops outside the pond.
  for(let i=0;i<65;i++)controller.update(.016,{x:1,y:0},0);
  assert.ok(!insidePond(controller.position.x,controller.position.z,controller.radius-.01));
});
test("server allows small outdoor steps but denies wall crossing and teleports",()=>{
  assert.equal(withinMovementSpeed({x:9.5,y:1.65,z:-5},{x:10.7,y:1.65,z:-5},180),true);
  assert.equal(withinMovementSpeed({x:9.5,y:1.65,z:-9},{x:10.7,y:1.65,z:-9},180),false);
  assert.equal(withinMovementSpeed({x:12,y:1.65,z:-5},{x:99,y:1.65,z:30},500),false);
});

test("static coastal terrain varies but keeps paths and existing indoor flat",()=>{
  assert.equal(groundHeightAt(0,0),0);
  assert.equal(groundHeightAt(14,-5),0);
  assert.equal(groundHeightAt(52,-5),0);
  const hills=[groundHeightAt(58,19),groundHeightAt(73,28),groundHeightAt(91,18)];
  assert.ok(hills.some(v=>v>.2));
  assert.notEqual(hills[0],hills[1]);
  const x=73,z=28,h=groundHeightAt(x,z);
  assert.ok(validWorldStep({x:x-.3,y:1.65+groundHeightAt(x-.3,z),z},
    {x,y:1.65+h,z}));
});
test("indoor wall blocks shots while real exit passage stays open",()=>{
  assert.equal(shotObstructed({x:8,y:1.65,z:-9},{x:12,y:1.65,z:-9}),true);
  assert.equal(shotObstructed({x:8,y:1.65,z:-5},{x:12,y:1.65,z:-5}),false);
});
