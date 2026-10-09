import type { Vector2 } from "../types/Player";
import { joystickVector } from "./joystickMath";
interface Callbacks { onLook(dx:number,dy:number):void;onJump():void;onMenu():void;onInteract():void }
export class DualTouchController{
  private movePointer:number|null=null;
  private lookPointer:number|null=null;
  private x0=0;private y0=0;private lastX=0;private lastY=0;
  private joystickInput:Vector2={x:0,y:0};
  private keys=new Set<string>();
  enabled=false;
  constructor(
    private canvas:HTMLCanvasElement,
    private joystick:HTMLElement,
    private thumb:HTMLElement,
    private callbacks:Callbacks
  ){
    canvas.addEventListener("pointerdown",this.down,{passive:false});
    canvas.addEventListener("pointermove",this.move,{passive:false});
    for(const name of ["pointerup","pointercancel","lostpointercapture"] as const)
      canvas.addEventListener(name,this.up);
    canvas.addEventListener("contextmenu",e=>e.preventDefault());
    window.addEventListener("keydown",this.keydown);
    window.addEventListener("keyup",this.keyup);
    window.addEventListener("blur",this.reset);
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden)this.reset();
    });
  }
  private down=(e:PointerEvent):void=>{
    if(!this.enabled)return;
    if(e.pointerType==="mouse"){
      if(e.button!==0||this.lookPointer!==null)return;
      this.lookPointer=e.pointerId;
    }else if(e.clientX<window.innerWidth/2){
      if(this.movePointer!==null)return;
      this.movePointer=e.pointerId;this.x0=e.clientX;this.y0=e.clientY;
      this.joystickInput={x:0,y:0};
      this.joystick.style.left=e.clientX+"px";
      this.joystick.style.top=e.clientY+"px";
      this.thumb.style.transform="translate(-50%, -50%)";
      this.joystick.classList.add("active");
    }else{
      if(this.lookPointer!==null)return;
      this.lookPointer=e.pointerId;
    }
    if(this.lookPointer===e.pointerId){this.lastX=e.clientX;this.lastY=e.clientY;}
    try{this.canvas.setPointerCapture(e.pointerId)}catch{ /* Safari may cancel capture */ }
    e.preventDefault();
  };
  private move=(e:PointerEvent):void=>{
    if(e.pointerId===this.movePointer){
      const dx=e.clientX-this.x0,dy=e.clientY-this.y0;
      const length=Math.hypot(dx,dy),k=length>60?60/length:1;
      this.joystickInput=joystickVector(dx,dy);
      this.thumb.style.transform="translate(calc(-50% + "+(dx*k)+"px),calc(-50% + "+(dy*k)+"px))";
      e.preventDefault();
    }else if(e.pointerId===this.lookPointer){
      const dx=e.clientX-this.lastX,dy=e.clientY-this.lastY;
      this.lastX=e.clientX;this.lastY=e.clientY;
      this.callbacks.onLook(dx,dy);
      e.preventDefault();
    }
  };
  private up=(e:PointerEvent):void=>{
    if(e.pointerId===this.movePointer){
      this.movePointer=null;this.joystickInput={x:0,y:0};
      this.joystick.classList.remove("active");
    }
    if(e.pointerId===this.lookPointer)this.lookPointer=null;
  };
  private keydown=(e:KeyboardEvent):void=>{
    if(e.code==="Escape"){this.callbacks.onMenu();e.preventDefault();return;}
    if(!this.enabled)return;
    const movement=["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"];
    if(movement.includes(e.code))e.preventDefault();
    this.keys.add(e.code);
    if(e.code==="Space"&&!e.repeat)this.callbacks.onJump();
    if(e.code==="KeyE"&&!e.repeat)this.callbacks.onInteract();
  };
  private keyup=(e:KeyboardEvent):void=>{this.keys.delete(e.code)};
  getMovement():Vector2{
    let x=0,y=0;
    if(this.keys.has("KeyA")||this.keys.has("ArrowLeft"))x--;
    if(this.keys.has("KeyD")||this.keys.has("ArrowRight"))x++;
    if(this.keys.has("KeyW")||this.keys.has("ArrowUp"))y++;
    if(this.keys.has("KeyS")||this.keys.has("ArrowDown"))y--;
    if(x||y){const d=Math.max(1,Math.hypot(x,y));return{x:x/d,y:y/d};}
    return {...this.joystickInput};
  }
  reset=():void=>{
    this.movePointer=this.lookPointer=null;this.joystickInput={x:0,y:0};
    this.keys.clear();this.joystick.classList.remove("active");
  };
  dispose():void{
    this.reset();this.canvas.removeEventListener("pointerdown",this.down);
    this.canvas.removeEventListener("pointermove",this.move);
    for(const name of ["pointerup","pointercancel","lostpointercapture"] as const)this.canvas.removeEventListener(name,this.up);
    window.removeEventListener("keydown",this.keydown);
    window.removeEventListener("keyup",this.keyup);
    window.removeEventListener("blur",this.reset);
  }
}
