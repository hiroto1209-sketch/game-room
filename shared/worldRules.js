import {inArena} from "./combatRules.js";
/**
 * Deterministic geometry/navigation rules shared by Vite and Cloudflare Worker.
 * Coordinates are Three.js units; +X leads through the new east door.
 * No remote assets, randomness or browser-specific APIs.
 */
export const WORLD_SEED=419261;
// Exterior includes the land behind and around the PARTY HOUSE.
export const OUTDOOR={minX:-24,maxX:104,minZ:-48,maxZ:48,chunkSize:16,columns:6,rows:6};
export const HOUSE={main:{minX:-10,maxX:10,minZ:-16,maxZ:8},
  hall:{minX:-2.3,maxX:2.3,minZ:8,maxZ:18},
  armory:{minX:-5,maxX:5,minZ:18,maxZ:26}};
export const DOOR={x:10,minZ:-6.65,maxZ:-3.35};
export const POND={x:57,z:-27,rx:9.5,rz:7.0};
export const SPAWN={x:0,y:1.65,z:15};
// Bounded static hills: deterministic at every coordinate, no per-frame animation.
export function groundHeightAt(x,z){
  if(x<24)return 0; // preserve the original room and the entrance
  // Established paths, pond rim and combat plaza remain flat and walkable.
  const path1=Math.max(0,1-Math.abs(z+5)/6);
  const path2=x>=43&&x<=90?Math.max(0,1-Math.abs(z+40)/5):0;
  // Keep the entire shoreline flat so lake water is never buried by a hill.
  const pondRadius=Math.hypot((x-POND.x)/POND.rx,(z-POND.z)/POND.rz);
  const pond=Math.max(0,Math.min(1,(1.35-pondRadius)/.10));
  const arena=inArena({x,z})?1:0;
  const flatten=Math.min(1,Math.max(path1,path2,pond,arena));
  const transition=Math.min(1,Math.max(0,(x-24)/12));
  const wave=.46*Math.sin(x*.105+z*.057)+.36*Math.sin(z*.123-x*.038)+.22*Math.sin(x*.041+z*.19);
  return Math.max(0,1.0+wave)*transition*(1-flatten);
}
// Rendering-only depression. Collision uses the same visible pond ellipse and
// does not let a player walk on underwater terrain.
export function terrainVisualHeightAt(x,z){
  const d=Math.hypot((x-POND.x)/POND.rx,(z-POND.z)/POND.rz);
  if(d<1.08)return -.42;
  if(d<1.19)return -.42*(1-(d-1.08)/.11);
  return groundHeightAt(x,z);
}
export function insideHouse(x,z,margin=0){
  const inBox=(b)=>x>=b.minX+margin&&x<=b.maxX-margin&&
    z>=b.minZ+margin&&z<=b.maxZ-margin;
  return inBox(HOUSE.main)||inBox(HOUSE.hall)||inBox(HOUSE.armory);
}
export function terrainSlopeAt(x,z){
  const delta=.4,center=groundHeightAt(x,z);
  return Math.max(Math.abs(groundHeightAt(x+delta,z)-center),
    Math.abs(groundHeightAt(x,z+delta)-center))/delta;
}
export function hashCell(cx,cz,seed=WORLD_SEED){
  let n=(Math.imul(cx+101,374761393)^Math.imul(cz+227,668265263)^seed)>>>0;
  n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
  return n>>>0;
}
export function chunkData(cx,cz,seed=WORLD_SEED){
  if(!Number.isInteger(cx)||!Number.isInteger(cz)||cx<0||cx>=OUTDOOR.columns||cz<0||cz>=OUTDOOR.rows)return null;
  let state=hashCell(cx,cz,seed);
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  // Vegetation cells keep their pre-5.1 coordinates: new rear lawn is a
  // separate lightweight continuous slab, not a shifted procedural grid.
  const centerX=16+16*cx, centerZ=-40+16*cz;
  const grass=[],trees=[],rocks=[],blocks=[];
  // Instanced geometry only; plants never receive unique Mesh objects.
  for(let i=0;i<72;i++){
    const x=centerX+(rand()-.5)*15,z=centerZ+(rand()-.5)*15;
    if((x<34&&Math.abs(z+5)<11)||insidePond(x,z,2.0)||inArena({x,z})||terrainSlopeAt(x,z)>.48)continue;
    grass.push({x,z,size:.25+rand()*.48,twist:rand()*6.28});
  }
  for(let i=0;i<8;i++){
    const x=centerX+(rand()-.5)*13,z=centerZ+(rand()-.5)*13;
    const path=Math.abs(z+5)<(x<45?7:4.5);
    if(x<29||path||insidePond(x,z,4.0)||inArena({x,z})||terrainSlopeAt(x,z)>.40)continue;
    trees.push({x,z,height:2.7+rand()*2.3,color:Math.floor(rand()*3)});
  }
  for(let i=0;i<4;i++){
    const x=centerX+(rand()-.5)*13,z=centerZ+(rand()-.5)*13;
    if(x<29||Math.abs(z+5)<5.5||insidePond(x,z,2.6)||inArena({x,z}))continue;
    rocks.push({x,z,size:.38+rand()*.75});
  }
  if(centerX>78){
    for(let i=0;i<4;i++){
      const x=centerX+(rand()-.5)*11,z=centerZ+(rand()-.5)*11;
      if(Math.abs(z+5)<6||insidePond(x,z,2.5)||inArena({x,z}))continue;
      blocks.push({x,z,height:.8+Math.floor(rand()*4)*.72});
    }
  }
  return {cx,cz,centerX,centerZ,grass,trees,rocks,blocks};
}
export function insidePond(x,z,margin=0){
  const dx=(x-POND.x)/(POND.rx+margin),dz=(z-POND.z)/(POND.rz+margin);
  return dx*dx+dz*dz<1;
}
export function outdoorRegion(x,z){
  return x>=OUTDOOR.minX && x<=OUTDOOR.maxX && z>=OUTDOOR.minZ && z<=OUTDOOR.maxZ;
}
export function validWorldPosition(p){
  if(!p||typeof p!=="object"||!["x","y","z"].every(k=>typeof p[k]==="number"&&Number.isFinite(p[k])))return false;
  if(p.y<1.54||p.y>5.1)return false;
  return outdoorRegion(p.x,p.z);
}
export function crossesClosedEastWall(from,to){
  // Validate the exact segment where a network position update crosses the exit plane.
  if((from.x-DOOR.x)*(to.x-DOOR.x)>0 || from.x===to.x)return false;
  const t=(DOOR.x-from.x)/(to.x-from.x);
  if(t<0||t>1)return false;
  const z=from.z+(to.z-from.z)*t;
  if(z<HOUSE.main.minZ||z>HOUSE.main.maxZ)return false;
  return z<DOOR.minZ+.36 || z>DOOR.maxZ-.36;
}
// Shared exact house-envelope validation: crossing an exterior wall is denied,
// but legitimate corridors, eastern doorway and the new armory entrance remain open.
export function crossesHouseWall(from,to){
  if(crossesClosedEastWall(from,to))return true;
  const xCross=(x,minZ,maxZ)=>{
    const dx=to.x-from.x;if(!dx)return false;
    const t=(x-from.x)/dx;if(t<0||t>1)return false;
    const z=from.z+(to.z-from.z)*t;
    return z>=minZ&&z<=maxZ;
  };
  const zCross=(z,minX,maxX,openMin=Infinity,openMax=-Infinity)=>{
    const dz=to.z-from.z;if(!dz)return false;
    const t=(z-from.z)/dz;if(t<0||t>1)return false;
    const x=from.x+(to.x-from.x)*t;
    return x>=minX&&x<=maxX&&!(x>=openMin&&x<=openMax);
  };
  return xCross(-10,-16,8)||zCross(-16,-10,10)
    ||zCross(8,-10,10,-2.20,2.20)
    ||xCross(-2.3,8,18)||xCross(2.3,8,18)
    ||zCross(18,-5,5,-2.20,2.20)
    ||xCross(-5,18,26)||xCross(5,18,26)
    ||zCross(26,-5,5);
}
const colliders=[];
for(let cx=0;cx<OUTDOOR.columns;cx++){
  for(let cz=0;cz<OUTDOOR.rows;cz++){
    const data=chunkData(cx,cz);
    if(!data)continue;
    for(const t of data.trees)colliders.push({x0:t.x-.48,x1:t.x+.48,z0:t.z-.48,z1:t.z+.48});
    for(const r of data.rocks)colliders.push({x0:r.x-r.size*.63,x1:r.x+r.size*.63,z0:r.z-r.size*.63,z1:r.z+r.size*.63});
    for(const b of data.blocks)colliders.push({x0:b.x-.72,x1:b.x+.72,z0:b.z-.72,z1:b.z+.72});
  }
}
export function outdoorColliderBoxes(){return colliders.map(c=>({...c}))}
export function outsideBounds(x,z,radius=0){
  return x<OUTDOOR.minX+radius||x>OUTDOOR.maxX-radius||
    z<OUTDOOR.minZ+radius||z>OUTDOOR.maxZ-radius;
}
export function worldBlocked(x,z,radius=.36){
  if(outsideBounds(x,z,radius))return true;
  if(insideHouse(x,z))return false; // furniture/walls use actual local colliders
  if(insidePond(x,z,radius))return true;
  for(const c of colliders){
    const dx=x-Math.max(c.x0,Math.min(c.x1,x));
    const dz=z-Math.max(c.z0,Math.min(c.z1,z));
    if(dx*dx+dz*dz<radius*radius)return true;
  }
  return false;
}
export function validWorldStep(from,to){
  if(!validWorldPosition(to))return false;
  if(crossesHouseWall(from,to))return false;
  if(worldBlocked(to.x,to.z,.32))return false;
  const floor=groundHeightAt(to.x,to.z)+1.65;
  // Allow jumping (to 2.5+) and short frame-to-frame terrain corrections,
  // but no underground movement or flying above the legal jump ceiling.
  if(to.y<floor-.24||to.y>floor+2.2)return false;
  return true;
}

