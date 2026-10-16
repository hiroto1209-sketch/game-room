import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {DAMAGE, MAX_HP} from "../shared/combatRules.js";
import {
  applyFoeDamage, findFoeHit, fireTargetKind, foeEye, freshCoop, inCoopPlaza, publicCoop, reviveFoes, validCoopState
} from "../shared/coopRules.js";
import {chunkData, groundHeightAt, worldBlocked} from "../shared/worldRules.js";
import {decodeMessage} from "../server/src/guards.js";
import {parseIncoming, validateOutgoing} from "../src/network/protocol.ts";
import {CoopPlaza} from "../src/world/CoopPlaza.ts";

test("co-op shots hit shared foes and leave players alone",()=>{
  assert.equal(fireTargetKind(false),"players");
  assert.equal(fireTargetKind(true),"foes");
  const eye=foeEye("plazafoe2");
  assert.ok(eye);
  const origin={x:eye.x,y:1.65,z:eye.z-6};
  const hit=findFoeHit(origin,Math.PI,0,freshCoop().foes);
  assert.equal(hit?.id,"plazafoe2");
  assert.equal(hit?.damage,DAMAGE);
  assert.equal(findFoeHit(origin,0,0,freshCoop().foes),null);
  assert.equal(findFoeHit(origin,Math.PI,0,freshCoop().foes,()=>true),null);
  const down=freshCoop().foes.map(f=>f.id==="plazafoe2"?{...f,hp:0}:f);
  assert.equal(findFoeHit(origin,Math.PI,0,down),null);
});

test("clearing the plaza mission needs each foe down once, then they stand back up",()=>{
  let state={...freshCoop(),enabled:true};
  const now=1_000_000;
  let shots=0;
  for(const id of ["plazafoe1","plazafoe2","plazafoe3"]){
    for(let n=0;n<MAX_HP/DAMAGE;n++){
      const step=applyFoeDamage(state,id,now+shots);
      shots++;
      assert.equal(step.damage,DAMAGE);
      assert.equal(step.justCleared,id==="plazafoe3"&&n===MAX_HP/DAMAGE-1);
      state=step.state;
    }
  }
  assert.equal(state.cleared,true);
  assert.equal(state.foes.every(f=>f.beaten),true);
  assert.equal(applyFoeDamage(state,"plazafoe1",now+shots).justCleared,false);
  const down=state.foes.find(f=>f.id==="plazafoe3");
  assert.ok(down&&down.hp===0&&down.downUntil>now);
  const stood=reviveFoes(state.foes,down.downUntil);
  assert.equal(stood.find(f=>f.id==="plazafoe3")?.hp,MAX_HP);
  assert.equal(validCoopState(publicCoop(state)),true);
  assert.equal(validCoopState({...publicCoop(state),foes:[]}),false);
});

test("coop packets stay fixed and cannot name a victim",()=>{
  assert.deepEqual(decodeMessage('{"type":"coop_mode","enabled":true}'),{type:"coop_mode",enabled:true});
  assert.equal(decodeMessage('{"type":"coop_mode","enabled":true,"target":"friend"}'),null);
  assert.equal(validateOutgoing({type:"coop_mode",enabled:false}),true);
  const state=publicCoop({...freshCoop(),enabled:true});
  const parsed=parseIncoming(JSON.stringify({type:"coop_state",...state}));
  assert.equal(parsed?.type,"coop_state");
  if(parsed?.type==="coop_state")assert.equal(parsed.foes.length,3);
  assert.equal(parseIncoming(JSON.stringify({type:"mission_clear"}))?.type,"mission_clear");
  assert.equal(parseIncoming(JSON.stringify({type:"coop_state",enabled:true,cleared:false,foes:[{id:"plazafoe1",hp:101,downUntil:0,beaten:false}]})),null);
});

test("the co-op plaza is flat, open, and batched",()=>{
  assert.equal(inCoopPlaza(21,40),true);
  assert.equal(inCoopPlaza(0,0),false);
  assert.equal(groundHeightAt(21,40),0);
  assert.equal(groundHeightAt(22,40),0);
  assert.equal(worldBlocked(21,40,.36),false);
  for(let x=0;x<6;x++)for(let z=0;z<6;z++){
    const chunk=chunkData(x,z);
    for(const tree of chunk.trees)assert.equal(inCoopPlaza(tree.x,tree.z),false);
    for(const rock of chunk.rocks)assert.equal(inCoopPlaza(rock.x,rock.z),false);
    for(const tuft of chunk.grass)assert.equal(inCoopPlaza(tuft.x,tuft.z),false);
  }
  const scene=new THREE.Scene();
  const plaza=new CoopPlaza(scene);
  assert.ok(plaza.batched>=8);
  assert.equal(scene.getObjectByName("COOP_PLAZA")!==undefined,true);
  const lights=[];
  plaza.root.traverse(obj=>{if(obj instanceof THREE.Light)lights.push(obj)});
  assert.equal(lights.length,0);
});
