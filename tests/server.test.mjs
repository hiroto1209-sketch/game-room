import test from "node:test";
import assert from "node:assert/strict";
import {safeName,validRoomId,validPosition,decodeMessage,permittedOrigin,withinMovementSpeed} from "../server/src/guards.js";
import {createRoomId} from "../src/network/protocol.ts";
test("room IDs require 192-bit URL-safe tokens",()=>{
  assert.equal(validRoomId(createRoomId()),true);
  assert.equal(validRoomId("room1"),false);
});
test("incoming join sanitizes strings and rejects overlong packets",()=>{
  const roomId=createRoomId();
  const m=decodeMessage(JSON.stringify({type:"join",roomId,displayName:"  <A>  "}));
  assert.equal(m.displayName,"A");
  assert.equal(decodeMessage("x".repeat(5000)),null);
  assert.equal(safeName("".padEnd(50,"x")).length,24);
});
test("malformed movement, sequence, origins are denied",()=>{
  assert.equal(decodeMessage(JSON.stringify({type:"move",position:{x:Infinity,y:2,z:0},yaw:0,pitch:0,sequence:2})),null);
  assert.equal(decodeMessage(JSON.stringify({type:"move",position:{x:0,y:1.65,z:15},yaw:0,pitch:2,sequence:1})),null);
  assert.equal(validPosition({x:200,y:1.65,z:0}),false);
  assert.equal(permittedOrigin("https://evil.example"),false);
  assert.equal(permittedOrigin("https://hiroto1209-sketch.github.io"),true);
});
test("plausible movement accepted; teleport rejected",()=>{
  assert.equal(withinMovementSpeed({x:0,y:1.65,z:15},{x:0,y:1.65,z:14.5},120),true);
  assert.equal(withinMovementSpeed({x:0,y:1.65,z:15},{x:9,y:1.65,z:0},120),false);
});