/**
 * Coarse server line-of-sight for short energy rays. The original building
 * walls and deterministic outdoor trunks/rocks/ruins are solid to weapons.
 * World ambience and water are intentionally not bullet blockers.
 */
export function shotObstructed(from,to){
  const distance=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
  const count=Math.ceil(distance/.35);
  if(!count)return false;
  const isDoor=z=>z>=DOOR.minZ+.15&&z<=DOOR.maxZ-.15;
  for(let i=1;i<count;i++){
    const t=i/count;
    const x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
    const y=from.y+(to.y-from.y)*t;
    if(y>=0&&y<=4.10){
      if(x>=9.85&&x<=10.16&&z>=-16&&z<=8&&!isDoor(z))return true;
      if(x>=-10.18&&x<=-9.85&&z>=-16&&z<=8)return true;
      if(z>=-16.16&&z<=-15.85&&x>=-10&&x<=10)return true;
      if(z>=7.85&&z<=8.16&&x>=2.4&&x<=10)return true;
      if(z>=7.85&&z<=8.16&&x<=-2.4&&x>=-10)return true;
      if(z>=8&&z<=18&&((x>=2.16&&x<=2.44)||(x<=-2.16&&x>=-2.44)))return true;
      if(z>=17.85&&z<=18.15&&x>=-5&&x<=5&&(x<=-2.3||x>=2.3))return true;
      if(z>=18&&z<=26&&((x>=4.85&&x<=5.15)||(x<=-4.85&&x>=-5.15)))return true;
      if(z>=25.85&&z<=26.15&&x>=-5&&x<=5)return true;
    }
    if(!insideHouse(x,z)&&outdoorRegion(x,z)){
      for(const b of colliders){
        if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1
          &&y>groundHeightAt(x,z)&&y<groundHeightAt(x,z)+3.2)return true;
      }
    }
    if(y<groundHeightAt(x,z)+.08)return true;
  }
  return false;
}
