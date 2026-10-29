import {aimDirection, raySphereDistance} from "./combatRules.js";
import {stageBlocked, stageGround} from "./playcanvasRules.js";

/** Flat, open floor inside the FPS stage. The building collision stays. */
export const GROVE = {minX:120.6, maxX:135.2, minZ:-13.2, maxZ:-4.4};
export const STONE = {x:123.2, z:-5.6};
export const GUIDE = {x:123.0, z:-12.4};
export const SMITH = {x:128.6, z:-12.4};
export const GROVE_BODY = 25;
export const GROVE_RANK_STEP = 8;

export const KINDS = {
  rush: {hp:78, speed:3.6, range:1.55, aggro:12, damage:8, cooldown:1.05, radius:.5, height:1.55, weak:.22},
  spit: {hp:60, speed:2.15, range:8.2, aggro:14, damage:11, cooldown:1.7, radius:.46, height:1.75, weak:.26, minRange:4.4},
  elite: {hp:240, speed:1.65, range:2.15, aggro:15, damage:18, cooldown:1.55, radius:.95, height:2.15, weak:.38}
};

const WAVES = [
  ["rush", "rush", "rush"],
  ["rush", "rush", "spit", "spit"],
  ["rush", "spit", "elite"]
];

export function inGrove(p){
  return !!p && p.x>=GROVE.minX && p.x<=GROVE.maxX && p.z>=GROVE.minZ && p.z<=GROVE.maxZ;
}
export function nearStone(p){
  return !!p && Math.hypot(p.x-STONE.x, p.z-STONE.z)<3.1;
}
export function freshGrove(){
  return {wave:0, phase:"idle", kills:0, eliteDown:false, nextId:1, monsters:[]};
}
export function shotDamage(rank){
  return GROVE_BODY + Math.max(0, Math.min(2, rank|0)) * GROVE_RANK_STEP;
}
export function rankForKills(kills){
  return Math.max(0, Math.min(2, Math.floor(Math.max(0, kills)/4)));
}

function lane(kind, index){
  if(kind==="spit") return {ax:124.2, az:-6.6, bx:133.4, bz:-6.4};
  if(kind==="elite") return {ax:129.2, az:-7.6, bx:132.4, bz:-8.2};
  const z = -9.2 - (index%2)*.6;
  return {ax:122.6, az:z, bx:133.2, bz:z};
}
function specOf(kind){return KINDS[kind]??KINDS.rush}

export function beginWave(state){
  if(state.phase==="fight") return state;
  const wave = state.wave>=3 && state.phase==="clear" ? 3 : Math.min(3, state.wave+1);
  const kinds = WAVES[wave-1];
  const monsters = kinds.map((kind, index)=>{
    const path = lane(kind, index);
    const spec = specOf(kind);
    return {
      id: state.nextId+index, kind, hp:spec.hp, maxHp:spec.hp,
      x:path.ax+index*.35, z:path.az, yaw:0, state:"patrol",
      cooldown:0.4+index*.15, wind:0, stagger:0, deadFor:0, patrol:index%2,
      ax:path.ax, az:path.az, bx:path.bx, bz:path.bz
    };
  });
  return {...state, wave, phase:"fight", nextId:state.nextId+kinds.length, monsters};
}

function footAt(x, z, foot){
  const g = stageGround(x, z, foot+0.45);
  if(g===null || Math.abs(g-foot)>0.4) return null;
  if(stageBlocked(x, z, 0.42, g+1.65)) return null;
  if(x<GROVE.minX||x>GROVE.maxX||z<GROVE.minZ||z>GROVE.maxZ) return null;
  return g;
}
function tryMove(m, dx, dz, dt){
  const foot = stageGround(m.x, m.z, 0.8) ?? 0;
  const nx = m.x+dx*dt, nz = m.z+dz*dt;
  if(footAt(nx, nz, foot)!==null){m.x=nx; m.z=nz; return;}
  if(footAt(nx, m.z, foot)!==null){m.x=nx; return;}
  if(footAt(m.x, nz, foot)!==null) m.z=nz;
}
function nearest(monsters, m, players){
  let best=null, dist=1e9;
  for(const p of players){
    if(!p || p.hp<=0) continue;
    const d=Math.hypot(p.x-m.x, p.z-m.z);
    if(d<dist){dist=d; best=p;}
  }
  return {best, dist};
}

