import * as THREE from 'three';
import {POKO_ANCHOR} from '../../shared/residentRules.js';
import {DOOR,groundHeightAt,insideHouse} from '../../shared/worldRules.js';

type Phase='unloaded'|'loading'|'hidden'|'emerging'|'idle'|'hiding'|'error';
const ANCHOR=POKO_ANCHOR;
/** One local welcome character. The supplied GLB/animations are unchanged.
 * Appearance depends on each viewer leaving the house, not multiplayer authority.
 */
export class PokoWelcome {
  readonly root=new THREE.Group();
  private character:THREE.Object3D|undefined;
  private mixer:THREE.AnimationMixer|undefined;
  private actions:Record<string,THREE.AnimationAction>={};
  private phase:Phase='unloaded';
  private wanted=false;
  private previousX=0;
  private loadPromise:Promise<void>|undefined;
  private disposed=false;
  private retriesAfter=0;
  private elapsed=0;
  private popCount=0;
  constructor(private readonly scene:THREE.Scene){
    this.root.name='POKO_WELCOME';
    this.root.position.set(ANCHOR.x,groundHeightAt(ANCHOR.x,ANCHOR.z),ANCHOR.z);
    this.root.rotation.y=-Math.PI/2;this.root.scale.setScalar(.8);
    this.root.visible=false;scene.add(this.root);
  }
  get status():Phase{return this.phase;}
  get talkable():boolean{return this.phase==='idle'&&this.root.visible;}
  get appearances():number{return this.popCount;}
  get clips():string[]{return Object.keys(this.actions);}
  load():Promise<void>{
    if(this.disposed)return Promise.resolve();
    if(this.loadPromise)return this.loadPromise;
    this.phase='loading';
    this.loadPromise=(async()=>{
      try{
        // Keep the loader and model out of the initial house download.
        const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
        const gltf=await new GLTFLoader().loadAsync(import.meta.env.BASE_URL+'poko/poko.glb');
        if(this.disposed){this.release(gltf.scene);return;}
        const character=gltf.scene.getObjectByName('Character');
        if(!character||!['PopUp','Hide','Idle'].every(name=>gltf.animations.some(c=>c.name===name))){
          this.release(gltf.scene);throw Error('POKO model is missing required animations');
        }
        this.root.add(gltf.scene);this.character=character;
        this.mixer=new THREE.AnimationMixer(gltf.scene);
        for(const clip of gltf.animations)this.actions[clip.name]=this.mixer.clipAction(clip);
        this.mixer.addEventListener('finished',this.finished);
        this.character.position.y=-2.1;this.phase='hidden';
      }catch(error){
        if(!this.disposed){this.phase='error';this.retriesAfter=this.elapsed+5;this.loadPromise=undefined;console.warn('POKO could not load',error);}
      }
    })();
    return this.loadPromise;
  }
  private finished=({action}:{action:THREE.AnimationAction}):void=>{
    if(!this.character)return;
    if(action===this.actions.PopUp&&this.phase==='emerging'){
      action.stop();this.character.position.set(0,0,0);this.character.scale.set(1,1,1);
      this.phase='idle';this.actions.Idle.reset().play();
    }else if(action===this.actions.Hide&&this.phase==='hiding'){
      action.stop();this.character.position.set(0,-2.1,0);this.character.scale.set(1,1,1);this.phase='hidden';
    }
  };
  private once(name:'PopUp'|'Hide',phase:Phase):void{
    this.mixer?.stopAllAction();this.phase=phase;
    const action=this.actions[name];action.reset().setLoop(THREE.LoopOnce,1);
    action.clampWhenFinished=true;action.play();
  }
  update(position:{x:number;z:number},dt:number,playing:boolean,reducedMotion:boolean):void{
    if(this.disposed)return;
    this.elapsed+=dt;
    if(!playing)return;
    if(this.previousX<=10.65&&position.x>10.65&&position.z>=DOOR.minZ-.5&&position.z<=DOOR.maxZ+.5)this.wanted=true;
    if(insideHouse(position.x,position.z))this.wanted=false;
    this.previousX=position.x;
    const near=Math.hypot(position.x-ANCHOR.x,position.z-ANCHOR.z)<30;
    if((this.phase==='unloaded'||this.phase==='error')&&near&&position.x>5.5&&this.elapsed>=this.retriesAfter)void this.load();
    if(!this.character)return;
    this.root.visible=near;
    if(reducedMotion){
      if(this.wanted&&this.phase==='hidden')this.popCount++;
      this.mixer?.stopAllAction();this.character.position.set(0,this.wanted?0:-2.1,0);this.character.scale.set(1,1,1);
      this.phase=this.wanted?'idle':'hidden';return;
    }
    if(this.wanted&&this.phase==='hidden'){this.popCount++;this.once('PopUp','emerging');}
    else if(!this.wanted&&this.phase==='idle')this.once('Hide','hiding');
    // Transitions finish even after walking away; idle is culled by distance.
    if(near||this.phase==='emerging'||this.phase==='hiding')this.mixer?.update(Math.max(0,dt));
  }
  private release(root:THREE.Object3D):void{
    const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    root.traverse(obj=>{if(obj instanceof THREE.Mesh){geometry.add(obj.geometry);for(const m of Array.isArray(obj.material)?obj.material:[obj.material])materials.add(m);}});
    geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  }
  dispose():void{
    this.disposed=true;this.mixer?.removeEventListener('finished',this.finished);
    this.mixer?.stopAllAction();if(this.root.children[0])this.mixer?.uncacheRoot(this.root.children[0]);
    this.scene.remove(this.root);this.release(this.root);
  }
}
