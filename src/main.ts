import * as THREE from "three";
import { createPartyWorld } from "./world/PartyWorld.js";
import { InteractionManager } from "./world/InteractionManager";
import { CameraController } from "./camera/CameraController";
import { PlayerController } from "./player/PlayerController";
import { PlayerManager } from "./player/PlayerManager";
import { DualTouchController } from "./input/DualTouchController";
import { MusicController } from "./audio/MusicController";
import { OfflineTransport, type Transport } from "./network/Transport";
import { safeDisplayName } from "./types/Player";

const byId=<T extends HTMLElement>(id:string):T=>{
  const el=document.getElementById(id);
  if(!el)throw new Error("Missing UI element: "+id);
  return el as T;
};
const canvas=byId<HTMLCanvasElement>("scene");
const loader=byId("loading");
const startScreen=byId("start-screen");
const hud=byId("hud");
const menu=byId("menu-overlay");
const monitorOverlay=byId("monitor-overlay");
const monitorFile=byId<HTMLInputElement>("monitor-file");
const monitorUrl=byId<HTMLInputElement>("monitor-url");
const monitorError=byId("monitor-error");
const monitorApply=byId<HTMLButtonElement>("apply-monitor");
const joystick=byId("joystick");
const thumb=byId("joystick-thumb");
const interaction=byId("interaction");
const interactionText=byId("interaction-text");
const toast=byId("toast");
const tips=byId("tips");
const music=new MusicController();
const transport:Transport=new OfflineTransport();
// Local-first Phase 1: transport is deliberately disconnected.
void transport;
const settings={sensitivity:4,exposure:1,reducedMotion:false};
const state={playing:false,paused:false,editingMonitor:false,time:0,toastUntil:0};
let nearby:ReturnType<InteractionManager["closest"]>=null;
let world:ReturnType<typeof createPartyWorld>|undefined;
let player:PlayerController|undefined;
let camera:CameraController|undefined;
let players:PlayerManager|undefined;
let input:DualTouchController|undefined;
const clock=new THREE.Clock();
function showToast(message:string):void{
  toast.textContent=message;
  toast.classList.add("visible");
  state.toastUntil=performance.now()+2700;
}
function openMonitor():void{
  if(!state.playing||state.paused)return;
  state.editingMonitor=true;
  state.paused=true;
  if(input){input.enabled=false;input.reset();}
  player?.stop();
  monitorError.textContent="";
  monitorOverlay.classList.remove("hidden");
}
function closeMonitor():void{
  if(!state.editingMonitor)return;
  state.editingMonitor=false;
  monitorOverlay.classList.add("hidden");
  monitorError.textContent="";
  if(input){input.reset();input.enabled=state.playing;}
  state.paused=false;
}
async function applyMonitorImage():Promise<void>{
  if(!world||monitorApply.disabled)return;
  const selected=monitorFile.files?.[0];
  const url=monitorUrl.value.trim();
  if(!selected&&!url){monitorError.textContent="写真を選ぶか画像URLを入力してください";return;}
  monitorApply.disabled=true;
  monitorApply.textContent="読み込み中…";
  monitorError.textContent="";
  try{
    if(selected)await world.monitor.setFile(selected);
    else await world.monitor.setUrl(url);
    monitorFile.value="";
    closeMonitor();
    showToast("モニターに画像を表示しました 📸");
  }catch(error){
    monitorError.textContent=error instanceof Error?error.message:"画像を表示できませんでした";
  }finally{
    monitorApply.disabled=false;
    monitorApply.textContent="モニターに表示する";
  }
}
function start():void{
  if(!world||!input)return;
  state.playing=true;state.paused=false;
  input.enabled=true;
  startScreen.classList.add("dismissed");
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  tips.classList.remove("fading");
  window.setTimeout(()=>tips.classList.add("fading"),6900);
}
function openMenu():void{
  if(state.editingMonitor)return;
  state.paused=true;
  input?.reset();if(input)input.enabled=false;
  player?.stop();
  byId<HTMLButtonElement>("resume-button").textContent=state.playing?"ワールドへ戻る":"設定を閉じる";
  menu.classList.remove("hidden");
}
function closeMenu():void{
  state.paused=false;
  menu.classList.add("hidden");
  input?.reset();if(input)input.enabled=state.playing;
}
function backToTitle():void{
  closeMonitor();
  closeMenu();state.playing=false;
  if(input)input.enabled=false;
  player?.reset();camera?.reset();
  if(player&&camera)camera.update(player.position);
  world?.resetParty();
  startScreen.classList.remove("dismissed");
  hud.classList.add("hidden");
  players?.clear();
  music.stop();
  byId<HTMLInputElement>("sound-enabled").checked=false;
}
function doInteraction():void{if(state.playing&&!state.paused)nearby?.action()}
function updateInteraction():void{
  if(!world||!player)return;
  nearby=new InteractionManager(world.targets).closest(player.position);
  if(!nearby){interaction.classList.add("hidden");return;}
  interactionText.textContent=nearby.label;
  interaction.classList.remove("hidden");
}
function update(dt:number):void{
  if(!world||!player||!camera||!input||!players)return;
  state.time+=dt;
  if(state.playing&&!state.paused){
    const bob=player.update(dt,input.getMovement(),camera.yaw,settings.reducedMotion);
    camera.update(player.position,bob);
    updateInteraction();
  }
  world.update(dt,state.time,settings.reducedMotion);
  players.update(dt,world.camera);
  if(toast.classList.contains("visible")&&performance.now()>state.toastUntil)
    toast.classList.remove("visible");
  world.renderer.render(world.scene,world.camera);
}
function frame():void{
  requestAnimationFrame(frame);
  update(Math.min(.04,clock.getDelta()));
}
function registerUi():void{
  byId("start-button").addEventListener("click",start);
  byId("menu-button").addEventListener("click",()=>state.paused?closeMenu():openMenu());
  byId("close-menu").addEventListener("click",closeMenu);
  byId("resume-button").addEventListener("click",closeMenu);
  byId("return-title").addEventListener("click",backToTitle);
  const jumpButton=byId<HTMLButtonElement>("jump-button");
  // iOS Safari may suppress a second-finger synthesized click while the left
  // thumb is moving on the canvas. Handle touch/pen immediately on pointerdown.
  let lastTouchJump=-Infinity;
  jumpButton.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="mouse"){
      e.preventDefault();e.stopPropagation();
      lastTouchJump=performance.now();
      if(state.playing&&!state.paused)player?.jump();
    }
  },{passive:false});
  // Click remains the keyboard/mouse accessibility fallback.
  jumpButton.addEventListener("click",()=>{
    // Ignore synthetic click generated after touch pointerdown to prevent a second jump.
    if(performance.now()-lastTouchJump<1000)return;
    if(state.playing&&!state.paused)player?.jump();
  });
  byId("close-monitor").addEventListener("click",closeMonitor);
  byId("apply-monitor").addEventListener("click",()=>{void applyMonitorImage();});
  byId("reset-monitor").addEventListener("click",()=>{
    world?.monitor.clear();
    monitorFile.value="";monitorUrl.value="";
    closeMonitor();showToast("モニターを初期表示に戻しました");
  });
  byId("interact-button").addEventListener("click",doInteraction);
  byId<HTMLInputElement>("sensitivity").addEventListener("input",e=>{
    settings.sensitivity=Number((e.target as HTMLInputElement).value);
    byId("sensitivity-value").textContent=String(settings.sensitivity);
  });
  byId<HTMLInputElement>("brightness").addEventListener("input",e=>{
    settings.exposure=Number((e.target as HTMLInputElement).value);
    byId("brightness-value").textContent=settings.exposure.toFixed(1);
    world?.setExposure(settings.exposure);
  });
  byId<HTMLInputElement>("reduced-motion").addEventListener("change",e=>{
    settings.reducedMotion=(e.target as HTMLInputElement).checked;
  });
  byId<HTMLInputElement>("sound-enabled").addEventListener("change",async e=>{
    const target=e.target as HTMLInputElement;
    if(!target.checked){music.stop();return;}
    try{await music.start()}catch(error){
      target.checked=false;showToast("音声の再生が許可されませんでした");
      console.warn("WebAudio unavailable",error);
    }
  });
}
function initialize():void{
  world=createPartyWorld(canvas,showToast,openMonitor);
  player=new PlayerController(world.colliders);
  camera=new CameraController(world.camera);
  players=new PlayerManager(world.scene);
  const safeName=safeDisplayName("Guest");
  console.info("GAME ROOM 2.0 Phase 1",{
    mode:"offline",displayName:safeName,
    playerId:players.localId,
    renderer:"Three.js",serverConnected:false
  });
  input=new DualTouchController(canvas,joystick,thumb,{
    onLook:(dx,dy)=>{
      if(!state.paused&&state.playing)camera?.drag(dx,dy,settings.sensitivity);
    },
    onJump:()=>{if(state.playing&&!state.paused)player?.jump()},
    onMenu:()=>state.paused?closeMenu():openMenu(),
    onInteract:doInteraction
  });
  input.enabled=false;
  window.addEventListener("resize",()=>world?.resize());
  registerUi();
  camera.update(player.position);
  // Developers can preview remote placeholder avatars without a backend.
  // Never represent preview avatars as connected online players.
  if(new URLSearchParams(window.location.search).has("previewAvatars")){
    const id="preview_avatar_0001";
    players.upsertRemote({id,displayName:"Preview Bot",position:{x:1.5,y:1.65,z:5.5},
      yaw:0,pitch:0,sequence:1});
    showToast("ローカルアバタープレビュー（オンライン未接続）");
  }
  loader.classList.add("done");
  window.setTimeout(()=>loader.remove(),600);
  frame();
}
try{initialize()}catch(error){
  console.error("Game Room 2.0 initialization error",error);
  loader.classList.add("hidden");
  byId("fatal").classList.remove("hidden");
}
