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
export function findHitscanTarget(shooter,players,yaw,pitch){
  const dir=aimDirection(yaw,pitch);
  let best=null,dist=RANGE+1;
  // One approximated chest and head sphere per eligible player.
  for(const p of players){
    if(p.id===shooter.id||p.hp<=0||!inArena(p.position))continue;
    const base=p.position;
    const body=raySphereDistance(shooter.position,dir,{x:base.x,y:base.y-.80,z:base.z},.59);
    const head=raySphereDistance(shooter.position,dir,{x:base.x,y:base.y-.12,z:base.z},.31);
    const hit=Math.min(body??Infinity,head??Infinity);
    if(hit<=RANGE&&hit<dist){best=p;dist=hit}
  }
  return best;
}
