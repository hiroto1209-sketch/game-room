import type { PerspectiveCamera } from "three";
import type { Vector3 } from "../types/Player";
export class CameraController{
  yaw=0;
  pitch=0;
  constructor(private camera:PerspectiveCamera){}
  drag(dx:number,dy:number,sensitivity:number):void{
    this.yaw-=dx*sensitivity*.001;
    this.pitch=Math.max(-1.22,Math.min(1.2,this.pitch-dy*sensitivity*.001));
  }
  update(position:Vector3,bob=0):void{
    this.camera.position.set(position.x,position.y+bob,position.z);
    this.camera.rotation.order="YXZ";
    this.camera.rotation.set(this.pitch,this.yaw,0);
  }
  reset():void{this.yaw=0;this.pitch=0;}
}
