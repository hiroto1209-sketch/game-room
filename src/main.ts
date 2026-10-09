import * as THREE from "three";
import { createPartyWorld } from "./world/PartyWorld.js";
import { InteractionManager } from "./world/InteractionManager";
import { CameraController } from "./camera/CameraController";
import { PlayerController } from "./player/PlayerController";
import { PlayerManager } from "./player/PlayerManager";
import { DualTouchController } from "./input/DualTouchController";
import { MusicController } from "./audio/MusicController";
import { RealtimeRoomClient, type RoomConnectionState } from "./network/RealtimeRoomClient";
import { createRoomId, isValidRoomId } from "./network/protocol";
import { safeDisplayName } from "./types/Player";
import { worldBlocked, groundHeightAt } from "../shared/worldRules.js";
import { inArena, validSignText, MAX_HP } from "../shared/combatRules.js";
import {BlasterEffects} from "./combat/BlasterEffects";

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
const monitorShareRow=byId("monitor-share-row");
const monitorShareDetail=byId("monitor-share-detail");
const monitorShare=byId<HTMLInputElement>("monitor-share");
const signOverlay=byId("sign-overlay");
const signText=byId<HTMLInputElement>("sign-text");
const signError=byId("sign-error");
const hpLabel=byId("hp-label");
const hpFill=byId("hp-fill");
const combatNote=byId("combat-note");
const combatHud=byId("combat-hud");
const shootButton=byId<HTMLButtonElement>("shoot-button");
const crosshair=byId("crosshair");
const joystick=byId("joystick");
const thumb=byId("joystick-thumb");
const interaction=byId("interaction");
const interactionText=byId("interaction-text");
const toast=byId("toast");
const tips=byId("tips");
const onlinePanel=byId("online-panel");
const onlineNote=byId("online-note");
const roomName=byId<HTMLInputElement>("room-name");
const createRoomButton=byId<HTMLButtonElement>("create-room");
const joinRoomButton=byId<HTMLButtonElement>("join-room");
const roomHud=byId("room-hud");
const roomState=byId("room-state");
const roomCount=byId("room-count");
const music=new MusicController();
const configuredServer=(import.meta.env.VITE_GAME_ROOM_SERVER_URL??"").trim();
const invitation=new URLSearchParams(window.location.search).get("room");
const inviteRoomId=invitation&&isValidRoomId(invitation)?invitation:null;
const settings={sensitivity:4,exposure:1,reducedMotion:false};
const state={playing:false,paused:false,editingMonitor:false,editingSign:false,time:0,toastUntil:0};
let nearby:ReturnType<InteractionManager["closest"]>=null;
let world:ReturnType<typeof createPartyWorld>|undefined;
let player:PlayerController|undefined;
let camera:CameraController|undefined;
let players:PlayerManager|undefined;
let input:DualTouchController|undefined;
let blaster:BlasterEffects|undefined;
let currentHp=MAX_HP;
let lastShotAt=0;
const hpByPlayer=new Map<string,number>();
function setHealth(value:number):void{
  currentHp=Math.max(0,Math.min(MAX_HP,value));
  hpLabel.textContent="HP "+currentHp+" / "+MAX_HP;
  hpFill.style.width=currentHp+"%";
  combatNote.textContent=currentHp===0?"リスポーンを待っています…":"アリーナ内のみ対戦可能";
}
function openSign():void{
  if(!state.playing||state.paused||!world)return;
  state.editingSign=true;state.paused=true;player?.stop();
  input?.reset();if(input)input.enabled=false;
  signText.value=world.signBoard.getText();signError.textContent="";
  signOverlay.classList.remove("hidden");
}
function closeSign():void{
  if(!state.editingSign)return;
  state.editingSign=false;state.paused=false;
  signOverlay.classList.add("hidden");
  input?.reset();if(input)input.enabled=state.playing;
}
function saveSign():void{
  if(!world)return;
  const value=signText.value.trim()||"WELCOME TO GAME ROOM";
  if(!validSignText(value)){signError.textContent="80文字以内で入力してください。タグ・改行・制御文字は使えません";return;}
  if(roomClient.online){
    if(!roomClient.setSignText(value)){signError.textContent="共有できませんでした。接続状態を確認してください";return;}
  }else world.signBoard.setText(value);
  closeSign();
  showToast(roomClient.online?"📢 看板の共有を送信しました":"📢 看板を書き換えました");
}
function fireBlaster():void{
  if(!state.playing||state.paused||!player||!camera||!blaster)return;
  if(!inArena(player.position))return;
  if(currentHp<=0)return;
  const now=performance.now();if(now-lastShotAt<410)return;
  lastShotAt=now;
  const origin={...player.position};
  blaster.shoot(origin,camera.yaw,camera.pitch);
  if(roomClient.online && !roomClient.shoot(camera.yaw,camera.pitch))
    showToast("発射通信に失敗しました");
}
const clock=new THREE.Clock();
const zoneIndicator=byId("zone-indicator");
let lastOutdoorZone=false;
const roomClient=new RealtimeRoomClient({
  onState:(connection:RoomConnectionState,count:number)=>{
    roomState.textContent=connection==="online"?"オンライン":connection==="offline"?"オフライン":connection==="connecting"?"接続中…":"再接続中…";
    roomCount.textContent=count+"人";
    roomHud.classList.toggle("hidden",connection==="offline");
    onlineNote.textContent=connection==="online"?"ルームに接続しました":
      connection==="reconnecting"?"通信を再接続しています":"オンラインルームを準備しています";
  },
  onSnapshot:remotePlayers=>{
    players?.clear();
    for(const member of remotePlayers)players?.upsertRemote(member);
  },
  onPlayer:member=>{players?.upsertRemote(member);},
  onLeave:id=>{players?.removeRemote(id);},
  onRoomState:shared=>{
    if(!world)return;
    world.setPartyMode(shared.lightShow);
    world.signBoard.setText(shared.signText);
    void world.monitor.applySharedJpeg(shared.monitorImage).catch(error=>{
      console.warn("Shared monitor image could not be applied",error);
      showToast("共有画像の読み込みに失敗しました");
    });
  },
  onHealth:(id,hp,_respawnAt)=>{
    hpByPlayer.set(id,hp);
    if(id===roomClient.playerId)setHealth(hp);
  },
  onFire:(shooterId,position,yaw,pitch)=>{
    if(shooterId!==roomClient.playerId)blaster?.shoot(position,yaw,pitch);
  },
  onFireResult:(hit,damage)=>{
    if(hit)showToast("✦ HIT! "+damage+" DAMAGE");
  },
  onRespawn:position=>{
    player?.teleport(position.x,position.y,position.z);
    if(player&&camera)camera.update(player.position);
    setHealth(MAX_HP);showToast("✨ RESPAWN — 戻ってきました");
  },
  onError:message=>showToast(message)
},configuredServer);
function clearRoomQuery():void{
  const url=new URL(window.location.href);
  url.searchParams.delete("room");
  window.history.replaceState(null,"",url.toString());
}
function currentInviteLink():string{
  const url=new URL(window.location.href);
  url.searchParams.set("room",roomClient.roomId);
  url.searchParams.delete("previewAvatars");
  return url.toString();
}
async function connectRoom(roomId:string):Promise<void>{
  if(!roomClient.supported){
    onlineNote.textContent="Cloudflareサーバー未設定：オンライン機能は準備中です";
    return;
  }
  start();
  try{
    await roomClient.join(roomId,roomName.value);
    const link=new URL(window.location.href);
    link.searchParams.set("room",roomId);
    window.history.replaceState(null,"",link.toString());
  }catch(error){
    roomClient.leave();
    onlineNote.textContent=error instanceof Error?error.message:"接続に失敗しました";
    showToast(onlineNote.textContent);
  }
}
async function copyInvitation():Promise<void>{
  if(!roomClient.roomId)return;
  const value=currentInviteLink();
  try{
    await navigator.clipboard.writeText(value);
    showToast("招待リンクをコピーしました 📋");
  }catch{
    // Safari may deny clipboard API when outside a secure/user gesture context.
    window.prompt("このリンクをコピーして友達に送ってください",value);
  }
}
function leaveOnlineRoom():void{
  roomClient.leave();
  clearRoomQuery();
  showToast("オンラインルームから退出しました。ソロプレイを続けられます");
}

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
  monitorShareRow.classList.toggle("hidden",!roomClient.online);
  monitorShareDetail.classList.toggle("hidden",!roomClient.online);
  // Opt-in every time: photos are never uploaded without this checkbox.
  monitorShare.checked=false;
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
    if(roomClient.online && monitorShare.checked){
      const compressed=world.monitor.exportSharedJpeg();
      if(!roomClient.setRoomImage(compressed))
        throw new Error("共有できませんでした。オンライン接続を確認してください");
    }
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
  if(state.editingMonitor||state.editingSign)return;
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
  closeSign();
  closeMonitor();
  closeMenu();roomClient.leave();clearRoomQuery();state.playing=false;
  if(input)input.enabled=false;
  player?.reset();camera?.reset();
  lastOutdoorZone=false;
  zoneIndicator.textContent="PARTY LOUNGE";
  if(player&&camera)camera.update(player.position);
  world?.resetParty();
  startScreen.classList.remove("dismissed");
  hud.classList.add("hidden");
  players?.clear();
  setHealth(MAX_HP);hpByPlayer.clear();
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
    const bob=currentHp>0?player.update(dt,input.getMovement(),camera.yaw,settings.reducedMotion):0;
    camera.update(player.position,bob);
    const inOutdoor=player.position.x>10.65;
    if(inOutdoor!==lastOutdoorZone){
      lastOutdoorZone=inOutdoor;
      showToast(inOutdoor?"🌿 THE DOOR — ようこそ月夜の世界へ！":"🏠 パーティールームにおかえり！");
    }
    const nextZone=inOutdoor?
      (player.position.x>45&&player.position.z< -14?"STARLIT POND":player.position.x>75?"BLOCK GROVE":"MOONLIT PLAZA") :
      "PARTY LOUNGE · 東側の扉から外へ";
    if(zoneIndicator.textContent!==nextZone)zoneIndicator.textContent=nextZone;
    const fighting=inArena(player.position);
    combatHud.classList.toggle("hidden",!fighting);
    shootButton.classList.toggle("hidden",!fighting);
    crosshair.classList.toggle("armed",fighting);
    updateInteraction();
    roomClient.tick(performance.now(),{
      position:{...player.position},yaw:camera.yaw,pitch:camera.pitch
    });
  }
  world.update(dt,state.time,settings.reducedMotion);
  blaster?.update(dt);
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
  onlinePanel.style.display="flex";
  onlineNote.textContent=roomClient.supported?
    (inviteRoomId?"招待されたルームに参加できます":"友達と同じ部屋で遊ぶ"):
    "オンラインサーバー未設定（ソロプレイ可能）";
  createRoomButton.disabled=!roomClient.supported;
  joinRoomButton.disabled=!roomClient.supported;
  joinRoomButton.classList.toggle("hidden",!inviteRoomId);
  createRoomButton.addEventListener("click",()=>{void connectRoom(createRoomId());});
  joinRoomButton.addEventListener("click",()=>{
    if(inviteRoomId)void connectRoom(inviteRoomId);
  });
  byId("copy-invite").addEventListener("click",()=>{void copyInvitation();});
  byId("leave-room").addEventListener("click",leaveOnlineRoom);
  byId("start-button").addEventListener("click",start);
  byId("close-sign").addEventListener("click",closeSign);
  byId("save-sign").addEventListener("click",saveSign);
  signText.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();saveSign()}});
  shootButton.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="mouse"){
      e.preventDefault();e.stopPropagation();fireBlaster();
    }
  },{passive:false});
  shootButton.addEventListener("click",e=>{if(e.detail===0||e instanceof MouseEvent&&e.pointerType===undefined)fireBlaster()});
  window.addEventListener("keydown",e=>{
    if(e.code==="KeyF"&&!e.repeat&&!state.editingSign&&!(document.activeElement instanceof HTMLInputElement))
      fireBlaster();
  });
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
    if(roomClient.online && monitorShare.checked && !roomClient.setRoomImage(null)){
      monitorError.textContent="共有モニターのリセットを送信できませんでした";return;
    }
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
  world=createPartyWorld(canvas,showToast,openMonitor,(enabled:boolean)=>{
    // Solo mode stays local; joined rooms persist light-show changes for all peers.
    if(roomClient.online && !roomClient.setLightShow(enabled))
      showToast("照明の共有に失敗しました");
  },openSign);
  blaster=new BlasterEffects(world.scene);
  player=new PlayerController(world.colliders,worldBlocked,groundHeightAt);
  camera=new CameraController(world.camera);
  players=new PlayerManager(world.scene);
  const safeName=safeDisplayName("Guest");
  console.info("GAME ROOM Phase 2",{
    mode:"offline",displayName:safeName,
    playerId:players.localId,
    renderer:"Three.js",serverConfigured:roomClient.supported
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
