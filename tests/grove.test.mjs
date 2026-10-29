import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import "./../shared/playcanvasCollisionData.js";
import {
  freshGrove, beginWave, stepGrove, shootGrove, inGrove, nearStone, STONE, monsterFoot, KINDS,
  questCopy, validGroveView, viewOf, rankForKills, shotDamage
} from "../shared/groveRules.js";
import {decodeMessage} from "../server/src/guards.js";

test("grove waves spawn three original kinds and a center shot hurts a rusher", ()=>{
  const started=beginWave(freshGrove());
  assert.equal(started.wave, 1);
  assert.equal(started.phase, "fight");
  assert.equal(started.monsters.length, 3);
  assert.ok(started.monsters.every(m=>m.kind==="rush"));
  const target=started.monsters[0];
  const origin={x:target.x, y:monsterFoot(target)+KINDS.rush.height*0.95, z:target.z-3};
  const yaw=Math.atan2(origin.x-target.x, origin.z-target.z);
  const shot=shootGrove(started, origin, yaw, 0, 0);
  assert.ok(shot);
  assert.equal(shot.damage, shotDamage(0)*2);
  assert.equal(shot.crit, true);
  assert.ok(shot.hp<target.hp);
  const bodyOrigin={x:target.x, y:monsterFoot(target)+KINDS.rush.height*0.42, z:target.z-3};
  const again=shootGrove(shot.state, bodyOrigin, yaw, 0, 2);
  assert.ok(again);
  assert.equal(again.crit, false);
  assert.equal(again.damage, shotDamage(2));
});

test("grove ai chases, then the wave clears only after every body falls", ()=>{
  let state=beginWave(freshGrove());
  const player={id:"hero", x:STONE.x, z:STONE.z, hp:100};
  let chased=false;
  for(let i=0;i<90;i++){
    const stepped=stepGrove(state, 0.1, [player]);
    state=stepped.state;
    if(state.monsters.some(m=>m.state==="chase"||m.state==="attack")) chased=true;
  }
  assert.equal(chased, true);
  for(const m of state.monsters) m.hp=0;
  const done=stepGrove(state, 0.1, [player]);
  assert.equal(done.state.phase, "clear");
  let boss=freshGrove();
  for(let wave=0;wave<3;wave++){
    boss=beginWave(boss);
    boss={...boss, phase:"clear", monsters:[]};
  }
  boss=beginWave({...boss, phase:"clear"});
  assert.equal(boss.wave, 3);
  assert.ok(boss.monsters.some(m=>m.kind==="elite"));
  assert.ok(boss.monsters.some(m=>m.kind==="spit"));
});

test("grove packets stay strict and the quest copy stays in Japanese", ()=>{
  assert.equal(inGrove(STONE), true);
  assert.equal(nearStone({x:STONE.x+2.4, z:STONE.z}), true);
  assert.equal(rankForKills(4), 1);
  assert.match(questCopy(freshGrove()).body, /召喚石/);
  const view=viewOf(beginWave(freshGrove()));
  assert.equal(validGroveView(view), true);
  assert.equal(validGroveView({...view, monsters:[...view.monsters, {id:1}]}), false);
  assert.deepEqual(decodeMessage('{"type":"grove_summon"}'), {type:"grove_summon"});
  assert.equal(decodeMessage('{"type":"grove_summon","wave":3}'), null);
  assert.deepEqual(decodeMessage('{"type":"grove_upgrade"}'), {type:"grove_upgrade"});
  const html=readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const grove=readFileSync(new URL("../src/world/ForestGrove.ts", import.meta.url), "utf8");
  assert.doesNotMatch(grove, /NEON777|秘密のコード|666/);
  assert.match(html, /id="grove-talk"/);
  assert.match(html, /召喚石から怪物を呼べる/);
});
