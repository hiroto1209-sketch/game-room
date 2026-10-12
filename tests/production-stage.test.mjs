import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import WebSocket from 'ws';
import {setTimeout as wait} from 'node:timers/promises';
import '../shared/playcanvasCollisionData.js';
import {worldBlocked} from '../shared/worldRules.js';
import {withinMovementSpeed} from '../server/src/guards.js';
const ROOT=process.env.GAME_ROOM_SERVER_URL?.replace(/\/$/,'');
if(!ROOT||!ROOT.startsWith('https://'))throw Error('Production HTTPS endpoint required');
const ROOM=randomBytes(24).toString('base64url');
function message(s,type,match=()=>true){return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{s.off('message',on);reject(Error('Timeout '+type));},8000);
 function on(raw){let m;try{m=JSON.parse(raw.toString());}catch{return;}if(m.type===type&&match(m)){clearTimeout(timer);s.off('message',on);resolve(m);}}
 s.on('message',on);
});}
function route(start,end){
 const key=(x,z)=>x+','+z,queue=[start],prev=new Map([[key(...start),null]]);let found=null;
 for(let n=0;n<queue.length;n++){
  const [x,z]=queue[n];if(x===end[0]&&z===end[1]){found=key(x,z);break;}
  for(const [dx,dz] of [[.5,0],[-.5,0],[0,.5],[0,-.5]]){
   const nx=x+dx,nz=z+dz,k=key(nx,nz);
   if(prev.has(k)||nx<120.5||nx>140||nz<-22||nz>22||worldBlocked(nx,nz)||!withinMovementSpeed({x,y:1.65,z},{x:nx,y:1.65,z:nz},200,true))continue;
   prev.set(k,key(x,z));queue.push([nx,nz]);
  }
 }
 assert.ok(found,'walkable original-map route');const path=[];
 while(found!==null){path.push(found.split(',').map(Number));found=prev.get(found);}
 return path.reverse();
}
test('PRODUCTION: three clients traverse original map, synchronize avatars/emotes, respect cover and safely respawn',{timeout:150000},async()=>{
 const server={kill(){}};
 const sockets=[],ids=[],seq=[0,0,0],corrections=[];
 try{
  for(let i=0;i<100;i++){try{if((await fetch(ROOT+'/api/health')).ok)break;}catch{}await wait(250);}
  for(let i=0;i<3;i++){
   const s=new WebSocket(ROOT.replace('https://','wss://')+'/rooms/'+ROOM,{headers:{Origin:'https://hiroto1209-sketch.github.io'}});
   await new Promise((resolve,reject)=>{s.once('open',resolve);s.once('error',reject);});sockets.push(s);
   s.on('message',r=>{const m=JSON.parse(r.toString());if(m.type==='position_correction'||m.type==='error')corrections.push(m);});
   const welcome=message(s,'welcome');s.send(JSON.stringify({type:'join',roomId:ROOM,displayName:'FPS Tester '+i}));ids.push((await welcome).playerId);
   const unlocked=message(s,'weapon_state',m=>m.boosted===true);s.send(JSON.stringify({type:'unlock_weapon',code:'NEON777'}));await unlocked;
  }
  async function move(i,x,z,yaw=0){
   const observer=sockets[(i+1)%3],n=++seq[i],receipt=message(observer,'joined',m=>m.player.id===ids[i]&&m.player.sequence===n);
   sockets[i].send(JSON.stringify({type:'move',sequence:n,position:{x,y:1.65,z},yaw,pitch:0}));return receipt;
  }
  async function together(x,z){await Promise.all(sockets.map((_,i)=>move(i,x,z)));await wait(105);}
  await wait(150);
  for(let z=14.5;z>=-5;z-=.5)await together(0,z);
  for(let x=2;x<=120;x+=2)await together(x,-5);
  await together(121.2,-5);
  for(let i=0;i<3;i++){await move(i,121.2+i*.9,-5,-Math.PI/2);await wait(110);}
  const style={color:'amber',hat:'crown'},styles=[message(sockets[1],'avatar_state'),message(sockets[2],'avatar_state')];
  sockets[0].send(JSON.stringify({type:'avatar_update',avatar:style}));for(const m of await Promise.all(styles))assert.deepEqual(m.avatar,style);
  const emotes=[message(sockets[1],'emote_event'),message(sockets[2],'emote_event')];
  sockets[0].send(JSON.stringify({type:'emote',kind:'wave'}));for(const m of await Promise.all(emotes))assert.equal(m.kind,'wave');
  const peace=message(sockets[2],'weapon_state',m=>m.peaceful);sockets[2].send(JSON.stringify({type:'peace_mode',enabled:true}));await peace;
  await wait(120);await move(1,123,-5);await wait(110);
  const path=route([123,-5],[125,2]);
  for(const [x,z] of path.slice(1)){await move(1,x,z);await wait(105);}
  let fireSeq=0;
  async function fire(yaw=-Math.PI/2){const n=++fireSeq,result=message(sockets[0],'fire_result',m=>m.sequence===n);sockets[0].send(JSON.stringify({type:'fire',sequence:n,yaw,pitch:0}));return result;}
  const blockedYaw=-Math.atan2(125-121.2,-(2+5));
  await move(0,121.2,-5,blockedYaw);await wait(110);
  assert.equal((await fire(blockedYaw)).hit,false,'original cover must stop a server-owned ray');
  for(const [x,z] of path.slice(0,-1).reverse()){await move(1,x,z);await wait(105);}
  await move(0,121.2,-5,-Math.PI/2);await wait(110);
  for(const hp of [75,50,25,0]){
   await wait(430);const health=message(sockets[1],'health_state',m=>m.playerId===ids[1]&&m.hp===hp);
   assert.equal((await fire()).hit,true);assert.equal((await health).hp,hp);
  }
  await wait(4100);const respawn=message(sockets[1],'respawn');sockets[1].send(JSON.stringify({type:'move',sequence:++seq[1],position:{x:123,y:1.65,z:-5},yaw:0,pitch:0}));
  const revived=await respawn;assert.equal(revived.health,100);assert.deepEqual(revived.position,{x:121.2,y:1.65,z:-5});assert.equal(worldBlocked(revived.position.x,revived.position.z),false);
  // All three independently retrace the continuous corridor back outdoors.
  await wait(120);await together(121.2,-5);for(let x=120;x>=100;x-=2)await together(x,-5);
  assert.deepEqual(corrections,[],'no invalid movement during stage traversal');
 }finally{for(const s of sockets)s.close();server.kill();}
});
