import test from "node:test";
import assert from "node:assert/strict";
import {canBlasterFire,shouldSendPvpShot} from "../src/combat/practiceRules.ts";
test("local practice is allowed when Peace Mode protects other players",()=>{
  assert.equal(canBlasterFire(true,true,true),true);
  assert.equal(canBlasterFire(true,true,false),false);
  assert.equal(canBlasterFire(true,false,false),true);
  assert.equal(canBlasterFire(false,false,true),false);
  assert.equal(canBlasterFire(false,true,true),false);
});
test("practice never leaks PvP damage into Worker even in a connected room",()=>{
  assert.equal(shouldSendPvpShot(true,true,true),false);
  assert.equal(shouldSendPvpShot(true,false,true),false);
  assert.equal(shouldSendPvpShot(false,false,false),false);
  assert.equal(shouldSendPvpShot(true,true,false),false);
  assert.equal(shouldSendPvpShot(true,false,false),true);
});
