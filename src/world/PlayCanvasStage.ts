import * as THREE from 'three';
import {FPS_STAGE,inFpsStage,setStageAccess} from '../../shared/playcanvasRules.js';

/** Actual exported scene; no screenshot-derived walls or substitute buildings. */
export class PlayCanvasStage{
 readonly root=new THREE.Group();
 status:'idle'|'loading'|'ready'|'failed'='idle';
 /** The playable room is dressed as a forest. Collision geometry stays loaded. */
 forestDress=true;
 private disposed=false;
 private model:THREE.Object3D|null=null;
 private readonly resources:THREE.Mesh[]=[];
 constructor(scene:THREE.Scene,private onToast:(message:string)=>void){
  this.root.name='PLAYCANVAS FPS / 626211';scene.add(this.root);
  setStageAccess(false);
  const ground=new THREE.Mesh(new THREE.BoxGeometry(18,.10,3.2),new THREE.MeshStandardMaterial({color:0x777b83,roughness:1}));
  ground.position.set(111.8,-.055,-5);this.root.add(ground);this.resources.push(ground);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');
  if(ctx){
   ctx.fillStyle='#241c19';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#ff9a37';ctx.lineWidth=10;ctx.strokeRect(5,5,1014,246);
   ctx.textAlign='center';ctx.fillStyle='#ffb563';ctx.font='bold 58px system-ui';ctx.fillText('FPS ORIGINAL MAP →',512,105);
   ctx.fillStyle='#fff3df';ctx.font='26px system-ui';ctx.fillText('Map: ResoForge · CC BY 4.0 · PlayCanvas 626211',512,179);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.4,1.35),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
   sign.position.set(101.7,2.3,-7.4);sign.rotation.y=-Math.PI/2;this.root.add(sign);this.resources.push(sign);
  }
 }
 async load():Promise<void>{
  if(this.status==='ready'||this.status==='loading'||this.disposed)return;
  this.status='loading';
  try{
   const [{GLTFLoader}]=await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('../../shared/playcanvasCollisionData.js')
   ]);
   const gltf=await new GLTFLoader().loadAsync(import.meta.env.BASE_URL+'playcanvas-fps/stage.glb');
   if(this.disposed){this.release(gltf.scene);return;}
   this.model=gltf.scene;this.model.position.set(FPS_STAGE.x,0,FPS_STAGE.z);
   this.model.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.frustumCulled=true;obj.castShadow=false;obj.receiveShadow=false;}});
   this.root.add(this.model);this.status='ready';setStageAccess(true);
  }catch(error){this.status='failed';console.error('Original FPS map load failed',error);this.onToast('FPSマップの読込に失敗しました。近くの看板から再読込できます。');}
 }
 update(p:{x:number;z:number}):void{
  // Nothing is fetched during the original lobby startup.
  if(p.x>87&&Math.abs(p.z)<36&&this.status==='idle')void this.load();
  if(this.model)this.model.visible=inFpsStage(p.x,p.z,58)&&!this.forestDress;
 }
 private release(root:THREE.Object3D):void{
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(obj=>{if(obj instanceof THREE.Mesh){geometries.add(obj.geometry);for(const m of Array.isArray(obj.material)?obj.material:[obj.material])materials.add(m);}});
  for(const g of geometries)g.dispose();for(const m of materials){if(m instanceof THREE.MeshBasicMaterial||m instanceof THREE.MeshStandardMaterial)m.map?.dispose();m.dispose();}
 }
 dispose():void{this.disposed=true;this.root.parent?.remove(this.root);this.release(this.root);this.model=null;}
}
