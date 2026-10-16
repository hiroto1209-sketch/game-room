import {aimDirection, raySphereDistance, DAMAGE, MAX_HP, RANGE} from "./combatRules.js";

/** Flat north yard. Positions are fixed so the Worker and every phone agree. */
export const COOP_PLAZA={minX:14,maxX:23,minZ:34,maxZ:46};
export const FOE_RESPAWN_MS=6500;
export const FOE_SLOTS=[
  {id:"plazafoe1",x:16,z:42},
  {id:"plazafoe2",x:19,z:43.2},
  {id:"plazafoe3",x:22,z:42}
];
export const FOE_IDS=FOE_SLOTS.map(s=>s.id);

export function inCoopPlaza(x,z){
  return Number.isFinite(x)&&Number.isFinite(z)
    &&x>=COOP_PLAZA.minX&&x<=COOP_PLAZA.maxX&&z>=COOP_PLAZA.minZ&&z<=COOP_PLAZA.maxZ;
}
export function foeSlot(id){
  return FOE_SLOTS.find(s=>s.id===id)??null;
}
export function foeEye(id){
  const slot=foeSlot(id);
  return slot?{x:slot.x,y:1.65,z:slot.z}:null;
}
export function freshFoes(){
  return FOE_SLOTS.map(s=>({id:s.id,hp:MAX_HP,downUntil:0,beaten:false}));
}
export function freshCoop(){
  return {enabled:false,cleared:false,foes:freshFoes()};
}
function validFoe(f){
  return !!f&&typeof f==="object"&&FOE_IDS.includes(f.id)
    &&Number.isInteger(f.hp)&&f.hp>=0&&f.hp<=MAX_HP
    &&typeof f.downUntil==="number"&&Number.isFinite(f.downUntil)&&f.downUntil>=0&&f.downUntil<=1e15
    &&typeof f.beaten==="boolean";
}
export function validCoopState(s){
  if(!s||typeof s!=="object"||typeof s.enabled!=="boolean"||typeof s.cleared!=="boolean")return false;
  if(!Array.isArray(s.foes)||s.foes.length!==FOE_IDS.length)return false;
  return FOE_IDS.every(id=>s.foes.some(f=>f.id===id&&validFoe(f)));
}
/** Co-op shots never damage players. PvP shots never damage these foes. */
export function fireTargetKind(coopEnabled){
  return coopEnabled?"foes":"players";
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
  return best?{id:best.id,damage:DAMAGE,point}:null;
}
export function applyFoeDamage(state,id,now){
  const foes=reviveFoes(state.foes,now).map(f=>({...f}));
  const foe=foes.find(f=>f.id===id);
  if(!foe||foe.hp<=0)return {state:{...state,foes},damage:0,justCleared:false};
  foe.hp=Math.max(0,foe.hp-DAMAGE);
  if(foe.hp===0){foe.downUntil=now+FOE_RESPAWN_MS;foe.beaten=true;}
  const cleared=foes.every(f=>f.beaten);
  const justCleared=cleared&&!state.cleared;
  return {state:{...state,foes,cleared:state.cleared||cleared},damage:DAMAGE,justCleared};
}
export function publicCoop(state){
  return {
    enabled:state.enabled===true,
    cleared:state.cleared===true,
    foes:FOE_IDS.map(id=>{
      const foe=state.foes.find(f=>f.id===id);
      return {id,hp:foe.hp,downUntil:foe.downUntil,beaten:foe.beaten===true};
    })
  };
}
