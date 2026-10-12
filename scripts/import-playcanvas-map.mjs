// Exact offline import: no hand-authored or screenshot-derived placements.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const [source,sceneFile,output='public/playcanvas-fps']=process.argv.slice(2);
if(!source||!sceneFile)throw Error('Usage: node scripts/import-playcanvas-map.mjs EXPORT_DIR SCENE_JSON [OUTPUT_DIR]');
const config=JSON.parse(await fs.readFile(path.join(source,'config.json'),'utf8'));
const sceneBytes=await fs.readFile(sceneFile);
const entities=JSON.parse(sceneBytes).entities,assets=config.assets;
const container=Object.values(assets).find(a=>a.type==='container');
if(!container?.file)throw Error('Missing original container');
const bytes=await fs.readFile(path.join(source,decodeURIComponent(container.file.url)));
const md5=crypto.createHash('md5').update(bytes).digest('hex');
if(md5!==container.file.hash)throw Error('Container hash mismatch');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const matrices=new Map();
function worldMatrix(id){
 if(matrices.has(id))return matrices.get(id);
 const e=entities[id];if(!e)throw Error('Missing parent '+id);
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...e.rotation.map(THREE.MathUtils.degToRad),'ZYX'));
 const m=new THREE.Matrix4().compose(new THREE.Vector3(...e.position),q,new THREE.Vector3(...e.scale));
 if(e.parent)m.premultiply(worldMatrix(e.parent));matrices.set(id,m);return m;
}
function active(id){const e=entities[id];return e.enabled!==false&&(!e.parent||active(e.parent));}
const buckets=new Map(),records=[],triangles=[];
const bounds=new THREE.Box3();let vertices=0;
// User-approved integration doorway; all other source triangles are untouched.
const door={min:[-13,-.02,-6.6],max:[-12,2.8,-3.4]};
function cutDoor(geometry){
 const source=geometry.toNonIndexed(),p=source.attributes.position,n=source.attributes.normal;
 const positions=[],normals=[];
 for(let i=0;i<p.count;i+=3){
  let polygon=[0,1,2].map(j=>({p:[p.getX(i+j),p.getY(i+j),p.getZ(i+j)],n:[n.getX(i+j),n.getY(i+j),n.getZ(i+j)]}));
  const overlap=[0,1,2].every(axis=>Math.max(...polygon.map(v=>v.p[axis]))>=door.min[axis]&&Math.min(...polygon.map(v=>v.p[axis]))<=door.max[axis]);
  if(!overlap){for(const v of polygon){positions.push(...v.p);normals.push(...v.n);}continue;}
  const fragments=[];
  for(const [axis,sign,value] of [[0,-1,door.min[0]],[0,1,door.max[0]],[1,-1,door.min[1]],[1,1,door.max[1]],[2,-1,door.min[2]],[2,1,door.max[2]]]){
   if(!polygon.length)break;
   const inside=[],outside=[];
   for(let j=0;j<polygon.length;j++){
    const a=polygon[j],b=polygon[(j+1)%polygon.length];
    const da=sign*(a.p[axis]-value),db=sign*(b.p[axis]-value);
    (da<=0?inside:outside).push(a);
    if((da<0&&db>0)||(da>0&&db<0)){
     const t=da/(da-db),v={p:a.p.map((x,k)=>x+(b.p[k]-x)*t),n:a.n.map((x,k)=>x+(b.n[k]-x)*t)};
     inside.push(v);outside.push(v);
    }
   }
   if(outside.length>=3)fragments.push(outside);polygon=inside;
  }
  for(const poly of fragments)for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){
   positions.push(...v.p);normals.push(...v.n);
  }
 }
 source.dispose();geometry.dispose();
 return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  .setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
}
for(const [id,e] of Object.entries(entities)){
 const r=e.components.render;
 if(!r||r.enabled===false||r.type!=='asset'||!active(id))continue;
 const asset=assets[r.asset];if(asset.data.containerAsset!==Number(container.id))throw Error('Unexpected geometry container');
 const original=await gltf.parser.getDependency('mesh',asset.data.renderIndex);
 if(!original.isMesh)throw Error('Expected single-primitive mesh');
 let geometry=original.geometry.clone().applyMatrix4(worldMatrix(id));
 for(const [key,attr] of Object.entries(geometry.attributes)){
  if(!attr.isInterleavedBufferAttribute)continue;
  const values=new Float32Array(attr.count*attr.itemSize);
  for(let i=0;i<attr.count;i++)for(let j=0;j<attr.itemSize;j++)values[i*attr.itemSize+j]=attr.data.array[i*attr.data.stride+attr.offset+j];
  geometry.setAttribute(key,new THREE.BufferAttribute(values,attr.itemSize));
 }
 const originalTriangleCount=(geometry.index?.count??geometry.attributes.position.count)/3;
 geometry=cutDoor(geometry);
 const pos=geometry.attributes.position,idx=geometry.index;
 for(let n=0;n<(idx?.count??pos.count);n+=3){
  for(let j=0;j<3;j++){
   const k=idx?idx.getX(n+j):n+j;
   triangles.push(pos.getX(k),pos.getY(k),pos.getZ(k));
  }
 }
 vertices+=pos.count;geometry.computeBoundingBox();bounds.union(geometry.boundingBox);
 const matId=String(r.materialAssets[0]);if(!assets[matId])throw Error('Missing original material');
 if(!buckets.has(matId))buckets.set(matId,[]);buckets.get(matId).push(geometry);
 records.push({id,name:e.name,renderIndex:asset.data.renderIndex,material:matId,
  matrix:worldMatrix(id).toArray(),vertices:pos.count,originalTriangles:originalTriangleCount,triangles:(idx?.count??pos.count)/3,
  bounds:geometry.boundingBox.toArray?.()??{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}});
}
const root=new THREE.Group();root.name='PLAYCANVAS_626211_EXACT_SCENE';
for(const [id,geometries] of buckets){
 const data=assets[id].data;
 const material=new THREE.MeshStandardMaterial({
  color:new THREE.Color(...data.diffuse).convertSRGBToLinear(),
  metalness:data.metalness??0,roughness:Math.sqrt(2/((data.shininess??60)+2)),
  side:THREE.DoubleSide,opacity:data.opacity??1,transparent:(data.opacity??1)<1
 });
 material.name=assets[id].name;
 const merged=mergeGeometries(geometries),indexed=mergeVertices(merged,1e-7);merged.dispose();
 const mesh=new THREE.Mesh(indexed,material);mesh.name=material.name;
 root.add(mesh);for(const g of geometries)g.dispose();
}
// GLTFExporter uses the browser FileReader API; provide only its Blob operations.
globalThis.FileReader=class{
 readAsArrayBuffer(blob){blob.arrayBuffer().then(b=>{this.result=b;this.onloadend?.();});}
 readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onloadend?.();});}
};
await fs.mkdir(output,{recursive:true});
const packed=await new GLTFExporter().parseAsync(root,{binary:true});
await fs.writeFile(path.join(output,'stage.glb'),Buffer.from(packed));
const collision=new Float32Array(triangles);
// Same exact triangles on the Worker; clients import this chunk only near the map.
await fs.writeFile('shared/playcanvasCollisionData.js',
 "// Generated by scripts/import-playcanvas-map.mjs. Source MD5: "+md5+"\n"+
 "import {setStageGeometry} from './playcanvasRules.js';\n"+
 "const encoded="+JSON.stringify(Buffer.from(collision.buffer).toString('base64'))+";\n"+
 "setStageGeometry(()=>{const s=atob(encoded),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return new Float32Array(b.buffer);});\n");
const manifest={projectId:626211,sourceHash:md5,sceneSha256:crypto.createHash('sha256').update(sceneBytes).digest('hex'),
 originalMeshes:records.length,materials:buckets.size,vertices,originalTriangles:records.reduce((n,r)=>n+r.originalTriangles,0),triangles:triangles.length/9,
 doorway:door,
 bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},records,
 differences:['Static render meshes merged by original material; positions and triangles retained.',
 'User-approved doorway cut at local X -13..-12, Y -0.02..2.8, Z -6.6..-3.4; no other placements changed.',
 'PlayCanvas Blinn materials converted to Three.js PBR; numeric original diffuse colors retained.',
 'Original SSAO and global lighting are not part of the geometry export.']};
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({...manifest,records:undefined},null,2));
