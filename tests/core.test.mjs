import test from "node:test";
import assert from "node:assert/strict";
import { joystickVector } from "../src/input/joystickMath.ts";
import { createRoomId,isValidRoomId,parseIncoming,validateOutgoing } from "../src/network/protocol.ts";

test("neutral joystick and dead zone",()=>{
  assert.deepEqual(joystickVector(0,0),{x:0,y:0});
  assert.deepEqual(joystickVector(2,3),{x:0,y:0});
});
test("joystick has correct directions and normalized diagonal",()=>{
  assert.ok(joystickVector(0,-60).y>.99);
  assert.ok(joystickVector(60,0).x>.99);
  assert.ok(joystickVector(-60,0).x<-.99);
  const diagonal=joystickVector(100,100);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<.00001);
});
test("cryptographically generated room codes are 32 URL-safe characters",()=>{
  const ids=new Set(Array.from({length:150},()=>createRoomId()));
  assert.equal(ids.size,150);
  for(const id of ids)assert.equal(isValidRoomId(id),true);
  assert.equal(isValidRoomId("demo"),false);
  assert.equal(isValidRoomId("https://site/room/123"),false);
});
test("malformed and oversized incoming packets are rejected",()=>{
  assert.equal(parseIncoming("not json"),null);
  assert.equal(parseIncoming("x".repeat(4097)),null);
  assert.equal(parseIncoming(JSON.stringify({type:"snapshot",players:[{id:"user_one01",displayName:"Test",position:{x:Infinity,y:1,z:0},yaw:0,pitch:0,sequence:1}]})),null);
  assert.equal(parseIncoming(JSON.stringify({type:"left",playerId:"!"})),null);
});
test("validated snapshot sanitizes display names",()=>{
  const valid={type:"joined",player:{id:"player_0001",displayName:"<hello>",position:{x:1,y:1.65,z:2},yaw:0,pitch:0,sequence:1}};
  const msg=parseIncoming(JSON.stringify(valid));
  assert.equal(msg?.type,"joined");
  assert.equal(msg?.player.displayName,"hello");
});
test("outbound join requires valid room identifier",()=>{
  assert.equal(validateOutgoing({type:"join",roomId:"short",displayName:"Guest"}),false);
  assert.equal(validateOutgoing({type:"join",roomId:createRoomId(),displayName:"Guest"}),true);
});
