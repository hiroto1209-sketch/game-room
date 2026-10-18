import test from "node:test";
import assert from "node:assert/strict";
import {canBlasterFire,shouldSendPvpShot} from "../src/combat/practiceRules.ts";

test("an unlocked blaster fires everywhere and online shots are always sent",()=>{
  assert.equal(canBlasterFire(true),true);
  assert.equal(canBlasterFire(false),false);
  assert.equal(shouldSendPvpShot(true),true);
  assert.equal(shouldSendPvpShot(false),false);
});
