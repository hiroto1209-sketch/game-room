import * as THREE from "three";
import {COOP_PLAZA} from "../../shared/coopRules.js";
import {batchStaticMeshes} from "./staticBatch.ts";

/**
 * A small flat yard north of the house. Static boxes are merged into a few
 * draw calls. No point lights, so phones do not pay for extra lighting.
 */
export class CoopPlaza{
  readonly root=new THREE.Group();
  readonly batched:number;
  constructor(scene:THREE.Scene){
    this.root.name="COOP_PLAZA";
    const floor=new THREE.MeshStandardMaterial({color:0x3a455c,roughness:1});
    const post=new THREE.MeshStandardMaterial({color:0x6e4b6a,roughness:.92});
    const cap=new THREE.MeshBasicMaterial({color:0xffd19a});
    const box=(w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
      mesh.position.set(x,y,z);
      mesh.castShadow=false;mesh.receiveShadow=false;
      this.root.add(mesh);
    };
    const midX=(COOP_PLAZA.minX+COOP_PLAZA.maxX)/2;
    const midZ=(COOP_PLAZA.minZ+COOP_PLAZA.maxZ)/2;
    box(COOP_PLAZA.maxX-COOP_PLAZA.minX,.08,COOP_PLAZA.maxZ-COOP_PLAZA.minZ,floor,midX,.04,midZ);
    box(3.2,.06,8,floor,16,.05,30);
    for(const [x,z] of [
      [COOP_PLAZA.minX+1.2,COOP_PLAZA.minZ+1.2],
      [COOP_PLAZA.maxX-1.2,COOP_PLAZA.minZ+1.2],
      [COOP_PLAZA.minX+1.2,COOP_PLAZA.maxZ-1.2],
      [COOP_PLAZA.maxX-1.2,COOP_PLAZA.maxZ-1.2]
    ]){
      box(.28,2.15,.28,post,x,1.1,z);
      box(.42,.16,.42,cap,x,2.22,z);
    }
    this.batched=batchStaticMeshes(this.root);
    scene.add(this.root);
  }
}
