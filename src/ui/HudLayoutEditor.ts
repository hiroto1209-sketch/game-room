import {HUD_IDS,HUD_DEVICES,HUD_REFERENCE,HUD_STORAGE_KEY,copyProfile,
  defaultProfile,detectHudDevice,hudControlBox,parseHudLayout,validHudPlacement,
  validateWholeHudProfile,clamp,type HudControlId,type HudDevice,type HudProfile,
  type HudLayoutV1} from "./hudLayoutModel";
import {loadHudLayouts,saveHudLayouts} from "./hudLayoutStorage";
const labels:Record<HudControlId,string>={
  fire:"✦ FIRE",ads:"◎ ADS",jump:"↑ JUMP",emote:"☺ EMOTE",interact:"あそぶ"
};
const actualIds:Record<HudControlId,string>={
  fire:"shoot-button",ads:"aim-button",jump:"jump-button",
  emote:"emote-button",interact:"interaction"
};
const modeKey="game-room-hud-device-mode-v1";
type Mode="auto"|"phone"|"pad";
const get=<T extends HTMLElement>(id:string):T=>{
  const el=document.getElementById(id);
  if(!el)throw Error("HUD editor missing "+id);
  return el as T;
};
const touchAvailable=()=>matchMedia("(pointer:coarse)").matches||navigator.maxTouchPoints>0;
function storedMode():Mode{
  try{
    const v=localStorage.getItem(modeKey);
    if(v==="phone"||v==="pad")return v;
  }catch{}
  return "auto";
}
function safeInsets():{top:number;right:number;bottom:number;left:number}{
  const probe=document.createElement("div");
  probe.style.cssText="position:fixed;visibility:hidden;pointer-events:none;"+
    "padding:env(safe-area-inset-top) env(safe-area-inset-right) "+
    "env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.appendChild(probe);
  const c=getComputedStyle(probe);
  const v={top:parseFloat(c.paddingTop)||0,right:parseFloat(c.paddingRight)||0,
    bottom:parseFloat(c.paddingBottom)||0,left:parseFloat(c.paddingLeft)||0};
  probe.remove();return v;
}
function applyControl(node:HTMLElement,id:HudControlId,x:number,y:number,size:number,opacity:number):void{
  const important=(key:string,value:string)=>node.style.setProperty(key,value,"important");
  important("position","absolute");
  important("left",x+"px");important("top",y+"px");
  important("right","auto");important("bottom","auto");
  important("opacity",String(opacity));
  if(id==="interact"){
    // The contextual interaction remains a variable-width pill, never a tiny circle.
    important("transform","translate(-50%, -50%) scale("+(size/58)+")");
  }else{
    important("width",size+"px");important("height",size+"px");
    important("transform","translate(-50%, -50%)");
  }
}
function clearControl(node:HTMLElement,id:HudControlId):void{
  for(const prop of ["position","left","top","right","bottom","opacity","transform",
    "width","height"])node.style.removeProperty(prop);
  if(id==="interact")node.style.removeProperty("--hud-size");
}
/** Local-only visual editor. The game is paused by its caller before the overlay opens. */
export class HudLayoutEditor{
  private readonly overlay=get<HTMLElement>("hud-editor-overlay");
  private readonly frame=get<HTMLElement>("hud-editor-preview-frame");
  private readonly stage=get<HTMLElement>("hud-editor-stage");
  private readonly selectDevice=get<HTMLSelectElement>("hud-editor-device");
  private readonly selectMode=get<HTMLSelectElement>("hud-editor-mode");
  private readonly selectedName=get<HTMLElement>("hud-editor-selected-name");
  private readonly sizeInput=get<HTMLInputElement>("hud-editor-size");
  private readonly opacityInput=get<HTMLInputElement>("hud-editor-opacity");
  private readonly sizeValue=get<HTMLElement>("hud-editor-size-value");
  private readonly opacityValue=get<HTMLElement>("hud-editor-opacity-value");
  private readonly status=get<HTMLElement>("hud-editor-status");
  private current:HudDevice="phonePortrait";
  private selected:HudControlId="fire";
  private mode:Mode=storedMode();
  private working:HudLayoutV1=loadHudLayouts();
  private undoStack:HudLayoutV1[]=[];
  private drag:{pointerId:number;id:HudControlId;before:HudProfile}|null=null;
  private sliderSnapshot=false;
  private ghosts=new Map<HudControlId,HTMLButtonElement>();
  private onExit:()=>void=()=>{};
  private opened=false;
  private viewportFrame=0;
  constructor(){
    for(const id of HUD_DEVICES){
      const opt=document.createElement("option");
      opt.value=id;
      opt.textContent=({phonePortrait:"iPhone · 縦",phoneLandscape:"iPhone · 横",
        padPortrait:"iPad · 縦",padLandscape:"iPad · 横"} as Record<HudDevice,string>)[id];
      this.selectDevice.append(opt);
    }
    this.selectDevice.addEventListener("change",()=>{
      this.current=this.selectDevice.value as HudDevice;
      this.selectGhost(this.selected);this.renderStage();
    });
    this.selectMode.value=this.mode;
    this.selectMode.addEventListener("change",()=>{
      this.mode=this.selectMode.value as Mode;
      this.setStatus("保存するとこの端末の判定方法も記憶します");
    });
    this.stage.addEventListener("pointerdown",this.pointerDown,{passive:false});
    this.stage.addEventListener("pointermove",this.pointerMove,{passive:false});
    this.stage.addEventListener("pointerup",this.pointerUp,{passive:false});
    this.stage.addEventListener("pointercancel",this.pointerCancel,{passive:false});
    for(const input of [this.sizeInput,this.opacityInput]){
      input.addEventListener("pointerdown",()=>{this.sliderSnapshot=false;});
      input.addEventListener("change",()=>{this.sliderSnapshot=false;});
    }
    this.sizeInput.addEventListener("input",()=>{
      this.ensureSnapshot();
      this.updateSelected({sizePx:Number(this.sizeInput.value)});
    });
    this.opacityInput.addEventListener("input",()=>{
      this.ensureSnapshot();
      this.updateSelected({opacity:Number(this.opacityInput.value)/100});
    });
    get<HTMLButtonElement>("hud-editor-undo").addEventListener("click",()=>this.undo());
    get<HTMLButtonElement>("hud-editor-reset").addEventListener("click",()=>this.resetSelected());
    get<HTMLButtonElement>("hud-editor-reset-all").addEventListener("click",()=>this.resetAll());
    get<HTMLButtonElement>("hud-editor-save").addEventListener("click",()=>this.save());
    for(const id of ["hud-editor-cancel","hud-editor-close"]){
      get<HTMLButtonElement>(id).addEventListener("click",()=>this.close());
    }
    // Window resize and visualViewport can arrive in either order, sometimes
    // before innerWidth matches the new layout. Apply once after layout so a
    // busy phone frame cannot leave the previous device profile in place.
    window.addEventListener("resize",this.onViewportChange);
    window.visualViewport?.addEventListener("resize",this.onViewportChange);
    new ResizeObserver(this.onViewportChange).observe(document.documentElement);
  }
  private readonly onViewportChange=():void=>{
    cancelAnimationFrame(this.viewportFrame);
    this.viewportFrame=requestAnimationFrame(()=>{
      this.viewportFrame=0;
      this.applySaved();
      if(this.opened)this.renderStage();
    });
  };
  private get activeProfile():HudProfile{return this.working.profiles[this.current];}
  private snapshot():void{
    this.undoStack.push(JSON.parse(JSON.stringify(this.working)) as HudLayoutV1);
    if(this.undoStack.length>30)this.undoStack.shift();
  }
  private ensureSnapshot():void{
    if(!this.sliderSnapshot){this.snapshot();this.sliderSnapshot=true;}
  }
  private setStatus(message:string):void{this.status.textContent=message;}
  /** Keep legacy CSS completely untouched until a user actually saves an edited HUD. */
  applySaved():void{
    let profile:HudProfile|null=null;
    try{
      const raw=localStorage.getItem(HUD_STORAGE_KEY);
      const layout=raw?parseHudLayout(JSON.parse(raw)):null;
      if(layout){
        const device=detectHudDevice(window.innerWidth,window.innerHeight,touchAvailable(),storedMode());
        profile=layout.profiles[device];
      }
    }catch{}
    const inset=safeInsets();
    const width=Math.max(1,window.innerWidth-inset.left-inset.right);
    const height=Math.max(1,window.innerHeight-inset.top-inset.bottom);
    for(const id of HUD_IDS){
      const node=get<HTMLElement>(actualIds[id]);
      if(!profile){clearControl(node,id);continue;}
      const c=profile[id];
      const half=(id==="interact"?Math.max(100,c.sizePx*1.85):c.sizePx)/2;
      const x=inset.left+clamp(c.x*width,half+8,width-half-8);
      const y=inset.top+clamp(c.y*height,c.sizePx/2+8,height-c.sizePx/2-8);
      applyControl(node,id,x,y,c.sizePx,c.opacity);
    }
  }
  open(onExit:()=>void):void{
    this.onExit=onExit;
    this.working=loadHudLayouts();
    this.mode=storedMode();this.selectMode.value=this.mode;
    this.current=detectHudDevice(window.innerWidth,window.innerHeight,touchAvailable(),this.mode);
    this.selectDevice.value=this.current;
    this.selected="fire";this.undoStack=[];this.drag=null;this.sliderSnapshot=false;
    this.opened=true;this.overlay.classList.remove("hidden");
    this.setStatus("ボタンを指で動かしてください。ゲーム操作は停止しています。");
    this.selectGhost(this.selected);
    this.renderStage();
    window.addEventListener("keydown",this.onKey,true);
    get<HTMLButtonElement>("hud-editor-close").focus();
  }
  private onKey=(e:KeyboardEvent):void=>{
    if(!this.opened)return;
    if(e.key==="Escape"){
      e.preventDefault();e.stopImmediatePropagation();this.close();
    }
  };
  close():void{
    if(!this.opened)return;
    this.opened=false;this.drag=null;this.ghosts.clear();
    this.overlay.classList.add("hidden");
    window.removeEventListener("keydown",this.onKey,true);
    this.onExit();
  }
  private renderStage():void{
    if(!this.opened)return;
    const ref=HUD_REFERENCE[this.current];
    const parentWidth=Math.max(180,this.frame.clientWidth-8);
    const maxHeight=Math.min(window.innerHeight*.52,510);
    const width=Math.min(parentWidth,maxHeight*ref.width/ref.height);
    this.stage.style.width=width+"px";
    this.stage.style.height=(width*ref.height/ref.width)+"px";
    this.stage.dataset.device=this.current;
    // The controls use the actual buttons' labels, not an invented world map.
    this.stage.querySelectorAll("[data-hud-id]").forEach(n=>n.remove());
    this.ghosts.clear();
    for(const id of HUD_IDS){
      const button=document.createElement("button");
      button.type="button";button.className="hud-editor-ghost";
      button.dataset.hudId=id;button.textContent=labels[id];
      button.setAttribute("aria-label",labels[id]+" を配置");
      this.stage.appendChild(button);
      this.ghosts.set(id,button);
    }
    this.paint();
    this.selectGhost(this.selected);
  }
  private paint():void{
    if(!this.opened)return;
    const ref=HUD_REFERENCE[this.current];
    const scale=this.stage.clientWidth/ref.width;
    const width=this.stage.clientWidth,height=this.stage.clientHeight;
    for(const id of HUD_IDS){
      const c=this.activeProfile[id],node=this.ghosts.get(id);
      if(!node)continue;
      const box=hudControlBox(c,id,width,height,scale);
      node.style.left=c.x*100+"%";
      node.style.top=c.y*100+"%";
      node.style.width=Math.max(28,box.width)+"px";
      node.style.height=Math.max(28,box.height)+"px";
      node.style.opacity=String(c.opacity);
      node.classList.toggle("selected",id===this.selected);
      node.classList.toggle("invalid",!validHudPlacement(this.activeProfile,id,
        ref.width,ref.height,1));
    }
  }
  private selectGhost(id:HudControlId):void{
    this.selected=id;
    const control=this.activeProfile[id];
    this.selectedName.textContent=labels[id];
    this.sizeInput.value=String(control.sizePx);
    this.opacityInput.value=String(Math.round(control.opacity*100));
    this.sizeValue.textContent=control.sizePx+"px";
    this.opacityValue.textContent=Math.round(control.opacity*100)+"%";
    this.paint();
  }
  private updateSelected(patch:Partial<{sizePx:number;opacity:number}>):void{
    const previous={...this.activeProfile[this.selected]};
    Object.assign(this.activeProfile[this.selected],patch);
    const ref=HUD_REFERENCE[this.current];
    if(!validHudPlacement(this.activeProfile,this.selected,ref.width,ref.height)){
      this.activeProfile[this.selected]=previous;
      this.setStatus("安全領域または他のボタンと重なるため変更できません");
    }else this.setStatus("編集中 · 保存すると反映します");
    this.selectGhost(this.selected);
  }
  private pointerDown=(e:PointerEvent):void=>{
    const target=e.target instanceof Element?e.target.closest<HTMLElement>("[data-hud-id]"):null;
    if(!target||this.drag)return;
    const id=target.dataset.hudId as HudControlId;
    this.selectGhost(id);
    this.snapshot();
    this.drag={id,pointerId:e.pointerId,before:copyProfile(this.activeProfile)};
    this.stage.setPointerCapture(e.pointerId);
    e.stopPropagation();e.preventDefault();
  };
  private pointerMove=(e:PointerEvent):void=>{
    if(!this.drag||e.pointerId!==this.drag.pointerId)return;
    const box=this.stage.getBoundingClientRect();
    const c=this.activeProfile[this.drag.id];
    c.x=clamp((e.clientX-box.left)/box.width,0,1);
    c.y=clamp((e.clientY-box.top)/box.height,0,1);
    this.paint();
    e.stopPropagation();e.preventDefault();
  };
  private finishDrag(cancelled:boolean):void{
    if(!this.drag)return;
    const {id,before}=this.drag;
    this.drag=null;
    const ref=HUD_REFERENCE[this.current];
    if(cancelled||!validHudPlacement(this.activeProfile,id,ref.width,ref.height)){
      this.working.profiles[this.current]=before;
      // Failed drags don't consume an undo slot.
      this.undoStack.pop();
      this.setStatus("重なり・中央照準・画面端を避けて配置してください");
    }else this.setStatus("位置を変更しました · 保存で確定");
    this.selectGhost(id);
  }
  private pointerUp=(e:PointerEvent):void=>{
    if(this.drag?.pointerId!==e.pointerId)return;
    this.finishDrag(false);e.stopPropagation();e.preventDefault();
  };
  private pointerCancel=(e:PointerEvent):void=>{
    if(this.drag?.pointerId!==e.pointerId)return;
    this.finishDrag(true);e.stopPropagation();e.preventDefault();
  };
  private undo():void{
    const previous=this.undoStack.pop();
    if(!previous){this.setStatus("元に戻せる操作がありません");return;}
    this.working=previous;this.sliderSnapshot=false;
    this.selectGhost(this.selected);
    this.setStatus("ひとつ前の状態に戻しました");
  }
  private resetSelected():void{
    this.snapshot();
    this.activeProfile[this.selected]={...defaultProfile(this.current)[this.selected]};
    this.selectGhost(this.selected);this.setStatus("選択中のボタンを初期位置へ戻しました");
  }
  private resetAll():void{
    this.snapshot();this.working.profiles[this.current]=defaultProfile(this.current);
    this.selectGhost(this.selected);this.setStatus("この端末レイアウトを初期化しました");
  }
  private save():void{
    for(const id of HUD_DEVICES){
      const ref=HUD_REFERENCE[id];
      if(!validateWholeHudProfile(this.working.profiles[id],ref.width,ref.height)){
        this.current=id;this.selectDevice.value=id;this.renderStage();
        this.setStatus("このレイアウトに配置の重複があります。修正してから保存してください");
        return;
      }
    }
    if(!saveHudLayouts(this.working)){
      this.setStatus("保存できません。Safariのストレージ設定を確認してください");return;
    }
    try{localStorage.setItem(modeKey,this.mode)}catch{}
    this.applySaved();this.close();
  }
}
