import type { WorldTarget } from "./PartyWorld.js";
import type { Vector3 } from "../types/Player";
export class InteractionManager{
  private targets:readonly WorldTarget[];
  private reach:number;
  constructor(targets:readonly WorldTarget[],reach=2.5){this.targets=targets;this.reach=reach;}
  closest(position:Vector3):WorldTarget|null{
    let nearest:WorldTarget|null=null,dist=this.reach;
    for(const target of this.targets){
      if(target.enabled&&!target.enabled())continue;
      const d=Math.hypot(position.x-target.x,position.z-target.z);
      if(d<dist){dist=d;nearest=target;}
    }
    return nearest;
  }
}
