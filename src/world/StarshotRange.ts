import * as THREE from "three";
import {aimDirection,raySphereDistance} from "../../shared/combatRules.js";
import {shotObstructed,groundHeightAt} from "../../shared/worldRules.js";

export const RANGE_ENTRY={x:33,z:10};
export const RANGE_SHOTS=6;
export const RANGE_SECONDS=30;
export const RANGE_SPOTS=[
  {x:44,z:12},{x:52,z:12},{x:60,z:12}
] as const;

/**
 * Starshot: a physical three-target 3D speedrun, not a modal mini-game.
 * Score belongs only to this client; it is NEVER presented as shared or as
 * authoritative PvP damage. All player-to-player hits stay Worker-owned.
 */
export class StarshotRange{
  readonly group=new THREE.Group();
  readonly targets:THREE.Mesh[]=[];
  private readonly targetMaterials:THREE.MeshBasicMaterial[]=[];
  private active=false;
  private shots=0;
  private misses=0;
  private lastTarget=-1;
  private current=0;
  private endsAt=0;
  private flash=0;
  private startedAt=0;
  private bestTime=0;
  private travel=1;
  private readonly from:{x:number;y:number;z:number}={x:RANGE_SPOTS[0].x,y:0,z:RANGE_SPOTS[0].z};
  private readonly aim:{x:number;y:number;z:number}={x:RANGE_SPOTS[0].x,y:0,z:RANGE_SPOTS[0].z};
  private readonly now:()=>number;
  constructor(scene:THREE.Scene,now=()=>performance.now()){
    this.now=now;
    this.group.name="STARSHOT_RANGE";
    scene.add(this.group);
    const neon=new THREE.MeshBasicMaterial({color:0x65f5db,toneMapped:false});
    const violet=new THREE.MeshBasicMaterial({color:0x8149b1,toneMapped:false});
    const concrete=new THREE.MeshStandardMaterial({color:0x303444,roughness:1});
    const makeBox=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
      mesh.position.set(x,y,z);this.group.add(mesh);return mesh;
    };
    // Big portal is visible from the house-to-pond route. No dynamic lights.
    const base=groundHeightAt(RANGE_ENTRY.x,RANGE_ENTRY.z);
    makeBox(.5,5,.6,32,base+2.5,8.5,violet);
    makeBox(.5,5,.6,32,base+2.5,13.5,violet);
    makeBox(.6,.38,5.7,32,base+4.92,11,neon);
    makeBox(.13,1.4,3.2,32,base+2.8,11,concrete);
    // The entrance explains itself without HUD popups or a tutorial.
    if(typeof document!=="undefined"){
    const sign=document.createElement("canvas");sign.width=512;sign.height=128;
    const ctx=sign.getContext("2d");
    if(ctx){
      ctx.fillStyle="#11172c";ctx.fillRect(0,0,512,128);
      ctx.strokeStyle="#7fffe2";ctx.lineWidth=9;ctx.strokeRect(7,7,498,114);
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillStyle="#d5ffee";ctx.font="bold 53px system-ui,sans-serif";
      ctx.fillText("STARSHOT",256,52);
      ctx.fillStyle="#ffaee4";ctx.font="bold 28px system-ui,sans-serif";
      ctx.fillText("6 HITS · 30 SEC",256,98);
      const texture=new THREE.CanvasTexture(sign);texture.colorSpace=THREE.SRGBColorSpace;
      const board=new THREE.Mesh(new THREE.PlaneGeometry(3.65,.92),
        new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,transparent:false}));
      board.position.set(31.65,base+4.12,11);board.rotation.y=-Math.PI/2;
      this.group.add(board);
    }
    }
    // A simple guided lane is visible across shallow terrain, not a fake
    // blocking floor. No physics/collider changes are introduced.
    for(let x=35;x<=61;x+=4){
      const y=groundHeightAt(x,12)+.035;
      makeBox(2.2,.035,.08,x,y,8.8,neon);
      makeBox(2.2,.035,.08,x,y,15.3,neon);
    }
    // Target lane is on the +X side, facing the player who travels east.
    for(let i=0;i<RANGE_SPOTS.length;i++){
      const spot=RANGE_SPOTS[i],height=groundHeightAt(spot.x,spot.z);
      const post=makeBox(.16,2.45,.16,spot.x,height+1.22,spot.z,concrete);
      post.name="STARSHOT_POST_"+i;
      const backing=new THREE.Mesh(new THREE.CircleGeometry(1.03,24),
        new THREE.MeshBasicMaterial({color:0x151e35,side:THREE.DoubleSide}));
      backing.rotation.y=Math.PI/2;
      backing.position.set(spot.x,height+1.92,spot.z);
      this.group.add(backing);
      const rim=new THREE.Mesh(new THREE.RingGeometry(.72,.91,24),neon);
      rim.rotation.y=Math.PI/2;
      rim.position.set(spot.x-.04,height+1.92,spot.z);
      this.group.add(rim);
      const mat=new THREE.MeshBasicMaterial({color:0x7a528d,side:THREE.DoubleSide,toneMapped:false});
      const disk=new THREE.Mesh(new THREE.CircleGeometry(.65,20),mat);
      disk.rotation.y=Math.PI/2;
      disk.position.set(spot.x-.07,height+1.92,spot.z);
      disk.userData.targetIndex=i;
      this.group.add(disk);this.targets.push(disk);this.targetMaterials.push(mat);
    }
    // Visible horizon anchor, not a second fake skybox or active particle field.
    makeBox(.9,12,.9,93,6,23,concrete);
    makeBox(1.6,1.8,1.6,93,12.2,23,neon);
    makeBox(6,.25,6,93,.10,23,violet);
    this.updateVisual();
  }
  get running():boolean{return this.active}
  get hits():number{return this.shots}
  get attempts():number{return this.shots+this.misses}
  get remaining():number{return this.active?Math.max(0,(this.endsAt-this.now())/1000):0}
  /** Best clear time in seconds. 0 means the player has not cleared a round. */
  get record():number{return this.bestTime}
  get activeTarget():number{return this.current}
  /** World position the live disk can be hit at, including its strafe. */
  targetPoint():{x:number;y:number;z:number}{this.place(0);return {...this.aim}}

  start():void{
    this.active=true;this.shots=0;this.misses=0;
    this.startedAt=this.now();
    this.endsAt=this.startedAt+RANGE_SECONDS*1000;
    this.lastTarget=-1;
    this.current=0;
    this.flash=0;
    this.travel=1;
    const home=this.home(0);
    this.from.x=home.x;this.from.y=home.y;this.from.z=home.z;
    this.place(0);
    this.updateVisual();
  }
  stop():void{this.active=false;this.updateVisual()}
  reset():void{this.stop();this.shots=0;this.misses=0}
  update(dt:number):void{
    if(!this.active){this.place(0);return}
    this.travel=Math.min(1,this.travel+dt/.38);
    this.place(dt);
    if(this.now()>=this.endsAt){
      this.active=false;
      this.updateVisual();return;
    }
    if(this.flash>0){this.flash=Math.max(0,this.flash-dt);if(!this.flash)this.updateVisual();}
  }
  shoot(origin:{x:number;y:number;z:number},yaw:number,pitch:number):"hit"|"miss"|"inactive"{
    if(!this.active||this.now()>=this.endsAt)return "inactive";
    this.place(0);
    const direction=aimDirection(yaw,pitch);
    const target=this.aim;
    const distance=raySphereDistance(origin,direction,target,.70);
    // Player must be reasonably close to the range. Never award a local
    // practice hit through an actual wall/tree/rock.
    const valid=distance!==null&&distance<=35&&
      Math.hypot(origin.x-RANGE_ENTRY.x,origin.z-RANGE_ENTRY.z)<35&&
      !shotObstructed(origin,{x:target.x,y:target.y,z:target.z});
    if(!valid){
      this.misses++;
      this.endsAt=Math.max(this.now(),this.endsAt-1000);
      if(this.now()>=this.endsAt)this.active=false;
      this.updateVisual();
      return "miss";
    }
    this.shots++;
    if(this.shots>=RANGE_SHOTS){
      this.active=false;
      const elapsed=Math.max(.01,(this.now()-this.startedAt)/1000);
      this.bestTime=this.bestTime>0?Math.min(this.bestTime,elapsed):elapsed;
      this.updateVisual();return "hit";
    }
    this.flash=.18;
    this.lastTarget=this.current;
    this.from.x=this.aim.x;this.from.y=this.aim.y;this.from.z=this.aim.z;
    this.current=(this.current+1)%RANGE_SPOTS.length;
    this.travel=0;
    this.updateVisual();
    return "hit";
  }
  private home(index:number):{x:number;y:number;z:number}{
    const spot=RANGE_SPOTS[index];
    return {x:spot.x,y:groundHeightAt(spot.x,spot.z)+1.92,z:spot.z};
  }
  private place(dt:number):void{
    const u=this.travel;
    const home=this.home(this.current);
    const glideX=this.from.x+(home.x-this.from.x)*u;
    const glideY=this.from.y+(home.y-this.from.y)*u;
    const glideZ=this.from.z+(home.z-this.from.z)*u;
    const t=this.now()/1000;
    this.aim.x=glideX;
    this.aim.y=glideY+Math.sin(t*1.6)*.12;
    this.aim.z=glideZ+Math.sin(t*2.15)*.8;
    if(dt<0)return;
    for(let i=0;i<this.targets.length;i++){
      const disk=this.targets[i];
      if(i===this.current)disk.position.set(this.aim.x-.07,this.aim.y,this.aim.z);
      else{
        const spot=this.home(i);
        disk.position.set(spot.x-.07,spot.y,spot.z);
      }
    }
  }
  private updateVisual():void{
    this.place(0);
    for(let i=0;i<this.targetMaterials.length;i++){
      const material=this.targetMaterials[i];
      material.color.setHex(this.active&&i===this.current?0x9cffe8:
        this.active&&this.flash>0&&i===this.lastTarget?0xff92dd:0x805b9b);
    }
  }
  dispose():void{
    this.group.parent?.remove(this.group);
    const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>();
    this.group.traverse(obj=>{
      if(obj instanceof THREE.Mesh){
        geos.add(obj.geometry);
        if(Array.isArray(obj.material))obj.material.forEach(m=>mats.add(m));
        else mats.add(obj.material);
      }
    });
    geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
  }
}
