import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {DAMAGE, MAX_HP} from "../shared/combatRules.js";
import {applyFoeDamage, findFoeHit, foeEye, freshFoes, publicFoes, reviveFoes, FOE_IDS, validFoeList} from "../shared/foeRules.js";
import {parseIncoming} from "../src/network/protocol.ts";
import {SharedFoes} from "../src/world/SharedFoes.ts";
import {StudioMirror} from "../src/world/StudioMirror.ts";
import {chunkData} from "../shared/worldRules.js";

test("shared foes live on the FPS floor and stay shootable",()=>{
  const foes=freshFoes();
  assert.deepEqual(FOE_IDS,["fpsfoe01","fpsfoe02","fpsfoe03"]);
  assert.equal(validFoeList(foes),true);
  const origin={x:124,y:1.65,z:2};
  const hit=findFoeHit(origin,0,0,foes);
  assert.equal(hit?.id,"fpsfoe03");
  assert.ok(hit.distance<8);
  const eye=foeEye("fpsfoe03");
  assert.equal(eye.x,124);
  let state=foes;
  for(let n=0;n<MAX_HP/DAMAGE;n++)state=applyFoeDamage(state,"fpsfoe03",1000).foes;
  const down=state.find(f=>f.id==="fpsfoe03");
  assert.equal(down.hp,0);
  assert.equal(reviveFoes(state,down.downUntil-1).find(f=>f.id==="fpsfoe03").hp,0);
  assert.equal(reviveFoes(state,down.downUntil).find(f=>f.id==="fpsfoe03").hp,MAX_HP);
  const parsed=parseIncoming(JSON.stringify({type:"foe_state",foes:publicFoes(freshFoes())}));
  assert.equal(parsed?.type,"foe_state");
  if(parsed?.type==="foe_state")assert.equal(parsed.foes.length,3);
  assert.equal(parseIncoming(JSON.stringify({type:"foe_state",foes:[{id:"fpsfoe01",hp:101,downUntil:0}]})),null);
});

test("enemy faces have eyes and the lounge mirror is a small render target",()=>{
  const scene=new THREE.Scene();
  const foes=new SharedFoes(scene);
  let eyes=0;
  foes.group.traverse(obj=>{
    if(obj instanceof THREE.Mesh&&obj.geometry instanceof THREE.SphereGeometry&&obj.geometry.parameters.radius<.05)eyes++;
  });
  assert.equal(eyes,6);
  const mirror=new StudioMirror(scene,1);
  assert.equal(mirror.mesh.name,"STUDIO_MIRROR");
  assert.ok(mirror.mesh.position.z<-15.5);
  assert.ok(Math.abs(mirror.mesh.position.x)>4);
});

test("retired plaza footprint still keeps vegetation off that rectangle",()=>{
  const chunks=[];
  for(let x=0;x<6;x++)for(let z=0;z<6;z++)chunks.push(chunkData(x,z));
  assert.equal(chunks.flatMap(c=>c.trees).length,84);
  const inside=(x,z)=>x>=14&&x<=23&&z>=34&&z<=46;
  for(const chunk of chunks){
    for(const tree of chunk.trees)assert.equal(inside(tree.x,tree.z),false);
    for(const rock of chunk.rocks)assert.equal(inside(rock.x,rock.z),false);
    for(const tuft of chunk.grass)assert.equal(inside(tuft.x,tuft.z),false);
  }
});
