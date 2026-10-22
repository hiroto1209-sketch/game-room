import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const game = readFileSync(new URL("../public/minigames/games/cans/index.html", import.meta.url), "utf8");
const list = readFileSync(new URL("../public/minigames/index.html", import.meta.url), "utf8");

function pyramidCount(w, d) {
  let n = 0;
  while (w > 0 && d > 0) {
    n += w * d;
    w -= 1;
    d -= 1;
  }
  return n;
}

test("can gallery is an original single-file page with absolute cards", () => {
  assert.equal(pyramidCount(24, 41), 10000);
  assert.match(game, /const W0 = 24/);
  assert.match(game, /const D0 = 41/);
  assert.match(game, /const N = 10000/);
  assert.match(game, /three@0\.160\.1\/build\/three\.module\.js/);
  assert.match(game, /https:\/\/hiroto1209-sketch\.github\.io\/game-room\/minigames\/games\/cans\/"/);
  assert.match(game, /https:\/\/hiroto1209-sketch\.github\.io\/game-room\/minigames\/games\/cans\/icon\.png/);
  assert.match(game, /property="og:url"/);
  assert.match(game, /property="og:image"/);
  assert.match(game, /name="twitter:image"/);
  assert.match(game, /user-scalable=no/);
  assert.match(game, /100dvh/);
  assert.match(game, /touch-action:\s*none/);
  assert.match(game, /localStorage/);
  assert.match(game, /AudioContext/);
  assert.match(game, /navigator\.share/);
  assert.match(game, /https:\/\/x\.com\/intent\/post/);
  assert.match(game, /InstancedMesh/);
  assert.match(game, /THREE\.Points/);
  assert.match(game, /1万缶つみ射的/);
  assert.match(game, /10,000 Can Gallery/);
  assert.match(game, /景品：飴/);
  assert.match(game, /景品：おもちゃ/);
  assert.match(game, /景品：特賞/);
  assert.match(game, /全部落とし/);
  assert.match(game, /要石/);
  assert.match(game, /黄金/);
  assert.match(game, /第1面/);
  assert.match(game, /連鎖/);
  assert.match(game, /let lang = "ja"/);
  assert.doesNotMatch(game, /navigator\.language/);
  assert.doesNotMatch(game, /cannon|ammo\.|rapier|x282665|NEON777|秘密のコード/i);
  assert.equal(existsSync(new URL("../public/minigames/games/cans/icon.png", import.meta.url)), true);
  assert.equal(existsSync(new URL("../public/minigames/games/cans/icon.svg", import.meta.url)), true);
});

test("minigames list links the can gallery", () => {
  assert.match(list, /href="games\/cans\/"/);
  assert.match(list, /1万缶つみ射的/);
  assert.match(list, /10,000 Can Gallery/);
  assert.match(list, /games\/cans\/icon\.png/);
  assert.match(list, /黄金缶と要石/);
});
