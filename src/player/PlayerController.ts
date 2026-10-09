import type { Collider, Vector2, Vector3 } from "../types/Player";
export interface PlayerPose { position:Vector3; yaw:number; pitch:number }
export class PlayerController {
  readonly position:Vector3={x:0,y:1.65,z:15};
  readonly height=1.65;
  readonly radius=.36;
  private velocity={x:0,y:0,z:0};
  grounded=true;
  private phase=0;
  constructor(private colliders:readonly Collider[]){}
  reset():void{
    this.position.x=0;this.position.y=this.height;this.position.z=15;
    this.velocity.x=this.velocity.y=this.velocity.z=0;this.grounded=true;
    this.phase=0;
  }
  stop():void{this.velocity.x=this.velocity.z=0}
  jump():void{
    if(this.grounded){this.velocity.y=4.5;this.grounded=false;}
  }
  private collides(x:number,z:number):boolean{
    for(const c of this.colliders){
      const dx=x-Math.max(c.x0,Math.min(c.x1,x));
      const dz=z-Math.max(c.z0,Math.min(c.z1,z));
      if(dx*dx+dz*dz<this.radius*this.radius)return true;
    }
    return false;
  }
  update(dt:number,input:Vector2,yaw:number,reducedMotion=false):number{
    const length=Math.max(1,Math.hypot(input.x,input.y));
    const x=input.x/length,z=input.y/length;
    // Three.js camera looks down -Z; transform local right/forward by yaw.
    const tx=(Math.cos(yaw)*x-Math.sin(yaw)*z)*4.2;
    const tz=(-Math.sin(yaw)*x-Math.cos(yaw)*z)*4.2;
    const moving=Math.hypot(x,z)>.01;
    const blend=1-Math.exp(-dt*(moving?11:15));
    this.velocity.x+=(tx-this.velocity.x)*blend;
    this.velocity.z+=(tz-this.velocity.z)*blend;
    const nx=this.position.x+this.velocity.x*dt;
    if(!this.collides(nx,this.position.z))this.position.x=nx;
    else this.velocity.x=0;
    const nz=this.position.z+this.velocity.z*dt;
    if(!this.collides(this.position.x,nz))this.position.z=nz;
    else this.velocity.z=0;
    if(!this.grounded){
      this.velocity.y-=11.8*dt;
      this.position.y+=this.velocity.y*dt;
      if(this.position.y<=this.height){
        this.position.y=this.height;this.velocity.y=0;this.grounded=true;
      }
    }
    this.phase+=dt;
    const speed=Math.hypot(this.velocity.x,this.velocity.z);
    return !reducedMotion&&this.grounded?Math.sin(this.phase*9)*Math.min(4,speed)*.008:0;
  }
  snapshot(id:string,displayName:string,yaw:number,pitch:number,sequence:number){
    return {id,displayName,position:{...this.position},yaw,pitch,sequence};
  }
}
