import * as THREE from "three";
import {isFiniteVector3,safeDisplayName,type PlayerSnapshot} from "../types/Player";
import {DEFAULT_AVATAR,sanitizedAvatar,type AvatarStyle,type AvatarColor,type AvatarHat,type EmoteKind} from "../../shared/avatarRules.js";

const PALETTE:Record<AvatarColor,number>={
  rose:0xf79ec7,mint:0x78e5c0,sky:0x88b9ff,amber:0xffce81,violet:0xc2a0ff
};
const HAT_COLORS={cap:0x304b71,crown:0xffd36c,halo:0x96fff5};
type Rig={
  snapshot:PlayerSnapshot;group:THREE.Group;name:THREE.Sprite;
  torso:THREE.Group;leftArm:THREE.Group;rightArm:THREE.Group;
  bodyMaterial:THREE.MeshStandardMaterial;hat:THREE.Group;
  avatar:AvatarStyle;emote:EmoteKind|null;emoteUntil:number;emoteStart:number;
  hp:number;bar:THREE.Group;fill:THREE.Mesh;
};
/** Remote avatars are visual only, and never change world collision or combat hitboxes. */
export class PlayerManager{
  private readonly remote=new Map<string,Rig>();
  private readonly moveTarget=new THREE.Vector3();
  private static readonly maxRemotes=24;
  readonly localId:string;
  constructor(private readonly scene:THREE.Scene){
    this.localId=crypto.randomUUID();
  }
  get count():number{return this.remote.size}
  getRemote(id:string):PlayerSnapshot|undefined{return this.remote.get(id)?.snapshot}
  getRemoteSnapshots():PlayerSnapshot[]{return [...this.remote.values()].map(v=>v.snapshot)}

