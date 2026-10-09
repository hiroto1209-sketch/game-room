import {validSignText} from "../../shared/combatRules.js";
import { validWorldPosition, validWorldStep } from "../../shared/worldRules.js";
// Pure protocol/security helpers shared with Node unit tests (no Worker globals).
export const ROOM_ID=/^[A-Za-z0-9_-]{32}$/;
export const MAX_PLAYERS=8;
export const MAX_PACKET_BYTES=4096;
// Shared JPEG is deliberately downscaled and bounded; this is a prototype, not R2 storage.
export const MAX_SHARED_IMAGE_CHARS=110000;
export const MAX_SHARED_PACKET_BYTES=150000;
export function validSharedImage(value){
  return value===null || (
    typeof value==="string" && value.length<=MAX_SHARED_IMAGE_CHARS
    && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value)
  );
}
export const MAX_NAME_LENGTH=24;
export function safeName(value){
  if(typeof value!=="string")return "Guest";
  return value.replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,MAX_NAME_LENGTH)||"Guest";
}
export function validRoomId(value){return typeof value==="string"&&ROOM_ID.test(value)}
export function validPosition(p){return validWorldPosition(p)}
export function decodeMessage(raw){
  if(typeof raw!=="string"||raw.length>MAX_SHARED_PACKET_BYTES)return null;
  // A large frame is allowed only for explicit bounded JPEG room-update messages.
  if(raw.length>MAX_PACKET_BYTES && !raw.startsWith('{"type":"room_update","key":"monitorImage",'))return null;
  try{
    const m=JSON.parse(raw);
    if(!m||typeof m!=="object"||Array.isArray(m))return null;
    if(m.type==="room_update" && m.key==="monitorImage" && validSharedImage(m.value))
      return {type:"room_update",key:"monitorImage",value:m.value};
    if(m.type==="room_update" && m.key==="lightShow" && typeof m.value==="boolean")
      return {type:"room_update",key:"lightShow",value:m.value};
    if(m.type==="room_update" && m.key==="signText" && validSignText(m.value))
      return {type:"room_update",key:"signText",value:m.value.trim()||"WELCOME TO GAME ROOM"};
    if(m.type==="fire" && Number.isSafeInteger(m.sequence) && m.sequence>0 && m.sequence<=1000000000
      && typeof m.yaw==="number"&&Number.isFinite(m.yaw)&&Math.abs(m.yaw)<=1e6
      && typeof m.pitch==="number"&&Number.isFinite(m.pitch)&&Math.abs(m.pitch)<=1.22)
      return {type:"fire",sequence:m.sequence,yaw:m.yaw,pitch:m.pitch};
    if(m.type==="join"&&validRoomId(m.roomId)&&typeof m.displayName==="string"&&m.displayName.length<=80)
      return {type:"join",roomId:m.roomId,displayName:safeName(m.displayName)};
    if(m.type==="move"&&validPosition(m.position)&&typeof m.yaw==="number"&&Number.isFinite(m.yaw)
      &&Math.abs(m.yaw)<=1e6&&typeof m.pitch==="number"&&Number.isFinite(m.pitch)
      &&Math.abs(m.pitch)<=1.22&&Number.isSafeInteger(m.sequence)&&m.sequence>=0)
      return {type:"move",position:{...m.position},yaw:m.yaw,pitch:m.pitch,sequence:m.sequence};
    return null;
  }catch{return null}
}
export function permittedOrigin(value){
  return value==="https://hiroto1209-sketch.github.io" || value==="http://localhost:5173" || value==="http://127.0.0.1:5173";
}
export function withinMovementSpeed(prev,next,elapsedMs){
  if(!validWorldStep(prev,next))return false;
  const dx=next.x-prev.x,dy=next.y-prev.y,dz=next.z-prev.z;
  const horizontal=Math.hypot(dx,dz);
  // Generous tolerance for frame stalls and normal speed ~4.2m/s; not full authoritative physics.
  return horizontal<=Math.max(.45,Math.min(2.5,elapsedMs*.009))+0.3 && Math.abs(dy)<=2.5;
}
