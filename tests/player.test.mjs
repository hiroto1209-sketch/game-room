import test from "node:test";
import assert from "node:assert/strict";
import { PlayerController } from "../src/player/PlayerController.ts";

test("camera-relative forward moves toward world -Z at yaw 0",()=>{
  const player=new PlayerController([]);
  player.update(.04,{x:0,y:1},0);
  assert.ok(player.position.z<15);
  assert.equal(player.position.x,0);
});
test("camera-relative forward rotates with the camera",()=>{
  const player=new PlayerController([]);
  player.update(.04,{x:0,y:1},Math.PI/2);
  assert.ok(player.position.x<0);
  assert.ok(Math.abs(player.position.z-15)<.00001);
});
test("solid walls prevent walking through at normal speeds",()=>{
  const wall={x0:-2,x1:2,z0:13.5,z1:14.3};
  const player=new PlayerController([wall]);
  for(let i=0;i<200;i++)player.update(.016,{x:0,y:1},0);
  assert.ok(player.position.z>=14.3+player.radius-.025);
});
test("jump returns to the ground and can jump again",()=>{
  const player=new PlayerController([]);
  player.jump();
  player.update(.016,{x:0,y:0},0);
  assert.ok(player.position.y>1.65);
  for(let i=0;i<150;i++)player.update(.016,{x:0,y:0},0);
  assert.equal(player.position.y,1.65);
  assert.equal(player.grounded,true);
  player.jump();
  player.update(.016,{x:0,y:0},0);
  assert.ok(player.position.y>1.65);
});

test("jump during forward movement preserves horizontal travel",()=>{
  const player=new PlayerController([]);
  for(let i=0;i<12;i++)player.update(.016,{x:0,y:1},0);
  const beforeZ=player.position.z;
  player.jump();
  assert.equal(player.grounded,false);
  for(let i=0;i<15;i++)player.update(.016,{x:0,y:1},0);
  assert.ok(player.position.y>1.65,"jump should gain altitude");
  assert.ok(player.position.z<beforeZ,"forward movement must continue during jump");
});
test("airborne jump input does not double-jump",()=>{
  const player=new PlayerController([]);
  player.jump();
  for(let i=0;i<5;i++)player.update(.016,{x:0,y:1},0);
  const initialY=player.position.y;
  player.jump();
  player.update(.016,{x:0,y:1},0);
  assert.ok(player.position.y>initialY,"original jump arc should continue");
  for(let i=0;i<170;i++)player.update(.016,{x:0,y:0},0);
  assert.equal(player.grounded,true);
});
