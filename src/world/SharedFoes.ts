import * as THREE from "three";
import {MAX_HP} from "../../shared/combatRules.js";
import {shotObstructed} from "../../shared/worldRules.js";
import {applyFoeDamage, findFoeHit, foeEye, foeSlot, freshFoes, reviveFoes, type FoeState} from "../../shared/foeRules.js";
import {stageGround} from "../../shared/playcanvasRules.js";

type Rig={
  id:string;
  group:THREE.Group;
  fill:THREE.Mesh;
  bar:THREE.Group;
};

/** Shared orange figures on the FPS map. Online HP comes from the Worker. */
export class SharedFoes{
  readonly group=new THREE.Group();
  private foes:FoeState[]=freshFoes();
  private readonly rigs:Rig[]=[];
  constructor(scene:THREE.Scene){
    this.group.name="SHARED_FOES";
    this.group.userData.noBatch=true;
    scene.add(this.group);
    const barMat=new THREE.MeshBasicMaterial({color:0x1c2433});
    const fillMat=new THREE.MeshBasicMaterial({color:0x8cf0c2});
    const eyeMat=new THREE.MeshBasicMaterial({color:0x1a120c});
    for(const slot of this.foes){
      const where=foeSlot(slot.id);
      if(!where)continue;
      const group=new THREE.Group();
      group.position.set(where.x,0,where.z);
      group.rotation.y=Math.PI;
      const bodyMat=new THREE.MeshStandardMaterial({color:0xd98a3a,roughness:.7});
      const headMat=new THREE.MeshStandardMaterial({color:0xf2d2b0,roughness:.65});
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.32,.7,3,6),bodyMat);
      body.position.y=.95;
      const head=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),headMat);
      head.position.y=1.58;
      for(const side of [-1,1]){
        const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,6,5),eyeMat);
        eye.position.set(side*.08,.04,-.18);
        head.add(eye);
      }
      const bar=new THREE.Group();
      bar.position.y=2.12;
      const back=new THREE.Mesh(new THREE.PlaneGeometry(.78,.09),barMat);
      const fill=new THREE.Mesh(new THREE.PlaneGeometry(.72,.05),fillMat);
      fill.position.z=.01;
      bar.add(back,fill);
      bar.visible=false;
      group.add(body,head,bar);
      this.group.add(group);
      this.rigs.push({id:slot.id,group,fill,bar});
    }
  }
  foe(id:string):FoeState|undefined{return this.foes.find(f=>f.id===id)}
  applyServer(next:FoeState[],now=Date.now()):{id:string;damage:number;point:{x:number;y:number;z:number}}[]{
    const drops:{id:string;damage:number;point:{x:number;y:number;z:number}}[]=[];
    for(const foe of next){
      const prev=this.foe(foe.id);
      const eye=foeEye(foe.id);
      if(prev&&eye&&foe.hp<prev.hp)
        drops.push({id:foe.id,damage:prev.hp-foe.hp,point:{x:eye.x,y:eye.y+.15,z:eye.z}});
    }
    this.foes=next.map(f=>({...f}));
    this.pose(now);
    return drops;
  }
  aim(origin:{x:number;y:number;z:number},yaw:number,pitch:number,now=Date.now()){
    return findFoeHit(origin,yaw,pitch,reviveFoes(this.foes,now),shotObstructed);
  }
  shoot(origin:{x:number;y:number;z:number},yaw:number,pitch:number,now=Date.now()){
    const foes=reviveFoes(this.foes,now);
    const hit=findFoeHit(origin,yaw,pitch,foes,shotObstructed);
    if(!hit){this.foes=foes;this.pose(now);return null;}
    const applied=applyFoeDamage(foes,hit.id,now);
    this.foes=applied.foes;
    this.pose(now);
    return applied.damage>0?{damage:applied.damage,point:hit.point}:null;
  }
  update(camera:THREE.Camera,player:{x:number;z:number},now=Date.now()):void{
    const near=player.x>100&&player.x<160&&Math.abs(player.z)<40;
    this.group.visible=near;
    if(!near)return;
    this.foes=reviveFoes(this.foes,now);
    this.pose(now);
    for(const rig of this.rigs){
      rig.bar.quaternion.copy(camera.quaternion);
    }
  }
  private pose(now:number):void{
    const foes=reviveFoes(this.foes,now);
    for(const rig of this.rigs){
      const foe=foes.find(f=>f.id===rig.id);
      const where=foeSlot(rig.id);
      if(!foe||!where)continue;
      const foot=stageGround(where.x,where.z,1.2)??0;
      rig.group.position.set(where.x,foot,where.z);
      const down=foe.hp<=0;
      rig.group.visible=!down;
      rig.bar.visible=!down&&foe.hp<MAX_HP;
      rig.fill.scale.x=Math.max(.04,foe.hp/MAX_HP);
    }
  }
}
