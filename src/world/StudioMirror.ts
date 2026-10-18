import * as THREE from "three";

/**
 * One low-resolution planar mirror on the lounge's south wall.
 * The reflected camera uses an oblique clip so the wall behind the glass
 * cannot hide the local body or other players. Resolution tracks quality.
 */
export class StudioMirror{
  readonly mesh:THREE.Mesh;
  private readonly target:THREE.WebGLRenderTarget;
  private readonly cam=new THREE.PerspectiveCamera(60,1,.08,80);
  private readonly planeZ=-15.72;
  private readonly planeX=-6.15;
  private readonly textureMatrix=new THREE.Matrix4();
  private readonly normal=new THREE.Vector3();
  private readonly mirrorPosition=new THREE.Vector3();
  private readonly view=new THREE.Vector3();
  private readonly targetPoint=new THREE.Vector3();
  private readonly lookAt=new THREE.Vector3();
  private readonly rotation=new THREE.Matrix4();
  private readonly reflectorPlane=new THREE.Plane();
  private readonly clipPlane=new THREE.Vector4();
  private readonly q=new THREE.Vector4();
  constructor(scene:THREE.Scene,pixelScale:number){
    const width=Math.round(THREE.MathUtils.clamp(168*pixelScale,128,220));
    const height=Math.round(width*.58);
    this.target=new THREE.WebGLRenderTarget(width,height,{depthBuffer:true,samples:0});
    this.target.texture.colorSpace=THREE.SRGBColorSpace;
    const glass=new THREE.ShaderMaterial({
      uniforms:{tDiffuse:{value:this.target.texture},textureMatrix:{value:this.textureMatrix}},
      vertexShader:`uniform mat4 textureMatrix;varying vec4 vUv;void main(){vUv=textureMatrix*vec4(position,1.0);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform sampler2D tDiffuse;varying vec4 vUv;void main(){gl_FragColor=texture2DProj(tDiffuse,vUv);}`,
      toneMapped:false
    });
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(4.6,2.4),glass);
    this.mesh.name="STUDIO_MIRROR";
    this.mesh.position.set(this.planeX,1.38,this.planeZ);
    scene.add(this.mesh);
    const frame=new THREE.MeshStandardMaterial({color:0xc9b7a2,roughness:.42,metalness:.28});
    const bar=(x:number,y:number,z:number,w:number,h:number,d:number)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),frame);
      mesh.position.set(x,y,z);
      mesh.name="STUDIO_MIRROR_FRAME";
      scene.add(mesh);
    };
    bar(this.planeX,2.64,this.planeZ,4.86,.12,.08);
    bar(this.planeX,.12,this.planeZ,4.86,.12,.08);
    bar(this.planeX-2.36,1.38,this.planeZ,.12,2.64,.08);
    bar(this.planeX+2.36,1.38,this.planeZ,.12,2.64,.08);
    // Layer 0 is the room and remote players. Layer 1 is the local body.
    this.cam.layers.enable(1);
  }
  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,view:THREE.Camera):void{
    const cam=view as THREE.PerspectiveCamera;
    this.mirrorPosition.setFromMatrixPosition(this.mesh.matrixWorld);
    if(cam.position.z<this.planeZ+.4)return;
    if(cam.position.distanceTo(this.mirrorPosition)>16)return;
    this.rotation.extractRotation(this.mesh.matrixWorld);
    this.normal.set(0,0,1).applyMatrix4(this.rotation);
    this.view.subVectors(this.mirrorPosition,cam.position);
    if(this.view.dot(this.normal)>0)return;
    this.view.reflect(this.normal).negate().add(this.mirrorPosition);
    this.rotation.extractRotation(cam.matrixWorld);
    this.lookAt.set(0,0,-1).applyMatrix4(this.rotation).add(cam.position);
    this.targetPoint.subVectors(this.mirrorPosition,this.lookAt).reflect(this.normal).negate().add(this.mirrorPosition);
    this.cam.position.copy(this.view);
    this.cam.up.set(0,1,0).applyMatrix4(this.rotation).reflect(this.normal);
    this.cam.lookAt(this.targetPoint);
    this.cam.far=cam.far;
    this.cam.updateMatrixWorld();
    this.cam.projectionMatrix.copy(cam.projectionMatrix);
    this.textureMatrix.set(
      .5,0,0,.5,
      0,.5,0,.5,
      0,0,.5,.5,
      0,0,0,1
    );
    this.textureMatrix.multiply(this.cam.projectionMatrix);
    this.textureMatrix.multiply(this.cam.matrixWorldInverse);
    this.textureMatrix.multiply(this.mesh.matrixWorld);
    this.reflectorPlane.setFromNormalAndCoplanarPoint(this.normal,this.mirrorPosition);
    this.reflectorPlane.applyMatrix4(this.cam.matrixWorldInverse);
    this.clipPlane.set(this.reflectorPlane.normal.x,this.reflectorPlane.normal.y,this.reflectorPlane.normal.z,this.reflectorPlane.constant);
    const projection=this.cam.projectionMatrix;
    this.q.set(
      (Math.sign(this.clipPlane.x)+projection.elements[8])/projection.elements[0],
      (Math.sign(this.clipPlane.y)+projection.elements[9])/projection.elements[5],
      -1,
      (1+projection.elements[10])/projection.elements[14]
    );
    this.clipPlane.multiplyScalar(2/this.clipPlane.dot(this.q));
    projection.elements[2]=this.clipPlane.x;
    projection.elements[6]=this.clipPlane.y;
    projection.elements[10]=this.clipPlane.z+1-0.003;
    projection.elements[14]=this.clipPlane.w;
    const previous=renderer.getRenderTarget();
    const xr=renderer.xr.enabled;
    this.mesh.visible=false;
    // The reflected camera sits behind the wall. Draw avatars without depth so
    // the wall cannot hide the person standing in front of the glass.
    const opened:THREE.Material[]=[];
    scene.traverse(obj=>{
      if(!obj.name.startsWith("GUEST_AVATAR_"))return;
      obj.traverse(child=>{
        child.frustumCulled=false;
        const mesh=child as THREE.Mesh;
        if(!mesh.isMesh||Array.isArray(mesh.material)||mesh.material.depthTest===false)return;
        mesh.material.depthTest=false;
        opened.push(mesh.material);
      });
    });
    renderer.xr.enabled=false;
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene,this.cam);
    renderer.setRenderTarget(previous);
    renderer.xr.enabled=xr;
    for(let i=0;i<opened.length;i++)opened[i].depthTest=true;
    this.mesh.visible=true;
  }
}
