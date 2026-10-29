import * as THREE from "three";
import {groundHeightAt} from "../../shared/worldRules.js";
import {
  GROVE, GUIDE, SMITH, STONE, KINDS,
  freshGrove, beginWave, stepGrove, shootGrove, monsterFoot, viewOf,
  questCopy, guideLines, smithLines, rankForKills,
  type GroveState, type GroveView, type MonsterKind
} from "../../shared/groveRules.js";

type Floater={sprite:THREE.Sprite; life:number};
type Bolt={mesh:THREE.Mesh; life:number; from:THREE.Vector3; to:THREE.Vector3};

const COLORS:Record<MonsterKind,number>={rush:0x8d3a32, spit:0x6f8f72, elite:0x3c3358};

/**
 * The FPS room, dressed as a dusk forest clearing. Trees and grass are
 * instanced. Monster HP in online rooms comes from the server snapshot.
 */
export class ForestGrove{
  readonly group=new THREE.Group();
  state:GroveState=freshGrove();
  online=false;
  rank=0;
  shake=0;
  hitStop=0;
  private readonly lite:boolean;
  private readonly monsters=new Map<number, THREE.Group>();
  private readonly bars=new Map<number, {mesh:THREE.Mesh; canvas:HTMLCanvasElement; ctx:CanvasRenderingContext2D|null}>();
  private readonly floaters:Floater[]=[];
  private readonly bolts:Bolt[]=[];
  private readonly rays:THREE.Mesh[]=[];
  private readonly spark:THREE.Points;
  private sparkLife=0;
  private readonly stone:THREE.Group;
  private readonly guide:THREE.Group;
  private readonly smith:THREE.Group;
  private mood=false;
  private savedFog:THREE.Fog|THREE.FogExp2|null=null;
  private audio:AudioContext|null=null;
  private readonly dummy=new THREE.Object3D();
  constructor(private readonly scene:THREE.Scene){
    this.lite=(navigator.hardwareConcurrency||8)<=4;
    this.group.name="FOREST_GROVE";
    scene.add(this.group);
    this.buildScenery();
    this.stone=this.character(STONE.x, STONE.z, 0xc4553a, true);
    this.guide=this.character(GUIDE.x, GUIDE.z, 0xf0d2a0, false);
    this.smith=this.character(SMITH.x, SMITH.z, 0x8a5a3a, false);
    const geo=new THREE.BufferGeometry();
    const pos=new Float32Array(48*3);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.spark=new THREE.Points(geo, new THREE.PointsMaterial({color:0xffd089, size:0.12, transparent:true, depthWrite:false}));
    this.spark.visible=false;
    this.group.add(this.spark);
    this.group.visible=false;
  }
  private buildScenery():void{
    const trunk=new THREE.CylinderGeometry(0.16, 0.26, 1, 6);
    const crown=new THREE.IcosahedronGeometry(0.72, 0);
    const leafMat=new THREE.MeshLambertMaterial({color:0x2f6a45});
    const trunkMat=new THREE.MeshLambertMaterial({color:0x5c4030});
    const count=this.lite?42:96;
    const trunks=new THREE.InstancedMesh(trunk, trunkMat, count);
    const crowns=new THREE.InstancedMesh(crown, leafMat, count);
    trunks.castShadow=false; crowns.castShadow=false;
    let n=0;
    for(let i=0;i<count;i++){
      const edge=i%4;
      let x=127, z=-9;
      if(edge===0){x=GROVE.minX-1.4-(i%5)*0.2; z=GROVE.minZ+((i*1.7)%9);}
      else if(edge===1){x=GROVE.maxX+1.2; z=GROVE.minZ+((i*1.3)%9);}
      else if(edge===2){x=GROVE.minX+((i*1.1)%14); z=GROVE.minZ-1.5;}
      else{x=112+(i%6)*1.1; z=i%2?-10.5:-1.2;}
      const h=2.6+(i%5)*0.45;
      this.dummy.position.set(x, h*0.5, z);
      this.dummy.rotation.set(0, i, 0);
      this.dummy.scale.set(1, h, 1);
      this.dummy.updateMatrix();
      trunks.setMatrixAt(n, this.dummy.matrix);
      this.dummy.position.set(x, h+0.35, z);
      this.dummy.scale.set(1.1+(i%3)*0.25, 0.9+(i%4)*0.15, 1.1);
      this.dummy.updateMatrix();
      crowns.setMatrixAt(n, this.dummy.matrix);
      n++;
    }
    trunks.count=n; crowns.count=n;
    trunks.instanceMatrix.needsUpdate=true;
    crowns.instanceMatrix.needsUpdate=true;
    this.group.add(trunks, crowns);
    const tufts=this.lite?80:200;
    const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.46, 3), new THREE.MeshLambertMaterial({color:0x6ea86a}), tufts);
    let g=0;
    for(let i=0;i<tufts;i++){
      const x=GROVE.minX+((i*3.1)%(GROVE.maxX-GROVE.minX));
      const z=GROVE.minZ+((i*2.4)%(GROVE.maxZ-GROVE.minZ));
      if(Math.hypot(x-STONE.x, z-STONE.z)<1.4) continue;
      this.dummy.position.set(x, 0.2, z);
      this.dummy.rotation.set(0, i, 0);
      this.dummy.scale.set(1, 0.7+(i%4)*0.2, 1);
      this.dummy.updateMatrix();
      grass.setMatrixAt(g++, this.dummy.matrix);
    }
    grass.count=g; grass.instanceMatrix.needsUpdate=true;
    this.group.add(grass);
    if(!this.lite){
      const mat=new THREE.MeshBasicMaterial({color:0xffe1b0, transparent:true, opacity:0.09, depthWrite:false, side:THREE.DoubleSide});
      for(let i=0;i<4;i++){
        const ray=new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), mat);
        ray.position.set(126+i*1.6, 4.2, -8);
        ray.rotation.z=-0.35; ray.rotation.y=0.4;
        this.rays.push(ray); this.group.add(ray);
      }
    }
    const floor=new THREE.Mesh(new THREE.CircleGeometry(2.1, 18), new THREE.MeshLambertMaterial({color:0x243028}));
    floor.rotation.x=-Math.PI/2; floor.position.set(STONE.x, 0.02, STONE.z);
    this.group.add(floor);
  }
  private character(x:number, z:number, color:number, stone:boolean):THREE.Group{
    const group=new THREE.Group();
    if(stone){
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(0.55), new THREE.MeshLambertMaterial({color, emissive:0x3a120c, emissiveIntensity:0.4}));
      rock.position.y=0.55;
      const glow=new THREE.PointLight(0xff9a55, 1.4, 8);
      glow.position.y=1.4;
      group.add(rock, glow);
    }else{
      const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 3, 6), new THREE.MeshLambertMaterial({color}));
      body.position.y=1.05;
      const head=new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshLambertMaterial({color:0xf3ddc4}));
      head.position.y=1.72;
      group.add(body, head);
    }
    const y=groundHeightAt(x, z)??0;
    group.position.set(x, y, z);
    this.group.add(group);
    return group;
  }
  private monsterMesh(kind:MonsterKind):THREE.Group{
    const group=new THREE.Group();
    const color=COLORS[kind];
    const mat=new THREE.MeshLambertMaterial({color, emissive:0x000000});
    if(kind==="rush"){
      const body=new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 1.15), mat);
      body.position.y=0.48;
      const horn=new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.38, 5), new THREE.MeshLambertMaterial({color:0xf2e2c4}));
      horn.position.set(0, 0.86, 0.35); horn.rotation.x=0.5;
      group.add(body, horn);
    }else if(kind==="spit"){
      const stalk=new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.9, 3, 6), mat);
      stalk.position.y=0.9;
      const sac=new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({color:0xb6e38a, emissive:0x3d6a32, emissiveIntensity:0.6}));
      sac.position.y=1.55; sac.name="SAC";
      group.add(stalk, sac);
    }else{
      const body=new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 8), mat);
      body.position.y=0.78; body.scale.y=0.72;
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({color:0xffd56a}));
      eye.position.set(0, 1.35, 0.42); eye.name="EYE";
      group.add(body, eye);
    }
    group.userData.mat=mat;
    return group;
  }
  private barFor(id:number){
    let bar=this.bars.get(id);
    if(bar) return bar;
    const canvas=document.createElement("canvas");
    canvas.width=64; canvas.height=8;
    const ctx=canvas.getContext("2d");
    const texture=new THREE.CanvasTexture(canvas);
    if(ctx){ctx.fillStyle="#241018";ctx.fillRect(0,0,64,8);ctx.fillStyle="#7dffe0";ctx.fillRect(1,1,62,6);}
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.08), new THREE.MeshBasicMaterial({map:texture, transparent:true, depthTest:false}));
    mesh.renderOrder=5;
    this.group.add(mesh);
    bar={mesh, canvas, ctx};
    this.bars.set(id, bar);
    return bar;
  }
  applyView(view:GroveView):void{
    this.state={...this.state, ...view, nextId:this.state.nextId, monsters:view.monsters.map(m=>{
      const prev=this.state.monsters.find(p=>p.id===m.id);
      return {...(prev??{cooldown:0, wind:0, stagger:0, deadFor:0, patrol:0, ax:m.x, az:m.z, bx:m.x, bz:m.z}), ...m};
    })};
  }
  summon():boolean{
    if(this.online) return false;
    if(this.state.phase==="fight") return false;
    this.state=beginWave(this.state);
    this.burst(STONE.x, 1, STONE.z);
    this.tone(220, 0.18, "sawtooth", 0.05);
    return true;
  }
  shoot(origin:{x:number;y:number;z:number}, yaw:number, pitch:number){
    if(this.online || this.state.phase!=="fight") return null;
    const shot=shootGrove(this.state, origin, yaw, pitch, this.rank);
    if(!shot) return null;
    this.state=shot.state;
    this.onHit(shot.point, shot.damage, shot.crit, shot.killed);
    return shot;
  }
  private onHit(point:{x:number;y:number;z:number}, damage:number, crit:boolean, killed:boolean):void{
    this.shake=Math.max(this.shake, crit?0.16:0.07);
    this.hitStop=crit?0.045:0.02;
    this.float(point, (crit?"急所 ":"")+damage);
    this.tone(crit?680:420, 0.07, "triangle", 0.06);
    if(killed){this.burst(point.x, point.y, point.z); this.tone(140, 0.2, "sine", 0.07);}
  }
  noteRemoteHit(point:{x:number;y:number;z:number}, damage:number, crit:boolean, killed:boolean):void{
    this.onHit(point, damage, crit, killed);
  }
  unlock():void{
    const Ctx=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!Ctx)return;
    if(!this.audio)this.audio=new Ctx();
    if(this.audio.state==="suspended")void this.audio.resume();
  }
  private tone(freq:number, dur:number, type:OscillatorType, gain:number):void{
    const ac=this.audio;
    if(!ac || ac.state!=="running") return;
    const o=ac.createOscillator();
    const g=ac.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+dur);
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime+dur);
  }
  private float(point:{x:number;y:number;z:number}, text:string):void{
    const canvas=document.createElement("canvas");
    canvas.width=128; canvas.height=64;
    const ctx=canvas.getContext("2d");
    if(!ctx) return;
    ctx.font="700 36px sans-serif"; ctx.textAlign="center"; ctx.fillStyle="#fff6ea";
    ctx.fillText(text, 64, 42);
    const map=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map, transparent:true, depthTest:false}));
    sprite.position.set(point.x, point.y+0.4, point.z);
    sprite.scale.set(0.9, 0.45, 1);
    this.group.add(sprite);
    this.floaters.push({sprite, life:0.7});
  }
  private burst(x:number, y:number, z:number):void{
    const attr=this.spark.geometry.getAttribute("position") as THREE.BufferAttribute;
    for(let i=0;i<16;i++){
      attr.setXYZ(i, x+(Math.random()-0.5)*1.4, y+Math.random()*1.2, z+(Math.random()-0.5)*1.4);
    }
    attr.needsUpdate=true;
    this.spark.visible=true;
    this.sparkLife=0.45;
  }
  timeScale():number{return this.hitStop>0?0.35:1}
  update(dt:number, player:{x:number;y:number;z:number;hp:number}, active:boolean, camera?:THREE.Camera):Array<{type:"hurt"; damage:number}>{
    this.hitStop=Math.max(0, this.hitStop-dt);
    this.shake*=Math.pow(0.05, dt);
    const inside=active && player.x>108 && player.x<148 && player.z>-30 && player.z<30;
    this.group.visible=inside;
    this.setMood(inside);
    if(!inside) return [];
    const hurts:Array<{type:"hurt"; damage:number}>=[];
    if(!this.online && this.state.phase==="fight"){
      const stepped=stepGrove(this.state, dt, [{id:"local", x:player.x, z:player.z, hp:player.hp}]);
      this.state=stepped.state;
      for(const ev of stepped.events){
        hurts.push({type:"hurt", damage:ev.damage});
        this.shake=Math.max(this.shake, 0.12);
        this.tone(90, 0.12, "sine", 0.08);
      }
      const next=rankForKills(this.state.kills);
      if(next>this.rank && Math.hypot(player.x-SMITH.x, player.z-SMITH.z)<2.4) this.rank=next;
    }
    const seen=new Set<number>();
    for(const m of this.state.monsters){
      seen.add(m.id);
      let group=this.monsters.get(m.id);
      if(!group){
        group=this.monsterMesh(m.kind);
        this.monsters.set(m.id, group);
        this.group.add(group);
      }
      const foot=monsterFoot(m);
      const spec=KINDS[m.kind];
      group.visible=m.state!=="dead" || true;
      group.position.set(m.x, foot, m.z);
      group.rotation.y=m.yaw;
      const fallen=m.state==="dead";
      group.scale.setScalar(fallen?0.4:1);
      const mat=group.userData.mat as THREE.MeshLambertMaterial|undefined;
      if(mat) mat.emissive.setHex(m.state==="stagger"?0xff6a4a:0x000000);
      const bar=this.barFor(m.id);
      if(bar.ctx){
        bar.ctx.clearRect(0, 0, 64, 8);
        bar.ctx.fillStyle="#2a1420"; bar.ctx.fillRect(0, 0, 64, 8);
        bar.ctx.fillStyle=m.hp*2<m.maxHp?"#e23b3b":"#7dffe0";
        bar.ctx.fillRect(1, 1, Math.max(0, 62*m.hp/Math.max(1, m.maxHp)), 6);
        const map=(bar.mesh.material as THREE.MeshBasicMaterial).map;
        if(map) map.needsUpdate=true;
      }
      bar.mesh.position.set(m.x, foot+spec.height+0.45, m.z);
      if(camera)bar.mesh.lookAt(camera.position);
      bar.mesh.visible=!fallen;
      if(m.kind==="spit" && m.state==="attack"){
        const sac=group.getObjectByName("SAC");
        if(sac) sac.scale.setScalar(1.25);
      }
    }
    for(const [id, group] of this.monsters){
      if(!seen.has(id)){group.visible=false;}
    }
    for(const [id, bar] of this.bars) if(!seen.has(id)) bar.mesh.visible=false;
    for(let i=this.floaters.length-1;i>=0;i--){
      const f=this.floaters[i];
      f.life-=dt; f.sprite.position.y+=dt*0.8;
      if(f.life<=0){this.group.remove(f.sprite); f.sprite.material.dispose(); this.floaters.splice(i, 1);}
    }
    if(this.sparkLife>0){this.sparkLife-=dt; if(this.sparkLife<=0) this.spark.visible=false;}
    this.stone.rotation.y+=dt*0.4;
    return hurts;
  }
  private setMood(on:boolean):void{
    if(on===this.mood) return;
    this.mood=on;
    if(on){
      this.savedFog=this.scene.fog as THREE.Fog|null;
      this.scene.fog=new THREE.Fog(0x1c2430, 10, this.lite?32:42);
      this.scene.background=new THREE.Color(0x1c2430);
    }else if(this.savedFog){
      this.scene.fog=this.savedFog;
      this.scene.background=new THREE.Color(0x19121e);
    }
  }
  hud():{title:string; body:string; wave:string}{
    const q=questCopy(this.state);
    const wave=this.state.phase==="fight"?"第"+this.state.wave+"波":this.state.phase==="clear"?"突破":"待機";
    return {title:q.title, body:q.body, wave};
  }
  talk(kind:"guide"|"smith"):[string, string]{
    return kind==="guide"?guideLines(this.state):smithLines(this.state, this.rank);
  }
  tryUpgrade():boolean{
    const next=rankForKills(this.state.kills);
    if(next<=this.rank) return false;
    this.rank=next;
    this.tone(520, 0.12, "square", 0.04);
    return true;
  }
  snapshot():GroveView{return viewOf(this.state)}
}
