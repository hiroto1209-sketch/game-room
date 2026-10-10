import * as THREE from "three";
import {OUTDOOR, insideHouse, terrainVisualHeightAt} from "../../shared/worldRules.js";

/**
 * One continuous ground sheet, no temporary fallback/slabs or swapping terrain
 * at chunk edges. Collision and visual bed heights derive from shared world rules.
 * Vegetation remains the only near-camera streaming workload.
 */
export class TerrainSurface {
  readonly mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshStandardMaterial>;
  constructor(scene:THREE.Scene){
    const width=OUTDOOR.maxX-OUTDOOR.minX;
    const depth=OUTDOOR.maxZ-OUTDOOR.minZ;
    // ~12k vertices / one draw call, created once. Never animated.
    const geometry=new THREE.PlaneGeometry(width,depth,128,96);
    geometry.rotateX(-Math.PI/2);
    const offsetX=(OUTDOOR.maxX+OUTDOOR.minX)/2;
    const offsetZ=(OUTDOOR.maxZ+OUTDOOR.minZ)/2;
    const attr=geometry.attributes.position;
    const colors:number[]=[];
    const color=new THREE.Color();
    for(let i=0;i<attr.count;i++){
      const x=offsetX+attr.getX(i),z=offsetZ+attr.getZ(i);
      const h=insideHouse(x,z,-.25)?-.23:terrainVisualHeightAt(x,z);
      attr.setY(i,h-.02);
      // Gentle hill colors stay consistent throughout the world, including
      // in the distance. No per-chunk palette switches or dark fallback.
      const landscape=.5+.5*Math.sin(x*.055+z*.074);
      color.setHSL(.345+.01*landscape,.26+.045*landscape,.22+Math.max(0,h)*.026);
      colors.push(color.r,color.g,color.b);
    }
    geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({
      color:0xffffff,vertexColors:true,roughness:1,metalness:0,side:THREE.FrontSide
    });
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name="SINGLE_CONTINUOUS_TERRAIN";
    mesh.position.set(offsetX,0,offsetZ);
    mesh.receiveShadow=false;
    mesh.frustumCulled=true;
    scene.add(mesh);
    this.mesh=mesh;
  }
  dispose():void{
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();this.mesh.material.dispose();
  }
}
