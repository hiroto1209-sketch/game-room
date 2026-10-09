import { isFiniteVector3, safeDisplayName, type PlayerSnapshot } from "../types/Player.ts";
export const MAX_MESSAGE_BYTES=4096;
export const MAX_ROOM_STATE_BYTES=150000;
export const MAX_SHARED_IMAGE_CHARS=110000;
export type RoomSharedState={type:"room_state";revision:number;monitorImage:string|null;lightShow:boolean};
export type RoomStateUpdate={type:"room_update";key:"monitorImage";value:string|null}
  | {type:"room_update";key:"lightShow";value:boolean};
export function validSharedImage(value:unknown):value is string|null{
  return value===null || (typeof value==="string"&&value.length<=MAX_SHARED_IMAGE_CHARS
    && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value));
}
export const ROOM_ID_PATTERN=/^[A-Za-z0-9_-]{32}$/;
export const PLAYER_ID_PATTERN=/^[A-Za-z0-9_-]{8,64}$/;
export type IncomingMessage=
  | {type:"welcome";playerId:string;roomId:string}
  | {type:"snapshot";players:PlayerSnapshot[]}
  | {type:"joined";player:PlayerSnapshot}
  | {type:"left";playerId:string}
  | {type:"error";reason:string}
  | RoomSharedState;
export type OutgoingMessage=
  | {type:"join";roomId:string;displayName:string}
  | {type:"move";position:{x:number;y:number;z:number};yaw:number;pitch:number;sequence:number}
  | RoomStateUpdate;
export function createRoomId():string{
  const bytes=new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out="";
  for(let i=0;i<bytes.length;i+=3){
    const n=(bytes[i]<<16)|(bytes[i+1]<<8)|bytes[i+2];
    out+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+alphabet[(n>>>6)&63]+alphabet[n&63];
  }
  return out;
}
export function isValidRoomId(value:unknown):value is string{
  return typeof value==="string"&&ROOM_ID_PATTERN.test(value);
}
function validPlayer(value:unknown):value is PlayerSnapshot{
  if(!value||typeof value!=="object")return false;
  const v=value as Record<string,unknown>;
  return typeof v.id==="string"&&PLAYER_ID_PATTERN.test(v.id)
   &&typeof v.displayName==="string"&&v.displayName.length<=80
   &&isFiniteVector3(v.position)
   &&typeof v.yaw==="number"&&Number.isFinite(v.yaw)&&Math.abs(v.yaw)<=1e6
   &&typeof v.pitch==="number"&&Number.isFinite(v.pitch)&&Math.abs(v.pitch)<=Math.PI
   &&Number.isSafeInteger(v.sequence)&&Number(v.sequence)>=0;
}
/** Reject arbitrary JSON, malformed identities, oversized packets and non-finite world positions. */
export function parseIncoming(raw:string):IncomingMessage|null{
  if(typeof raw!=="string"||raw.length>MAX_ROOM_STATE_BYTES)return null;
  // Oversize frames must be room-state messages, not unbounded player messages.
  if(raw.length>MAX_MESSAGE_BYTES&&!raw.startsWith('{"type":"room_state",'))return null;
  let parsed:unknown;
  try{parsed=JSON.parse(raw)}catch{return null}
  if(!parsed||typeof parsed!=="object")return null;
  const o=parsed as Record<string,unknown>;
  if(o.type==="room_state"&&Number.isSafeInteger(o.revision)&&Number(o.revision)>=0
    &&typeof o.lightShow==="boolean"&&validSharedImage(o.monitorImage))
    return {type:"room_state",revision:Number(o.revision),monitorImage:o.monitorImage,lightShow:o.lightShow};
  if(o.type==="welcome"&&typeof o.playerId==="string"&&PLAYER_ID_PATTERN.test(o.playerId)&&isValidRoomId(o.roomId))
    return {type:"welcome",playerId:o.playerId,roomId:o.roomId};
  if(o.type==="snapshot"&&Array.isArray(o.players)&&o.players.length<=24&&o.players.every(validPlayer))
    return {type:"snapshot",players:o.players.map(p=>({...p,displayName:safeDisplayName(p.displayName)}))};
  if(o.type==="joined"&&validPlayer(o.player))
    return {type:"joined",player:{...o.player,displayName:safeDisplayName(o.player.displayName)}};
  if(o.type==="left"&&typeof o.playerId==="string"&&PLAYER_ID_PATTERN.test(o.playerId))
    return {type:"left",playerId:o.playerId};
  if(o.type==="error"&&typeof o.reason==="string")
    return {type:"error",reason:o.reason.slice(0,120)};
  return null;
}
export function validateOutgoing(message:OutgoingMessage):boolean{
  if(message.type==="room_update")return message.key==="lightShow"?
    typeof message.value==="boolean":message.key==="monitorImage"&&validSharedImage(message.value);
  if(message.type==="join")
    return isValidRoomId(message.roomId)&&safeDisplayName(message.displayName)===message.displayName;
  return isFiniteVector3(message.position)&&Number.isFinite(message.yaw)
    &&Number.isFinite(message.pitch)&&Number.isSafeInteger(message.sequence)&&message.sequence>=0;
}
