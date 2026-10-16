import * as THREE from "three";
import {aimDirection,RANGE} from "../../shared/combatRules.js";
/** Small bounded pool of one-shot visuals; no projectile or damage authority. */
export class BlasterEffects{
  private readonly effects:{line:THREE.Line;life:number}[]=[];
  private readonly impacts:{mesh:THREE.Mesh;life:number}[]=[];
  private readonly raycaster=new THREE.Raycaster();
  private readonly aim=new THREE.Vector3();
  private readonly origin=new THREE.Vector3();
  constructor(private scene:THREE.Scene){
    const geometry=new THREE.SphereGeometry(.09,6,4);
    for(let i=0;i<8;i++){
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
        color:0xffe2a4,transparent:true,opacity:1,depthWrite:false,toneMapped:false
      }));
      mesh.name="IMPACT_SPARK";
      mesh.visible=false;
      mesh.frustumCulled=false;
      this.scene.add(mesh);
      this.impacts.push({mesh,life:0});
    }
  }
  shoot(position:{x:number;y:number;z:number},yaw:number,pitch:number,impact?:{x:number;y:number;z:number}|null):void{
    const dir=aimDirection(yaw,pitch);
    const right={x:Math.cos(yaw),y:0,z:-Math.sin(yaw)};
    const start=new THREE.Vector3(
      position.x+dir.x*.42+right.x*.1,
      position.y+dir.y*.42-.05,
      position.z+dir.z*.42+right.z*.1
    );
    const end=new THREE.Vector3(position.x+dir.x*RANGE,position.y+dir.y*RANGE,position.z+dir.z*RANGE);
    const geometry=new THREE.BufferGeometry().setFromPoints([start,end]);
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xa6f8ed,transparent:true,opacity:.9,depthWrite:false}));
    line.name="BLASTER_TRACER";
    this.scene.add(line);
    this.effects.push({line,life:.16});
    while(this.effects.length>12)this.removeOldest();
    const spark=impact??this.worldImpact(position,dir);
    if(spark)this.sparkAt(spark);
  }
  private worldImpact(position:{x:number;y:number;z:number},dir:{x:number;y:number;z:number}):{x:number;y:number;z:number}|null{
    this.origin.set(position.x,position.y,position.z);
    this.aim.set(dir.x,dir.y,dir.z);
    this.raycaster.set(this.origin,this.aim);
    this.raycaster.far=RANGE;
    this.raycaster.near=.35;
    const hits=this.raycaster.intersectObjects(this.scene.children,true);
    for(const hit of hits){
      if(!hit.object.visible||hit.distance<.4)continue;
      if(this.skip(hit.object))continue;
      return {x:hit.point.x,y:hit.point.y,z:hit.point.z};
    }
    return null;
  }
  private skip(object:THREE.Object3D):boolean{
    let current:THREE.Object3D|null=object;
    while(current){
      if(current.name==="FPS_WEAPON_SOLIDS"||current.name==="FPS_HOLO_SIGHT"||
        current.name==="IMPACT_SPARK"||current.name==="BLASTER_TRACER"||
        current.name==="PRACTICE_DUMMIES")return true;
      if(current instanceof THREE.Line)return true;
      current=current.parent;
    }
    return false;
  }
  private sparkAt(point:{x:number;y:number;z:number}):void{
    const slot=this.impacts.find(entry=>entry.life<=0)??this.impacts[0];
    slot.life=.12;
    slot.mesh.visible=true;
    slot.mesh.position.set(point.x,point.y,point.z);
    (slot.mesh.material as THREE.MeshBasicMaterial).opacity=1;
  }
  update(dt:number):void{
    for(const entry of this.effects)entry.life-=dt;
    while(this.effects.length&&this.effects[0].life<=0)this.removeOldest();
    for(const e of this.effects)(e.line.material as THREE.LineBasicMaterial).opacity=Math.max(0,e.life/.16);
    for(const spark of this.impacts){
      if(spark.life<=0)continue;
      spark.life-=dt;
      const material=spark.mesh.material as THREE.MeshBasicMaterial;
      material.opacity=Math.max(0,spark.life/.12);
      spark.mesh.visible=spark.life>0;
    }
  }
  private removeOldest():void{
    const e=this.effects.shift();if(!e)return;
    this.scene.remove(e.line);e.line.geometry.dispose();(e.line.material as THREE.Material).dispose();
  }
  dispose():void{
    while(this.effects.length)this.removeOldest();
    for(const spark of this.impacts){
      this.scene.remove(spark.mesh);
      spark.mesh.geometry.dispose();
      (spark.mesh.material as THREE.Material).dispose();
    }
    this.impacts.length=0;
  }
}
