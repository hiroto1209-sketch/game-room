import * as THREE from "three";
import {aimDirection,raySphereDistance,DAMAGE,MAX_HP,RANGE} from "../../shared/combatRules.js";
import {shotObstructed} from "../../shared/worldRules.js";
import {stageGround} from "../../shared/playcanvasRules.js";

export const PRACTICE_HEAD_DAMAGE=50;
const LANES=[
  {ax:128,az:-2,bx:134,bz:-2},
  {ax:136,az:0,bx:140,bz:0},
  {ax:124,az:-8,bx:124,bz:-2}
] as const;

type Dummy={
  group:THREE.Group;
  body:THREE.Mesh;
  head:THREE.Mesh;
  ax:number;az:number;bx:number;bz:number;
  phase:number;
  hp:number;
  down:number;
  flash:number;
  x:number;z:number;foot:number;
};

/**
 * Local moving targets inside the imported FPS map. Damage never leaves
 * this browser: online players still use the Worker hitscan.
 */
export class PracticeDummies{
  readonly group=new THREE.Group();
  private readonly dummies:Dummy[]=[];
  private readonly materials:THREE.Material[]=[];
  constructor(scene:THREE.Scene){
    this.group.name="PRACTICE_DUMMIES";
    this.group.userData.noBatch=true;
    scene.add(this.group);
    LANES.forEach((lane,index)=>{
      const group=new THREE.Group();
      group.name="PRACTICE_DUMMY_"+index;
      const bodyMat=new THREE.MeshStandardMaterial({color:0xc4556a,roughness:.7,emissive:0x000000});
      const headMat=new THREE.MeshStandardMaterial({color:0xf2d2b0,roughness:.6});
      this.materials.push(bodyMat,headMat);
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.32,.7,3,6),bodyMat);
      body.position.y=.95;body.castShadow=false;
      const head=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),headMat);
      head.position.y=1.58;
      group.add(body,head);
      this.group.add(group);
      this.dummies.push({
        group,body,head,ax:lane.ax,az:lane.az,bx:lane.bx,bz:lane.bz,
        phase:index*1.7,hp:MAX_HP,down:0,flash:0,x:lane.ax,z:lane.az,foot:0
      });
    });
  }
  update(dt:number,player:{x:number;z:number}):void{
    const near=player.x>100&&player.x<160&&Math.abs(player.z)<40;
    this.group.visible=near;
    if(!near)return;
    for(const dummy of this.dummies){
      if(dummy.down>0){
        dummy.down=Math.max(0,dummy.down-dt);
        dummy.group.visible=false;
        if(dummy.down===0)dummy.hp=MAX_HP;
        continue;
      }
      dummy.group.visible=true;
      dummy.phase+=dt;
      const swing=(Math.sin(dummy.phase*.65)+1)*.5;
      dummy.x=dummy.ax+(dummy.bx-dummy.ax)*swing;
      dummy.z=dummy.az+(dummy.bz-dummy.az)*swing;
      const ground=stageGround(dummy.x,dummy.z,1.2);
      dummy.foot=ground??0;
      dummy.group.position.set(dummy.x,dummy.foot,dummy.z);
      dummy.group.rotation.y=Math.atan2(dummy.bx-dummy.ax,dummy.bz-dummy.az);
      if(dummy.flash>0)dummy.flash=Math.max(0,dummy.flash-dt);
      (dummy.body.material as THREE.MeshStandardMaterial).emissive.setHex(dummy.flash>0?0xff6a4a:0x000000);
    }
  }
  /** Returns local damage when the aim ray meets a live dummy. */
  shoot(origin:{x:number;y:number;z:number},yaw:number,pitch:number):{damage:number;head:boolean;point:{x:number;y:number;z:number}}|null{
    if(!this.group.visible)return null;
    const dir=aimDirection(yaw,pitch);
    let best:number|null=null,index=-1,head=false;
    for(let i=0;i<this.dummies.length;i++){
      const dummy=this.dummies[i];
      if(dummy.down>0||dummy.hp<=0)continue;
      const base={x:dummy.x,y:dummy.foot+1.65,z:dummy.z};
      const bodyHit=raySphereDistance(origin,dir,{x:base.x,y:base.y-.80,z:base.z},.59);
      const headHit=raySphereDistance(origin,dir,{x:base.x,y:base.y-.12,z:base.z},.31);
      const useHead=headHit!==null&&(bodyHit===null||headHit<=bodyHit);
      const hit=useHead?headHit:bodyHit;
      if(hit===null||hit>RANGE||(best!==null&&hit>=best))continue;
      const point={x:origin.x+dir.x*hit,y:origin.y+dir.y*hit,z:origin.z+dir.z*hit};
      if(shotObstructed(origin,point))continue;
      best=hit;index=i;head=useHead;
    }
    if(index<0||best===null)return null;
    const dummy=this.dummies[index];
    const damage=head?PRACTICE_HEAD_DAMAGE:DAMAGE;
    dummy.hp=Math.max(0,dummy.hp-damage);
    dummy.flash=.12;
    if(dummy.hp===0)dummy.down=2.4;
    const point={x:origin.x+dir.x*best,y:origin.y+dir.y*best,z:origin.z+dir.z*best};
    return {damage,head,point};
  }
  dispose():void{
    this.group.parent?.remove(this.group);
    this.group.traverse(obj=>{
      if(obj instanceof THREE.Mesh)obj.geometry.dispose();
    });
    for(const material of this.materials)material.dispose();
  }
}
