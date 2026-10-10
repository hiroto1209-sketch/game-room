import * as THREE from "three";
import {BLACK,WHITE,legalMoves,validMatch,type OthelloMatch} from "../../shared/othello.js";

const STEP=.79;
const CENTER_Z=-5.7;
/** 8x8 dance-floor Othello. One instanced draw per color and legal-move hints. */
export class FloorOthello {
  private group=new THREE.Group();
  private readonly tileGeo=new THREE.PlaneGeometry(.755,.755);
  private readonly discGeo=new THREE.CylinderGeometry(.30,.30,.11,20);
  private readonly hintGeo=new THREE.SphereGeometry(.072,7,5);
  private readonly tileMat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  private readonly blackMat=new THREE.MeshStandardMaterial({color:0x1a1b31,metalness:.23,roughness:.31});
  private readonly whiteMat=new THREE.MeshStandardMaterial({color:0xfff2dd,metalness:.1,roughness:.4});
  private readonly hintMat=new THREE.MeshBasicMaterial({color:0xffd78f,transparent:true,opacity:.8});
  private readonly tiles=new THREE.InstancedMesh(this.tileGeo,this.tileMat,64);
  private readonly blacks=new THREE.InstancedMesh(this.discGeo,this.blackMat,64);
  private readonly whites=new THREE.InstancedMesh(this.discGeo,this.whiteMat,64);
  private readonly hints=new THREE.InstancedMesh(this.hintGeo,this.hintMat,64);
  private readonly pointer:THREE.LineSegments;
  private readonly tmp=new THREE.Object3D();
  private readonly raycaster=new THREE.Raycaster();
  private readonly center=new THREE.Vector2(0,0);
  private readonly plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.065);
  private readonly hitPoint=new THREE.Vector3();
  private match:OthelloMatch|null=null;
  private highlighted=-1;

  constructor(scene:THREE.Scene){
    this.group.name="FLOOR OTHELLO 8x8";
    for(let i=0;i<64;i++){
      const row=Math.floor(i/8),col=i%8;
      this.tmp.position.set((col-3.5)*STEP,.035,CENTER_Z+(row-3.5)*STEP);
      this.tmp.rotation.set(-Math.PI/2,0,0);this.tmp.scale.set(1,1,1);
      this.tmp.updateMatrix();this.tiles.setMatrixAt(i,this.tmp.matrix);
      this.tiles.setColorAt(i,new THREE.Color((row+col)%2===0?0x324658:0x283750));
    }
    this.tiles.instanceMatrix.needsUpdate=true;
    if(this.tiles.instanceColor)this.tiles.instanceColor.needsUpdate=true;
    this.tiles.computeBoundingSphere();
    this.blacks.count=0;this.whites.count=0;this.hints.count=0;
    this.group.add(this.tiles,this.blacks,this.whites,this.hints);
    const ring=new THREE.EdgesGeometry(new THREE.BoxGeometry(.748,.012,.748));
    this.pointer=new THREE.LineSegments(ring,new THREE.LineBasicMaterial({color:0xffdd92}));
    this.pointer.position.y=.095;
    this.pointer.visible=false;
    this.group.add(this.pointer);
    this.group.visible=false;
    scene.add(this.group);
  }
  get active():boolean{return this.match!==null&&this.match.status!=="idle"}
  get current():OthelloMatch|null{return this.match}
  setMatch(match:OthelloMatch):void{
    if(!validMatch(match))return;
    if(this.match&&this.match.revision===match.revision&&
      this.match.status===match.status)return;
    this.match=match;
    this.group.visible=match.status!=="idle";
    this.highlighted=-1;this.pointer.visible=false;
    if(!this.group.visible)return;
    let b=0,w=0,h=0;
    const legal=match.status==="playing"?legalMoves(match.board,match.turn):[];
    for(let i=0;i<64;i++){
      const value=match.board[i],r=Math.floor(i/8),c=i%8;
      this.tmp.position.set((c-3.5)*STEP,.11,CENTER_Z+(r-3.5)*STEP);
      this.tmp.rotation.set(0,0,0);this.tmp.scale.set(1,1,1);
      this.tmp.updateMatrix();
      if(value===BLACK)this.blacks.setMatrixAt(b++,this.tmp.matrix);
      if(value===WHITE)this.whites.setMatrixAt(w++,this.tmp.matrix);
    }
    for(const i of legal){
      const r=Math.floor(i/8),c=i%8;
      this.tmp.position.set((c-3.5)*STEP,.077,CENTER_Z+(r-3.5)*STEP);
      this.tmp.rotation.set(0,0,0);this.tmp.scale.set(1,1,1);
      this.tmp.updateMatrix();this.hints.setMatrixAt(h++,this.tmp.matrix);
    }
    this.blacks.count=b;this.whites.count=w;this.hints.count=h;
    for(const m of [this.blacks,this.whites,this.hints])m.instanceMatrix.needsUpdate=true;
  }
  aim(camera:THREE.Camera):number|null{
    if(!this.active){this.pointer.visible=false;return null}
    this.raycaster.setFromCamera(this.center,camera);
    if(!this.raycaster.ray.intersectPlane(this.plane,this.hitPoint)){
      this.pointer.visible=false;return null;
    }
    const col=Math.floor((this.hitPoint.x+4*STEP)/STEP);
    const row=Math.floor((this.hitPoint.z-CENTER_Z+4*STEP)/STEP);
    const valid=col>=0&&col<8&&row>=0&&row<8;
    this.pointer.visible=valid;
    if(!valid)return null;
    const id=row*8+col;
    if(id!==this.highlighted){
      this.highlighted=id;
      this.pointer.position.set((col-3.5)*STEP,.105,CENTER_Z+(row-3.5)*STEP);
    }
    return id;
  }
  dispose():void{
    this.group.parent?.remove(this.group);
    for(const mesh of [this.tiles,this.blacks,this.whites,this.hints])mesh.dispose();
    for(const geo of [this.tileGeo,this.discGeo,this.hintGeo])geo.dispose();
    for(const mat of [this.tileMat,this.blackMat,this.whiteMat,this.hintMat])mat.dispose();
    this.pointer.geometry.dispose();
    (this.pointer.material as THREE.Material).dispose();
  }
}
