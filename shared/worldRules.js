import {residentHeightAt} from "./residentRules.js";
import {inArena} from "./combatRules.js";
// Retired north-yard footprint. The skip stays so the vegetation seed is unchanged.
import {FPS_STAGE,inFpsStage,stageCorridor,stageGround,stageBlocked,stageShotObstructed} from "./playcanvasRules.js";
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
// Hidden Exploration 9: ALL coordinates, navigability and hill heights are
// deterministic and shared by the client and Cloudflare movement validator.
// Cave roof is ABOVE the head; the continuous TerrainSurface is the only floor.
export const HIDDEN_WORLD={
  entrance:{x:65,z:32},rune:{x:72,z:32},trail:{x:80,z:33},
  vista:{x:90,z:37},caveStart:66,caveEnd:78,
  caveMinZ:29.5,caveMaxZ:34.5
};
const explorationWalls=[
  {x0:66,x1:78,z0:27.25,z1:29.25},
  {x0:66,x1:78,z0:34.75,z1:36.75}
];
export function hiddenTrailDistance(x,z){
  // Secret trail runs from the hidden cave exit to the hill lookout.
  const ax=78,az=32,bx=90,bz=37;
  const dx=bx-ax,dz=bz-az;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
  return Math.hypot(x-ax-dx*t,z-az-dz*t);
}
export function nearExplorationFeature(x,z,clearance=0){
  return (x>=63-clearance&&x<=80+clearance&&z>=26-clearance&&z<=38+clearance)
    ||hiddenTrailDistance(x,z)<2.0+clearance
    ||Math.hypot(x-HIDDEN_WORLD.vista.x,z-HIDDEN_WORLD.vista.z)<6+clearance;
}

