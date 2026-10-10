import * as THREE from "three";
import {validSignText} from "../../shared/combatRules.js";

/** Full-sign personalized billboard: bold stationary short copy; marquee on long copy. */
export class SignMarquee{
  private readonly canvas=document.createElement("canvas");
  private readonly ctx:CanvasRenderingContext2D;
  private readonly texture:THREE.CanvasTexture;
  private readonly mesh:THREE.Mesh;
  private text="WELCOME TO GAME ROOM";
  private elapsed=0;
  private ticker=false;
  private width=0;
  private fontSize=128;
  private acc=0;
  constructor(scene:THREE.Scene){
    this.canvas.width=1024;this.canvas.height=256;
    const ctx=this.canvas.getContext("2d");
    if(!ctx)throw new Error("Sign board canvas unavailable");
    this.ctx=ctx;
    this.texture=new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace=THREE.SRGBColorSpace;
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(7.20,1.59),
      new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false,depthWrite:false,side:THREE.DoubleSide}));
    this.mesh.position.set(0,2.50,-15.56);
    scene.add(this.mesh);
    this.setText(this.text);
  }
  getText():string{return this.text}
  setText(value:string):void{
    if(!validSignText(value))return;
    this.text=value.trim()||"WELCOME TO GAME ROOM";
    const ctx=this.ctx;
    this.fontSize=128;
    ctx.font="900 128px -apple-system,system-ui,sans-serif";
    this.width=ctx.measureText(this.text).width;
    // Keep short text huge and centered; scroll longer copy instead of tiny text.
    while(this.fontSize>62){
      ctx.font="900 "+this.fontSize+"px -apple-system,system-ui,sans-serif";
      if(ctx.measureText(this.text).width<=895)break;
      this.fontSize-=4;
    }
    this.ticker=ctx.measureText(this.text).width>895;
    this.elapsed=0;
    this.draw(false);
  }
  update(dt:number,reducedMotion=false):void{
    if(!this.ticker)return;
    if(!reducedMotion)this.elapsed+=dt;
    this.acc+=dt;
    if(this.acc>.085){this.acc=0;this.draw(reducedMotion)}
  }
  private draw(reducedMotion:boolean):void{
    const ctx=this.ctx,w=1024,h=256;
    const bg=ctx.createLinearGradient(0,0,w,h);
    bg.addColorStop(0,"#1a102a");bg.addColorStop(.5,"#38213e");bg.addColorStop(1,"#171627");
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#eeafd1";ctx.lineWidth=8;ctx.strokeRect(8,8,w-16,h-16);
    ctx.strokeStyle="#a36eaf";ctx.lineWidth=2;ctx.strokeRect(22,23,w-44,h-46);
    ctx.save();ctx.beginPath();ctx.rect(35,28,w-70,h-56);ctx.clip();
    ctx.textBaseline="middle";
    ctx.fillStyle="#fff5e6";ctx.shadowColor="#ffb5d2";ctx.shadowBlur=14;
    if(!this.ticker){
      ctx.font="900 "+this.fontSize+"px -apple-system,system-ui,sans-serif";
      ctx.textAlign="center";ctx.fillText(this.text,w/2,h/2);
    }else if(reducedMotion){
      // Static two-row fallback avoids endless motion for reduced-motion users.
      const chars=Array.from(this.text);
      const split=Math.ceil(chars.length/2);
      ctx.font="bold "+(chars.length>45?40:58)+"px -apple-system,system-ui,sans-serif";
      ctx.textAlign="center";ctx.fillText(chars.slice(0,split).join(""),w/2,96,920);
      ctx.fillText(chars.slice(split).join(""),w/2,169,920);
    }else{
      ctx.font="900 104px -apple-system,system-ui,sans-serif";
      ctx.textAlign="left";
      const len=ctx.measureText(this.text).width;
      const wrap=w+len+120;
      const x=140-(this.elapsed*120)%wrap;
      ctx.fillText(this.text,x,134);
      // Second copy creates seamless loop for narrower text.
      ctx.fillText(this.text,x+len+170,134);
    }
    ctx.restore();
    this.texture.needsUpdate=true;
  }
  dispose():void{
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}
