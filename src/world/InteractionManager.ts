import type { WorldTarget } from "./PartyWorld.js";
import type { Vector3 } from "../types/Player";
export class InteractionManager{
  constructor(private targets:readonly WorldTarget[],private reach=2.5){}
  closest(position:Vector3):WorldTarget|null{
    let nearest:WorldTarget|null=null,dist=this.reach;
    for(const target of this.targets){
      const d=Math.hypot(position.x-target.x,position.z-target.z);
      if(d<dist){dist=d;nearest=target;}
    }
    return nearest;
  }
}
