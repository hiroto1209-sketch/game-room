import test from 'node:test';
import assert from 'node:assert/strict';
import {residentPoseAt,currentResidentPose,holdResident,residentTimeAt,residentStepBlocked,residentHeightAt,
 EMPTY_MOTION,POKO_ANCHOR,RESIDENT_CYCLE_SECONDS,canTalkToResident,TOKOTOKO} from '../shared/residentRules.js';
import {worldBlocked,crossesHouseWall,groundHeightAt,validWorldStep} from '../shared/worldRules.js';
import {PlayerController} from '../src/player/PlayerController.ts';
import {decodeMessage,withinMovementSpeed} from '../server/src/guards.js';
import {parseIncoming,validateOutgoing} from '../src/network/protocol.ts';
import {InteractionManager} from '../src/world/InteractionManager.ts';

test('resident wanders around the house with pauses and never crosses buildings or scenery',()=>{
 let previous,walk=0,idle=0;
 for(let t=0;t<RESIDENT_CYCLE_SECONDS*1000;t+=100){
  const p=residentPoseAt(t);if(p.moving)walk++;else idle++;
  assert.equal(worldBlocked(p.x,p.z,TOKOTOKO.radius+.05),false,`${t}: ${p.x},${p.z}`);
  assert.equal(groundHeightAt(p.x,p.z),0);
  if(previous){assert.equal(crossesHouseWall(previous,p),false);assert.ok(Math.hypot(p.x-previous.x,p.z-previous.z)<.063);}
  previous=p;
 }
 assert.ok(walk>2000&&idle>500);
 const start=residentPoseAt(0),end=residentPoseAt(RESIDENT_CYCLE_SECONDS*1000);assert.ok(Math.hypot(start.x-end.x,start.z-end.z)<.001);
});
test('conversation holds one shared pose, turns toward viewer, renews and resumes without teleport',()=>{
 const time=25000,pose=residentPoseAt(time),viewer={x:pose.x+1,z:pose.z};
 const held=holdResident(time,EMPTY_MOTION,viewer);
 const a=currentResidentPose(time+3000,held),b=currentResidentPose(time+11000,held);
 assert.equal(a.moving,false);assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.ok(Math.abs(a.yaw-Math.PI/2)<1e-8);
 const renewed=holdResident(time+9000,held,viewer,true);
 assert.equal(residentTimeAt(time+15000,renewed),time);
 const before=currentResidentPose(renewed.holdUntil-1,renewed),after=currentResidentPose(renewed.holdUntil+1,renewed);
 assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<.001);
});
test('both characters block movement, allow escape from overlap and bound support to body height',()=>{
 const now=1000,motion=EMPTY_MOTION,pose=residentPoseAt(now);
 for(const c of [POKO_ANCHOR,{...pose,radius:TOKOTOKO.radius,height:TOKOTOKO.height}]){
  const inside={x:c.x,y:1.65,z:c.z},outside={x:c.x+c.radius+1,y:1.65,z:c.z};
  assert.equal(residentStepBlocked(outside,inside,.36,now,motion),true);
  assert.equal(residentStepBlocked(inside,{...inside,x:c.x+.1},.36,now,motion),false);
  assert.equal(residentStepBlocked({...outside,y:c.height+1.7},{...inside,y:c.height+1.7},.36,now,motion),false);
  assert.equal(residentHeightAt(c.x,c.z,c.height+.05,now,motion),c.height);
  assert.equal(residentHeightAt(c.x,c.z,0,now,motion),0);
  assert.equal(withinMovementSpeed({...inside,x:c.x-.9},inside,200,true,{now,motion}),false);
 }
 assert.equal(residentStepBlocked({x:17,y:1.65,z:-5},{x:19,y:1.65,z:-5},.36,now,motion),false,'welcome body must not block the straight entrance path');
});
test('resident messages have fixed IDs; no arbitrary NPC position, clock, text or remote conversation',()=>{
 assert.deepEqual(decodeMessage(JSON.stringify({type:'npc_talk',id:'tokotoko'})),{type:'npc_talk',id:'tokotoko',continue:false});
 for(const bad of [{type:'npc_talk',id:'other'},{type:'npc_talk',id:'poko',x:999},{type:'npc_talk',id:'poko',continue:'yes'}])assert.equal(decodeMessage(JSON.stringify(bad)),null);
 assert.equal(validateOutgoing({type:'npc_talk',id:'poko'}),true);
 assert.equal(parseIncoming(JSON.stringify({type:'npc_state',serverTime:1000,motion:{...EMPTY_MOTION,holdUntil:999999}})),null);
 assert.equal(canTalkToResident('poko',{x:0,y:1.65,z:15},1000),false);
 assert.equal(canTalkToResident('poko',{x:POKO_ANCHOR.x-1,y:1.65,z:POKO_ANCHOR.z},1000),true);
});
test('jump launch is exactly 1.3 times the previous 5.0 and maintains gravity / server limits',()=>{
 const player=new PlayerController([]);player.jump();player.update(.001,{x:0,y:0},0,true);
 const velocity=(player.position.y-1.65)/.001+11.8*.001;
 assert.ok(Math.abs(velocity-6.5)<1e-9);
 let peak=0;
 for(let i=0;i<300;i++){const from={...player.position};player.update(.005,{x:0,y:0},0,true);peak=Math.max(peak,player.position.y-1.65);assert.equal(validWorldStep(from,player.position),true);}
 assert.ok(peak>1.70&&peak<1.80);assert.equal(player.grounded,true);
});
test('unloaded and hidden residents cannot steal a nearby interaction target',()=>{
 const hidden={x:1,z:15,label:'hidden resident',action:()=>{},enabled:()=>false},shown={x:2,z:15,label:'resident',action:()=>{},enabled:()=>true};
 assert.equal(new InteractionManager([hidden,shown]).closest({x:0,y:1.65,z:15}),shown);
});
