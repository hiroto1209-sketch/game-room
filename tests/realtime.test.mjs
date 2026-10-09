import test from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import {spawn} from "node:child_process";
import {setTimeout as wait} from "node:timers/promises";

const PORT=8987, ROOT="http://127.0.0.1:"+PORT;
const ROOM="ABCDEFGHIJKLMNOPQRSTUVWXabcdefgh"; // 32 URL-safe characters
const ORIGIN="http://localhost:5173";
async function available(){
  for(let i=0;i<80;i++){
    try{const response=await fetch(ROOT+"/api/health");if(response.ok)return;}
    catch{}
    await wait(350);
  }
  throw Error("Local Wrangler Worker did not respond");
}
function connected(url){
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(url,{headers:{Origin:ORIGIN}});
    const timeout=setTimeout(()=>reject(Error("WebSocket connect timeout")),8000);
    socket.once("open",()=>{clearTimeout(timeout);resolve(socket);});
    socket.once("error",error=>{clearTimeout(timeout);reject(error)});
  });
}
function nextMessage(socket,type,predicate=()=>true){
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{cleanup();reject(Error("Message timeout: "+type))},8000);
    const onData=buffer=>{
      let message;try{message=JSON.parse(buffer.toString())}catch{return}
      if(message.type!==type||!predicate(message))return;
      cleanup();resolve(message);
    };
    const onError=e=>{cleanup();reject(e)};
    const cleanup=()=>{clearTimeout(timeout);socket.off("message",onData);socket.off("error",onError)};
    socket.on("message",onData);socket.on("error",onError);
  });
}
test("two players share one Durable Object and positions/leave events propagate", {timeout:65000},async()=>{
  const server=spawn(process.execPath,["./node_modules/wrangler/bin/wrangler.js","dev",
    "--config","server/wrangler.jsonc","--port",String(PORT),"--ip","127.0.0.1","--local"],{stdio:"ignore"});
  let a,b,c;
  try{
    await available();
    const url="ws://127.0.0.1:"+PORT+"/rooms/"+ROOM;
    a=await connected(url);
    const aWelcome=nextMessage(a,"welcome");
    a.send(JSON.stringify({type:"join",roomId:ROOM,displayName:"Alice"}));
    const alice=await aWelcome;
    assert.equal(alice.roomId,ROOM);
    assert.ok(alice.playerId);
    b=await connected(url);
    const bWelcome=nextMessage(b,"welcome");
    const bSnapshot=nextMessage(b,"snapshot");
    const aJoined=nextMessage(a,"joined");
    b.send(JSON.stringify({type:"join",roomId:ROOM,displayName:"Bob"}));
    const bob=await bWelcome;
    const snapshot=await bSnapshot;
    const joined=await aJoined;
    assert.equal(snapshot.players.some(x=>x.id===alice.playerId),true);
    assert.equal(joined.player.id,bob.playerId);
    await wait(130);
    const aMove=nextMessage(a,"joined",m=>m.player.id===bob.playerId&&m.player.sequence===1);
    b.send(JSON.stringify({type:"move",position:{x:0.1,y:1.65,z:14.7},yaw:0.3,pitch:0,sequence:1}));
    const move=await aMove;
    assert.equal(move.player.position.z,14.7);
    const lightA=nextMessage(a,"room_state",m=>m.revision>=1&&m.lightShow===true);
    const lightB=nextMessage(b,"room_state",m=>m.revision>=1&&m.lightShow===true);
    a.send(JSON.stringify({type:"room_update",key:"lightShow",value:true}));
    const confirmedA=await lightA, confirmedB=await lightB;
    assert.equal(confirmedA.revision,confirmedB.revision);
    const jpeg="data:image/jpeg;base64,/9j/AA==";
    const imageA=nextMessage(a,"room_state",m=>m.monitorImage===jpeg);
    const imageB=nextMessage(b,"room_state",m=>m.monitorImage===jpeg);
    b.send(JSON.stringify({type:"room_update",key:"monitorImage",value:jpeg}));
    assert.equal((await imageA).monitorImage,jpeg);
    assert.equal((await imageB).monitorImage,jpeg);
    // Late joiners receive the last persisted state, rather than a private client texture.
    c=await connected(url);
    const cWelcome=nextMessage(c,"welcome");
    const cState=nextMessage(c,"room_state");
    c.send(JSON.stringify({type:"join",roomId:ROOM,displayName:"Charlie"}));
    assert.ok((await cWelcome).playerId);
    const saved=await cState;
    assert.equal(saved.monitorImage,jpeg);
    assert.equal(saved.lightShow,true);
    c.close();
    // Phase 4-A full outdoor traversal: server must accept a walk from the
    // existing hallway spawn, through the actual doorway, then beyond x=10.
    // We exercise real Durable Object WebSocket events, not only pure math.
    const acceptedSteps=[];
    const rejectedSteps=[];
    a.on("message",raw=>{
      try{const m=JSON.parse(raw.toString());
        if(m.type==="joined"&&m.player?.id===bob.playerId)acceptedSteps.push({seq:m.player.sequence,x:m.player.position.x,z:m.player.position.z});
      }catch{}
    });
    b.on("message",raw=>{
      try{const m=JSON.parse(raw.toString());
        if(m.type==="error")rejectedSteps.push(m.reason);
      }catch{}
    });
    let p={x:0.1,y:1.65,z:14.7}, seq=1;
    async function walkStep(x,z){
      p={x,y:1.65,z};
      b.send(JSON.stringify({type:"move",position:p,yaw:0,pitch:0,sequence:++seq}));
      await wait(165); // server movement pacing >=75ms, ~1.0 unit/step
    }
    for(let i=1;i<=20;i++)await walkStep(.1,14.7-i);
    // Snap slightly to the center of the doorway without wall penetration.
    for(let i=1;i<=11;i++)await walkStep(.1+i,-5.3);
    const outdoorMove=nextMessage(a,"joined",m=>m.player.id===bob.playerId&&m.player.sequence===seq+1);
    b.send(JSON.stringify({type:"move",position:{x:12.1,y:1.65,z:-5.3},yaw:0,pitch:0,sequence:++seq}));
    let observedOutdoor;
    try{observedOutdoor=await outdoorMove}
    catch(error){
      console.error("OUTDOOR DEBUG",JSON.stringify({finalSequence:seq,acceptedSteps:acceptedSteps.slice(-12),rejectedSteps}));
      throw error;
    }
    assert.equal(observedOutdoor.player.position.x,12.1);
    assert.equal(observedOutdoor.player.position.z,-5.3);
    const aLeft=nextMessage(a,"left",m=>m.playerId===bob.playerId);
    b.close();
    const left=await aLeft;
    assert.equal(left.playerId,bob.playerId);
  }finally{
    a?.close();b?.close();c?.close();
    server.kill("SIGTERM");
  }
});
