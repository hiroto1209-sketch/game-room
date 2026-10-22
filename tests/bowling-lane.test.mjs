import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const game = readFileSync(new URL("../public/minigames/games/bowling/index.html", import.meta.url), "utf8");
const list = readFileSync(new URL("../public/minigames/index.html", import.meta.url), "utf8");

function pinCount() {
  let n = 0;
  for (let r = 0; r < 140; r++) n += r + 1;
  n += 130;
  return n;
}

test("bowling lane is an original single-file page with absolute cards", () => {
  assert.equal(pinCount(), 10000);
  assert.match(game, /const N = 10000/);
  assert.match(game, /const FULL = 140/);
  assert.match(game, /const TAIL = 130/);
  assert.match(game, /three@0\.160\.1\/build\/three\.module\.js/);
  assert.match(game, /https:\/\/hiroto1209-sketch\.github\.io\/game-room\/minigames\/games\/bowling\/"/);
  assert.match(game, /https:\/\/hiroto1209-sketch\.github\.io\/game-room\/minigames\/games\/bowling\/icon\.png/);
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
  assert.match(game, /1万本ボウリング/);
  assert.match(game, /10,000 Pin Roll/);
  assert.match(game, /ストライク/);
  assert.match(game, /スペア/);
  assert.match(game, /見習い/);
  assert.match(game, /万本/);
  assert.match(game, /let lang = "ja"/);
  assert.match(game, /横にずらす/);
  assert.match(game, /曲がりを止める/);
  assert.match(game, /強さを止める/);
  assert.doesNotMatch(game, /navigator\.language/);
  assert.doesNotMatch(game, /cannon|ammo\.|rapier|x282665|NEON777|秘密のコード|1万ボーリング/i);
  assert.equal(existsSync(new URL("../public/minigames/games/bowling/icon.png", import.meta.url)), true);
  assert.equal(existsSync(new URL("../public/minigames/games/bowling/icon.svg", import.meta.url)), true);
});

test("minigames list links the bowling lane", () => {
  assert.match(list, /href="games\/bowling\/"/);
  assert.match(list, /1万本ボウリング/);
  assert.match(list, /10,000 Pin Roll/);
  assert.match(list, /games\/bowling\/icon\.png/);
  assert.match(list, /1万本のピンを連鎖で倒す/);
});
