import {AVATAR_COLORS,AVATAR_HATS,DEFAULT_AVATAR,sanitizedAvatar,
  type AvatarStyle,type EmoteKind} from "../../shared/avatarRules.js";
const COLORS={rose:"#f79ec7",mint:"#78e5c0",sky:"#88b9ff",amber:"#ffce81",violet:"#c2a0ff"};
const HATS={none:"なし",cap:"キャップ",crown:"クラウン",halo:"光るリング"};
const LABELS:Record<EmoteKind,string>={wave:"👋 手を振る",dance:"♫ ダンス",cheer:"✦ よろこぶ"};
const KEY="game-room-avatar-v1";
function id<T extends HTMLElement>(value:string):T{
  const el=document.getElementById(value);
  if(!el)throw Error("Missing avatar UI "+value);
  return el as T;
}
/** A tiny DOM-only self preview; other guests see actual Three.js avatars. */
export class AvatarStudio{
  private readonly overlay=id("avatar-overlay");
  private readonly color=id<HTMLSelectElement>("avatar-color");
  private readonly hat=id<HTMLSelectElement>("avatar-hat");
  private readonly preview=id("avatar-preview-body");
  private readonly previewHat=id("avatar-preview-hat");
  private readonly previewName=id("avatar-preview-name");
  private readonly flyout=id("emote-picker");
  private readonly quickButton=id<HTMLButtonElement>("emote-button");
  private appearance:AvatarStyle={...DEFAULT_AVATAR};
  private onExit:()=>void=()=>{};
  constructor(private onApply:(avatar:AvatarStyle)=>void,
    private onEmote:(kind:EmoteKind)=>void){
    for(const color of AVATAR_COLORS){
      const option=document.createElement("option");option.value=color;
      option.textContent=color.toUpperCase();this.color.appendChild(option);
    }
    for(const hat of AVATAR_HATS){
      const option=document.createElement("option");option.value=hat;
      option.textContent=HATS[hat];this.hat.appendChild(option);
    }
    try{
      const stored=localStorage.getItem(KEY);
      if(stored)this.appearance=sanitizedAvatar(JSON.parse(stored));
    }catch{}
    this.color.value=this.appearance.color;this.hat.value=this.appearance.hat;
    this.color.addEventListener("change",()=>this.render());
    this.hat.addEventListener("change",()=>this.render());
    id("avatar-apply").addEventListener("click",()=>this.save());
    id("avatar-close").addEventListener("click",()=>this.close());
    id("avatar-back").addEventListener("click",()=>this.close());
    this.quickButton.addEventListener("click",e=>{
      e.stopPropagation();this.toggleEmotes();
    });
    for(const b of document.querySelectorAll<HTMLButtonElement>("[data-emote]")){
      b.addEventListener("click",()=>{
        const kind=b.dataset.emote as EmoteKind;
        if(kind!=="wave"&&kind!=="dance"&&kind!=="cheer")return;
        this.hideEmotes();this.onEmote(kind);
      });
    }
    this.render();
  }
  get selected():AvatarStyle{return {...this.appearance}}
  open(name:string,onExit:()=>void):void{
    this.onExit=onExit;this.previewName.textContent=name.slice(0,24)||"Guest";
    this.hideEmotes();this.render();this.overlay.classList.remove("hidden");
  }
  close():void{
    if(this.overlay.classList.contains("hidden"))return;
    this.overlay.classList.add("hidden");this.onExit();
  }
  get opened():boolean{return !this.overlay.classList.contains("hidden")}
  showQuick(visible:boolean):void{
    this.quickButton.classList.toggle("hidden",!visible);
    if(!visible)this.hideEmotes();
  }
  hideEmotes():void{this.flyout.classList.add("hidden")}
  toggleEmotes():void{this.flyout.classList.toggle("hidden")}
  setAppearance(avatar:AvatarStyle):void{
    this.appearance=sanitizedAvatar(avatar);
    this.color.value=this.appearance.color;this.hat.value=this.appearance.hat;
    this.render();
  }
  private render():void{
    const color=this.color.value as AvatarStyle["color"];
    const hat=this.hat.value as AvatarStyle["hat"];
    this.preview.style.backgroundColor=COLORS[color]??COLORS.rose;
    this.previewHat.textContent=hat==="crown"?"♛":hat==="halo"?"◎":hat==="cap"?"▰":"";
    this.previewHat.dataset.hat=hat;
  }
  private save():void{
    const avatar=sanitizedAvatar({color:this.color.value,hat:this.hat.value});
    this.setAppearance(avatar);
    try{localStorage.setItem(KEY,JSON.stringify(avatar))}catch{}
    this.onApply(avatar);
    this.close();
  }
}
export {LABELS as AVATAR_EMOTE_LABELS};
