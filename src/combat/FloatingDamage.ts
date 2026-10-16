import * as THREE from "three";

type Floater={sprite:THREE.Sprite;life:number;rise:number;baseY:number};

/** Short world-space numbers. A handful of sprites, no screen-space panel. */
export class FloatingDamage{
  private readonly root=new THREE.Group();
  private readonly pool:Floater[]=[];
  constructor(scene:THREE.Scene){
    this.root.name="FLOATING_DAMAGE";
    this.root.userData.noBatch=true;
    scene.add(this.root);
    for(let i=0;i<6;i++){
      const canvas=document.createElement("canvas");
      canvas.width=128;canvas.height=64;
      const texture=new THREE.CanvasTexture(canvas);
      texture.colorSpace=THREE.SRGBColorSpace;
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
      sprite.scale.set(1.05,.52,1);
      sprite.visible=false;
      this.root.add(sprite);
      this.pool.push({sprite,life:0,rise:0,baseY:0});
    }
  }
  spawn(at:{x:number;y:number;z:number},text:string,reducedMotion=false):void{
    const slot=this.pool.find(f=>f.life<=0)??this.pool.reduce((a,b)=>a.life<b.life?a:b);
    const map=slot.sprite.material.map;
    const canvas=map?.image as HTMLCanvasElement|undefined;
    const ctx=canvas?.getContext("2d");
    if(ctx&&canvas&&map){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.font="700 42px system-ui,sans-serif";
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.lineWidth=8;ctx.strokeStyle="#24160c";ctx.strokeText(text,64,34);
      ctx.fillStyle="#ffe08a";ctx.fillText(text,64,34);
      map.needsUpdate=true;
    }
    slot.sprite.position.set(at.x,at.y,at.z);
    slot.sprite.visible=true;
    slot.life=.8;
    slot.rise=reducedMotion?0:.9;
    slot.baseY=at.y;
    const material=slot.sprite.material;
    material.opacity=1;
  }
  update(dt:number):void{
    for(const slot of this.pool){
      if(slot.life<=0)continue;
      slot.life=Math.max(0,slot.life-dt);
      const t=1-slot.life/.8;
      slot.sprite.position.y=slot.baseY+slot.rise*t;
      slot.sprite.material.opacity=slot.life<=0?0:Math.min(1,slot.life/.25);
      if(slot.life<=0)slot.sprite.visible=false;
    }
  }
}
