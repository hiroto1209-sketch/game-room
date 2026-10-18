import {aimDirection, raySphereDistance, DAMAGE, MAX_HP, RANGE} from "./combatRules.js";

/** Stationary shared targets on the open floor of the imported FPS map. */
export const FOE_RESPAWN_MS=6500;
export const FOE_SLOTS=[
  {id:"fpsfoe01",x:124,z:-10},
  {id:"fpsfoe02",x:124,z:-6},
  {id:"fpsfoe03",x:124,z:-2}
];
export const FOE_IDS=FOE_SLOTS.map(s=>s.id);

export function foeSlot(id){
  return FOE_SLOTS.find(s=>s.id===id)??null;
}
export function foeEye(id){
  const slot=foeSlot(id);
  return slot?{x:slot.x,y:1.65,z:slot.z}:null;
}
export function freshFoes(){
  return FOE_SLOTS.map(s=>({id:s.id,hp:MAX_HP,downUntil:0}));
}
function validFoe(f){
  return !!f&&typeof f==="object"&&FOE_IDS.includes(f.id)
    &&Number.isInteger(f.hp)&&f.hp>=0&&f.hp<=MAX_HP
    &&typeof f.downUntil==="number"&&Number.isFinite(f.downUntil)&&f.downUntil>=0&&f.downUntil<=1e15;
}
export function validFoeList(foes){
  if(!Array.isArray(foes)||foes.length!==FOE_IDS.length)return false;
  return FOE_IDS.every(id=>foes.some(f=>f.id===id&&validFoe(f)));
}
export function reviveFoes(foes,now){
  return foes.map(f=>f.hp<=0&&f.downUntil>0&&now>=f.downUntil?{...f,hp:MAX_HP,downUntil:0}:f);
}
export function findFoeHit(origin,yaw,pitch,foes,occluded=()=>false){
  const dir=aimDirection(yaw,pitch);
  let best=null,dist=RANGE+1,point=null;
  for(const foe of foes){
    if(!foe||foe.hp<=0)continue;
    const eye=foeEye(foe.id);
    if(!eye)continue;
    const body=raySphereDistance(origin,dir,{x:eye.x,y:eye.y-.80,z:eye.z},.59);
    const head=raySphereDistance(origin,dir,{x:eye.x,y:eye.y-.12,z:eye.z},.31);
    const hit=Math.min(body??Infinity,head??Infinity);
    if(!(hit<=RANGE)||hit>=dist)continue;
    const at={x:origin.x+dir.x*hit,y:origin.y+dir.y*hit,z:origin.z+dir.z*hit};
    if(occluded(origin,at))continue;
    best=foe;dist=hit;point=at;
  }
  return best?{id:best.id,damage:DAMAGE,point,distance:dist}:null;
}
export function applyFoeDamage(foes,id,now){
  const next=reviveFoes(foes,now).map(f=>({...f}));
  const foe=next.find(f=>f.id===id);
  if(!foe||foe.hp<=0)return {foes:next,damage:0};
  foe.hp=Math.max(0,foe.hp-DAMAGE);
  if(foe.hp===0)foe.downUntil=now+FOE_RESPAWN_MS;
  return {foes:next,damage:DAMAGE};
}
export function publicFoes(foes){
  return FOE_IDS.map(id=>{
    const foe=foes.find(f=>f.id===id);
    return {id,hp:foe?.hp??MAX_HP,downUntil:foe?.downUntil??0};
  });
}
