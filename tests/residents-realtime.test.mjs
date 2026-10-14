import test from 'node:test';import assert from 'node:assert/strict';import WebSocket from 'ws';import {spawn} from 'node:child_process';import {setTimeout as wait} from 'node:timers/promises';import {randomUUID} from 'node:crypto';
import {currentResidentPose,EMPTY_MOTION,residentTimeAt} from '../shared/residentRules.js';
import {insideHouse} from '../shared/worldRules.js';import {withinMovementSpeed} from '../server/src/guards.js';
const PORT=8993,ROOM=randomUUID().replaceAll('-','');
function message(s,type,predicate=()=>true){return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{cleanup();reject(Error('Timed out: '+type));},8000);
 const onData=raw=>{const m=JSON.parse(raw.toString());if(m.type===type&&predicate(m)){cleanup();resolve(m);}};
 const cleanup=()=>{clearTimeout(timer);s.off('message',onData);};s.on('message',onData);
});}
function route(from,goal,motion){
 const start=[Math.round(from.x),Math.round(from.z)],key=(x,z)=>x+','+z,queue=[start],parents=new Map([[key(...start),null]]);let found;
 const context={now:Date.now(),motion};
 for(let i=0;i<queue.length;i++){
  const [x,z]=queue[i],distance=Math.hypot(x-goal.x,z-goal.z);
  if(distance>=1.1&&distance<1.8){found=key(x,z);break;}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=x+dx,nz=z+dz,k=key(nx,nz);
   if(parents.has(k)||nx< -22||nx>22||nz< -26||nz>35||insideHouse(nx,nz,.0))continue;
   if(!withinMovementSpeed({x,y:1.65,z},{x:nx,y:1.65,z:nz},200,true,context))continue;
   parents.set(k,key(x,z));queue.push([nx,nz]);
  }
 }
 assert.ok(found,'find a safe outdoor route to resident');const path=[];
 while(found!==null){path.push(found.split(',').map(Number));found=parents.get(found);}return path.reverse().slice(1);
}
test('two clients share resident holds, body collision, conversation validation and late joins',{timeout:100000},async()=>{
 const server=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--config','server/wrangler.jsonc','--ip','127.0.0.1','--port',String(PORT),'--inspector-port','9237'],{stdio:'ignore'});
 const sockets=[];let p={x:0,y:1.65,z:15},seq=0,playerId,motion={...EMPTY_MOTION};
 try{
  for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok)break;}catch{}await wait(250);}
  async function join(name){
   const s=new WebSocket(`ws://127.0.0.1:${PORT}/rooms/${ROOM}`,{headers:{Origin:'http://localhost:5173'}});sockets.push(s);
   await new Promise((resolve,reject)=>{s.once('open',resolve);s.once('error',reject);});
   const welcome=message(s,'welcome'),state=message(s,'npc_state');s.send(JSON.stringify({type:'join',roomId:ROOM,displayName:name}));
   const w=await welcome,clock=await state;assert.ok(clock.serverTime>0);return {s,w,clock};
  }
  const a=await join('Resident Friend A'),b=await join('Resident Friend B');playerId=a.w.playerId;
  assert.deepEqual(a.clock.motion,b.clock.motion);motion=a.clock.motion;
  const distant=message(a.s,'error',m=>m.reason.includes('近づいて'));
  a.s.send(JSON.stringify({type:'npc_talk',id:'tokotoko'}));await distant;
  const turbo=message(a.s,'weapon_state',m=>m.boosted);a.s.send(JSON.stringify({type:'unlock_weapon',code:'NEON777'}));await turbo;
  async function move(x,z,allowResidentBlock=false){
   await wait(105);const n=++seq;
   const receipt=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(Error('Movement response timeout: '+JSON.stringify({from:p,to:{x,z},sequence:n})));},8000);
    const accepted=raw=>{const m=JSON.parse(raw.toString());if(m.type==='joined'&&m.player.id===playerId&&m.player.sequence===n){cleanup();resolve({accepted:true,position:m.player.position});}};
    const corrected=raw=>{const m=JSON.parse(raw.toString());if(m.type==='position_correction'){cleanup();resolve({accepted:false,position:m.position});}};
    const cleanup=()=>{clearTimeout(timer);b.s.off('message',accepted);a.s.off('message',corrected);};
    b.s.on('message',accepted);a.s.on('message',corrected);
   });
   a.s.send(JSON.stringify({type:'move',sequence:n,position:{x,y:1.65,z},yaw:0,pitch:0}));const result=await receipt;p=result.position;
   if(!allowResidentBlock)assert.ok(result.accepted,'expected clear path at '+JSON.stringify({x,z,actual:p}));
   return result.accepted;
  }
  for(let z=14.5;z>=-5;z-=.5)await move(0,z);
  for(let x=1;x<=18;x++)await move(x,-5);
  const poko=message(a.s,'npc_dialogue',m=>m.id==='poko');a.s.send(JSON.stringify({type:'npc_talk',id:'poko'}));await poko;
  await wait(150);const correction=message(a.s,'position_correction');a.s.send(JSON.stringify({type:'move',sequence:++seq,position:{x:18,y:1.65,z:-5.4},yaw:0,pitch:0}));assert.deepEqual((await correction).position,p);
  let near=false;
  for(let attempt=0;attempt<20;attempt++){
   const goal=currentResidentPose(Date.now(),motion);
   if(Math.hypot(p.x-goal.x,p.z-goal.z)<2.4){near=true;break;}
   const path=route(p,goal,motion);
   for(const [x,z] of path.slice(0,8))if(!await move(x,z,true))break;
  }
  assert.ok(near,'walk within talking distance of the roaming resident');
  await wait(550);
  const stateA=message(a.s,'npc_state'),stateB=message(b.s,'npc_state'),dialogue=message(a.s,'npc_dialogue',m=>m.id==='tokotoko');
  a.s.send(JSON.stringify({type:'npc_talk',id:'tokotoko'}));const [sa,sb]=await Promise.all([stateA,stateB]);await dialogue;assert.deepEqual(sa.motion,sb.motion);motion=sa.motion;
  const held=currentResidentPose(Date.now(),motion);assert.equal(held.moving,false);
  assert.equal(residentTimeAt(Date.now()+4000,motion),residentTimeAt(Date.now(),motion));
  const c=await join('Resident Late Friend');assert.deepEqual(c.clock.motion,motion);
  const dx=p.x-held.x,dz=p.z-held.z,d=Math.hypot(dx,dz);await move(held.x+dx/d*1.15,held.z+dz/d*1.15);
  await wait(750);const blocked=message(a.s,'position_correction');a.s.send(JSON.stringify({type:'move',sequence:++seq,position:{x:held.x,y:1.65,z:held.z},yaw:0,pitch:0}));assert.deepEqual((await blocked).position,p);
  await wait(550);const renew=message(b.s,'npc_state');a.s.send(JSON.stringify({type:'npc_talk',id:'tokotoko',continue:true}));const renewed=await renew;
  const renewedPose=currentResidentPose(Date.now(),renewed.motion);assert.ok(Math.hypot(renewedPose.x-held.x,renewedPose.z-held.z)<.001);
 }finally{for(const s of sockets)s.close();server.kill('SIGTERM');}
});
