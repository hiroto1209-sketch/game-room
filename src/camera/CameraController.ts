import type { PerspectiveCamera } from "three";
import type { Vector3 } from "../types/Player";
import {recoilDelta} from "./recoilMath";
export class CameraController{
  yaw=0;
  pitch=0;
  constructor(private camera:PerspectiveCamera){}
  drag(dx:number,dy:number,sensitivity:number):void{
    this.yaw-=dx*sensitivity*.001;
    this.pitch=Math.max(-1.22,Math.min(1.2,this.pitch-dy*sensitivity*.001));
  }
  // Server still receives the camera yaw/pitch. ADS reduces *actual*
  // recoil so repeated shots are easier to control, not merely enlarged.
  kickRecoil(ads:boolean):void{
    const delta=recoilDelta(ads);
    this.pitch=Math.min(1.2,this.pitch+delta.pitch);
    this.yaw+=delta.yaw;
  }
  update(position:Vector3,bob=0):void{
    this.camera.position.set(position.x,position.y+bob,position.z);
    this.camera.rotation.order="YXZ";
    this.camera.rotation.set(this.pitch,this.yaw,0);
  }
  reset():void{this.yaw=0;this.pitch=0;}
}
