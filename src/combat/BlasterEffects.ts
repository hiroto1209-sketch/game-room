import * as THREE from "three";
import {aimDirection,RANGE} from "../../shared/combatRules.js";
/** Small bounded pool of one-shot visuals; no projectile or damage authority. */
export class BlasterEffects{
  private readonly effects:{line:THREE.Line;life:number}[]=[];
  constructor(private scene:THREE.Scene){}
  shoot(position:{x:number;y:number;z:number},yaw:number,pitch:number):void{
    const dir=aimDirection(yaw,pitch);
    const end=new THREE.Vector3(position.x+dir.x*RANGE,position.y+dir.y*RANGE,position.z+dir.z*RANGE);
    const start=new THREE.Vector3(position.x,position.y,position.z);
    const geometry=new THREE.BufferGeometry().setFromPoints([start,end]);
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xa6f8ed,transparent:true,opacity:.9,depthWrite:false}));
    this.scene.add(line);
    this.effects.push({line,life:.16});
    while(this.effects.length>12)this.removeOldest();
  }
  update(dt:number):void{
    for(const entry of this.effects)entry.life-=dt;
    while(this.effects.length&&this.effects[0].life<=0)this.removeOldest();
    for(const e of this.effects)(e.line.material as THREE.LineBasicMaterial).opacity=Math.max(0,e.life/.16);
  }
  private removeOldest():void{
    const e=this.effects.shift();if(!e)return;
    this.scene.remove(e.line);e.line.geometry.dispose();(e.line.material as THREE.Material).dispose();
  }
  dispose():void{while(this.effects.length)this.removeOldest()}
}
