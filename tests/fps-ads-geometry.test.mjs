import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {WeaponViewmodel} from "../src/combat/WeaponViewmodel.ts";

function build(aspect,ads){
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(ads?54:76,aspect,.06,185);
  const model=new WeaponViewmodel(camera,scene);
  model.setVisible(true);
  for(let i=0;i<100;i++)model.update(1/60,ads);
  camera.updateMatrixWorld(true);
  return {scene,camera,model};
}

test("FPS ADS: center aiming corridor stays clear in iPhone portrait",()=>{
  const {camera,model}=build(390/844,true);
  assert.equal(model.isTargetCorridorClear(),true,
    "Solid blaster geometry blocks the iPhone center target corridor");
  assert.ok(model.sightProjectionError()<1e-5,
    "Open holo sight must project to exact camera center");
  const target=new THREE.Vector3(0,0,-10).project(camera);
  assert.ok(Math.abs(target.x)<1e-6&&Math.abs(target.y)<1e-6,
    "Ten-meter target must project behind centered sight");
  model.dispose();
});

test("FPS ADS: no obstructed aim in iPhone landscape or desktop",()=>{
  for(const aspect of [844/390,16/9]){
    for(const ads of [true,false]){
      const {model}=build(aspect,ads);
      assert.equal(model.isTargetCorridorClear(),true,
        `Opaque gun obscures central firing cone: aspect=${aspect}, ads=${ads}`);
      model.dispose();
    }
  }
});

test("FPS sight remains geometrically aligned after yaw/pitch and animation",()=>{
  const {camera,model}=build(390/844,true);
  camera.rotation.order="YXZ";
  camera.rotation.set(-.2,.43,0);
  camera.updateMatrixWorld(true);
  assert.ok(model.sightProjectionError()<1e-5);
  assert.equal(model.isTargetCorridorClear(),true);
  model.fire();
  for(let i=0;i<10;i++){
    model.update(1/60,true);
    assert.equal(model.isTargetCorridorClear(),true,
      "Recoil/flash must never obscure target corridor");
  }
  model.dispose();
});

test("FPS viewmodel cleanly removes meshes from camera on dispose",()=>{
  const {camera,model}=build(.5,true);
  assert.ok(camera.children.length>=2);
  model.dispose();
  assert.equal(camera.children.length,0);
});
