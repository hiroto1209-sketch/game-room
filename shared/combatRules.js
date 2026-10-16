/** Shared deterministic arena and server-owned hitscan rules. No client hit claims. */
export const ARENA={minX:77,maxX:103,minZ:-47,maxZ:-30};
export const MAX_HP=100, DAMAGE=25, RANGE=28, SHOT_COOLDOWN_MS=400, RESPAWN_MS=4000, SPAWN_SHIELD_MS=2000;
export const ARENA_RESPAWN={x:88,y:1.65,z:-38};
export function inArena(p){
  return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.z)
    &&p.x>=ARENA.minX&&p.x<=ARENA.maxX&&p.z>=ARENA.minZ&&p.z<=ARENA.maxZ;
}
export function validSignText(value){
  return typeof value==="string"&&[...value].length<=80
    &&!/[<>\u0000-\u001f\u007f\u2028\u2029]/u.test(value);
}
export function signText(value){
  if(!validSignText(value))return null;
  return value.trim()||"WELCOME TO GAME ROOM";
}
export function aimDirection(yaw,pitch){
  return {x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
}
export function raySphereDistance(origin,dir,center,radius){
  const to={x:center.x-origin.x,y:center.y-origin.y,z:center.z-origin.z};
  const along=to.x*dir.x+to.y*dir.y+to.z*dir.z;
  const d2=to.x*to.x+to.y*to.y+to.z*to.z-along*along;
  if(d2>radius*radius||along<0)return null;
  const hit=along-Math.sqrt(Math.max(0,radius*radius-d2));
  return hit>=0?hit:null;
}
export function findHitscanTarget(shooter,players,yaw,pitch,occluded=()=>false){
  const dir=aimDirection(yaw,pitch);
  let best=null,dist=RANGE+1;
  // One approximated chest and head sphere per eligible player.
  for(const p of players){
    if(p.id===shooter.id||p.hp<=0)continue;
    const base=p.position;
    const body=raySphereDistance(shooter.position,dir,{x:base.x,y:base.y-.80,z:base.z},.59);
    const head=raySphereDistance(shooter.position,dir,{x:base.x,y:base.y-.12,z:base.z},.31);
    const hit=Math.min(body??Infinity,head??Infinity);
    if(hit<=RANGE&&hit<dist&&!occluded(shooter.position,{
      x:shooter.position.x+dir.x*hit,y:shooter.position.y+dir.y*hit,z:shooter.position.z+dir.z*hit
    })){best=p;dist=hit}
  }
  return best;
}

export const WEAPON_CODE="NEON777";
export function validUnlockCode(v){return typeof v==="string"&&v.length<=24&&/^[A-Z0-9]+$/.test(v)}

/** How far aim may move since the last accepted pose, in radians.
 * Scales with elapsed time so a finger flick between 10 Hz move packets
 * still counts, and caps at a half-turn so a stale pose cannot spin freely.
 */
export const LOOK_YAW_RATE=36, LOOK_PITCH_RATE=20;
export function angleDelta(from,to){
  return Math.atan2(Math.sin(to-from),Math.cos(to-from));
}
export function aimAllowance(elapsedMs){
  const t=Math.max(0,Number(elapsedMs)||0)/1000;
  return {
    yaw:Math.min(Math.PI,Math.max(.6,t*LOOK_YAW_RATE)),
    pitch:Math.min(1.15,Math.max(.45,t*LOOK_PITCH_RATE))
  };
}
export function aimWithinRate(previous,next,elapsedMs){
  if(!previous||!next)return false;
  const allow=aimAllowance(elapsedMs);
  return Math.abs(angleDelta(previous.yaw??0,next.yaw??0))<=allow.yaw+1e-6
    && Math.abs((next.pitch??0)-(previous.pitch??0))<=allow.pitch+1e-6;
}
