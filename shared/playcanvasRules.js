// Scene-local coordinates and exact triangles, shared by browser and Worker.
export const FPS_STAGE={x:132,z:0,minX:119.25,maxX:144.75,minZ:-24.6,maxZ:24.6,maxY:12,
 entrance:{x:119.6,z:-5},spawn:{x:121.2,y:1.65,z:-5},cellSize:2};
let factory=null,geometry=null,grid=null;
let access=true;
export function setStageAccess(value){access=value;}
export function setStageGeometry(value){factory=value;geometry=null;grid=null;}
export function stageReady(){return Boolean(factory);}
export function inFpsStage(x,z,margin=0){return x>=FPS_STAGE.minX-margin&&x<=FPS_STAGE.maxX+margin&&z>=FPS_STAGE.minZ-margin&&z<=FPS_STAGE.maxZ+margin;}
export function stageCorridor(x,z,radius=0){return x>=103-radius&&x<=120.8+radius&&z>=-6.6+radius&&z<=-3.4-radius;}
function key(x,z){return Math.floor(x/2)+','+Math.floor(z/2);}
function prepare(){
 if(geometry)return true;if(!factory)return false;
 geometry=factory();grid=new Map();
 for(let i=0;i<geometry.length;i+=9){
  const x0=Math.min(geometry[i],geometry[i+3],geometry[i+6]),x1=Math.max(geometry[i],geometry[i+3],geometry[i+6]);
  const z0=Math.min(geometry[i+2],geometry[i+5],geometry[i+8]),z1=Math.max(geometry[i+2],geometry[i+5],geometry[i+8]);
  for(let x=Math.floor(x0/2);x<=Math.floor(x1/2);x++)for(let z=Math.floor(z0/2);z<=Math.floor(z1/2);z++){
   const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);
  }
 }
 return true;
}
function candidates(x,z,r=0){
 if(!prepare())return [];
 if(!r)return grid.get(key(x,z))??[];
 const ids=new Set();
 for(let ix=Math.floor((x-r)/2);ix<=Math.floor((x+r)/2);ix++)for(let iz=Math.floor((z-r)/2);iz<=Math.floor((z+r)/2);iz++){
  for(const id of grid.get(ix+','+iz)??[])ids.add(id);
 }
 return ids;
}
function normal(i){
 const g=geometry,ux=g[i+3]-g[i],uy=g[i+4]-g[i+1],uz=g[i+5]-g[i+2],vx=g[i+6]-g[i],vy=g[i+7]-g[i+1],vz=g[i+8]-g[i+2];
 const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz);
 return l>1e-9?[nx/l,ny/l,nz/l]:[0,0,0];
}
function height(i,x,z){
 const g=geometry,ax=g[i],az=g[i+2],bx=g[i+3],bz=g[i+5],cx=g[i+6],cz=g[i+8];
 const det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(det)<1e-8)return null;
 const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det,w=1-u-v;
 return u>=-1e-6&&v>=-1e-6&&w>=-1e-6?u*g[i+1]+v*g[i+4]+w*g[i+7]:null;
}
export function stageGround(x,z,ceiling=.35){
 if(!inFpsStage(x,z)||!prepare())return null;
 x-=FPS_STAGE.x;z-=FPS_STAGE.z;let highest=null;
 for(const i of candidates(x,z)){
  if(normal(i)[1]<.65)continue;
  const h=height(i,x,z);if(h!==null&&h<=ceiling+.0001&&(highest===null||h>highest))highest=h;
 }
 return highest;
}
function segmentDistance2(px,pz,ax,az,bx,bz){
 const dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz;
 const t=l?Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/l)):0;
 return (px-ax-t*dx)**2+(pz-az-t*dz)**2;
}
// A horizontal slice through a triangle, tested against the player circle.
function sliceBlocked(i,x,z,y,r){
 const g=geometry,points=[];
 for(let a=0;a<3;a++){
  const b=(a+1)%3,ai=i+a*3,bi=i+b*3,ay=g[ai+1],by=g[bi+1];
  if(Math.abs(ay-y)<1e-7)points.push([g[ai],g[ai+2]]);
  if((ay<y&&by>y)||(ay>y&&by<y)){
   const t=(y-ay)/(by-ay);points.push([g[ai]+t*(g[bi]-g[ai]),g[ai+2]+t*(g[bi+2]-g[ai+2])]);
  }
 }
 for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++){
  if(segmentDistance2(x,z,...points[a],...points[b])<r*r)return true;
 }
 return false;
}
export function stageBlocked(x,z,r=.36,eye=1.65){
 if(!inFpsStage(x,z,r))return false;if(!access||!prepare())return true;
 x-=FPS_STAGE.x;z-=FPS_STAGE.z;const foot=eye-1.65;
 for(const i of candidates(x,z,r)){
  const ny=normal(i)[1];if(ny>=.65)continue;
  // 10 slices through the upright body; floors/slopes handled separately.
  const minY=Math.min(geometry[i+1],geometry[i+4],geometry[i+7]),maxY=Math.max(geometry[i+1],geometry[i+4],geometry[i+7]);
  if(maxY<foot+.32||minY>eye+.12)continue;
  if(ny<-.65){const h=height(i,x,z);if(h!==null&&h>foot+.32&&h<eye+.12)return true;}
  for(const y of [Math.max(foot+.33,minY+1e-6),Math.min(eye+.12,maxY-1e-6)])if(y>=foot+.33&&y<=eye+.12&&sliceBlocked(i,x,z,y,r))return true;
  for(let y=foot+.33;y<=eye+.12;y+=.14)if(sliceBlocked(i,x,z,y,r))return true;
 }
 return false;
}
function intersects(i,from,to){
 const g=geometry,dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z;
 const e1x=g[i+3]-g[i],e1y=g[i+4]-g[i+1],e1z=g[i+5]-g[i+2],e2x=g[i+6]-g[i],e2y=g[i+7]-g[i+1],e2z=g[i+8]-g[i+2];
 const px=dy*e2z-dz*e2y,py=dz*e2x-dx*e2z,pz=dx*e2y-dy*e2x,det=e1x*px+e1y*py+e1z*pz;
 if(Math.abs(det)<1e-9)return false;const inv=1/det,tx=from.x-g[i],ty=from.y-g[i+1],tz=from.z-g[i+2];
 const u=(tx*px+ty*py+tz*pz)*inv;if(u<0||u>1)return false;
 const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(dx*qx+dy*qy+dz*qz)*inv;
 if(v<0||u+v>1)return false;const t=(e2x*qx+e2y*qy+e2z*qz)*inv;return t>1e-5&&t<1-1e-5;
}
export function stageShotObstructed(from,to){
 const minX=Math.min(from.x,to.x),maxX=Math.max(from.x,to.x),minZ=Math.min(from.z,to.z),maxZ=Math.max(from.z,to.z);
 if(maxX<FPS_STAGE.minX||minX>FPS_STAGE.maxX||maxZ<FPS_STAGE.minZ||minZ>FPS_STAGE.maxZ)return false;
 if(!prepare())return true;
 const a={x:from.x-FPS_STAGE.x,y:from.y,z:from.z-FPS_STAGE.z},b={x:to.x-FPS_STAGE.x,y:to.y,z:to.z-FPS_STAGE.z};
 const ids=new Set(),count=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.75);
 for(let n=0;n<=count;n++){const t=count?n/count:0;for(const id of candidates(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))ids.add(id);}
 for(const i of ids)if(intersects(i,a,b))return true;return false;
}
