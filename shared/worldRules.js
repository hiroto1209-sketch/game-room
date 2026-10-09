/**
 * Deterministic geometry/navigation rules shared by Vite and Cloudflare Worker.
 * Coordinates are Three.js units; +X leads through the new east door.
 * No remote assets, randomness or browser-specific APIs.
 */
export const WORLD_SEED=419261;
export const OUTDOOR={minX:8,maxX:104,minZ:-48,maxZ:48,chunkSize:16,columns:6,rows:6};
export const DOOR={x:10,minZ:-6.65,maxZ:-3.35};
export const POND={x:57,z:-27,rx:9.5,rz:7.0};
export const SPAWN={x:0,y:1.65,z:15};
export function groundHeightAt(_x,_z){return 0}
export function hashCell(cx,cz,seed=WORLD_SEED){
  let n=(Math.imul(cx+101,374761393)^Math.imul(cz+227,668265263)^seed)>>>0;
  n^=n>>>13;n=Math.imul(n,1274126177)>>>0;n^=n>>>16;
  return n>>>0;
}
export function chunkData(cx,cz,seed=WORLD_SEED){
  if(!Number.isInteger(cx)||!Number.isInteger(cz)||cx<0||cx>=OUTDOOR.columns||cz<0||cz>=OUTDOOR.rows)return null;
  let state=hashCell(cx,cz,seed);
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  const centerX=16+16*cx, centerZ=-40+16*cz;
  const grass=[],trees=[],rocks=[],blocks=[];
  // Instanced geometry only; plants never receive unique Mesh objects.
  for(let i=0;i<72;i++){
    const x=centerX+(rand()-.5)*15,z=centerZ+(rand()-.5)*15;
    if((x<34&&Math.abs(z+5)<11)||insidePond(x,z,2.0))continue;
    grass.push({x,z,size:.25+rand()*.48,twist:rand()*6.28});
  }
  for(let i=0;i<8;i++){
    const x=centerX+(rand()-.5)*13,z=centerZ+(rand()-.5)*13;
    const path=Math.abs(z+5)<(x<45?7:4.5);
    if(x<29||path||insidePond(x,z,4.0))continue;
    trees.push({x,z,height:2.7+rand()*2.3,color:Math.floor(rand()*3)});
  }
  for(let i=0;i<4;i++){
    const x=centerX+(rand()-.5)*13,z=centerZ+(rand()-.5)*13;
    if(x<29||Math.abs(z+5)<5.5||insidePond(x,z,2.6))continue;
    rocks.push({x,z,size:.38+rand()*.75});
  }
  if(centerX>78){
    for(let i=0;i<4;i++){
      const x=centerX+(rand()-.5)*11,z=centerZ+(rand()-.5)*11;
      if(Math.abs(z+5)<6||insidePond(x,z,2.5))continue;
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
  if(p.y<1.60||p.y>4.9)return false;
  const insideMain=p.x>=-10.1&&p.x<=10.15&&p.z>=-16.15&&p.z<=8.15;
  const corridor=p.x>=-2.4&&p.x<=2.4&&p.z>=7.7&&p.z<=18.2;
  return insideMain||corridor||outdoorRegion(p.x,p.z);
}
export function crossesClosedEastWall(from,to){
  // Validate the exact segment where a network position update crosses the exit plane.
  if((from.x-DOOR.x)*(to.x-DOOR.x)>0 || from.x===to.x)return false;
  const t=(DOOR.x-from.x)/(to.x-from.x);
  if(t<0||t>1)return false;
  const z=from.z+(to.z-from.z)*t;
  return z<DOOR.minZ+.36 || z>DOOR.maxZ-.36;
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
  if(!outdoorRegion(x,z))return false; // original indoor colliders remain authoritative locally
  if(outsideBounds(x,z,radius)||insidePond(x,z,radius))return true;
  for(const c of colliders){
    const dx=x-Math.max(c.x0,Math.min(c.x1,x));
    const dz=z-Math.max(c.z0,Math.min(c.z1,z));
    if(dx*dx+dz*dz<radius*radius)return true;
  }
  return false;
}
export function validWorldStep(from,to){
  if(!validWorldPosition(to))return false;
  if(crossesClosedEastWall(from,to))return false;
  if(outdoorRegion(to.x,to.z)&&worldBlocked(to.x,to.z,.32))return false;
  return true;
}
