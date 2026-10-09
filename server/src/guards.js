// Pure protocol/security helpers shared with Node unit tests (no Worker globals).
export const ROOM_ID=/^[A-Za-z0-9_-]{32}$/;
export const MAX_PLAYERS=8;
export const MAX_PACKET_BYTES=4096;
export const MAX_NAME_LENGTH=24;
export function safeName(value){
  if(typeof value!=="string")return "Guest";
  return value.replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,MAX_NAME_LENGTH)||"Guest";
}
export function validRoomId(value){return typeof value==="string"&&ROOM_ID.test(value)}
export function validPosition(p){
  return p!==null&&typeof p==="object"&&["x","y","z"].every(k=>typeof p[k]==="number"&&Number.isFinite(p[k]))
    &&p.x>=-10&&p.x<=10&&p.y>=1.60&&p.y<=4.9&&p.z>=-16&&p.z<=18;
}
export function decodeMessage(raw){
  if(typeof raw!=="string"||new TextEncoder().encode(raw).byteLength>MAX_PACKET_BYTES)return null;
  try{
    const m=JSON.parse(raw);
    if(!m||typeof m!=="object"||Array.isArray(m))return null;
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
  if(!validPosition(next))return false;
  const dx=next.x-prev.x,dy=next.y-prev.y,dz=next.z-prev.z;
  const horizontal=Math.hypot(dx,dz);
  // Generous tolerance for frame stalls and normal speed ~4.2m/s; not full authoritative physics.
  return horizontal<=Math.max(.45,Math.min(2.5,elapsedMs*.009))+0.3 && Math.abs(dy)<=2.5;
}
