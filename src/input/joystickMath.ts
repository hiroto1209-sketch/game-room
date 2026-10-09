import type { Vector2 } from "../types/Player";
export function joystickVector(dx:number,dy:number,radius=60,deadZone=.1):Vector2{
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||radius<=0)return{x:0,y:0};
  const distance=Math.hypot(dx,dy);
  const normalized=Math.min(1,distance/radius);
  const power=normalized<deadZone?0:(normalized-deadZone)/(1-deadZone);
  if(distance===0||power===0)return{x:0,y:0};
  return{x:dx/distance*power,y:-dy/distance*power};
}
