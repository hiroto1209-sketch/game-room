import type {Vector3} from "../types/Player";
export type GuideStop={id:string;label:string;x:number;z:number;symbol:string};
export const STOPS:readonly GuideStop[]=[
  {id:'fps',label:'FPS ORIGINAL MAP',x:121.2,z:-5,symbol:'➜'},
  {id:"range",label:"STARSHOT RANGE",x:33,z:10,symbol:"✦"},
  {id:"pond",label:"STARLIT POND",x:57,z:-27,symbol:"◈"},
  {id:"grotto",label:"ECHO GROTTO",x:65,z:32,symbol:"◇"},
  {id:"skylook",label:"SKYLOOK VISTA",x:90,z:37,symbol:"△"},
  {id:"tower",label:"HORIZON SPIRE",x:93,z:23,symbol:"◆"},
  {id:"arena",label:"NEON ARENA",x:86,z:-40,symbol:"◉"},
  {id:"plaza",label:"CO-OP PLAZA",x:21,z:40,symbol:"✚"},
  {id:"home",label:"PARTY HOUSE",x:0,z:0,symbol:"⌂"},
  {id:"armory",label:"WEAPON ATM",x:3,z:23,symbol:"✧"}
] as const;
export function routeInfo(position:Pick<Vector3,"x"|"z">,yaw:number,stop:GuideStop){
  const dx=stop.x-position.x,dz=stop.z-position.z;
  const distance=Math.hypot(dx,dz);
  const bearing=Math.atan2(dx,-dz)+yaw;
  return {distance,angleDeg:((bearing*180/Math.PI)%360+360)%360,
    arrived:distance<5};
}
export function mapCoord(x:number,z:number,w=320,h=224){
  return {x:15+(x+24)/170*(w-30),y:15+(z+48)/96*(h-30)};
}

/** Small DOM compass + menu map: low refresh frequency and no world draw calls. */
export class WorldGuide{
  private readonly banner:HTMLElement;
  private readonly label:HTMLElement;
  private readonly arrow:HTMLElement;
  private readonly meter:HTMLElement;
  private readonly overlay:HTMLElement;
  private readonly map:HTMLCanvasElement;
  private readonly selector:HTMLSelectElement;
  private currentId="range";
  private last=0;
  private onResume:()=>void=()=>{};
  constructor(){
    const byId=<T extends HTMLElement>(id:string):T=>{
      const el=document.getElementById(id);if(!el)throw Error("Missing map element "+id);
      return el as T;
    };
    this.banner=byId("world-guide");
    this.label=byId("guide-label");
    this.arrow=byId("guide-arrow");
    this.meter=byId("guide-distance");
    this.overlay=byId("world-map-overlay");
    this.map=byId("world-map-canvas");
    this.selector=byId("world-destination");
    this.selector.innerHTML="";
    for(const stop of STOPS){
      const option=document.createElement("option");
      option.value=stop.id;option.textContent=stop.symbol+" "+stop.label;
      this.selector.appendChild(option);
    }
    this.selector.value=this.currentId;
    this.selector.addEventListener("change",()=>{this.currentId=this.selector.value;this.last=0});
    byId("world-map-close").addEventListener("click",()=>this.close());
    byId("world-map-back").addEventListener("click",()=>this.close());
  }
  get selected():GuideStop{return STOPS.find(s=>s.id===this.currentId)??STOPS[0]}
  setDestination(id:string):void{
    if(!STOPS.some(s=>s.id===id))return;
    this.currentId=id;this.selector.value=id;this.last=0;
  }
  open(onResume:()=>void,position:Pick<Vector3,"x"|"z">):void{
    this.onResume=onResume;
    this.overlay.classList.remove("hidden");
    this.drawMap(position);
  }
  close():void{
    if(this.overlay.classList.contains("hidden"))return;
    this.overlay.classList.add("hidden");
    this.onResume();
  }
  get opened():boolean{return !this.overlay.classList.contains("hidden")}
  show(show:boolean):void{this.banner.classList.toggle("hidden",!show)}
  tick(position:Pick<Vector3,"x"|"z">,yaw:number,time:number):void{
    if(time-this.last<250)return;
    this.last=time;
    const stop=this.selected;
    const value=routeInfo(position,yaw,stop);
    this.label.textContent=stop.label;
    this.arrow.style.transform="rotate("+value.angleDeg.toFixed(1)+"deg)";
    this.meter.textContent=value.arrived?"到着":Math.round(value.distance)+"m";
    if(this.opened)this.drawMap(position);
  }
  private drawMap(position:Pick<Vector3,"x"|"z">):void{
    const ctx=this.map.getContext("2d");if(!ctx)return;
    const w=this.map.width,h=this.map.height;
    ctx.clearRect(0,0,w,h);ctx.fillStyle="#171a2b";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#52677c";ctx.lineWidth=1;
    for(let x=24;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
    for(let y=24;y<h;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    // Simple pond / house silhouettes are orientation aids, not obstacles.
    const pond=mapCoord(57,-27,w,h);
    ctx.fillStyle="#397f92";ctx.beginPath();ctx.ellipse(pond.x,pond.y,18,13,0,0,Math.PI*2);ctx.fill();
    const house=mapCoord(0,0,w,h);
    ctx.fillStyle="#8f607f";ctx.fillRect(house.x-15,house.y-14,30,28);
    for(const stop of STOPS){
      const p=mapCoord(stop.x,stop.z,w,h);
      ctx.beginPath();ctx.arc(p.x,p.y,stop.id===this.currentId?6:3.2,0,Math.PI*2);
      ctx.fillStyle=stop.id===this.currentId?"#b5ffe7":"#ffa8e0";ctx.fill();
    }
    const me=mapCoord(position.x,position.z,w,h);
    const destination=mapCoord(this.selected.x,this.selected.z,w,h);
    ctx.setLineDash([5,6]);ctx.strokeStyle="#a6ffee";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(me.x,me.y);ctx.lineTo(destination.x,destination.y);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle="#f9fff7";ctx.beginPath();ctx.arc(me.x,me.y,5.5,0,Math.PI*2);ctx.fill();
    ctx.font="bold 11px system-ui";ctx.textAlign="center";
    ctx.fillText("YOU",me.x,me.y-12);
  }
}