/** Advance monster AI. `players` are {id,x,z,hp}. Returns the next state and hurt events. */
export function stepGrove(state, dt, players){
  const step=Math.max(0, Math.min(0.25, dt));
  if(state.phase!=="fight") return {state, events:[]};
  const events=[];
  const monsters=state.monsters.map(raw=>({...raw}));
  let kills=state.kills, eliteDown=state.eliteDown;
  for(const m of monsters){
    if(m.hp<=0){
      m.state="dead";
      m.deadFor+=step;
      continue;
    }
    if(m.stagger>0){
      m.stagger=Math.max(0, m.stagger-step);
      m.state="stagger";
      continue;
    }
    const spec=specOf(m.kind);
    const {best, dist}=nearest(monsters, m, players);
    if(m.wind>0){
      m.wind=Math.max(0, m.wind-step);
      m.state="attack";
      if(m.wind===0){
        const hitRange=spec.range+(m.kind==="spit"?0.8:0.35);
        if(best && dist<=hitRange) events.push({type:"hurt", playerId:best.id, damage:spec.damage, monsterId:m.id, kind:m.kind});
        m.cooldown=spec.cooldown;
      }
      continue;
    }
    if(m.cooldown>0) m.cooldown=Math.max(0, m.cooldown-step);
    const seen=best && dist<=spec.aggro;
    if(!seen){
      m.state="patrol";
      const goal=m.patrol?{x:m.bx,z:m.bz}:{x:m.ax,z:m.az};
      const dx=goal.x-m.x, dz=goal.z-m.z;
      if(Math.hypot(dx, dz)<0.45) m.patrol=m.patrol?0:1;
      else{
        m.yaw=Math.atan2(dx, dz);
        tryMove(m, Math.sin(m.yaw)*spec.speed*0.55, Math.cos(m.yaw)*spec.speed*0.55, step);
      }
      continue;
    }
    m.yaw=Math.atan2(best.x-m.x, best.z-m.z);
    const minRange=spec.minRange??0;
    if(dist>spec.range || (minRange && dist<minRange*0.85)){
      m.state="chase";
      const away=minRange && dist<minRange ? -1 : 1;
      tryMove(m, Math.sin(m.yaw)*spec.speed*away, Math.cos(m.yaw)*spec.speed*away, step);
      continue;
    }
    m.state="attack";
    if(m.cooldown<=0) m.wind=m.kind==="elite"?0.62:0.42;
  }
  const living=monsters.filter(m=>m.hp>0 || m.deadFor<1.15);
  const alive=living.some(m=>m.hp>0);
  let phase=state.phase;
  if(!alive){
    phase="clear";
    for(const m of monsters) if(m.kind==="elite" && m.hp<=0) eliteDown=true;
  }
  return {state:{...state, phase, kills, eliteDown, monsters:living}, events};
}

export function monsterFoot(m){
  return stageGround(m.x, m.z, 0.8) ?? 0;
}

