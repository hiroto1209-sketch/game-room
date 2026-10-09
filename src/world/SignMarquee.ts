import * as THREE from "three";
import {validSignText} from "../../shared/combatRules.js";
/** Scrolling ticker overlays the existing GAME ROOM sign; local geometry stays unchanged. */
export class SignMarquee{
  private readonly canvas=document.createElement("canvas");
  private readonly context:CanvasRenderingContext2D;
  private readonly texture:THREE.CanvasTexture;
  private readonly mesh:THREE.Mesh;
  private text="WELCOME TO GAME ROOM";
  private elapsed=0;
  private drawAccumulator=0;
  constructor(scene:THREE.Scene){
    this.canvas.width=1024;this.canvas.height=96;
    const ctx=this.canvas.getContext("2d");
    if(!ctx)throw new Error("Marquee canvas unavailable");
    this.context=ctx;
    this.texture=new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace=THREE.SRGBColorSpace;
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(6.9,.44),
      new THREE.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false}));
    this.mesh.position.set(0,1.87,-15.56);
    scene.add(this.mesh);
    this.draw();
  }
  setText(value:string):void{
    if(!validSignText(value))return;
    this.text=value.trim()||"WELCOME TO GAME ROOM";
    this.elapsed=0;this.draw();
  }
  getText():string{return this.text}
  update(dt:number,reducedMotion=false):void{
    if(!reducedMotion)this.elapsed+=dt;
    this.drawAccumulator+=dt;
    if(this.drawAccumulator>=.075){this.drawAccumulator=0;this.draw()}
  }
  private draw():void{
    const ctx=this.context,w=this.canvas.width,h=this.canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="rgba(24,11,39,.94)";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#ffb7dd";ctx.lineWidth=3;ctx.strokeRect(2,2,w-4,h-4);
    ctx.save();ctx.beginPath();ctx.rect(16,5,w-32,h-10);ctx.clip();
    ctx.fillStyle="#ffe4c8";ctx.font="bold 54px system-ui,sans-serif";
    ctx.textBaseline="middle";ctx.shadowColor="#f6a2d9";ctx.shadowBlur=10;
    const label="✦ "+this.text+" ✦";
    const textWidth=ctx.measureText(label).width;
    const travel=w+textWidth+60;
    const offset=(this.elapsed*104)%travel;
    ctx.fillText(label,w+10-offset,48);
    // Smooth looping text, including short announcements.
    ctx.restore();
    this.texture.needsUpdate=true;
  }
  dispose():void{
    this.mesh.parent?.remove(this.mesh);this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();this.texture.dispose();
  }
}
