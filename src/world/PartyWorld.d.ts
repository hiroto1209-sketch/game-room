import type * as THREE from "three";
export type Collider = {x0:number;x1:number;z0:number;z1:number};
export type WorldTarget = {x:number;z:number;label:string;action:()=>void};
export interface PartyWorld {
  scene:THREE.Scene; camera:THREE.PerspectiveCamera; renderer:THREE.WebGLRenderer;
  colliders:Collider[]; targets:WorldTarget[];
  resize():void; update(dt:number,time:number,reducedMotion?:boolean):void;
  setExposure(value:number):void;resetParty():void;dispose():void;
}
export function createPartyWorld(canvas:HTMLCanvasElement,onToast:(text:string)=>void):PartyWorld;
