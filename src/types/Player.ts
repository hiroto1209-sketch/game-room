export type Vector2 = { x: number; y: number };
export type Vector3 = { x: number; y: number; z: number };
export type PlayerId = string;
export interface PlayerSnapshot {
  id: PlayerId;
  displayName: string;
  position: Vector3;
  yaw: number;
  pitch: number;
  sequence: number;
}
export interface Collider { x0:number;x1:number;z0:number;z1:number }
export function safeDisplayName(name:unknown):string{
  if(typeof name!=="string")return "Guest";
  const value=name.trim().replace(/[<>\u0000-\u001f]/g,"").slice(0,24);
  return value||"Guest";
}
export function isFiniteVector3(value:unknown):value is Vector3{
  if(typeof value!=="object"||value===null)return false;
  const v=value as Record<string,unknown>;
  return ["x","y","z"].every(k=>typeof v[k]==="number"&&Number.isFinite(v[k])&&Math.abs(v[k])<=10000);
}