/** Server- and solo-shared hitscan. Rank is 0..2. Does not trust a client target id. */
export function shootGrove(state, origin, yaw, pitch, rank=0){
  if(!origin || state.phase!=="fight") return null;
  const dir=aimDirection(yaw, pitch);
  let best=null;
  for(const m of state.monsters){
    if(m.hp<=0) continue;
    const spec=specOf(m.kind);
    const foot=monsterFoot(m);
    const body=raySphereDistance(origin, dir, {x:m.x, y:foot+spec.height*0.48, z:m.z}, spec.radius);
    const weak=raySphereDistance(origin, dir, {x:m.x, y:foot+spec.height*0.95, z:m.z}, spec.weak);
    const crit=weak!==null && (body===null || weak<=body+0.02);
    const hit=crit?weak:body;
    if(hit===null || hit>28) continue;
    if(!best || hit<best.hit) best={m, hit, crit};
  }
  if(!best) return null;
  const amount=(shotDamage(rank))*(best.crit?2:1);
  const monsters=state.monsters.map(raw=>{
    if(raw.id!==best.m.id) return raw;
    const hp=Math.max(0, raw.hp-amount);
    return {...raw, hp, state:hp<=0?"dead":"stagger", stagger:hp<=0?0:0.28, deadFor:0};
  });
  const killed=best.m.hp-amount<=0;
  let kills=state.kills+(killed?1:0);
  let eliteDown=state.eliteDown || (killed && best.m.kind==="elite");
  const point={
    x:origin.x+dir.x*best.hit,
    y:origin.y+dir.y*best.hit,
    z:origin.z+dir.z*best.hit
  };
  const next={...state, monsters, kills, eliteDown};
  const cleared=!monsters.some(m=>m.hp>0);
  if(cleared) next.phase="clear";
  return {
    state:next,
    distance:best.hit,
    id:best.m.id,
    kind:best.m.kind,
    damage:amount,
    crit:best.crit,
    hp:Math.max(0, best.m.hp-amount),
    killed,
    point
  };
}

export function questCopy(state){
  if(state.phase==="idle") return {title:"森の試し", body:"召喚石に触れて、最初の波を呼べ"};
  if(state.phase==="fight") return {title:"第"+state.wave+"波", body:"倒した数 "+state.kills};
  if(state.wave>=3 && state.eliteDown) return {title:"森の試し", body:"オオガマを倒した。石でもう一度呼べる"};
  return {title:"波を突破", body:"召喚石で次の波へ。倒した数 "+state.kills};
}
export function guideLines(state){
  if(state.eliteDown) return ["モリビト", "オオガマが沈んだ。この森は、今日は君たちのものだ。"];
  if(state.kills>=4) return ["モリビト", "いい狙いだ。リンに会えば、弾が少し重くなる。"];
  if(state.phase==="fight") return ["モリビト", "ツノワラは突進、モヤビは離れて吐く。オオガマの金の目を撃て。"];
  return ["モリビト", "召喚石に触れろ。三つの波のあと、大きなのが来る。"];
}
export function smithLines(state, rank){
  const next=rankForKills(state.kills);
  if(next>rank) return ["リン", "弾を鍛え直した。弱点に当たればさらに重い。"];
  if(rank>=2) return ["リン", "これ以上は磨けない。あとは狙いだけだ。"];
  return ["リン", "4体倒すごとに弾を重くする。今は"+state.kills+"体だ。"];
}

export function viewOf(state){
  return {
    wave:state.wave, phase:state.phase, kills:state.kills, eliteDown:state.eliteDown===true,
    monsters:state.monsters.map(m=>({
      id:m.id, kind:m.kind, hp:m.hp, maxHp:m.maxHp, x:round3(m.x), z:round3(m.z),
      yaw:round3(m.yaw), state:m.state
    }))
  };
}
function round3(n){return Math.round(n*1000)/1000}

const KIND_SET=new Set(["rush","spit","elite"]);
const STATE_SET=new Set(["idle","patrol","chase","attack","stagger","dead"]);
export function validGroveView(value){
  if(!value||typeof value!=="object") return false;
  const v=value;
  if(!Number.isInteger(v.wave)||v.wave<0||v.wave>3) return false;
  if(!["idle","fight","clear"].includes(v.phase)) return false;
  if(!Number.isInteger(v.kills)||v.kills<0||v.kills>999) return false;
  if(typeof v.eliteDown!=="boolean") return false;
  if(!Array.isArray(v.monsters)||v.monsters.length>8) return false;
  return v.monsters.every(m=>m&&KIND_SET.has(m.kind)&&STATE_SET.has(m.state)
    && Number.isInteger(m.id)&&m.id>0&&m.id<100000
    && Number.isInteger(m.hp)&&m.hp>=0&&m.hp<=500
    && Number.isInteger(m.maxHp)&&m.maxHp>=m.hp&&m.maxHp<=500
    && Number.isFinite(m.x)&&Number.isFinite(m.z)&&Number.isFinite(m.yaw)
    && Math.abs(m.x)<400&&Math.abs(m.z)<400&&Math.abs(m.yaw)<20);
}
