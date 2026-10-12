import test from "node:test";
import assert from "node:assert/strict";
import {HUD_IDS,HUD_DEVICES,HUD_REFERENCE,defaultProfile,defaultLayout,
  detectHudDevice,parseHudLayout,validHudPlacement,validateWholeHudProfile,
  copyProfile,validHudControl} from "../src/ui/hudLayoutModel.ts";

test("all four iPhone/iPad defaults are collision-free at reference dimensions",()=>{
  for(const device of HUD_DEVICES){
    const size=HUD_REFERENCE[device],p=defaultProfile(device);
    for(const key of HUD_IDS){
      assert.equal(validHudPlacement(p,key,size.width,size.height),true,
        device+" "+key+" initial control is unsafe");
    }
    assert.equal(validateWholeHudProfile(p,size.width,size.height),true);
  }
});
test("automatic detection supports iPadOS touch / orientation / override",()=>{
  assert.equal(detectHudDevice(390,844,true),"phonePortrait");
  assert.equal(detectHudDevice(844,390,true),"phoneLandscape");
  assert.equal(detectHudDevice(820,1180,true),"padPortrait");
  assert.equal(detectHudDevice(1180,820,true),"padLandscape");
  assert.equal(detectHudDevice(1180,820,false),"phoneLandscape");
  assert.equal(detectHudDevice(900,550,true,"pad"),"padLandscape");
});
test("saved HUD profiles are sanitized and remain independent",()=>{
  const layout=defaultLayout();
  layout.profiles.phonePortrait.fire.x=.77;
  layout.profiles.padLandscape.fire.opacity=.5;
  const parsed=parseHudLayout(JSON.parse(JSON.stringify(layout)));
  assert.ok(parsed);
  assert.equal(parsed.profiles.phonePortrait.fire.x,.77);
  assert.equal(parsed.profiles.phoneLandscape.fire.x,defaultProfile("phoneLandscape").fire.x);
  assert.equal(parsed.profiles.padLandscape.fire.opacity,.5);
  parsed.profiles.phonePortrait.fire.x=.5;
  assert.equal(layout.profiles.phonePortrait.fire.x,.77);
});
test("malformed, old and unsafe saved values are rejected",()=>{
  const valid=defaultLayout();
  assert.equal(parseHudLayout({version:2,profiles:valid.profiles}),null);
  assert.equal(parseHudLayout({version:1,profiles:{}}),null);
  valid.profiles.phonePortrait.fire.x=NaN;
  assert.equal(parseHudLayout(valid),null);
  valid.profiles.phonePortrait.fire.x=.7;
  valid.profiles.phonePortrait.fire.opacity=.02;
  assert.equal(parseHudLayout(valid),null);
  assert.equal(validHudControl({x:0,y:0,sizePx:44,opacity:.35}),true);
});
test("editor refuses overlaps, crosshair occlusion and out-of-bounds controls",()=>{
  const p=copyProfile(defaultProfile("phonePortrait"));
  p.fire={...p.ads};
  assert.equal(validHudPlacement(p,"fire",390,844),false);
  p.fire.x=.5;p.fire.y=.5;
  assert.equal(validHudPlacement(p,"fire",390,844),false);
  p.fire.x=.99;p.fire.y=.95;
  assert.equal(validHudPlacement(p,"fire",390,844),false);
});
