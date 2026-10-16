import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../shared/playcanvasCollisionData.js';
import {stageGround,stageBlocked,stageShotObstructed,FPS_STAGE} from '../shared/playcanvasRules.js';
import {groundHeightAt,worldBlocked,validWorldStep,validWorldPosition} from '../shared/worldRules.js';
import {withinMovementSpeed} from '../server/src/guards.js';
import {PlayerController} from '../src/player/PlayerController.ts';

test('original export hash, 295 meshes and 14 materials are preserved in the audit manifest',()=>{
 const m=JSON.parse(fs.readFileSync('public/playcanvas-fps/manifest.json'));
 assert.equal(m.sourceHash,'14f8b0eb44cadf27412b86b57cfa9b8f');
 assert.equal(m.originalMeshes,295);assert.equal(m.materials,14);assert.equal(m.originalTriangles,58758);
 assert.deepEqual(m.bounds.min,[-12.75,-0.14999985694885254,-24.600000381469727]);
 assert.deepEqual(m.bounds.max,[12.75,12,24.600000381469727]);
 const encoded=JSON.parse(fs.readFileSync('shared/playcanvasCollisionData.js','utf8').match(/const encoded=("[^"]+")/)[1]);
 const count=Buffer.from(encoded,'base64').byteLength/36;
 assert.equal(count,m.triangles);
});
test('entrance joins the previous world without an unbounded coordinate exemption',()=>{
 for(let x=102;x<123;x+=.1){
  const p={x,y:1.65,z:-5};assert.equal(worldBlocked(x,-5),false,'blocked x='+x);
  assert.equal(validWorldStep({...p,x:x-.1},p),true,'invalid x='+x);
 }
 assert.equal(validWorldPosition({x:112,y:1.65,z:25}),false);
 assert.equal(validWorldPosition({x:145,y:1.65,z:0}),false);
 assert.equal(validWorldPosition({x:50,y:9,z:0}),false);
 assert.equal(validWorldPosition({x:132,y:30,z:0}),false);
});
test('original wall remains solid except at the recorded doorway; rays use the same triangles',()=>{
 assert.equal(stageBlocked(119.4,-5),false);
 assert.equal(stageBlocked(119.4,-2),true);
 assert.equal(stageShotObstructed({x:118,y:1.65,z:-5},{x:121,y:1.65,z:-5}),false);
 assert.equal(stageShotObstructed({x:118,y:1.65,z:-2},{x:121,y:1.65,z:-2}),true);
 assert.equal(stageShotObstructed({x:121.2,y:1.65,z:-5},{x:125,y:1.65,z:2}),true);
 assert.equal(withinMovementSpeed({x:118,y:1.65,z:-2},{x:121,y:1.65,z:-2},200,true),false);
});
test('walking, turbo, jumping and elevated surfaces use the original geometry',()=>{
 const p=new PlayerController([],worldBlocked,(x,z)=>groundHeightAt(x,z,p.position.y-1.65+.35),stageShotObstructed);
 p.teleport(102,1.65,-5);
 for(let i=0;i<240;i++)p.update(.016,{x:1,y:0},0,false,6);
 assert.ok(p.position.x>123&&p.position.x<126,'must enter and stop at original cover');
 p.teleport(FPS_STAGE.spawn.x,1.65,-5);p.jump();
 for(let i=0;i<150;i++)p.update(.016,{x:0,y:0},0);
 assert.ok(Math.abs(p.position.y-1.65)<1e-5);
 assert.ok(Math.abs(stageGround(121,-23,4)-3.15)<1e-5,'original upper walkway');
 assert.equal(stageBlocked(121,-23,.36,4.8),false,'walk above ground-level geometry');
});
test('practice dummies take local head and body hits without claiming server damage',async()=>{
 const THREE=await import('three');
 const {PracticeDummies,PRACTICE_HEAD_DAMAGE}=await import('../src/world/PracticeDummies.ts');
 const {aimDirection}=await import('../shared/combatRules.js');
 const scene=new THREE.Scene();
 const dummies=new PracticeDummies(scene);
 dummies.update(.016,{x:130,z:-2});
 const dummy=scene.getObjectByName('PRACTICE_DUMMY_0');
 assert.ok(dummy);
 // The map spawn at x=121.2 looks through solid cover. Stand on the open lane.
 const origin={x:128.2,y:dummy.position.y+1.65,z:dummy.position.z};
 const dirX=dummy.position.x-origin.x;
 const pitch=Math.atan2((dummy.position.y+1.53)-origin.y,dirX);
 const head=dummies.shoot(origin,-Math.PI/2,pitch);
 assert.equal(head?.head,true);
 assert.equal(head?.damage,PRACTICE_HEAD_DAMAGE);
 const bodyPitch=Math.atan2((dummy.position.y+.85)-origin.y,dirX);
 const body=dummies.shoot(origin,-Math.PI/2,bodyPitch);
 assert.equal(body?.head,false);
 assert.equal(body?.damage,25);
 assert.ok(aimDirection(-Math.PI/2,0).x>0);
 dummies.dispose();
});
