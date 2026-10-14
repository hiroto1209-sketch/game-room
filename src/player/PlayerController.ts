import type { Collider, Vector2, Vector3 } from "../types/Player";
export interface PlayerPose { position:Vector3; yaw:number; pitch:number }
export const WALK_SPEED=4.2;
export const NEON777_SPEED_MULTIPLIER=6;
export class PlayerController {
  readonly position:Vector3={x:0,y:1.65,z:15};
  readonly height=1.65;
  readonly radius=.36;
  private velocity={x:0,y:0,z:0};
  grounded=true;
  private phase=0;
  private readonly colliders:readonly Collider[];
  private readonly extraBlocked:(x:number,z:number,radius:number,eye?:number)=>boolean;
  private readonly groundAt:(x:number,z:number)=>number;
  private readonly verticalBlocked:(from:Vector3,to:Vector3)=>boolean;
  constructor(colliders:readonly Collider[],
    extraBlocked:(x:number,z:number,radius:number,eye?:number)=>boolean=()=>false,
    groundAt:(x:number,z:number)=>number=()=>0,
    verticalBlocked:(from:Vector3,to:Vector3)=>boolean=()=>false){
    this.colliders=colliders;
    this.extraBlocked=extraBlocked;
    this.groundAt=groundAt;
    this.verticalBlocked=verticalBlocked;
  }
  reset():void{
    this.position.x=0;this.position.y=this.height+this.groundAt(0,15);this.position.z=15;
    this.velocity.x=this.velocity.y=this.velocity.z=0;this.grounded=true;
    this.phase=0;
  }
  teleport(x:number,y:number,z:number):void{
    if(![x,y,z].every(Number.isFinite))return;
    this.position.x=x;this.position.y=y;this.position.z=z;
    this.velocity.x=this.velocity.y=this.velocity.z=0;
    this.grounded=true;
  }
  stop():void{this.velocity.x=this.velocity.z=0}
  jump():void{
    if(this.grounded){this.velocity.y=6.5;this.grounded=false;}
  }
  private collides(x:number,z:number):boolean{
    if(this.extraBlocked(x,z,this.radius,this.position.y))return true;
    if(this.groundAt(x,z)>this.position.y-this.height+.35)return true;
    for(const c of this.colliders){
      const dx=x-Math.max(c.x0,Math.min(c.x1,x));
      const dz=z-Math.max(c.z0,Math.min(c.z1,z));
      if(dx*dx+dz*dz<this.radius*this.radius)return true;
    }
    return false;
  }
  update(dt:number,input:Vector2,yaw:number,reducedMotion=false,speedMultiplier=1):number{
    const length=Math.max(1,Math.hypot(input.x,input.y));
    const x=input.x/length,z=input.y/length;
    // Three.js camera looks down -Z; transform local right/forward by yaw.
    const travelSpeed=WALK_SPEED*(speedMultiplier===NEON777_SPEED_MULTIPLIER?NEON777_SPEED_MULTIPLIER:1);
    const tx=(Math.cos(yaw)*x-Math.sin(yaw)*z)*travelSpeed;
    const tz=(-Math.sin(yaw)*x-Math.cos(yaw)*z)*travelSpeed;
    const moving=Math.hypot(x,z)>.01;
    const blend=1-Math.exp(-dt*(moving?11:15));
    this.velocity.x+=(tx-this.velocity.x)*blend;
    this.velocity.z+=(tz-this.velocity.z)*blend;
    // Sweep every short substep at turbo speed so thin walls/rocks cannot be skipped.
    const distance=Math.hypot(this.velocity.x,this.velocity.z)*dt;
    const segments=Math.max(1,Math.ceil(distance/.18));
    for(let i=0;i<segments;i++){
      const step=dt/segments;
      const nx=this.position.x+this.velocity.x*step;
      if(!this.collides(nx,this.position.z))this.position.x=nx;
      else this.velocity.x=0;
      const nz=this.position.z+this.velocity.z*step;
      if(!this.collides(this.position.x,nz))this.position.z=nz;
      else this.velocity.z=0;
    }
    const floor=this.height+this.groundAt(this.position.x,this.position.z);
    if(!this.grounded){
      this.velocity.y-=11.8*dt;
      const nextY=this.position.y+this.velocity.y*dt;
      if(nextY>this.position.y&&this.verticalBlocked(
        {...this.position,y:this.position.y+.12},{...this.position,y:nextY+.12}))this.velocity.y=0;
      else this.position.y=nextY;
      if(this.position.y<=floor){
        this.position.y=floor;this.velocity.y=0;this.grounded=true;
      }
    }else{
      // Foundation for future walkable slopes and terrace levels.
      if(floor<this.position.y-.35){this.grounded=false;this.velocity.y=0;}
      else this.position.y=floor;
    }
    this.phase+=dt;
    const speed=Math.hypot(this.velocity.x,this.velocity.z);
    return !reducedMotion&&this.grounded?Math.sin(this.phase*9)*Math.min(4,speed)*.008:0;
  }
  snapshot(id:string,displayName:string,yaw:number,pitch:number,sequence:number){
    return {id,displayName,position:{...this.position},yaw,pitch,sequence};
  }
}
