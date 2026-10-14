import * as THREE from 'three';
import {currentResidentPose,EMPTY_MOTION,TOKOTOKO,holdResident,type ResidentMotion} from '../../shared/residentRules.js';

export class TokotokoResident {
 readonly root=new THREE.Group();
 motion:ResidentMotion={...EMPTY_MOTION};
 private mixer:THREE.AnimationMixer|undefined;
 private walk:THREE.AnimationAction|undefined;
 private idle:THREE.AnimationAction|undefined;
 private loading:Promise<void>|undefined;
 private phase:'unloaded'|'loading'|'ready'|'error'='unloaded';
 private moving=false;
 private retryAt=0;
 private disposed=false;
 constructor(private scene:THREE.Scene){this.root.name='TOKOTOKO_RESIDENT';this.root.scale.setScalar(TOKOTOKO.scale);this.root.visible=false;scene.add(this.root);}
 get status(){return this.phase;}
 get talkable(){return this.phase==='ready'&&this.root.visible;}
 get isWalking(){return this.moving;}
 hold(now:number,viewer:{x:number;z:number},extend=false){this.motion=holdResident(now,this.motion,viewer,extend);}
 load():Promise<void>{
  if(this.loading)return this.loading;
  this.phase='loading';
  this.loading=(async()=>{
   try{
    const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
    const gltf=await new GLTFLoader().loadAsync(import.meta.env.BASE_URL+'tokotoko/tokotoko.glb');
    if(this.disposed){this.release(gltf.scene);return;}
    const walk=THREE.AnimationClip.findByName(gltf.animations,'Walk'),idle=THREE.AnimationClip.findByName(gltf.animations,'Idle');
    if(!walk||!idle){this.release(gltf.scene);throw Error('TOKOTOKO animations missing');}
    this.root.add(gltf.scene);this.mixer=new THREE.AnimationMixer(gltf.scene);
    this.walk=this.mixer.clipAction(walk);this.idle=this.mixer.clipAction(idle);this.idle.play();this.phase='ready';
   }catch(error){if(!this.disposed){this.phase='error';this.retryAt=Date.now()+5000;this.loading=undefined;console.warn('TOKOTOKO could not load',error);}}
  })();return this.loading;
 }
 update(player:{x:number;z:number},dt:number,now:number,playing:boolean,reducedMotion:boolean):void{
  if(this.disposed)return;
  const pose=currentResidentPose(now,this.motion);this.root.position.set(pose.x,0,pose.z);this.root.rotation.y=pose.yaw;
  const near=Math.hypot(player.x-pose.x,player.z-pose.z)<45;
  if(playing&&near&&(player.x>5.5||player.x< -10)&&(this.phase==='unloaded'||this.phase==='error')&&Date.now()>=this.retryAt)void this.load();
  this.root.visible=this.phase==='ready'&&near;
  if(!this.mixer||!this.walk||!this.idle||!near)return;
  const moving=pose.moving&&!reducedMotion;
  if(moving!==this.moving){
   const next=moving?this.walk:this.idle,previous=moving?this.idle:this.walk;
   next.reset().setEffectiveWeight(1).fadeIn(.16).play();previous.fadeOut(.16);this.moving=moving;
  }
  if(reducedMotion){this.mixer.setTime(0);return;}
  this.walk.setEffectiveTimeScale(TOKOTOKO.speed/(.65*TOKOTOKO.scale));
  this.mixer.update(Math.max(0,dt));
  // Use the shared motion clock for foot phase, including after low-FPS frames.
  if(moving)this.walk.time=(pose.animationTime*TOKOTOKO.speed/(.65*TOKOTOKO.scale))%this.walk.getClip().duration;
  else this.idle.time=(now/1000)%this.idle.getClip().duration;
  this.mixer.update(0);
 }
 private release(root:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 }
 dispose(){this.disposed=true;this.mixer?.stopAllAction();if(this.root.children[0])this.mixer?.uncacheRoot(this.root.children[0]);this.scene.remove(this.root);this.release(this.root);}
}
