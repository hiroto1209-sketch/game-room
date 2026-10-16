import * as THREE from "three";
import {MAX_HP} from "../../shared/combatRules.js";
import {shotObstructed} from "../../shared/worldRules.js";
import {applyFoeDamage, findFoeHit, foeEye, foeSlot, freshCoop, reviveFoes, type CoopState, type FoeState} from "../../shared/coopRules.js";

type Rig={
  id:string;
  group:THREE.Group;
  body:THREE.MeshStandardMaterial;
  fill:THREE.Mesh;
  bar:THREE.Group;
};

/**
 * Three shared plaza targets. Online HP comes from the Worker.
 * Offline shots use the same shared damage rule and never touch other players.
 */
export class CoopFoes{
  readonly group=new THREE.Group();
  private state:CoopState=freshCoop();
  private readonly rigs:Rig[]=[];
  constructor(scene:THREE.Scene){
    this.group.name="COOP_FOES";
    this.group.userData.noBatch=true;
    scene.add(this.group);
    const barMat=new THREE.MeshBasicMaterial({color:0x1c2433});
    const fillMat=new THREE.MeshBasicMaterial({color:0x8cf0c2});
    for(const slot of this.state.foes){
      const where=foeSlot(slot.id);
      if(!where)continue;
      const group=new THREE.Group();
      group.position.set(where.x,0,where.z);
      const bodyMat=new THREE.MeshStandardMaterial({color:0xd98a3a,roughness:.7});
      const headMat=new THREE.MeshStandardMaterial({color:0xf2d2b0,roughness:.65});
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(.32,.7,3,6),bodyMat);
      body.position.y=.95;body.castShadow=false;
      const head=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),headMat);
      head.position.y=1.58;head.castShadow=false;
      const bar=new THREE.Group();
      bar.position.y=2.12;
      const back=new THREE.Mesh(new THREE.PlaneGeometry(.78,.09),barMat);
      const fill=new THREE.Mesh(new THREE.PlaneGeometry(.72,.05),fillMat);
      fill.position.z=.01;
      bar.add(back,fill);
      bar.visible=false;
      group.add(body,head,bar);
      this.group.add(group);
      this.rigs.push({id:slot.id,group,body:bodyMat,fill,bar});
    }
  }
  get enabled(){return this.state.enabled}
  get cleared(){return this.state.cleared}
  foe(id:string):FoeState|undefined{return this.state.foes.find(f=>f.id===id)}
  /** Replace Worker state. Returns new damage numbers to float, one per drop. */
  applyServer(next:CoopState,now=Date.now()):{id:string;damage:number;point:{x:number;y:number;z:number}}[]{
    const drops:{id:string;damage:number;point:{x:number;y:number;z:number}}[]=[];
    for(const foe of next.foes){
      const prev=this.foe(foe.id);
      const eye=foeEye(foe.id);
      if(prev&&eye&&foe.hp<prev.hp)
        drops.push({id:foe.id,damage:prev.hp-foe.hp,point:{x:eye.x,y:eye.y+.15,z:eye.z}});
    }
    this.state={enabled:next.enabled,cleared:next.cleared,foes:next.foes.map(f=>({...f}))};
    this.pose(now);
    return drops;
  }
  setEnabled(enabled:boolean,now=Date.now()):void{
    if(enabled&&!this.state.enabled)
      this.state={enabled:true,cleared:false,foes:freshCoop().foes};
    else this.state={...this.state,enabled};
    this.pose(now);
  }
  aim(origin:{x:number;y:number;z:number},yaw:number,pitch:number,now=Date.now()){
    const foes=reviveFoes(this.state.foes,now);
    return findFoeHit(origin,yaw,pitch,foes,shotObstructed);
  }
  /** Offline only. Online damage stays inside the Durable Object. */
  shoot(origin:{x:number;y:number;z:number},yaw:number,pitch:number,now=Date.now()){
    if(!this.state.enabled)return null;
    const base={...this.state,foes:reviveFoes(this.state.foes,now)};
    const hit=findFoeHit(origin,yaw,pitch,base.foes,shotObstructed);
    if(!hit){this.state=base;this.pose(now);return null;}
    const applied=applyFoeDamage(base,hit.id,now);
    this.state=applied.state;
    this.pose(now);
    return applied.damage>0?{...hit,damage:applied.damage,justCleared:applied.justCleared}:null;
  }
  update(camera:THREE.Camera,player:{x:number;z:number},now=Date.now()):void{
    const near=Math.hypot(player.x-19,player.z-40)<58;
    this.group.visible=near;
    if(!near)return;
    if(this.state.foes.some(f=>f.hp<=0&&f.downUntil>0&&now>=f.downUntil)){
      this.state={...this.state,foes:reviveFoes(this.state.foes,now)};
    }
    this.pose(now);
    for(const rig of this.rigs)rig.bar.quaternion.copy(camera.quaternion);
  }
  private pose(now:number):void{
    for(const rig of this.rigs){
      const foe=this.foe(rig.id);
      if(!foe)continue;
      const down=foe.hp<=0;
      rig.group.visible=!down;
      rig.bar.visible=!down&&foe.hp<MAX_HP;
      const ratio=Math.max(0.04,foe.hp/MAX_HP);
      rig.fill.scale.x=ratio;
      rig.body.emissive.setHex(down?0x000000:foe.hp<MAX_HP?0x5a2a12:0x000000);
    }
  }
}
