import * as THREE from "three";
/**
 * Lightweight FPS blaster viewmodel. Camera owns the geometry, so this never
 * changes the server-authoritative hitscan ray. ADS visibly lines the sight up
 * and softens recoil instead of being only a FOV change.
 */
export class WeaponViewmodel{
  private group=new THREE.Group();
  private parts:THREE.Mesh[]=[];
  private flash:THREE.Mesh;
  private kick=0;
  private flashTime=0;
  private active=false;
  constructor(private camera:THREE.PerspectiveCamera,scene:THREE.Scene){
    scene.add(camera);
    const dark=new THREE.MeshBasicMaterial({color:0x1a2538,depthTest:false,depthWrite:false});
    const aqua=new THREE.MeshBasicMaterial({color:0x63dfcc,depthTest:false,depthWrite:false});
    const metal=new THREE.MeshBasicMaterial({color:0x708ca4,depthTest:false,depthWrite:false});
    const make=(geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number)=>{
      const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.renderOrder=999;
      m.frustumCulled=false;this.group.add(m);this.parts.push(m);return m;
    };
    make(new THREE.BoxGeometry(.19,.17,.43),dark,0,-.05,-.14);
    make(new THREE.BoxGeometry(.18,.095,.30),metal,0,.04,-.29);
    make(new THREE.CylinderGeometry(.052,.068,.43,8),dark,0,.05,-.53).rotation.x=Math.PI/2;
    make(new THREE.BoxGeometry(.06,.065,.1),aqua,0,.135,-.29);
    make(new THREE.BoxGeometry(.13,.26,.13),dark,0,-.2,-.04).rotation.x=-.26;
    const flashMat=new THREE.MeshBasicMaterial({color:0xd7fff2,transparent:true,opacity:.84,
      depthTest:false,depthWrite:false});
    this.flash=make(new THREE.SphereGeometry(.11,6,4),flashMat,0,.05,-.76);
    this.flash.visible=false;
    this.group.position.set(.38,-.33,-.62);
    camera.add(this.group);
    this.group.visible=false;
  }
  setVisible(show:boolean):void{this.active=show;this.group.visible=show;}
  fire():void{
    if(!this.active)return;
    this.kick=Math.min(.2,this.kick+.09);
    this.flashTime=.075;this.flash.visible=true;
  }
  update(dt:number,aiming:boolean):void{
    if(!this.active)return;
    const factor=Math.min(1,dt*13);
    const tx=aiming?.025:.38,ty=aiming?-.215:-.33,tz=aiming?-.52:-.62;
    this.group.position.x+=(tx-this.group.position.x)*factor;
    this.group.position.y+=(ty-this.kick-this.group.position.y)*factor;
    this.group.position.z+=(tz-this.group.position.z)*factor;
    this.kick=Math.max(0,this.kick-dt*.62);
    if(this.flashTime>0){
      this.flashTime-=dt;
      this.flash.visible=this.flashTime>0;
    }
  }
  dispose():void{
    this.group.removeFromParent();
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    for(const m of this.parts){
      geometries.add(m.geometry);
      if(Array.isArray(m.material))for(const mat of m.material)materials.add(mat);
      else materials.add(m.material);
    }
    for(const geo of geometries)geo.dispose();
    for(const mat of materials)mat.dispose();
  }
}
