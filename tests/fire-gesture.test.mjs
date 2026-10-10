import test from "node:test";
import assert from "node:assert/strict";
import {FireLookGesture} from "../src/input/FireLookGesture.ts";

test("held FIRE thumb drags aim without relinquishing firing ownership",()=>{
 const gesture=new FireLookGesture();
 assert.equal(gesture.begin(201,310,620),true);
 assert.equal(gesture.active,true);
 assert.deepEqual(gesture.move(201,340,607),{dx:30,dy:-13});
 assert.deepEqual(gesture.move(201,344,599),{dx:4,dy:-8});
 assert.equal(gesture.active,true);
});
test("releasing movement or look pointer cannot cancel the firing finger",()=>{
 const gesture=new FireLookGesture();
 assert.equal(gesture.begin(201,300,600),true);
 assert.equal(gesture.begin(202,320,400),false);
 assert.equal(gesture.move(202,360,300),null);
 assert.equal(gesture.end(101),false); // left movement thumb lifted
 assert.equal(gesture.end(202),false); // other right-hand look finger lifted
 assert.equal(gesture.active,true);
 assert.deepEqual(gesture.move(201,320,608),{dx:20,dy:8});
 assert.equal(gesture.end(201),true);
 assert.equal(gesture.active,false);
 assert.equal(gesture.move(201,350,620),null);
});
test("FIRE thumb camera movement clamps extreme deltas and resets cleanly",()=>{
 const gesture=new FireLookGesture();
 gesture.begin(3,100,100);
 assert.deepEqual(gesture.move(3,999,-999),{dx:65,dy:-65});
 gesture.reset();
 assert.equal(gesture.active,false);
 assert.equal(gesture.begin(4,300,300),true);
 assert.deepEqual(gesture.move(4,305,296),{dx:5,dy:-4});
});
