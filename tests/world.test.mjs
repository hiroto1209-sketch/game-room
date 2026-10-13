import test from "node:test";
import assert from "node:assert/strict";
import {
  OUTDOOR,DOOR,POND,chunkData,hashCell,groundHeightAt,insidePond,
  validWorldPosition,validWorldStep,worldBlocked,crossesClosedEastWall,shotObstructed,
  terrainVisualHeightAt,insideHouse,crossesHouseWall,walkableHeightAt,outdoorColliderBoxes
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
test("pond permits walking while far exterior boundaries stay blocked",()=>{
  assert.equal(insidePond(POND.x,POND.z),true);
  assert.equal(worldBlocked(POND.x,POND.z,.36),false);
  assert.equal(worldBlocked(12,-5,.36),false);
  assert.equal(validWorldPosition({x:105,y:1.65,z:0}),false);
  assert.equal(validWorldStep({x:49,y:1.65,z:-27},{x:57,y:1.65,z:-27}),true);
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
  // A player can cross the water boundary without jumping.
  for(let i=0;i<65;i++)controller.update(.016,{x:1,y:0},0);
  assert.ok(insidePond(controller.position.x,controller.position.z));
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
  // The old point (73,28) is now an intentional solid cave wall.
  // Exercise the nearby walkable hillside corridor, not the rock obstacle.
  const x=73,z=32,h=groundHeightAt(x,z);
  assert.ok(validWorldStep({x:x-.3,y:1.65+groundHeightAt(x-.3,z),z},
    {x,y:1.65+h,z}));
});
test("indoor wall blocks shots while real exit passage stays open",()=>{
  assert.equal(shotObstructed({x:8,y:1.65,z:-9},{x:12,y:1.65,z:-9}),true);
  assert.equal(shotObstructed({x:8,y:1.65,z:-5},{x:12,y:1.65,z:-5}),false);
});

test("rear and west side of PARTY HOUSE are backed by valid walkable terrain",()=>{
  for(const [x,z] of [[-15,0],[-18,-23],[-9,-20],[-5,31],[7,-24]]){
    assert.equal(validWorldPosition({x,y:1.65,z}),true,`missing ground at ${x},${z}`);
    assert.equal(worldBlocked(x,z,.36),false,`unexpected invisible obstacle at ${x},${z}`);
  }
  assert.equal(validWorldPosition({x:-26,y:1.65,z:0}),false);
  assert.equal(worldBlocked(-25,0,.36),true);
});
test("pond remains visible above depressed ground with a walkable shallow surface",()=>{
  assert.ok(terrainVisualHeightAt(POND.x,POND.z)<-.25,"pond bed must be below surface");
  assert.equal(insidePond(POND.x,POND.z),true);
  assert.equal(worldBlocked(POND.x,POND.z,.36),false,"water can be crossed");
  assert.equal(insidePond(POND.x+POND.rx+3,POND.z),false);
  assert.ok(terrainVisualHeightAt(POND.x+POND.rx+3,POND.z)>=0);
  assert.equal(groundHeightAt(POND.x,POND.z),0,"physics height stays level under pond");
});
test("extended armory has a real internal route, solid walls and ceiling",()=>{
  assert.equal(insideHouse(0,22),true);
  assert.equal(validWorldStep({x:0,y:1.65,z:17.6},{x:0,y:1.65,z:18.5}),true);
  assert.equal(validWorldStep({x:2,y:1.65,z:24},{x:2,y:1.65,z:25.4}),true);
  assert.equal(crossesHouseWall({x:3.5,z:17},{x:3.5,z:19}),true,
    "solid part of old corridor wall must not be breached");
  assert.equal(crossesHouseWall({x:0,z:17},{x:0,z:19}),false);
  assert.equal(validWorldStep({x:0,y:1.65,z:24},{x:0,y:1.65,z:27}),false);
  assert.equal(validWorldStep({x:0,y:1.65,z:-15},{x:0,y:1.65,z:-17}),false);
  assert.equal(crossesClosedEastWall({x:9.8,z:-21},{x:10.4,z:-21}),false,
    "east exit wall does not extend infinitely along z");
});

test("terrain geometry is a single persistent surface with matching world bounds",async()=>{
  const THREE=await import("three");
  const {TerrainSurface}=await import("../src/world/TerrainSurface.ts");
  const group=new THREE.Group();
  const land=new TerrainSurface(group);
  assert.equal(group.children.length,1);
  assert.equal(land.mesh.name,"SINGLE_CONTINUOUS_TERRAIN");
  const geometry=land.mesh.geometry;
  assert.equal(geometry.parameters.width,OUTDOOR.maxX-OUTDOOR.minX);
  assert.equal(geometry.parameters.height,OUTDOOR.maxZ-OUTDOOR.minZ);
  assert.ok(geometry.attributes.position.count>=12000);
  land.dispose();
  assert.equal(group.children.length,0);
});


test("forest removes all rectangular ruins and halves trees without moving rocks",()=>{
 const chunks=[];
 for(let x=0;x<6;x++)for(let z=0;z<6;z++)chunks.push(chunkData(x,z));
 assert.equal(chunks.flatMap(c=>c.blocks).length,0);
 assert.equal(chunks.flatMap(c=>c.trees).length,84);
 assert.equal(chunks.flatMap(c=>c.rocks).length,82);
 // No unknown tall box colliders are left in the forest.
 assert.equal(outdoorColliderBoxes().filter(c=>c.walkable).length,82);
});

test("rocks block feet, allow passage above their real top and support landing",()=>{
 const boxes=outdoorColliderBoxes(),rocks=boxes.filter(c=>c.walkable);
 let isolated=0;
 for(const rock of rocks){
  const x=(rock.x0+rock.x1)/2,z=(rock.z0+rock.z1)/2;
  assert.ok(rock.y1-rock.y0<.86,"every stone is within jump reach");
  // A neighbouring tree is still a real obstacle, even above a small stone.
  if(boxes.some(c=>c!==rock&&x>=c.x0-.4&&x<=c.x1+.4&&z>=c.z0-.4&&z<=c.z1+.4))continue;
  isolated++;
  assert.equal(worldBlocked(x,z,.01,rock.y0+1.65),true);
  assert.equal(worldBlocked(x,z,.01,rock.y1+1.65+.05),false);
  assert.equal(walkableHeightAt(x,z,rock.y1+.05),rock.y1);
  assert.equal(validWorldStep({x,y:rock.y1+1.65+.05,z},{x,y:rock.y1+1.65,z}),true);
  assert.equal(shotObstructed({x,y:rock.y1+.05,z},{x,y:rock.y1+.3,z}),false);
 }
 assert.ok(isolated>=60,"exercise the full set of unobstructed stones");
});

test("real player jumps onto a large stone and the server accepts the whole arc",()=>{
 const stones=outdoorColliderBoxes().filter(c=>c.walkable&&c.y1-c.y0>.65);
 let crossed=false;
 for(const rock of stones){
  const z=(rock.z0+rock.z1)/2;
  const controller=new PlayerController([],worldBlocked,(x,z)=>walkableHeightAt(x,z,controller.position.y-1.65+.35));
  const start=rock.x0-.65;
  if(worldBlocked(start,z,.36,groundHeightAt(start,z)+1.65))continue;
  controller.teleport(start,groundHeightAt(start,z)+1.65,z);controller.jump();
  let rejected=false;
  for(let i=0;i<80;i++){
   const from={...controller.position};
   controller.update(1/120,{x:1,y:0},0,true);
   if(!validWorldStep(from,controller.position))rejected=true;
  }
  if(controller.position.x>rock.x1+.36){assert.equal(rejected,false);crossed=true;break;}
 }
 assert.ok(crossed,"should actually clear a large rock at normal speed");
});