// Bounded static hills: deterministic at every coordinate, no per-frame animation.
export function groundHeightAt(x,z,ceiling=.35){
  if(inFpsStage(x,z))return stageGround(x,z,ceiling)??0;
  if(stageCorridor(x,z))return 0;
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
  const original=Math.max(0,1.0+wave)*transition*(1-flatten);
  // An accessible rounded lookout hill: low slope, no separate fake platform.
  // At most +1.45 world units, capped below the existing network height limit.
  const radial=Math.hypot((x-HIDDEN_WORLD.vista.x)/19,(z-HIDDEN_WORLD.vista.z)/16);
  const fraction=Math.max(0,Math.min(1,1-radial));
  const smooth=fraction*fraction*(3-2*fraction);
  const lookoutRise=1.45*smooth;
  return Math.min(3.06,original+lookoutRise);
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
function fullChunkData(cx,cz,seed=WORLD_SEED){
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
    if((x<34&&Math.abs(z+5)<11)||insidePond(x,z,2.0)||inArena({x,z})||retiredPlaza(x,z)||nearExplorationFeature(x,z,.4)||terrainSlopeAt(x,z)>.48)continue;
    grass.push({x,z,size:.25+rand()*.48,twist:rand()*6.28});
  }
  for(let i=0;i<8;i++){
    const x=centerX+(rand()-.5)*13,z=centerZ+(rand()-.5)*13;
    const path=Math.abs(z+5)<(x<45?7:4.5);
    if(x<29||path||insidePond(x,z,4.0)||inArena({x,z})||retiredPlaza(x,z)||nearExplorationFeature(x,z,2.2)||terrainSlopeAt(x,z)>.40)continue;
    trees.push({x,z,height:2.7+rand()*2.3,color:Math.floor(rand()*3)});
  }
  for(let i=0;i<4;i++){
    const x=centerX+(rand()-.5)*13,z=centerZ+(rand()-.5)*13;
    if(x<29||Math.abs(z+5)<5.5||insidePond(x,z,2.6)||inArena({x,z})||retiredPlaza(x,z)||nearExplorationFeature(x,z,.9))continue;
    rocks.push({x,z,size:.38+rand()*.75});
  }
  return {cx,cz,centerX,centerZ,grass,trees,rocks,blocks};
}
// Keep every second tree across the whole forest, retaining existing positions
// and the random stream that places grass and rocks. 167 -> 84 trees.
let forestSeed=null,forestChunks=[];
export function chunkData(cx,cz,seed=WORLD_SEED){
  if(!Number.isInteger(cx)||!Number.isInteger(cz)||cx<0||cx>=OUTDOOR.columns||cz<0||cz>=OUTDOOR.rows)return null;
  if(forestSeed!==seed){
    let index=0;forestChunks=[];
    for(let x=0;x<OUTDOOR.columns;x++)for(let z=0;z<OUTDOOR.rows;z++){
      const data=fullChunkData(x,z,seed);
      data.trees=data.trees.filter(()=>index++%2===0);
      forestChunks.push(data);
    }
    forestSeed=seed;
  }
  return forestChunks[cx*OUTDOOR.rows+cz];
}
function retiredPlaza(x,z){return x>=14&&x<=23&&z>=34&&z<=46}
export function insidePond(x,z,margin=0){
  const dx=(x-POND.x)/(POND.rx+margin),dz=(z-POND.z)/(POND.rz+margin);
  return dx*dx+dz*dz<1;
}
export function outdoorRegion(x,z){
  return (x>=OUTDOOR.minX && x<=OUTDOOR.maxX && z>=OUTDOOR.minZ && z<=OUTDOOR.maxZ)||inFpsStage(x,z)||stageCorridor(x,z);
}
export function validWorldPosition(p){
  if(!p||typeof p!=="object"||!["x","y","z"].every(k=>typeof p[k]==="number"&&Number.isFinite(p[k])))return false;
  if(p.y<1.54||p.y>(inFpsStage(p.x,p.z)?FPS_STAGE.maxY+3.85:6.91))return false;
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
    for(const t of data.trees)colliders.push({x0:t.x-.48,x1:t.x+.48,z0:t.z-.48,z1:t.z+.48,y0:groundHeightAt(t.x,t.z),y1:groundHeightAt(t.x,t.z)+t.height*1.03});
    for(const r of data.rocks)colliders.push({x0:r.x-r.size*.5,x1:r.x+r.size*.5,z0:r.z-r.size*.39,z1:r.z+r.size*.39,y0:groundHeightAt(r.x,r.z),y1:groundHeightAt(r.x,r.z)+r.size*.35+Math.max(.38,r.size*.8)*.5,walkable:true});
  }
}
// Cave rock walls share the exact same collision footprint as the visual mesh.
colliders.push(...explorationWalls.map(c=>({...c,y0:groundHeightAt((c.x0+c.x1)/2,(c.z0+c.z1)/2),y1:groundHeightAt((c.x0+c.x1)/2,(c.z0+c.z1)/2)+3.2})));
export function outdoorColliderBoxes(){return colliders.map(c=>({...c}))}
export function outsideBounds(x,z,radius=0){
  if(inFpsStage(x,z,-radius)||stageCorridor(x,z,radius))return false;
  return x<OUTDOOR.minX+radius||x>OUTDOOR.maxX-radius||
    z<OUTDOOR.minZ+radius||z>OUTDOOR.maxZ-radius;
}
const LOUNGE_TABLES=[
  {x:-6.1,z:-2,radius:.9,top:.97},
  {x:6.1,z:-2.2,radius:.9,top:.97}
];
function loungeTableBlocked(x,z,radius,eye){
  const foot=eye-1.65;
  return LOUNGE_TABLES.some(table=>{
    const dx=x-table.x,dz=z-table.z,reach=table.radius+radius;
    return dx*dx+dz*dz<=reach*reach&&foot<table.top-.2;
  });
}
// A rock supports a player who has cleared its top; terrain remains the one
// continuous world floor. The ceiling prevents snapping onto rocks from below.
export function walkableHeightAt(x,z,ceiling=.35){
  let height=groundHeightAt(x,z,ceiling);
  for(const table of LOUNGE_TABLES){
    const dx=x-table.x,dz=z-table.z;
    if(dx*dx+dz*dz<=table.radius*table.radius&&table.top<=ceiling+.01)
      height=Math.max(height,table.top);
  }
  for(const c of colliders){
    if(c.walkable&&x>=c.x0&&x<=c.x1&&z>=c.z0&&z<=c.z1&&c.y1<=ceiling+.01)
      height=Math.max(height,c.y1);
  }
  return height;
}
export function worldBlocked(x,z,radius=.36,eye=groundHeightAt(x,z)+1.65){
  if(inFpsStage(x,z,radius)&&stageBlocked(x,z,radius,eye))return true;
  if(outsideBounds(x,z,radius))return true;
  if(loungeTableBlocked(x,z,radius,eye))return true;
  if(insideHouse(x,z))return false; // furniture/walls use actual local colliders
  for(const c of colliders){
    if(eye-1.65>=c.y1-.01||eye+.12<=c.y0)continue;
    const dx=x-Math.max(c.x0,Math.min(c.x1,x));
    const dz=z-Math.max(c.z0,Math.min(c.z1,z));
    if(dx*dx+dz*dz<radius*radius)return true;
  }
  return false;
}
export function validWorldStep(from,to,residents=null,lift=2.2){
  if(!validWorldPosition(to))return false;
  if(crossesHouseWall(from,to))return false;
  if(worldBlocked(to.x,to.z,.32,to.y))return false;
  let floor=walkableHeightAt(to.x,to.z,to.y-1.65+.12)+1.65;
  if(residents)floor=Math.max(floor,residentHeightAt(to.x,to.z,to.y-1.65+.12,residents.now,residents.motion)+1.65);
  const jumpBase=residents&&Number.isFinite(residents.jumpBase)?residents.jumpBase+1.65:floor;
  // Allow jumping and short frame-to-frame terrain corrections,
  // but no underground movement or flying above the legal jump ceiling.
  if(to.y<floor-.24||to.y>Math.max(floor,jumpBase)+lift)return false;
  return true;
}

/**
 * Coarse server line-of-sight for short energy rays. The original building
 * walls and deterministic outdoor trunks/rocks are solid to weapons.
 * World ambience and water are intentionally not bullet blockers.
 */
export function shotObstructed(from,to){
  if(stageShotObstructed(from,to))return true;
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
          &&y>b.y0&&y<b.y1)return true;
      }
    }
    if(y<groundHeightAt(x,z,y)+.08)return true;
  }
  return false;
}
