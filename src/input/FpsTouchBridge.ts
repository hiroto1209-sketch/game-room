/** iOS Safari touch-event fallback for independent FIRE and LOOK contacts.
 * Fires are bound only to the touch that began on FIRE, allowing a second
 * right-half touch to look and a third left-half touch to walk.
 * PointerEvents remain for mouse/pen and other browsers.
 */
export class FpsTouchBridge {
  private fireId:number|null=null;
  private lookId:number|null=null;
  private fx=0;private fy=0;private lx=0;private ly=0;
  constructor(
    private readonly fireButton:HTMLElement,
    private readonly canvas:HTMLCanvasElement,
    private readonly callbacks:{
      canPlay():boolean;
      fireStart():void;fireStop():void;fireLook(dx:number,dy:number):void;
      freeLook(dx:number,dy:number):void;
      nativeLook(active:boolean):void;
    }
  ){
    fireButton.addEventListener("touchstart",this.startFire,{passive:false});
    canvas.addEventListener("touchstart",this.startLook,{passive:false});
    window.addEventListener("touchmove",this.move,{passive:false,capture:true});
    window.addEventListener("touchend",this.end,{capture:true});
    window.addEventListener("touchcancel",this.end,{capture:true});
    window.addEventListener("blur",this.reset);
    document.addEventListener("visibilitychange",this.visibility);
  }
  get firingNative():boolean{return this.fireId!==null}
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
      }
    }
    if(handled)e.preventDefault();
  };
  private end=(e:TouchEvent):void=>{
    for(const t of Array.from(e.changedTouches)){
      if(t.identifier===this.fireId){this.fireId=null;this.callbacks.fireStop();}
      if(t.identifier===this.lookId){this.lookId=null;this.callbacks.nativeLook(false);}
    }
  };
  reset=():void=>{
    if(this.fireId!==null)this.callbacks.fireStop();
    if(this.lookId!==null)this.callbacks.nativeLook(false);
    this.fireId=null;this.lookId=null;
  };
  private visibility=():void=>{if(document.hidden)this.reset()};
  dispose():void{
    this.reset();
    this.fireButton.removeEventListener("touchstart",this.startFire);
    this.canvas.removeEventListener("touchstart",this.startLook);
    window.removeEventListener("touchmove",this.move,true);
    window.removeEventListener("touchend",this.end,true);
    window.removeEventListener("touchcancel",this.end,true);
    window.removeEventListener("blur",this.reset);
    document.removeEventListener("visibilitychange",this.visibility);
  }
}
