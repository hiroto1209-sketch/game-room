import test from "node:test";
import assert from "node:assert/strict";
import {ARENA,MAX_HP,DAMAGE,inArena,validSignText,signText,aimDirection,
  raySphereDistance,findHitscanTarget} from "../shared/combatRules.js";
import {decodeMessage} from "../server/src/guards.js";
import {parseIncoming,validateOutgoing} from "../src/network/protocol.ts";

test("marquee prevents markup, controls, excessively long and malformed text",()=>{
  assert.equal(validSignText("HELLO 京都 🎉"),true);
  assert.equal(validSignText("a".repeat(81)),false);
  assert.equal(validSignText("<img src=x>"),false);
  assert.equal(validSignText("a\nb"),false);
  assert.equal(signText("  "), "WELCOME TO GAME ROOM");
  assert.deepEqual(decodeMessage(JSON.stringify({type:"room_update",key:"signText",value:"  PARTY!  "})),
    {type:"room_update",key:"signText",value:"PARTY!"});
  assert.equal(decodeMessage(JSON.stringify({type:"room_update",key:"signText",value:"<script>"})),null);
  assert.equal(validateOutgoing({type:"room_update",key:"signText",value:"HELLO FRIENDS"}),true);
});
test("one shared world snapshot preserves sign, photo and lights",()=>{
  const msg=parseIncoming(JSON.stringify({type:"room_state",revision:11,lightShow:true,
    monitorImage:"data:image/jpeg;base64,/9j/AA==",signText:"WELCOME HOME"}));
  assert.equal(msg?.type,"room_state");
  if(msg?.type==="room_state"){
    assert.equal(msg.signText,"WELCOME HOME");
    assert.equal(msg.lightShow,true);
  }
  const legacy=parseIncoming(JSON.stringify({type:"room_state",revision:1,lightShow:false,monitorImage:null}));
  assert.equal(legacy?.type==="room_state"&&legacy.signText==="WELCOME TO GAME ROOM",true);
});
test("only the arena allows PvP and position bounds are explicit",()=>{
  assert.equal(inArena({x:(ARENA.minX+ARENA.maxX)/2,z:(ARENA.minZ+ARENA.maxZ)/2}),true);
  assert.equal(inArena({x:0,z:0}),false);
  assert.equal(inArena({x:90,z:0}),false);
});
test("server detects target from shooter aim, ignoring client hit claims",()=>{
  const shooter={id:"shooter",hp:MAX_HP,position:{x:90,y:1.65,z:-40}};
  const target={id:"target",hp:MAX_HP,position:{x:90,y:1.65,z:-44}};
  const outsider={id:"outsider",hp:MAX_HP,position:{x:0,y:1.65,z:0}};
  assert.equal(findHitscanTarget(shooter,[target,outsider],0,0)?.id,"target");
  assert.equal(findHitscanTarget(shooter,[target,outsider],Math.PI,0),null);
  assert.equal(findHitscanTarget(shooter,[{...target,hp:0}],0,0),null);
  assert.equal(DAMAGE,25);
  assert.ok(Math.abs(aimDirection(0,0).x)<1e-10);
  assert.equal(aimDirection(0,0).z,-1);
  assert.equal(raySphereDistance(shooter.position,{x:0,y:0,z:-1},{x:100,y:0,z:0},.3),null);
});
test("clients send fire direction and sequence, never victim or damage",()=>{
  const outgoing={type:"fire",sequence:1,yaw:0,pitch:0};
  assert.equal(validateOutgoing(outgoing),true);
  assert.deepEqual(decodeMessage(JSON.stringify(outgoing)),outgoing);
  assert.equal(decodeMessage(JSON.stringify({...outgoing,sequence:-1})),null);
  assert.equal(decodeMessage(JSON.stringify({...outgoing,pitch:3})),null);
  assert.equal(parseIncoming(JSON.stringify({type:"health_state",playerId:"12345678",hp:55,respawnAt:0}))?.type,"health_state");
  assert.equal(parseIncoming(JSON.stringify({type:"respawn",position:{x:88,y:1.65,z:-38},health:100}))?.type,"respawn");
});
