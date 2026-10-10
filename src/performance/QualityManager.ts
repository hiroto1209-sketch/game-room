import * as THREE from "three";
/**
 * One cheap adaptive resolution governor. Uses measured frame times rather than
 * hard-coded claims about device classes; no DOM allocations in the render loop.
 */
export class QualityManager{
  private elapsed=0;
  private total=0;
  private frames=0;
  private cooldown=0;
  private readonly upper=Math.min(window.devicePixelRatio||1,1.75);
  private ratio=this.upper;
  constructor(private readonly renderer:THREE.WebGLRenderer){
    this.renderer.setPixelRatio(this.ratio);
  }
  get scale():number{return this.ratio}
  get calls():number{return this.renderer.info.render.calls}
  update(dt:number):void{
    if(document.hidden||dt<=0||dt>.25)return;
    this.elapsed+=dt;this.total+=dt;this.frames++;
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(this.elapsed<4.0)return;
    const ms=(this.total/Math.max(1,this.frames))*1000;
    if(this.cooldown===0){
      let next=this.ratio;
      if(ms>29&&this.ratio>.88)next=Math.max(.85,this.ratio-.16);
      else if(ms<18&&this.ratio<this.upper)next=Math.min(this.upper,this.ratio+.08);
      if(Math.abs(next-this.ratio)>.02){
        this.ratio=next;
        this.renderer.setPixelRatio(this.ratio);
        this.cooldown=9;
      }
    }
    this.elapsed=0;this.total=0;this.frames=0;
  }
}
