import type * as THREE from "three";
import type { MediaMonitor } from "./MediaMonitor";
import type { OutdoorWorld } from "./OutdoorWorld";
import type {SignMarquee} from "./SignMarquee";
import type {FloorOthello} from "./FloorOthello";
export type Collider = {x0:number;x1:number;z0:number;z1:number};
export type WorldTarget = {x:number;z:number;label:string;action:()=>void};
export interface PartyWorld {
  scene:THREE.Scene; camera:THREE.PerspectiveCamera; renderer:THREE.WebGLRenderer;
  monitor:MediaMonitor;
  outdoor:OutdoorWorld;
  signBoard:SignMarquee;
  othelloBoard:FloorOthello;
  colliders:Collider[]; targets:WorldTarget[];
  resize():void; update(dt:number,time:number,reducedMotion?:boolean):void;
  setExposure(value:number):void;resetParty():void;setPartyMode(enabled:boolean):void;dispose():void;
}
export function createPartyWorld(canvas:HTMLCanvasElement,onToast:(text:string)=>void,onEditMonitor:()=>void,onEditLights:(enabled:boolean)=>void,onEditSign:()=>void):PartyWorld;
