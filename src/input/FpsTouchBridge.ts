/** iOS Safari touch-event fallback for independent FIRE and LOOK contacts.
 * Fires are bound only to the touch that began on FIRE, allowing a second
 * right-half touch to look and a third left-half touch to walk.
 * PointerEvents remain for mouse/pen and other browsers.
 */
export class FpsTouchBridge {
  private fireId:number|null=null;
  private lookId:number|null=null;
  private aimId:number|null=null;
  private ax=0;private ay=0;
  private aimButton:HTMLElement|null=null;
  private fx=0;private fy=0;private lx=0;private ly=0;
  private readonly fireButton:HTMLElement;
  private readonly canvas:HTMLCanvasElement;
  private readonly callbacks:{
      canPlay():boolean;
      fireStart():void;fireStop():void;fireLook(dx:number,dy:number):void;
      freeLook(dx:number,dy:number):void;
      nativeLook(active:boolean):void;
      aimStart?():void;aimLook?(dx:number,dy:number):void;aimStop?(cancelled:boolean):void;
    };
  constructor(fireButton:HTMLElement,canvas:HTMLCanvasElement,callbacks:{
    canPlay():boolean;
    fireStart():void;fireStop():void;fireLook(dx:number,dy:number):void;
    freeLook(dx:number,dy:number):void;
    nativeLook(active:boolean):void;
    aimStart?():void;aimLook?(dx:number,dy:number):void;aimStop?(cancelled:boolean):void;
  }){
    this.fireButton=fireButton;this.canvas=canvas;this.callbacks=callbacks;
    fireButton.addEventListener("touchstart",this.startFire,{passive:false});
    canvas.addEventListener("touchstart",this.startLook,{passive:false});
    window.addEventListener("touchmove",this.move,{passive:false,capture:true});
    window.addEventListener("touchend",this.end,{capture:true});
    window.addEventListener("touchcancel",this.end,{capture:true});
    window.addEventListener("blur",this.reset);
    document.addEventListener("visibilitychange",this.visibility);
  }
  get firingNative():boolean{return this.fireId!==null}
  get aimingNative():boolean{return this.aimId!==null}
  bindAimButton(button:HTMLElement):void{
    if(this.aimButton)throw new Error("ADS native button already bound");
    this.aimButton=button;
    button.addEventListener("touchstart",this.startAim,{passive:false});
  }
  private startAim=(e:TouchEvent):void=>{
    if(!this.callbacks.canPlay()||this.aimId!==null)return;
    const t=e.changedTouches[0];if(!t)return;
    this.aimId=t.identifier;this.ax=t.clientX;this.ay=t.clientY;
    this.callbacks.aimStart?.();
    e.preventDefault();
  };
  private startFire=(e:TouchEvent):void=>{
    if(!this.callbacks.canPlay()||this.fireId!==null)return;
    const t=e.changedTouches[0];if(!t)return;
    this.fireId=t.identifier;this.fx=t.clientX;this.fy=t.clientY;
    this.callbacks.fireStart();
    e.preventDefault();
  };
  private startLook=(e:TouchEvent):void=>{
    if(!this.callbacks.canPlay()||this.lookId!==null)return;
    for(const t of Array.from(e.changedTouches)){
      if(t.clientX<window.innerWidth*.5)continue;
      this.lookId=t.identifier;this.lx=t.clientX;this.ly=t.clientY;
      this.callbacks.nativeLook(true);
      e.preventDefault();break;
    }
  };
  private move=(e:TouchEvent):void=>{
    if(!this.callbacks.canPlay())return;
    let handled=false;
    for(const t of Array.from(e.changedTouches)){
      if(t.identifier===this.fireId){
        const dx=t.clientX-this.fx,dy=t.clientY-this.fy;
        this.fx=t.clientX;this.fy=t.clientY;
        if(dx||dy)this.callbacks.fireLook(dx,dy);
        handled=true;
      }else if(t.identifier===this.lookId){
        const dx=t.clientX-this.lx,dy=t.clientY-this.ly;
        this.lx=t.clientX;this.ly=t.clientY;
        if(dx||dy)this.callbacks.freeLook(dx,dy);
        handled=true;
      }else if(t.identifier===this.aimId){
        const dx=t.clientX-this.ax,dy=t.clientY-this.ay;
        this.ax=t.clientX;this.ay=t.clientY;
        if(dx||dy)this.callbacks.aimLook?.(dx,dy);
        handled=true;
      }
    }
    if(handled)e.preventDefault();
  };
  private end=(e:TouchEvent):void=>{
    for(const t of Array.from(e.changedTouches)){
      if(t.identifier===this.fireId){this.fireId=null;this.callbacks.fireStop();}
      if(t.identifier===this.lookId){this.lookId=null;this.callbacks.nativeLook(false);}
      if(t.identifier===this.aimId){this.aimId=null;this.callbacks.aimStop?.(e.type==="touchcancel");}
    }
  };
  reset=():void=>{
    if(this.fireId!==null)this.callbacks.fireStop();
    if(this.lookId!==null)this.callbacks.nativeLook(false);
    if(this.aimId!==null)this.callbacks.aimStop?.(true);
    this.fireId=null;this.lookId=null;this.aimId=null;
  };
  private visibility=():void=>{if(document.hidden)this.reset()};
  dispose():void{
    this.reset();
    this.fireButton.removeEventListener("touchstart",this.startFire);
    this.aimButton?.removeEventListener("touchstart",this.startAim);
    this.canvas.removeEventListener("touchstart",this.startLook);
    window.removeEventListener("touchmove",this.move,true);
    window.removeEventListener("touchend",this.end,true);
    window.removeEventListener("touchcancel",this.end,true);
    window.removeEventListener("blur",this.reset);
    document.removeEventListener("visibilitychange",this.visibility);
  }
}
