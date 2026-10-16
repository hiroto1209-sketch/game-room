import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";

/** Collapse unmoving sibling meshes that share a look into one draw call.
 * Only direct children are merged, so a group that toggles visibility
 * (hidden grotto, monitor, balloons) keeps its own meshes.
 * Named meshes and anything marked userData.noBatch stay addressable.
 * Transparent surfaces stay separate so they keep their own sort.
 */
function materialKey(material:THREE.Material):string|null{
  if(!(material instanceof THREE.MeshStandardMaterial)&&!(material instanceof THREE.MeshBasicMaterial))return null;
  if(material.transparent&&material.opacity<.99)return null;
  if(material.vertexColors)return null;
  const emissive=material instanceof THREE.MeshStandardMaterial?material.emissive.getHexString():"";
  const rough=material instanceof THREE.MeshStandardMaterial?material.roughness:"";
  const metal=material instanceof THREE.MeshStandardMaterial?material.metalness:"";
  return [
    material.type,material.color.getHexString(),emissive,rough,metal,
    material.opacity,material.side,material.depthWrite?1:0,
    material.toneMapped===false?0:1,material.map?.uuid??""
  ].join("|");
}

export function batchStaticMeshes(root:THREE.Object3D,skip:readonly THREE.Object3D[]=[]):number{
  root.updateMatrixWorld(true);
  const skipSet=new Set(skip);
  const buckets=new Map<string,{material:THREE.Material;meshes:THREE.Mesh[]}>();
  for(const obj of root.children){
    if(skipSet.has(obj)||obj.userData?.noBatch)continue;
    if(obj instanceof THREE.Mesh&&!(obj instanceof THREE.InstancedMesh)&&!obj.name&&!Array.isArray(obj.material)){
      const key=materialKey(obj.material);
      if(!key)continue;
      let bucket=buckets.get(key);
      if(!bucket){bucket={material:obj.material,meshes:[]};buckets.set(key,bucket);}
      bucket.meshes.push(obj);
    }
  }
  let absorbed=0;
  for(const bucket of buckets.values()){
    if(bucket.meshes.length<2)continue;
    const pieces:THREE.BufferGeometry[]=[];
    for(const mesh of bucket.meshes){
      const geometry=mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      pieces.push(geometry);
    }
    let merged:THREE.BufferGeometry|null=null;
    try{merged=mergeGeometries(pieces,false);}catch{merged=null;}
    for(const geometry of pieces)geometry.dispose();
    if(!merged)continue;
    const mesh=new THREE.Mesh(merged,bucket.material);
    mesh.userData.batched=bucket.meshes.length;
    mesh.castShadow=false;mesh.receiveShadow=false;
    mesh.frustumCulled=true;
    root.add(mesh);
    const extras=new Set<THREE.Material>();
    for(const old of bucket.meshes){
      if(old.material!==bucket.material)extras.add(old.material as THREE.Material);
      old.removeFromParent();
      old.geometry.dispose();
    }
    for(const extra of extras)extra.dispose();
    absorbed+=bucket.meshes.length;
  }
  return absorbed;
}
