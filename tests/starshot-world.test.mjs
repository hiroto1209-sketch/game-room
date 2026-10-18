import test from "node:test";
import assert from "node:assert/strict";
import {STOPS,routeInfo,mapCoord} from "../src/ui/WorldGuide.ts";

test("World route guide gives distances and meaningful relative direction",()=>{
  assert.ok(STOPS.length>=5);
  assert.equal(STOPS.some(stop=>/STARSHOT|CO-OP|ATM|PLAZA/i.test(stop.label)),false);
  const east=routeInfo({x:0,z:0},0,{id:"e",label:"E",x:10,z:0,symbol:"+"});
  assert.ok(east.distance===10);
  assert.ok(Math.abs(east.angleDeg-90)<1e-8);
  const forward=routeInfo({x:0,z:0},0,{id:"f",label:"F",x:0,z:-10,symbol:"+"});
  assert.ok(forward.angleDeg<.01||forward.angleDeg>359.99);
  assert.equal(forward.arrived,false);
  assert.equal(routeInfo({x:2,z:2},0,{id:"f",label:"F",x:2,z:2,symbol:"+"}).arrived,true);
  const p=mapCoord(0,0);
  assert.ok(p.x>0&&p.x<320&&p.y>0&&p.y<224);
});
