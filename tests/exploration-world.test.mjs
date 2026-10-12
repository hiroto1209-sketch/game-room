import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {HiddenExploration} from "../src/world/HiddenExploration.ts";
import {HIDDEN_WORLD,groundHeightAt,terrainVisualHeightAt,
  hiddenTrailDistance,nearExplorationFeature,worldBlocked,validWorldPosition,
  validWorldStep,chunkData,OUTDOOR,shotObstructed} from "../shared/worldRules.js";
import {EXPLORATION_STAMPS,earnStamp,safeDiscovered} from "../shared/explorationProgress.js";
import {withinMovementSpeed} from "../server/src/guards.js";

test("Echo Grotto is actually walkable from both directions at legal server height",()=>{
 const z=32;
 for(let x=63;x<=81;x+=.34){
  const pos={x,y:groundHeightAt(x,z)+1.65,z};
  assert.equal(worldBlocked(x,z,.36),false,`blocked center corridor x=${x.toFixed(2)}`);
  assert.equal(validWorldPosition(pos),true,`out-of-bounds cave x=${x}`);
 }
 for(let x=65;x<79;x+=.38){
  const from={x,y:groundHeightAt(x,z)+1.65,z};
  const to={x:x+.38,y:groundHeightAt(x+.38,z)+1.65,z};
  assert.equal(validWorldStep(from,to),true,`rejected forward cave step at x=${x}`);
  assert.equal(withinMovementSpeed(from,to,110),true);
  assert.equal(validWorldStep(to,from),true,`rejected backward cave step at x=${x}`);
 }
 assert.equal(worldBlocked(71,28.3,.36),true,"cave wall must have real collision");
 assert.equal(worldBlocked(71,35.6,.36),true,"opposite rock wall must be solid");
});
test("Secret stone path physically connects cave exit to Skylook via one shared ground",()=>{
 for(let i=0;i<=40;i++){
  const t=i/40,x=78+t*12,z=32+t*5;
  assert.ok(hiddenTrailDistance(x,z)<1e-5);
  assert.equal(worldBlocked(x,z,.36),false,`trail blocked at ${x},${z}`);
  const floor=groundHeightAt(x,z);
  assert.ok(floor>=0&&floor<=3.06);
  assert.equal(terrainVisualHeightAt(x,z),floor);
  if(i>0){
    const prev=(i-1)/40,px=78+prev*12,pz=32+prev*5;
    const from={x:px,y:groundHeightAt(px,pz)+1.65,z:pz};
    const to={x,y:floor+1.65,z};
    assert.equal(validWorldStep(from,to),true,`invalid trail movement i=${i}`);
    assert.equal(withinMovementSpeed(from,to,110),true,`invalid trail step speed i=${i}`);
  }
 }
 const center=groundHeightAt(HIDDEN_WORLD.vista.x,HIDDEN_WORLD.vista.z);
 assert.ok(center>groundHeightAt(90,12)+.35,"lookout must feel elevated");
});
test("Nature generation clears the trail, cave and lookout without changing old house",()=>{
 assert.equal(nearExplorationFeature(72,32),true);
 assert.equal(nearExplorationFeature(90,37),true);
 assert.equal(nearExplorationFeature(0,15),false);
 for(let cx=0;cx<OUTDOOR.columns;cx++)for(let cz=0;cz<OUTDOOR.rows;cz++){
  const chunk=chunkData(cx,cz);
  for(const tree of chunk.trees)assert.equal(nearExplorationFeature(tree.x,tree.z,2.2),false);
  for(const rock of chunk.rocks)assert.equal(nearExplorationFeature(rock.x,rock.z,.9),false);
 }
 assert.equal(groundHeightAt(0,15),0);
 assert.equal(groundHeightAt(10,-5),0);
 // Existing pond shape and arena remain real collision, not overlaid walkable water.
 assert.equal(worldBlocked(57,-27,.36),true);
 assert.equal(shotObstructed({x:70,y:1.65,z:27},{x:70,y:1.65,z:31}),true);
});
test("Exploration graphics use static, shared GPU-instance geometry and distance culling",()=>{
 const scene=new THREE.Scene();
 const experience=new HiddenExploration(scene);
 assert.equal(scene.children.length,1);
 const instances=[];
 experience.root.traverse(obj=>{if(obj instanceof THREE.InstancedMesh)instances.push(obj)});
 assert.ok(instances.length>=4&&instances.length<=9,"bounded instance draw-call budget");
 assert.equal(experience.root.getObjectByName("ECHO_GROTTO_MEMORY_CRYSTAL")!==undefined,true);
 assert.equal(experience.root.getObjectByName("SKYLOOK_PLATFORM_EDGE")!==undefined,true);
 experience.update({x:0,z:15});
 assert.equal(experience.root.visible,false,"do not draw cave from the house");
 experience.update({x:72,z:32});
 assert.equal(experience.root.visible,true);
 let dynamicLights=0;experience.root.traverse(x=>{if(x instanceof THREE.Light)dynamicLights++});
 assert.equal(dynamicLights,0,"no dynamic lamps or shaders added");
 experience.dispose();assert.equal(scene.children.length,0);
});
test("Three discovery stamps are bounded and never accepted from arbitrary input",()=>{
 assert.equal(EXPLORATION_STAMPS.length,3);
 let found=[];
 for(const stamp of EXPLORATION_STAMPS){
  const next=earnStamp(found,stamp.id);
  assert.equal(next.newlyFound,true);
  found=next.found;
 }
 assert.equal(found.length,3);
 assert.equal(earnStamp(found,"echo").newlyFound,false);
 assert.equal(earnStamp(found,"<script>").newlyFound,false);
 assert.deepEqual(safeDiscovered(["echo","echo","unknown","skylook"]),["echo","skylook"]);
 assert.deepEqual(safeDiscovered({}),[]);
});
