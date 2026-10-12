import * as THREE from "three";
import {groundHeightAt,HIDDEN_WORLD} from "../../shared/worldRules.js";

const ROCK=0x595769,ROOF=0x37394d,MARKER=0x9eeed7,PATH=0x9f9c85;
/**
 * Walk-through surface cave, discrete stepping-stone secret trail, and an
 * accessible skyline lookout. These are decorative structures surrounding the
 * ONE existing collision/terrain heightmap; never create a second fake floor.
 *
 * Per 3D structure, transform data is uploaded only during construction.
 * No trees sway, no water shaders animate, and no new dynamic lights exist.
 */
export class HiddenExploration{
  readonly root=new THREE.Group();
  private readonly geometries=new Set<THREE.BufferGeometry>();
  private readonly materials=new Set<THREE.Material>();
  private readonly textures=new Set<THREE.Texture>();
  private readonly instances:THREE.InstancedMesh[]=[];
  private lastVisible:boolean|null=null;
  private readonly object=new THREE.Object3D();

  constructor(parent:THREE.Object3D){
    this.root.name="HIDDEN_EXPLORATION_WORLD_V9";
    parent.add(this.root);
    this.makeGrotto();
    this.makeSecretTrail();
    this.makeLookout();
  }
  private material(hex:number,basic=false):THREE.Material{
    const mat=basic?new THREE.MeshBasicMaterial({color:hex,toneMapped:false}):
      new THREE.MeshStandardMaterial({color:hex,roughness:.98,flatShading:true});
    this.materials.add(mat);return mat;
  }
  private geometry<T extends THREE.BufferGeometry>(g:T):T{this.geometries.add(g);return g;}
  private instancesOf(geometry:THREE.BufferGeometry,material:THREE.Material,
    data:Array<{x:number;y:number;z:number;sx:number;sy:number;sz:number;ry?:number}>,
    name:string):THREE.InstancedMesh{
    const mesh=new THREE.InstancedMesh(geometry,material,data.length);
    mesh.name=name;
    mesh.castShadow=false;mesh.receiveShadow=false;
    data.forEach((p,index)=>{
      this.object.position.set(p.x,p.y,p.z);
      this.object.rotation.set(0,p.ry??0,0);
      this.object.scale.set(p.sx,p.sy,p.sz);
      this.object.updateMatrix();
      mesh.setMatrixAt(index,this.object.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();
    this.root.add(mesh);
    this.instances.push(mesh);
    return mesh;
  }
  private box(positions:Array<{x:number;y:number;z:number;sx:number;sy:number;sz:number;ry?:number}>,
    color:number,name:string):void{
    this.instancesOf(this.geometry(new THREE.BoxGeometry(1,1,1)),this.material(color),positions,name);
  }
  private writeSign(label:string,x:number,y:number,z:number,rotationY:number):void{
    if(typeof document==="undefined")return;
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=112;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    ctx.fillStyle="#1a2030";ctx.fillRect(0,0,512,112);
    ctx.strokeStyle="#9affe0";ctx.lineWidth=8;ctx.strokeRect(5,5,502,102);
    ctx.font="bold 53px system-ui,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillStyle="#eafff6";ctx.fillText(label,256,56,472);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    this.textures.add(texture);
    const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false});
    this.materials.add(mat);
    const sign=new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(4,.88)),mat);
    sign.name="HIDDEN_SIGN_"+label.replace(/\s+/g,"_");
    sign.position.set(x,y,z);sign.rotation.y=rotationY;
    this.root.add(sign);
  }
  private makeGrotto():void{
    // Two LONG solid rock walls match explorationWalls in shared/worldRules.js,
    // and enclose a 5.5m-wide passage from west to east.
    const sides=[];
    for(let x=67;x<=77;x+=2){
      for(const z of [28.25,35.75]){
        const h=groundHeightAt(x,z);
        sides.push({x,y:h+1.85,z,sx:2.1,sy:3.65,sz:2.05});
      }
    }
    this.box(sides,ROCK,"CAVE_TWO_WALLS");
    // Heavy low-poly granite roof is safely above standing height, including
    // upward-sloping terrain, and never creates a hidden collision slab.
    const roof=[];
    for(let x=67;x<=77;x+=2){
      const ceiling=3.82+Math.max(
        groundHeightAt(x,29.5),groundHeightAt(x,34.5),groundHeightAt(x,32));
      roof.push({x,y:ceiling,z:32,sx:2.17,sy:1.35,sz:9.1});
    }
    this.box(roof,ROOF,"CAVE_STATIC_CEILING");
    // Exterior jagged rock silhouettes make the corridor look like a cave,
    // rather than a floating rectangular doorway.
    const crags=[];
    for(let i=0;i<18;i++){
      const x=65.8+(i%9)*1.5;
      const z=i<9?26.7:37.15;
      crags.push({
        x,y:groundHeightAt(x,z)+1.55,z,
        sx:.85+(i%4)*.2,sy:2.9+(i%5)*.27,sz:1.0+(i%3)*.24,
        ry:i*.21
      });
    }
    this.instancesOf(this.geometry(new THREE.IcosahedronGeometry(.75,0)),
      this.material(ROCK),crags,"CAVE_LOW_POLY_CRAGS");
    // Luminous markers signal entrance, exit, and a rune to discover.
    const markers=[];
    for(const x of [65.25,78.9])for(const z of [29.55,34.45]){
      markers.push({x,y:groundHeightAt(x,z)+1.9,z,sx:.26,sy:3.8,sz:.26});
    }
    this.box(markers,MARKER,"CAVE_ENTRANCE_GLYPHS");
    this.writeSign("ECHO GROTTO",65.3,groundHeightAt(65.3,32)+3.65,32,-Math.PI/2);
    // Small 'memory crystal' off the walking center line: cosmetic and non-blocking.
    const crystal=new THREE.Mesh(
      this.geometry(new THREE.OctahedronGeometry(.48,0)),
      this.material(0xa8b5ff,true)
    );
    crystal.name="ECHO_GROTTO_MEMORY_CRYSTAL";
    crystal.position.set(HIDDEN_WORLD.rune.x,groundHeightAt(72,30.3)+1.1,30.3);
    this.root.add(crystal);
    const plinth=new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.44,.57,.65,7)),
      this.material(0x696578));
    plinth.position.set(72,groundHeightAt(72,30.3)+.32,30.3);
    this.root.add(plinth);
  }
  private makeSecretTrail():void{
    const stones=[],edge=[];
    const ax=78,az=32,bx=90,bz=37;
    const heading=Math.atan2(bz-az,bx-ax);
    for(let i=0;i<20;i++){
      const t=i/19;
      const x=ax+(bx-ax)*t,z=az+(bz-az)*t;
      stones.push({x,y:groundHeightAt(x,z)+.012,z,
        sx:.82,sy:.045,sz:1.15,ry:-heading});
      if(i%2===0){
        const dx=-Math.sin(heading)*1.25,dz=Math.cos(heading)*1.25;
        edge.push({x:x+dx,y:groundHeightAt(x+dx,z+dz)+.15,z:z+dz,
          sx:.21,sy:.35,sz:.21});
      }
    }
    this.box(stones,PATH,"SECRET_TRAIL_STEPSTONES");
    this.instancesOf(this.geometry(new THREE.OctahedronGeometry(.5,0)),
      this.material(MARKER,true),edge,"SECRET_TRAIL_GLOW_STONES");
  }
  private makeLookout():void{
    const {x,z}=HIDDEN_WORLD.vista;
    // Rise is physically present in groundHeightAt() / TerrainSurface /
    // PlayerController / Worker. This ring is just a thin surface accent.
    const top=groundHeightAt(x,z);
    const stone=this.material(0x8e8195);
    const border=new THREE.Mesh(this.geometry(new THREE.TorusGeometry(3.05,.078,5,48)),
      this.material(0xa8f2d5,true));
    border.name="SKYLOOK_PLATFORM_EDGE";
    border.rotation.x=Math.PI/2;
    border.position.set(x,top+.055,z);
    this.root.add(border);
    // Panorama rail is deliberately short and non-solid so it never traps a
    // player or desynchronizes client/server movement.
    const rimPosts=[];
    for(let i=0;i<10;i++){
      const a=(i/10)*Math.PI*2;
      const px=x+Math.cos(a)*3.2,pz=z+Math.sin(a)*3.2;
      rimPosts.push({x:px,y:groundHeightAt(px,pz)+.32,z:pz,
        sx:.22,sy:.63,sz:.22});
    }
    this.instancesOf(this.geometry(new THREE.CylinderGeometry(.5,.55,1,5)),stone,
      rimPosts,"SKYLOOK_PANORAMA_STONES");
    const anchor=new THREE.Mesh(this.geometry(new THREE.OctahedronGeometry(.62,0)),
      this.material(0xffdca2,true));
    anchor.name="SKYLOOK_SUNSTAR_MARKER";
    anchor.position.set(x+1.1,top+1.5,z);
    this.root.add(anchor);
    const stand=new THREE.Mesh(this.geometry(new THREE.CylinderGeometry(.16,.25,1.55,6)),
      stone);
    stand.position.set(x+1.1,top+.8,z);
    this.root.add(stand);
    this.writeSign("SKYLOOK",x-2,top+2.7,z+3.1,Math.PI);
  }
  update(position:{x:number;z:number}):void{
    // Cheap area culling: the static 3D landmark is not even submitted to
    // WebGL when the visitor is far away (including inside PARTY HOUSE).
    const close=Math.hypot(position.x-76,position.z-32)<58;
    if(close!==this.lastVisible){
      this.root.visible=close;
      this.lastVisible=close;
    }
  }
  dispose():void{
    this.root.removeFromParent();
    for(const instance of this.instances)instance.dispose();
    for(const texture of this.textures)texture.dispose();
    for(const geometry of this.geometries)geometry.dispose();
    for(const material of this.materials)material.dispose();
  }
}
