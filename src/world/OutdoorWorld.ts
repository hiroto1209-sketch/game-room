import * as THREE from "three";
import { chunkData, OUTDOOR, POND, WORLD_SEED, groundHeightAt, terrainVisualHeightAt } from "../../shared/worldRules.js";
import {ARENA} from "../../shared/combatRules.js";
import {TerrainSurface} from "./TerrainSurface";

/**
 * Procedural outdoor preview linked to the existing lobby.
 * All decorative placements are deterministic and shared via WORLD_SEED.
 * Nearby 16x16 cells have active InstancedMesh vegetation; no image assets.
 */
export class OutdoorWorld {
  readonly seed=WORLD_SEED;
  private readonly root=new THREE.Group();
  private readonly terrain:TerrainSurface;
  private readonly chunks=new Map<string,THREE.Group>();
  private readonly box=new THREE.BoxGeometry(16,.26,16);
  private readonly trunk=new THREE.CylinderGeometry(.18,.25,1,5);
  private readonly crown=new THREE.IcosahedronGeometry(1,0);
  private readonly grass=new THREE.ConeGeometry(.16,.62,3);
  private readonly rock=new THREE.IcosahedronGeometry(.5,0);
  private readonly ruin=new THREE.BoxGeometry(1,1,1);
  private readonly materials={
    grounds:[0x294b38,0x305541,0x365843].map(color=>new THREE.MeshStandardMaterial({color,roughness:1})),
    trunk:new THREE.MeshStandardMaterial({color:0x735b50,roughness:1}),
    leaf:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,flatShading:true}),
    grass:new THREE.MeshStandardMaterial({color:0x7ebd86,roughness:1,side:THREE.DoubleSide}),
    rock:new THREE.MeshStandardMaterial({color:0x8f9c94,roughness:.93,flatShading:true}),
    ruin:new THREE.MeshStandardMaterial({color:0xb6a4bc,roughness:.83,flatShading:true})
  };
  private readonly tmp=new THREE.Object3D();
  private readonly sharedScenery:THREE.Object3D[]=[];
  private lastChunkId="";
  private water:THREE.Mesh | null=null;
  private fireflies:THREE.Points | null=null;
  readonly chunkSize=OUTDOOR.chunkSize;
  activeChunkCount=0;

  constructor(private scene:THREE.Scene){
    this.root.name="THE DOOR / MOONLIT OUTSIDE";
    scene.add(this.root);
    this.terrain=new TerrainSurface(this.root);
    this.populateStatic();
  }
  private boxMesh(w:number,h:number,d:number,color:number,x:number,y:number,z:number):THREE.Mesh{
    const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.88}));
    obj.position.set(x,y,z);this.root.add(obj);this.sharedScenery.push(obj);return obj;
  }
  private outdoorSign(text:string,x:number,z:number):void{
    const c=document.createElement("canvas");c.width=512;c.height=128;
    const ctx=c.getContext("2d");
    if(!ctx)return;
    ctx.fillStyle="#272039";ctx.fillRect(0,0,512,128);
    ctx.fillStyle="#f4d4b6";ctx.strokeStyle="#cb97d8";ctx.lineWidth=9;ctx.strokeRect(8,8,496,112);
    ctx.font="bold 40px system-ui,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(text,256,64);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const face=new THREE.Mesh(new THREE.PlaneGeometry(3.3,.84),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
    face.position.set(x,3.3,z);face.rotation.y=-Math.PI/2;this.root.add(face);this.sharedScenery.push(face);
  }
  private populateStatic():void{
    // Ground is a continuous static TerrainSurface. No overlap with another
    // floor, no dark fallback showing when distant vegetation unloads.
    // A gentle static landscaping accent signals that this is real walkable land.
    this.boxMesh(30,.018,3.0,0x71846e,-7,-.023,27.5);
    // Low, entirely decorative garden tufts around the house: one draw call,
    // no animation or hidden collision boxes. Avoid the party hall and armory.
    const backyardGrass=new THREE.InstancedMesh(new THREE.ConeGeometry(.12,.39,3),
      new THREE.MeshBasicMaterial({color:0x659a73}),112);
    const tuft=new THREE.Object3D();
    let used=0;
    for(let i=0;i<240&&used<112;i++){
      const px=-22+((i*37)%285)/10,pz=-44+((i*53)%895)/10;
      const inMain=px>-11.2&&px<11.2&&pz>-17.1&&pz<9.1;
      const inHall=px>-3.6&&px<3.6&&pz>8&&pz<19;
      const inArmory=px>-6&&px<6&&pz>17&&pz<27;
      if(inMain||inHall||inArmory||Math.abs(pz-27.5)<1.9)continue;
      tuft.position.set(px,.16,pz);
      tuft.rotation.y=(i*2.39996)%(Math.PI*2);
      tuft.scale.set(.65+(i%4)*.12,.6+(i%3)*.16,.65+(i%4)*.12);
      tuft.updateMatrix();backyardGrass.setMatrixAt(used++,tuft.matrix);
    }
    backyardGrass.count=used;
    backyardGrass.instanceMatrix.needsUpdate=true;
    backyardGrass.computeBoundingSphere();
    this.root.add(backyardGrass);this.sharedScenery.push(backyardGrass);

    this.boxMesh(43,.055,3.4,0x87796f,32,-.04,-5);
    this.boxMesh(2.8,.055,23,0x797b72,44,-.039,-17);
    this.boxMesh(22,.055,2.4,0x777e6d,45,-.038,-19);
    // Path to the combat island skirts the pond's southern edge.
    this.boxMesh(45,.065,2.8,0x777b83,65,-.055,-40.2);
    this.boxMesh(8,.065,2.8,0x777b83,46,-.055,-32);
    // Dedicated combat floor; no vegetation is generated inside this arena.
    const middleX=(ARENA.minX+ARENA.maxX)/2,middleZ=(ARENA.minZ+ARENA.maxZ)/2;
    const spanX=ARENA.maxX-ARENA.minX,spanZ=ARENA.maxZ-ARENA.minZ;
    this.boxMesh(spanX,.095,spanZ,0x2b2b46,middleX,-.065,middleZ);
    for(const [x,z,w,d] of [
      [middleX,ARENA.minZ,spanX,.22],[middleX,ARENA.maxZ,spanX,.22],
      [ARENA.minX,middleZ,.22,spanZ],[ARENA.maxX,middleZ,.22,spanZ]
    ]){
      this.boxMesh(w,.11,d,0x42e6ce,x,.035,z);
    }
    // Neon pylons signal a separate consensual arena, not a weapon in the lounge.
    for(const x of [ARENA.minX+1,ARENA.maxX-1])for(const z of [ARENA.minZ+1,ARENA.maxZ-1]){
      this.boxMesh(.32,3.6,.32,0x6e4ba5,x,1.8,z);
      const orb=new THREE.Mesh(new THREE.OctahedronGeometry(.34),new THREE.MeshBasicMaterial({color:0x8cfce6}));
      orb.position.set(x,3.6,z);this.root.add(orb);this.sharedScenery.push(orb);
    }
    this.outdoorSign("NEON ARENA",76,-38);
    // Entrance pillars make the former wall opening look deliberate.
    for(const z of [-6.7,-3.3]){
      this.boxMesh(.57,3.8,.55,0x8c6c83,11,1.91,z);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(.13,9,6),new THREE.MeshBasicMaterial({color:0xffc6e2}));
      cap.position.set(11,3.74,z);this.root.add(cap);this.sharedScenery.push(cap);
    }
    this.outdoorSign("MOONLIT WORLD",12.9,-5);
    // The pond uses two low-poly ellipses and transparent water; no expensive reflections.
    const shore=new THREE.Mesh(new THREE.CircleGeometry(1,64),
      new THREE.MeshStandardMaterial({color:0x6e7659,roughness:1,side:THREE.DoubleSide}));
    shore.rotation.x=-Math.PI/2;
    shore.scale.set(POND.rx+1.45,POND.rz+1.45,1);
    shore.position.set(POND.x,.018,POND.z);
    this.root.add(shore);this.sharedScenery.push(shore);
    this.water=new THREE.Mesh(new THREE.CircleGeometry(1,64),
      new THREE.MeshBasicMaterial({color:0x368c9a,transparent:true,opacity:.84,side:THREE.DoubleSide,depthWrite:false}));
    this.water.rotation.x=-Math.PI/2;
    this.water.scale.set(POND.rx,POND.rz,1);
    this.water.position.set(POND.x,.075,POND.z);
    this.root.add(this.water);this.sharedScenery.push(this.water);
    // Lilies + reeds are few and shared; the lake boundary is a blocked gameplay zone.
    const padGeometry=new THREE.CircleGeometry(.45,9);
    const padMaterial=new THREE.MeshStandardMaterial({color:0x6caf7c,side:THREE.DoubleSide,roughness:.9});
    for(let i=0;i<13;i++){
      const angle=i*2.39996,r=.21+.7*(i%5)/5;
      const pad=new THREE.Mesh(padGeometry,padMaterial);
      pad.rotation.x=-Math.PI/2;
      pad.position.set(POND.x+Math.cos(angle)*POND.rx*r,.058,POND.z+Math.sin(angle)*POND.rz*r);
      this.root.add(pad);this.sharedScenery.push(pad);
    }
    // Reeds around the lake use one instanced draw call.
    const reedGeometry=new THREE.ConeGeometry(.11,1.6,4);
    const reedMaterial=new THREE.MeshStandardMaterial({color:0x8cac77,roughness:1});
    const reeds=new THREE.InstancedMesh(reedGeometry,reedMaterial,40);
    const dummy=new THREE.Object3D();
    for(let i=0;i<40;i++){
      const angle=i*2.39996;
      const radial=1.04+(i%5)*.032;
      dummy.position.set(POND.x+Math.cos(angle)*POND.rx*radial,.57,POND.z+Math.sin(angle)*POND.rz*radial);
      dummy.rotation.y=angle;dummy.scale.set(.75, .8+(i%4)*.11, .75);
      dummy.updateMatrix();reeds.setMatrixAt(i,dummy.matrix);
    }
    reeds.instanceMatrix.needsUpdate=true;
    reeds.computeBoundingSphere();
    this.root.add(reeds);this.sharedScenery.push(reeds);
    // A few warm street lamps, rather than one point light per tree.
    for(const [x,z] of [[18,-10],[35,-11],[43,-22],[72,9]]){
      this.boxMesh(.14,3.6,.14,0x766776,x,1.8,z);
      const lantern=new THREE.Mesh(new THREE.OctahedronGeometry(.27),new THREE.MeshBasicMaterial({color:0xffd19a}));
      lantern.position.set(x,3.5,z);this.root.add(lantern);this.sharedScenery.push(lantern);
      const light=new THREE.PointLight(0xffd19a,.95,11,2);
      light.position.set(x,3.5,z);this.root.add(light);this.sharedScenery.push(light);
    }
    // Distant stars and floating fireflies: one draw call per point cloud.
    const starPoints=[];
    let random=78612;
    const rnd=()=>((random=(Math.imul(random,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<220;i++){
      starPoints.push(12+rnd()*99,20+rnd()*26,-50+rnd()*100);
    }
    const starGeometry=new THREE.BufferGeometry();
    starGeometry.setAttribute("position",new THREE.Float32BufferAttribute(starPoints,3));
    const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0xe7e4ff,size:.21,sizeAttenuation:true,depthWrite:false}));
    this.root.add(stars);this.sharedScenery.push(stars);
    const glowPoints=[];
    for(let i=0;i<72;i++)glowPoints.push(30+rnd()*67,.8+rnd()*3,-40+rnd()*78);
    const fireflyGeometry=new THREE.BufferGeometry();
    fireflyGeometry.setAttribute("position",new THREE.Float32BufferAttribute(glowPoints,3));
    this.fireflies=new THREE.Points(fireflyGeometry,new THREE.PointsMaterial({color:0xffd6a7,size:.13,depthWrite:false,transparent:true,opacity:.72}));
    this.root.add(this.fireflies);this.sharedScenery.push(this.fireflies);
  }
  private instance<T extends THREE.BufferGeometry>(
    parent:THREE.Group, geometry:T, material:THREE.Material,
    entries:Array<{x:number;z:number;size?:number;height?:number;color?:number;twist?:number}>,
    apply:(entry:typeof entries[number],out:THREE.Object3D)=>void
  ):void{
    if(entries.length===0)return;
    const mesh=new THREE.InstancedMesh(geometry,material,entries.length);
    mesh.frustumCulled=true;
    for(let i=0;i<entries.length;i++){
      this.tmp.position.set(0,0,0);
      this.tmp.rotation.set(0,0,0);
      this.tmp.scale.set(1,1,1);
      apply(entries[i],this.tmp);
      this.tmp.updateMatrix();mesh.setMatrixAt(i,this.tmp.matrix);
      if(material===this.materials.leaf){
        const shades=[0x72ac86,0x85bb99,0x58966c];
        mesh.setColorAt(i,new THREE.Color(shades[entries[i].color??0]));
      }
    }
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();
    mesh.castShadow=false;mesh.receiveShadow=false;
    parent.add(mesh);
  }
  private makeChunk(cx:number,cz:number):THREE.Group|null{
    const d=chunkData(cx,cz,this.seed);
    if(!d)return null;
    const group=new THREE.Group();
    group.name="outside-chunk-"+cx+"-"+cz;
    // 0.5-unit static grid resolves the shore without tessellation per frame.
    // Ground is *not* streamed: one continuous static mesh persists outside
    // camera view. Only foliage and scenery use 16x16 chunk streaming.
    this.instance(group,this.grass,this.materials.grass,d.grass,(e,o)=>{
      o.position.set(e.x,groundHeightAt(e.x,e.z)+.15,e.z);o.scale.set(e.size??.4,.52+(e.size??.4)*.5,e.size??.4);o.rotation.y=e.twist??0;
    });
    this.instance(group,this.trunk,this.materials.trunk,d.trees,(e,o)=>{
      const h=e.height??3.5;
      o.position.set(e.x,groundHeightAt(e.x,e.z)+h*.27,e.z);o.scale.set(.95,h*.55,.95);
    });
    this.instance(group,this.crown,this.materials.leaf,d.trees,(e,o)=>{
      const h=e.height??3.5;
      o.position.set(e.x,groundHeightAt(e.x,e.z)+h*.77,e.z);o.scale.set(1.15+(h-3)*.1,h*.26,1.07+(h-3)*.1);
    });
    this.instance(group,this.rock,this.materials.rock,d.rocks,(e,o)=>{
      const size=e.size??.6;o.position.set(e.x,groundHeightAt(e.x,e.z)+size*.35,e.z);o.scale.set(size,Math.max(.38,size*.8),size*.78);
    });
    this.instance(group,this.ruin,this.materials.ruin,d.blocks,(e,o)=>{
      const h=e.height??2;o.position.set(e.x,groundHeightAt(e.x,e.z)+h*.5,e.z);o.scale.set(1.35,h,1.35);
    });
    return group;
  }
  update(position:{x:number;z:number},time:number):void{
    // Indoor starts without dense outside vegetation; scenery wakes near exit.
    const inExterior=position.x>5.6&&!Number.isNaN(position.x);
    const cx=Math.max(0,Math.min(OUTDOOR.columns-1,Math.floor((position.x-8)/16)));
    const cz=Math.max(0,Math.min(OUTDOOR.rows-1,Math.floor((position.z-OUTDOOR.minZ)/16)));
    const radius=inExterior?1:0;
    const key=inExterior?cx+":"+cz+":"+radius:"indoor";
    if(key!==this.lastChunkId){
      this.lastChunkId=key;
      const wanted=new Set<string>();
      if(inExterior){
        for(let ix=cx-radius;ix<=cx+radius;ix++){
          for(let iz=cz-radius;iz<=cz+radius;iz++){
            if(ix<0||ix>=OUTDOOR.columns||iz<0||iz>=OUTDOOR.rows)continue;
            const k=ix+":"+iz;wanted.add(k);
            if(!this.chunks.has(k)){
              const created=this.makeChunk(ix,iz);
              if(created){this.root.add(created);this.chunks.set(k,created)}
            }
          }
        }
      }
      for(const [k,group] of this.chunks){
        if(!wanted.has(k)){
          this.root.remove(group);this.chunks.delete(k);
          group.traverse(o=>{
            if(o instanceof THREE.InstancedMesh)o.dispose();
            else if(o instanceof THREE.Mesh){
              o.geometry.dispose();
              const mats=Array.isArray(o.material)?o.material:[o.material];
              mats.forEach(m=>m.dispose());
            }
          });
          // Per-chunk instance buffers are released; shared geometries/materials stay resident.
        }
      }
      this.activeChunkCount=this.chunks.size;
    }
    // Water/vegetation/fireflies remain deliberately static for stable mobile frame time.
  }
  dispose():void{
    this.root.parent?.remove(this.root);
    this.terrain.dispose();
    for(const group of this.chunks.values())this.root.remove(group);
    this.chunks.clear();
    for(const mesh of this.sharedScenery){
      if(mesh instanceof THREE.Mesh||mesh instanceof THREE.Points){
        mesh.geometry.dispose();
        const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        mats.forEach(m=>{const t=(m as THREE.MeshBasicMaterial).map;t?.dispose();m.dispose()});
      }
    }
    this.box.dispose();this.trunk.dispose();this.crown.dispose();this.grass.dispose();this.rock.dispose();this.ruin.dispose();
    [...this.materials.grounds,this.materials.trunk,this.materials.leaf,this.materials.grass,this.materials.rock,this.materials.ruin]
      .forEach(m=>m.dispose());
  }
}
