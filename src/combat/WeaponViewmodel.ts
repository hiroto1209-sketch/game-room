import * as THREE from "three";

/**
 * Lightweight sci-fi FPS viewmodel. The holographic sight is optically centered
 * on the camera's -Z ray, while the solid weapon is deliberately BELOW that ray.
 * This distinction prevents the original giant box from covering the target.
 *
 * A viewmodel is VISUAL ONLY. All gameplay hitscan still originates from the
 * shared camera yaw/pitch and Cloudflare validates damage.
 */
export class WeaponViewmodel {
  private readonly group=new THREE.Group();
  private readonly sight=new THREE.Group();
  private readonly parts:THREE.Mesh[]=[];
  private readonly flash:THREE.Mesh;
  private readonly targetPosition=new THREE.Vector3();
  private readonly muzzleMaterial:THREE.MeshBasicMaterial;
  private kick=0;
  private flashTime=0;
  private active=false;
  private lastAiming=false;

  private readonly camera:THREE.PerspectiveCamera;
  constructor(camera:THREE.PerspectiveCamera,scene:THREE.Scene){
    this.camera=camera;
    // Camera-mounted meshes are rendered in the same pass as the world.
    // No extra render pass, extra scene, heavy shaders or expensive lights.
    scene.add(camera);
    this.group.name="FPS_WEAPON_SOLIDS";
    this.sight.name="FPS_HOLO_SIGHT";
    camera.add(this.group);
    camera.add(this.sight);

    const dark=new THREE.MeshBasicMaterial({color:0x19283b,depthTest:false,depthWrite:false,toneMapped:false});
    const trim=new THREE.MeshBasicMaterial({color:0x708fa6,depthTest:false,depthWrite:false,toneMapped:false});
    const teal=new THREE.MeshBasicMaterial({color:0x71e6d0,depthTest:false,depthWrite:false,toneMapped:false});
    const make=(geometry:THREE.BufferGeometry,material:THREE.Material,
      x:number,y:number,z:number,name:string)=>{
      const mesh=new THREE.Mesh(geometry,material);
      mesh.name="FPS_SOLID_"+name;
      mesh.position.set(x,y,z);
      mesh.renderOrder=900;
      mesh.frustumCulled=false;
      this.group.add(mesh);this.parts.push(mesh);
      return mesh;
    };
    // Compact, lower-right weapon silhouette: no giant box, no geometry
    // crossing the center pixel or upper/mid sight corridor.
    make(new THREE.BoxGeometry(.16,.13,.31),dark,.09,-.10,-.13,"receiver");
    make(new THREE.BoxGeometry(.135,.070,.24),trim,.09,-.015,-.29,"rail");
    const barrel=make(new THREE.CylinderGeometry(.033,.039,.29,8),
      dark,.09,-.050,-.48,"barrel");
    barrel.rotation.x=Math.PI/2;
    make(new THREE.BoxGeometry(.095,.21,.095),dark,.105,-.235,.008,"grip")
      .rotation.x=-.18;
    make(new THREE.BoxGeometry(.043,.037,.11),teal,.09,.056,-.30,"sight_mount");

    this.muzzleMaterial=new THREE.MeshBasicMaterial({
      color:0xe0fff8,transparent:true,opacity:0.85,
      depthTest:false,depthWrite:false,toneMapped:false
    });
    this.flash=make(new THREE.SphereGeometry(.078,6,4),
      this.muzzleMaterial,.09,-.05,-.68,"muzzle_flash");
    this.flash.visible=false;

    // Only a THIN, OPEN holographic ring belongs at the center in ADS.
    // The target remains visible *through* it. The 3D weapon sits below.
    const ringMaterial=new THREE.MeshBasicMaterial({
      color:0xaaffdf,transparent:true,opacity:.8,
      depthTest:false,depthWrite:false,toneMapped:false
    });
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.030,.0035,4,24),ringMaterial);
    ring.name="FPS_SIGHT_RING";
    ring.renderOrder=950;
    ring.frustumCulled=false;
    this.sight.add(ring);this.parts.push(ring);
    this.sight.position.set(0,0,-.80);
    this.sight.visible=false;
    this.group.position.set(.22,-.36,-.72);
    this.group.scale.setScalar(.9);
    this.group.visible=false;
  }

  setVisible(show:boolean):void{
    this.active=show;
    this.group.visible=show;
    this.sight.visible=show&&this.lastAiming;
    if(!show)this.flash.visible=false;
  }

  fire():void{
    if(!this.active)return;
    this.kick=Math.min(.075,this.kick+.036);
    this.flashTime=.065;
    this.flash.visible=true;
  }

  update(dt:number,aiming:boolean):void{
    this.lastAiming=aiming;
    if(!this.active){this.sight.visible=false;return;}
    const factor=Math.min(1,Math.max(0,dt)*15);
    // Moving the WEAPON BODY down and away from the optical center is vital.
    // Older code placed the entire solid model at x=0 in ADS and obscured aim.
    const aspect=this.camera.aspect;
    const offsetX=aiming?
      Math.min(.25,Math.max(.055,aspect*.145)):
      Math.min(.48,Math.max(.20,aspect*.30+.08));
    this.targetPosition.set(offsetX,aiming?-.34:-.36,aiming?-.83:-.72);
    this.group.position.lerp(this.targetPosition,factor);
    // Close to the eye on narrow displays, so a slightly smaller weapon
    // silhouette while ADS leaves more space for tracking moving enemies.
    const targetScale=aiming?.80:.90;
    const nextScale=this.group.scale.x+(targetScale-this.group.scale.x)*factor;
    this.group.scale.setScalar(nextScale);
    this.kick=Math.max(0,this.kick-dt*.43);
    this.group.position.y-=this.kick;
    this.sight.visible=aiming;
    if(this.flashTime>0){
      this.flashTime=Math.max(0,this.flashTime-dt);
      this.flash.visible=this.flashTime>0;
    }else this.flash.visible=false;
  }

  /**
   * Geometric quality gate. Returns true only when the camera's central
   * target corridor is clear of ALL solid weapon meshes.
   * This is independent of screenshots and works with portrait/landscape FOV.
   */
  isTargetCorridorClear():boolean{
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    const raycaster=new THREE.Raycaster();
    const solids=this.parts.filter(p=>p.name.startsWith("FPS_SOLID_")&&
      p!==this.flash&&p.visible);
    for(const x of [-.20,-.10,0,.10,.20]){
      for(const y of [-.16,0,.16]){
        raycaster.setFromCamera(new THREE.Vector2(x,y),this.camera);
        if(raycaster.intersectObjects(solids,false).length>0)return false;
      }
    }
    return true;
  }

  sightProjectionError():number{
    // The ring center MUST coincide with the same center ray as hitscan.
    this.camera.updateMatrixWorld(true);
    const p=new THREE.Vector3();
    this.sight.getWorldPosition(p);
    p.project(this.camera);
    return Math.hypot(p.x,p.y);
  }

  dispose():void{
    this.group.removeFromParent();
    this.sight.removeFromParent();
    const geometries=new Set<THREE.BufferGeometry>();
    const materials=new Set<THREE.Material>();
    for(const mesh of this.parts){
      geometries.add(mesh.geometry);
      if(Array.isArray(mesh.material)){
        for(const mat of mesh.material)materials.add(mat);
      }else materials.add(mesh.material);
    }
    for(const geo of geometries)geo.dispose();
    for(const mat of materials)mat.dispose();
  }
}
