import {HUD_STORAGE_KEY,defaultLayout,parseHudLayout,
  type HudLayoutV1,type HudDevice,type HudProfile,copyProfile} from "./hudLayoutModel";
export function loadHudLayouts():HudLayoutV1{
  try{
    const raw=localStorage.getItem(HUD_STORAGE_KEY);
    if(raw){const parsed=parseHudLayout(JSON.parse(raw));if(parsed)return parsed;}
  }catch{ /* private browsing or damaged data: safe default */ }
  return defaultLayout();
}
export function saveHudLayouts(layout:HudLayoutV1):boolean{
  const safe=parseHudLayout(layout);
  if(!safe)return false;
  safe.updatedAt=Date.now();
  try{localStorage.setItem(HUD_STORAGE_KEY,JSON.stringify(safe));return true}
  catch{return false}
}
/** Save is atomic at profile granularity, only after the user confirms. */
export function saveHudProfile(device:HudDevice,profile:HudProfile):boolean{
  const next=loadHudLayouts();
  next.profiles[device]=copyProfile(profile);
  return saveHudLayouts(next);
}