  upsertRemote(snapshot:PlayerSnapshot):boolean{
    if(snapshot.id===this.localId||!isFiniteVector3(snapshot.position)
      ||!Number.isFinite(snapshot.yaw)||!Number.isFinite(snapshot.pitch)
      ||!Number.isSafeInteger(snapshot.sequence)||snapshot.sequence<0)return false;
    if(!/^[A-Za-z0-9_-]{8,64}$/.test(snapshot.id))return false;
    const existing=this.remote.get(snapshot.id);
    if(existing&&snapshot.sequence<=existing.snapshot.sequence)return false;
    if(!existing&&this.remote.size>=PlayerManager.maxRemotes)return false;
    const safe={...snapshot,displayName:safeDisplayName(snapshot.displayName),
      avatar:sanitizedAvatar(snapshot.avatar),position:{...snapshot.position}};
    if(existing){
      existing.snapshot=safe;
      if(existing.avatar.color!==safe.avatar.color||existing.avatar.hat!==safe.avatar.hat)
        this.setAvatar(snapshot.id,safe.avatar);
      return true;
    }
    const rig=this.makeAvatar(snapshot.id,safe.displayName,safe.avatar);
    rig.snapshot=safe;
    rig.group.position.set(snapshot.position.x,snapshot.position.y-1.65,snapshot.position.z);
    this.scene.add(rig.group);
    this.remote.set(snapshot.id,rig);
    return true;
  }
  setAvatar(id:string,raw:AvatarStyle):void{
    const rig=this.remote.get(id);if(!rig)return;
    const avatar=sanitizedAvatar(raw);
    rig.avatar=avatar;
    rig.snapshot={...rig.snapshot,avatar};
    rig.bodyMaterial.color.setHex(PALETTE[avatar.color]);
    this.rebuildHat(rig.hat,avatar.hat);
  }
  playEmote(id:string,kind:EmoteKind,durationMs=2600):void{
    const rig=this.remote.get(id);if(!rig)return;
    rig.emote=kind;rig.emoteStart=performance.now();
    rig.emoteUntil=rig.emoteStart+Math.min(2600,Math.max(100,durationMs));
  }
  setHp(id:string,hp:number):void{
    const rig=this.remote.get(id);if(!rig)return;
    rig.hp=Math.max(0,Math.min(100,hp));
    rig.bar.visible=rig.hp>0&&rig.hp<100;
    rig.fill.scale.x=Math.max(.04,rig.hp/100);
  }
  removeRemote(id:string):void{
    const rig=this.remote.get(id);if(!rig)return;
    rig.group.removeFromParent();
    this.disposeGroup(rig.group);
    this.remote.delete(id);
  }
  clear():void{for(const id of [...this.remote.keys()])this.removeRemote(id)}
  update(dt:number,camera:THREE.Camera):void{
    const alpha=1-Math.exp(-Math.min(.1,dt)*12);
    const now=performance.now();
    for(const rig of this.remote.values()){
      const {snapshot,group,name}=rig;
      this.moveTarget.set(snapshot.position.x,snapshot.position.y-1.65,snapshot.position.z);
      group.position.lerp(this.moveTarget,alpha);
      const delta=((snapshot.yaw-group.rotation.y+Math.PI)%(Math.PI*2)+(Math.PI*2))%(Math.PI*2)-Math.PI;
      group.rotation.y+=delta*alpha;
      name.quaternion.copy(camera.quaternion);
      rig.bar.quaternion.copy(camera.quaternion);
      rig.bar.visible=rig.hp>0&&rig.hp<100;
      rig.fill.scale.x=Math.max(.04,rig.hp/100);
      if(rig.emote&&now<rig.emoteUntil){
        const t=(now-rig.emoteStart)/1000;
        if(rig.emote==="wave"){
          rig.rightArm.rotation.z=2.1+.30*Math.sin(t*12);
          rig.leftArm.rotation.z=.05;
          rig.torso.rotation.z=.09*Math.sin(t*4);
        }else if(rig.emote==="dance"){
          rig.rightArm.rotation.z=1.35+.35*Math.sin(t*9);
          rig.leftArm.rotation.z=-1.35+.35*Math.sin(t*9+Math.PI);
          rig.torso.rotation.z=.20*Math.sin(t*8);
          rig.torso.position.y=.12*Math.abs(Math.sin(t*8));
        }else{
          rig.rightArm.rotation.z=2.55+.16*Math.sin(t*9);
          rig.leftArm.rotation.z=-2.55+.16*Math.sin(t*9);
          rig.torso.position.y=.16*Math.abs(Math.sin(t*11));
        }
      }else if(rig.emote){
        rig.emote=null;rig.rightArm.rotation.z=0;rig.leftArm.rotation.z=0;
        rig.torso.rotation.z=0;rig.torso.position.y=0;
      }
    }
  }
  private makeAvatar(id:string,displayName:string,avatar:AvatarStyle):Rig{
    const group=new THREE.Group();group.name="GUEST_AVATAR_"+id;
    const torso=new THREE.Group();group.add(torso);
    const outfit=new THREE.MeshStandardMaterial({color:PALETTE[avatar.color],roughness:.82});
    const skin=new THREE.MeshStandardMaterial({color:0xffd7bd,roughness:.95});
    const dark=new THREE.MeshStandardMaterial({color:0x2b253a,roughness:1});
    const add=(parent:THREE.Object3D,geo:THREE.BufferGeometry,mat:THREE.Material,
      x:number,y:number,z:number)=>{
      const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;
    };
    const legs=new THREE.Mesh(new THREE.CylinderGeometry(.20,.24,.69,8),outfit);
    legs.position.y=.36;group.add(legs);
    add(torso,new THREE.CylinderGeometry(.30,.26,.74,9),outfit,0,1.04,0);
    const head=add(torso,new THREE.SphereGeometry(.255,11,8),skin,0,1.64,0);
    head.name="AVATAR_FACE";
    add(torso,new THREE.SphereGeometry(.038,6,4),dark,-.092,1.67,-.242);
    add(torso,new THREE.SphereGeometry(.038,6,4),dark,.092,1.67,-.242);
    const leftArm=new THREE.Group(),rightArm=new THREE.Group();
    leftArm.position.set(-.32,1.31,0);rightArm.position.set(.32,1.31,0);
    torso.add(leftArm,rightArm);
    add(leftArm,new THREE.CylinderGeometry(.105,.11,.49,7),outfit,-.045,-.24,0);
    add(rightArm,new THREE.CylinderGeometry(.105,.11,.49,7),outfit,.045,-.24,0);
    add(leftArm,new THREE.SphereGeometry(.10,7,5),skin,-.045,-.49,0);
    add(rightArm,new THREE.SphereGeometry(.10,7,5),skin,.045,-.49,0);
    const hat=new THREE.Group();hat.position.set(0,1.92,0);torso.add(hat);
    this.rebuildHat(hat,avatar.hat);
    const name=this.makeName(displayName);group.add(name);
    const bar=new THREE.Group();bar.position.y=2.05;bar.visible=false;
    const back=new THREE.Mesh(new THREE.PlaneGeometry(.78,.09),new THREE.MeshBasicMaterial({color:0x1c2433}));
    const fill=new THREE.Mesh(new THREE.PlaneGeometry(.72,.05),new THREE.MeshBasicMaterial({color:0x8cf0c2}));
    fill.position.z=.01;bar.add(back,fill);group.add(bar);
    return {snapshot:null as unknown as PlayerSnapshot,group,name,torso,leftArm,rightArm,
      bodyMaterial:outfit,hat,avatar,emote:null,emoteUntil:0,emoteStart:0,hp:100,bar,fill};
  }
  private rebuildHat(hat:THREE.Group,kind:AvatarHat):void{
    for(const obj of [...hat.children]){
      obj.traverse(child=>{
        if(child instanceof THREE.Mesh){
          child.geometry.dispose();
          const mats=Array.isArray(child.material)?child.material:[child.material];
          mats.forEach(mat=>mat.dispose());
        }
      });
      hat.remove(obj);
    }
    if(kind==="none")return;
    const material=new THREE.MeshStandardMaterial({color:HAT_COLORS[kind],roughness:.7,
      emissive:kind==="halo"?0x27594c:0x000000});
    if(kind==="halo"){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.28,.035,5,20),material);
      ring.rotation.x=Math.PI/2;ring.position.y=.15;hat.add(ring);
    }else if(kind==="crown"){
      const base=new THREE.Mesh(new THREE.CylinderGeometry(.22,.25,.15,7),material);
      hat.add(base);
      for(let i=0;i<5;i++){
        const angle=i/5*Math.PI*2;
        const spike=new THREE.Mesh(new THREE.ConeGeometry(.073,.20,4),material);
        spike.position.set(Math.sin(angle)*.17,.17,Math.cos(angle)*.17);
        hat.add(spike);
      }
    }else{
      const cap=new THREE.Mesh(new THREE.SphereGeometry(.235,10,5,0,Math.PI*2,0,Math.PI/2),material);
      hat.add(cap);
      const brim=new THREE.Mesh(new THREE.BoxGeometry(.39,.035,.20),material);
      brim.position.set(0,-.02,-.16);hat.add(brim);
    }
  }
  private makeName(value:string):THREE.Sprite{
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext("2d");
    if(ctx){
      ctx.fillStyle="rgba(24,20,37,.76)";ctx.fillRect(8,10,496,102);
      ctx.fillStyle="#fff6ef";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font="bold 44px system-ui,sans-serif";ctx.fillText(value,256,61,465);
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true}));
    sprite.scale.set(1.85,.47,1);sprite.position.y=2.33;return sprite;
  }
  private disposeGroup(root:THREE.Object3D):void{
    const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>();
    root.traverse(obj=>{
      if(obj instanceof THREE.Mesh){geos.add(obj.geometry);
        if(Array.isArray(obj.material))obj.material.forEach(m=>mats.add(m));
        else mats.add(obj.material);
      }else if(obj instanceof THREE.Sprite){mats.add(obj.material);obj.material.map?.dispose();}
    });
    geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
  }
}
