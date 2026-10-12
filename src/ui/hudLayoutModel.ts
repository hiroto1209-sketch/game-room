/** HUD 10.0 — pure, versioned layout model. No DOM, networking or Three.js dependencies. */
export const HUD_IDS=["fire","ads","jump","emote","interact"] as const;
export type HudControlId=typeof HUD_IDS[number];
export const HUD_DEVICES=["phonePortrait","phoneLandscape","padPortrait","padLandscape"] as const;
export type HudDevice=typeof HUD_DEVICES[number];
export type HudControl={x:number;y:number;sizePx:number;opacity:number};
export type HudProfile=Record<HudControlId,HudControl>;
export type HudLayoutV1={version:1;profiles:Record<HudDevice,HudProfile>;updatedAt:number};
export const HUD_STORAGE_KEY="game-room-hud-layout-v1";
export const HUD_REFERENCE:Record<HudDevice,{width:number;height:number}>={
  phonePortrait:{width:390,height:844},
  phoneLandscape:{width:844,height:390},
  padPortrait:{width:820,height:1180},
  padLandscape:{width:1180,height:820}
};
const ctrl=(x:number,y:number,sizePx:number,opacity=.9):HudControl=>({x,y,sizePx,opacity});
const defaults:Record<HudDevice,HudProfile>={
 phonePortrait:{
  fire:ctrl(.73,.77,70),ads:ctrl(.73,.63,60),jump:ctrl(.90,.86,68),
  emote:ctrl(.89,.22,50),interact:ctrl(.52,.86,58)
 },
 phoneLandscape:{
  fire:ctrl(.78,.63,67),ads:ctrl(.64,.68,54),jump:ctrl(.90,.78,62),
  emote:ctrl(.88,.28,46),interact:ctrl(.55,.79,48)
 },
 padPortrait:{
  fire:ctrl(.82,.76,88),ads:ctrl(.82,.63,72),jump:ctrl(.92,.85,78),
  emote:ctrl(.92,.17,56),interact:ctrl(.64,.86,58)
 },
 padLandscape:{
  fire:ctrl(.85,.75,87),ads:ctrl(.73,.76,72),jump:ctrl(.94,.87,77),
  emote:ctrl(.93,.18,56),interact:ctrl(.62,.87,58)
 }
};
export function copyProfile(profile:HudProfile):HudProfile{
  return Object.fromEntries(HUD_IDS.map(id=>[id,{...profile[id]}])) as HudProfile;
}
export function defaultProfile(device:HudDevice):HudProfile{return copyProfile(defaults[device]);}
export function defaultLayout():HudLayoutV1{
  return {version:1,updatedAt:0,profiles:Object.fromEntries(
    HUD_DEVICES.map(key=>[key,defaultProfile(key)])) as Record<HudDevice,HudProfile>};
}
export function detectHudDevice(width:number,height:number,isTouch:boolean,mode:"auto"|"phone"|"pad"="auto"):HudDevice{
  const portrait=height>=width;
  // iPadOS may report a desktop UA, so prioritize touch capability + short-side viewport.
  const tablet=mode==="pad"||(mode==="auto"&&isTouch&&Math.min(width,height)>=650);
  return tablet?(portrait?"padPortrait":"padLandscape"):(portrait?"phonePortrait":"phoneLandscape");
}
export function validHudControl(value:unknown):value is HudControl{
  if(!value||typeof value!=="object")return false;
  const c=value as Record<string,unknown>;
  return ["x","y","sizePx","opacity"].every(k=>typeof c[k]==="number"&&Number.isFinite(c[k]))
    &&(c.x as number)>=0&&(c.x as number)<=1&&(c.y as number)>=0&&(c.y as number)<=1
    &&(c.sizePx as number)>=44&&(c.sizePx as number)<=112
    &&(c.opacity as number)>=.35&&(c.opacity as number)<=1;
}
export function validHudProfile(value:unknown):value is HudProfile{
  if(!value||typeof value!=="object")return false;
  return HUD_IDS.every(id=>validHudControl((value as Record<string,unknown>)[id]));
}
export function parseHudLayout(value:unknown):HudLayoutV1|null{
  if(!value||typeof value!=="object")return null;
  const input=value as Record<string,unknown>;
  if(input.version!==1||!input.profiles||typeof input.profiles!=="object")return null;
  if(!HUD_DEVICES.every(id=>validHudProfile((input.profiles as Record<string,unknown>)[id])))return null;
  return {version:1,updatedAt:typeof input.updatedAt==="number"&&Number.isFinite(input.updatedAt)?
    input.updatedAt:0,profiles:Object.fromEntries(HUD_DEVICES.map(key=>[
      key,copyProfile((input.profiles as Record<HudDevice,HudProfile>)[key])
    ])) as Record<HudDevice,HudProfile>};
}
export const clamp=(value:number,min:number,max:number):number=>Math.max(min,Math.min(max,value));
/** Use relative centers in the safe viewport, not device-specific absolute pixels. */
export function hudControlBox(control:HudControl,id:HudControlId,width:number,height:number,scale=1){
  const w=(id==="interact"?Math.max(100,control.sizePx*1.85):control.sizePx)*scale;
  const h=control.sizePx*scale;
  const x=control.x*width,y=control.y*height;
  return {x:x-w/2,y:y-h/2,width:w,height:h};
}
const overlaps=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number},gap=0)=>
  a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
export function validHudPlacement(profile:HudProfile,id:HudControlId,width:number,height:number,scale=1):boolean{
  const c=profile[id],box=hudControlBox(c,id,width,height,scale);
  const pad=8*scale;
  if(box.x<pad||box.y<pad||box.x+box.width>width-pad||box.y+box.height>height-pad)return false;
  // Protect center reticle and the header / fixed HP navigation region.
  const reticle={x:width/2-38*scale,y:height/2-38*scale,width:76*scale,height:76*scale};
  const topRight={x:width-84*scale,y:0,width:84*scale,height:82*scale};
  const info={x:0,y:0,width:Math.min(width*.46,205*scale),height:Math.min(height*.3,192*scale)};
  if(overlaps(box,reticle,4*scale)||overlaps(box,topRight)||overlaps(box,info))return false;
  for(const other of HUD_IDS)if(other!==id&&overlaps(box,hudControlBox(profile[other],other,width,height,scale),8*scale))return false;
  return true;
}
export function validateWholeHudProfile(profile:HudProfile,width:number,height:number,scale=1):boolean{
  return HUD_IDS.every(id=>validHudPlacement(profile,id,width,height,scale));
}
