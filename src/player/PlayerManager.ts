import * as THREE from "three";
import { isFiniteVector3, safeDisplayName, type PlayerSnapshot } from "../types/Player";
type RemoteAvatar = { snapshot:PlayerSnapshot; group:THREE.Group; name:THREE.Sprite };
/**
 * Scene-only representation of remote players. No network dependency.
 * Placeholder avatars become visible when validated remote state is supplied.
 */
export class PlayerManager{
  private remote = new Map<string,RemoteAvatar>();
  private static readonly maxRemotes=24;
  readonly localId:string;
  constructor(private scene:THREE.Scene){
    this.localId=crypto.randomUUID();
  }
  get count():number{return this.remote.size}
  getRemote(id:string):PlayerSnapshot|undefined{return this.remote.get(id)?.snapshot}
  upsertRemote(snapshot:PlayerSnapshot):boolean{
    if(snapshot.id===this.localId||!isFiniteVector3(snapshot.position)
      ||!Number.isFinite(snapshot.yaw)||!Number.isFinite(snapshot.pitch)
      ||!Number.isSafeInteger(snapshot.sequence)||snapshot.sequence<0)return false;
    if(!/^[A-Za-z0-9_-]{8,64}$/.test(snapshot.id))return false;
    const existing=this.remote.get(snapshot.id);
    if(existing&&snapshot.sequence<=existing.snapshot.sequence)return false;
    if(!existing&&this.remote.size>=PlayerManager.maxRemotes)return false;
    const safe={...snapshot,displayName:safeDisplayName(snapshot.displayName),position:{...snapshot.position}};
    if(existing){existing.snapshot=safe;return true;}
    const group=this.makeAvatar(snapshot.id);
    group.position.set(snapshot.position.x,snapshot.position.y-1.65,snapshot.position.z);
    const name=this.makeName(safe.displayName);
    group.add(name);
    this.scene.add(group);
    this.remote.set(snapshot.id,{snapshot:safe,group,name});return true;
  }
  removeRemote(id:string):void{
    const entry=this.remote.get(id);if(!entry)return;
    this.scene.remove(entry.group);
    entry.group.traverse(obj=>{
      if(obj instanceof THREE.Mesh)obj.geometry.dispose();
      if(obj instanceof THREE.Sprite){
        const material=obj.material as THREE.SpriteMaterial;
        material.map?.dispose();material.dispose();
      }else if(obj instanceof THREE.Mesh){
        const mats=Array.isArray(obj.material)?obj.material:[obj.material];
        mats.forEach(m=>m.dispose());
      }
    });
    this.remote.delete(id);
  }
  clear():void{for(const id of [...this.remote.keys()])this.removeRemote(id)}
  update(dt:number,camera:THREE.Camera):void{
    const alpha=1-Math.exp(-Math.min(.1,dt)*12);
    for(const {snapshot,group,name} of this.remote.values()){
      group.position.lerp(new THREE.Vector3(snapshot.position.x,snapshot.position.y-1.65,snapshot.position.z),alpha);
      let delta=((snapshot.yaw-group.rotation.y+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
      group.rotation.y+=delta*alpha;
      name.quaternion.copy(camera.quaternion);
    }
  }
  private makeAvatar(id:string):THREE.Group{
    const group=new THREE.Group();
    let seed=0;for(let i=0;i<id.length;i++)seed=(seed*33+id.charCodeAt(i))>>>0;
    const palette=[0xf8a4c8,0x8cd9cc,0x99b8fa,0xf7c779,0xc0a1e6];
    const color=palette[seed%palette.length];
    const outfit=new THREE.MeshStandardMaterial({color,roughness:.75});
    const skin=new THREE.MeshStandardMaterial({color:0xffd4b6,roughness:.9});
    const legs=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,.7,10),outfit.clone());
    legs.position.y=.36;group.add(legs);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.31,.27,.79,12),outfit.clone());
    body.position.y=1.05;group.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.255,16,12),skin);
    head.position.y=1.65;group.add(head);
    const nose=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),skin.clone());
    nose.position.set(0,1.6,-.252);group.add(nose);
    outfit.dispose();
    return group;
  }
  private makeName(name:string):THREE.Sprite{
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext("2d");
    if(ctx){
      ctx.fillStyle="rgba(25,18,32,.78)";ctx.fillRect(8,10,496,100);
      ctx.fillStyle="#fff5e8";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font="bold 46px system-ui,sans-serif";ctx.fillText(name,256,60,460);
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true}));
    sprite.scale.set(1.9,.5,1);sprite.position.y=2.18;return sprite;
  }
}
