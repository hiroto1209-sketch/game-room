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
import { worldBlocked, groundHeightAt, shotObstructed } from "../shared/worldRules.js";
import { validSignText, MAX_HP, WEAPON_CODE, findHitscanTarget } from "../shared/combatRules.js";
import {BlasterEffects} from "./combat/BlasterEffects";
import {freshMatch,applyMove,legalMoves,counts,BLACK,WHITE,type OthelloMatch} from "../shared/othello.js";

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
const aimButton=byId<HTMLButtonElement>("aim-button");
const crosshair=byId("crosshair");
const secretTrigger=byId<HTMLButtonElement>("secret-trigger");
const secretOverlay=byId("secret-overlay");
const secretCode=byId<HTMLInputElement>("secret-code");
const secretError=byId("secret-error");
const peaceControl=byId<HTMLInputElement>("peace-mode");
const weaponInfo=byId("weapon-info");
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
const menuOnlineNote=byId("menu-online-note");
const othelloPanel=byId("othello-panel");
const othelloStatus=byId("othello-status");
const othelloScore=byId("othello-score");
const othelloAction=byId<HTMLButtonElement>("othello-action");
const othelloPause=byId<HTMLButtonElement>("othello-pause");
const othelloReset=byId<HTMLButtonElement>("othello-reset");
const othelloQuickState=byId("othello-quick-state");
const miniGamesOverlay=byId("minigames-overlay");
const music=new MusicController();
const configuredServer=(import.meta.env.VITE_GAME_ROOM_SERVER_URL??"").trim();
const invitation=new URLSearchParams(window.location.search).get("room");
const inviteRoomId=invitation&&isValidRoomId(invitation)?invitation:null;
const settings={sensitivity:4,exposure:1,reducedMotion:false};
const state={playing:false,paused:false,editingMonitor:false,editingSign:false,editingSecret:false,editingMiniGames:false,time:0,toastUntil:0};
let nearby:ReturnType<InteractionManager["closest"]>=null;
let world:ReturnType<typeof createPartyWorld>|undefined;
let player:PlayerController|undefined;
let camera:CameraController|undefined;
let players:PlayerManager|undefined;
let input:DualTouchController|undefined;
let blaster:BlasterEffects|undefined;
let currentHp=MAX_HP;
let lastShotAt=0;
let aiming=false;
let fireHeld:ReturnType<typeof setInterval>|null=null;
function setAimMode(enabled:boolean):void{
  if(!world)return;
  aiming=enabled&&weaponUnlocked&&!peaceful&&state.playing&&!state.paused;
  aimButton.classList.toggle("aiming",aiming);
  crosshair.classList.toggle("aiming",aiming);
  world.camera.fov=aiming?55:window.innerWidth<window.innerHeight?76:71;
  world.camera.updateProjectionMatrix();
}
function stopFiring():void{
  if(fireHeld!==null){clearInterval(fireHeld);fireHeld=null;}
}
function startFiring():void{
  if(!state.playing||state.paused||!weaponUnlocked||peaceful)return;
  stopFiring();
  fireBlaster();
  fireHeld=setInterval(()=>{if(state.playing&&!state.paused)fireBlaster();else stopFiring()},425);
}
let weaponUnlocked=false,peaceful=true,weaponWanted=false;
let logoTaps=0,lastLogoTapAt=0,lastCorrectionToast=0;
try{weaponWanted=sessionStorage.getItem("game-room-weapon-easteregg")==="1"}catch{}
function closeSecret():void{
  if(!state.editingSecret)return;
  state.editingSecret=false;secretOverlay.classList.add("hidden");state.paused=false;
  input?.reset();if(input)input.enabled=state.playing;
}
function openSecret():void{
  if(!state.playing||state.paused)return;
  state.editingSecret=true;state.paused=true;
  player?.stop();input?.reset();if(input)input.enabled=false;
  secretCode.value="";secretError.textContent="";
  secretOverlay.classList.remove("hidden");secretCode.focus();
}
function unlockSecret():void{
  const code=secretCode.value.trim().toUpperCase();
  if(code!==WEAPON_CODE){
    secretError.textContent="そのコードでは解放できません";return;
  }
  if(roomClient.online){
    if(!roomClient.unlockWeapon(code)){secretError.textContent="通信できません。もう一度お試しください";return;}
    secretError.textContent="サーバーに照会しています…";
  }else{
    weaponUnlocked=true;peaceful=false;peaceControl.checked=false;
    weaponWanted=true;try{sessionStorage.setItem("game-room-weapon-easteregg","1")}catch{}
    closeSecret();showToast("✦ SECRET WEAPON UNLOCKED ✦");
  }
}
function syncWeaponInfo():void{
  peaceControl.checked=peaceful;
  weaponInfo.textContent=weaponUnlocked?
    "✦ SECRET WEAPON UNLOCKED · "+(peaceful?"ピースモード":"対戦モード"):
    "ブラスター未解放 · GAME ROOMロゴに秘密があるかも";
}
let currentMatch:OthelloMatch=freshMatch();
let aimOthelloIndex:number|null=null;
let zoneVisibleUntil=0;
let currentZone="PARTY LOUNGE";
function setOthelloMatch(next:OthelloMatch):void{
  currentMatch=next;
  world?.othelloBoard.setMatch(next);
  updateOthelloPanel();
}
function isMyOthelloTurn():boolean{
  if(currentMatch.status!=="playing")return false;
  if(!roomClient.online)return true; // Offline hot-seat uses one device.
  return (currentMatch.turn===BLACK?currentMatch.blackId:currentMatch.whiteId)===roomClient.playerId;
}
function isOthelloParticipant():boolean{
  return !roomClient.online ||
    currentMatch.blackId===roomClient.playerId||currentMatch.whiteId===roomClient.playerId;
}
function updateOthelloPanel():void{
  const m=currentMatch,score=counts(m.board);
  othelloScore.textContent="● "+score.black+" — "+score.white+" ○";
  const participant=isOthelloParticipant();
  othelloAction.disabled=false;
  othelloPause.classList.add("hidden");
  othelloReset.classList.add("hidden");
  if(m.status==="idle"){
    othelloStatus.textContent="8×8の床タイルでオセロ";
    othelloAction.textContent="オセロを始める";
  }else if(m.status==="waiting"){
    othelloStatus.textContent=m.blackName+" · 白プレイヤー参加待ち";
    othelloAction.textContent=m.blackId===roomClient.playerId?"白の参加を待っています":"白で参加する";
    othelloAction.disabled=m.blackId===roomClient.playerId;
    if(participant&&!(!roomClient.online))othelloReset.classList.remove("hidden");
  }else if(m.status==="playing"||m.status==="paused"){
    const paused=m.status==="paused";
    othelloStatus.textContent=(paused?"⏸ 中断中 · ":"")+
      (m.turn===BLACK?"● 黒":"○ 白")+"の番"+
      (m.pass?" · パス発生":"");
    othelloQuickState.textContent=(paused?"⏸ 中断":"●"+score.black+" ○"+score.white);
    othelloAction.textContent=participant?"床の照準で石を置く":"対局を観戦する";
    othelloAction.disabled=false;
    if(participant){
      othelloPause.classList.remove("hidden");
      othelloPause.textContent=paused?"対局を再開":"対局を中断";
      othelloReset.classList.remove("hidden");
    }
  }else{
    othelloStatus.textContent=m.winner===3?"引き分け":
      (m.winner===BLACK?"● 黒":"○ 白")+"の勝利";
    othelloAction.textContent="新しい対局を始める";
  }
}
function openMiniGames():void{
  if(!state.playing||state.editingSecret||state.editingMonitor||state.editingSign)return;
  state.editingMiniGames=true;state.paused=true;
  menu.classList.add("hidden");
  player?.stop();input?.reset();if(input)input.enabled=false;
  updateOthelloPanel();
  miniGamesOverlay.classList.remove("hidden");
}
function closeMiniGames():void{
  if(!state.editingMiniGames)return;
  state.editingMiniGames=false;state.paused=false;
  miniGamesOverlay.classList.add("hidden");
  input?.reset();if(input)input.enabled=state.playing;
}
function othelloPrimaryAction():void{
  if(!state.playing||!state.editingMiniGames)return;
  if(roomClient.online){
    if(currentMatch.status==="idle"||currentMatch.status==="finished"){
      roomClient.othello("start");closeMiniGames();
    }else if(currentMatch.status==="waiting" && currentMatch.blackId!==roomClient.playerId){
      roomClient.othello("join");closeMiniGames();
    }else if(currentMatch.status==="playing"||currentMatch.status==="paused"){
      closeMiniGames();showToast("光る床マスを中央の照準で選んでください");
    }
    return;
  }
  if(currentMatch.status==="idle"||currentMatch.status==="finished"){
    setOthelloMatch({...freshMatch("PRACTICE_BLACK","BLACK"),
      whiteId:"PRACTICE_WHITE",whiteName:"WHITE",status:"playing",revision:currentMatch.revision+1});
    closeMiniGames();showToast("● ○ FLOOR OTHELLO 開始！");
  }else closeMiniGames();
}
function toggleOthelloPause():void{
  if(!state.editingMiniGames||!isOthelloParticipant())return;
  const paused=currentMatch.status==="paused";
  if(!paused&&currentMatch.status!=="playing")return;
  if(roomClient.online)roomClient.othello(paused?"resume":"pause");
  else setOthelloMatch({...currentMatch,status:paused?"playing":"paused",
    revision:currentMatch.revision+1});
  closeMiniGames();
  showToast(paused?"オセロを再開しました":"対局を中断しました。盤面は保持されます");
}
function endOthello():void{
  if(!state.editingMiniGames||!isOthelloParticipant())return;
  if(roomClient.online)roomClient.othello("reset");
  else setOthelloMatch({...freshMatch(),revision:currentMatch.revision+1});
  closeMiniGames();showToast("対局を終了しました");
}
function placeOthello(index:number):void{
  if(!isMyOthelloTurn()){showToast("対戦者の手番になるまで観戦できます");return;}
  if(!legalMoves(currentMatch.board,currentMatch.turn).includes(index)){
    showToast("そこには置けません。光るマスを狙ってください");return;
  }
  if(roomClient.online){
    if(!roomClient.othello("place",index))showToast("通信中です。少し待ってください");
  }else{
    const applied=applyMove(currentMatch,index);
    if(applied)setOthelloMatch(applied);
  }
}

const hpByPlayer=new Map<string,number>();
function setHealth(value:number):void{
  currentHp=Math.max(0,Math.min(MAX_HP,value));
  hpLabel.textContent="HP "+currentHp+" / "+MAX_HP;
  hpFill.style.width=currentHp+"%";
  combatNote.textContent=currentHp===0?"リスポーンを待っています…":"HP "+currentHp;
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
  if(!weaponUnlocked||peaceful){showToast("隠しブラスターの解放かピースモード設定を確認してください");return;}
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
    menuOnlineNote.textContent=connection==="online"?"友達と同じルームに参加中":
      connection==="offline"?"ソロプレイ中":
      connection==="connecting"?"ルームに接続しています…":"通信を再接続しています…";
    updateOthelloPanel();
    onlineNote.textContent=connection==="online"?"ルームに接続しました":
      connection==="reconnecting"?"通信を再接続しています":"オンラインルームを準備しています";
  },
  onSnapshot:remotePlayers=>{
    players?.clear();
    for(const member of remotePlayers)players?.upsertRemote(member);
  },
  onPlayer:member=>{players?.upsertRemote(member);},
  onLeave:id=>{players?.removeRemote(id);},
  onOthello:match=>setOthelloMatch(match),
  onSpawn:position=>{
    player?.teleport(position.x,position.y,position.z);
    if(player&&camera)camera.update(player.position);
    setHealth(MAX_HP);
    // The public easter-egg code is revalidated by the Worker on every reconnect.
    if(weaponWanted)roomClient.unlockWeapon(WEAPON_CODE);
  },
  onCorrection:position=>{
    player?.teleport(position.x,position.y,position.z);
    if(player&&camera)camera.update(player.position);
    const now=performance.now();
    if(now-lastCorrectionToast>5000){
      lastCorrectionToast=now;showToast("位置の同期を調整しました");
    }
  },
  onWeaponState:(unlocked,serverPeace)=>{
    weaponUnlocked=unlocked;peaceful=serverPeace;syncWeaponInfo();
    if(unlocked){
      weaponWanted=true;
      try{sessionStorage.setItem("game-room-weapon-easteregg","1")}catch{}
      closeSecret();showToast("✦ SECRET WEAPON UNLOCKED ✦");
    }
  },
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
  onError:message=>{
    if(state.editingSecret)secretError.textContent=message;
    else showToast(message);
  }
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
  weaponUnlocked=weaponWanted;peaceful=false;syncWeaponInfo();
  setOthelloMatch(freshMatch());
  setHealth(MAX_HP);
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
  stopFiring();setAimMode(false);
  if(state.editingMonitor||state.editingSign||state.editingSecret||state.editingMiniGames)return;
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
  stopFiring();setAimMode(false);
  closeMiniGames();
  closeSecret();
  closeSign();
  closeMonitor();
  closeMenu();roomClient.leave();clearRoomQuery();state.playing=false;
  if(input)input.enabled=false;
  player?.reset();camera?.reset();
  lastOutdoorZone=false;
  currentZone="PARTY LOUNGE";
  zoneIndicator.classList.remove("show");
  setOthelloMatch(freshMatch());
  zoneIndicator.textContent=currentZone;
  if(player&&camera)camera.update(player.position);
  world?.resetParty();
  startScreen.classList.remove("dismissed");
  hud.classList.add("hidden");
  players?.clear();
  setHealth(MAX_HP);hpByPlayer.clear();
  music.stop();
  byId<HTMLInputElement>("sound-enabled").checked=false;
}
function doInteraction():void{
  if(!state.playing||state.paused)return;
  if(aimOthelloIndex!==null&&currentMatch.status==="playing"){
    placeOthello(aimOthelloIndex);
    return;
  }
  nearby?.action();
}
function updateInteraction():void{
  if(!world||!player)return;
  nearby=new InteractionManager(world.targets).closest(player.position);
  if(currentMatch.status==="playing"&&aimOthelloIndex!==null
    &&Math.abs(player.position.x)<7.2&&player.position.z>-11&&player.position.z<0){
    const square=aimOthelloIndex;
    nearby={x:player.position.x,z:player.position.z,
      label:"オセロ "+(Math.floor(square/8)+1)+"行 "+(square%8+1)+"列",
      action:()=>placeOthello(square)};
  }
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
    if(nextZone!==currentZone){
      currentZone=nextZone;
      zoneIndicator.textContent=nextZone;
      zoneIndicator.classList.add("show");
      zoneVisibleUntil=performance.now()+2200;
    }
    if(zoneVisibleUntil&&performance.now()>zoneVisibleUntil){
      zoneVisibleUntil=0;zoneIndicator.classList.remove("show");
    }
    const nearBoard=Math.abs(player.position.x)<7.5&&player.position.z>-11&&player.position.z<0;
    // No large interactive panels in the left-thumb movement region.
    // Only show a tiny, touch-transparent match indicator near the floor.
    const matchVisible=nearBoard&&currentMatch.status!=="idle";
    othelloPanel.classList.toggle("hidden",!matchVisible);
    aimOthelloIndex=nearBoard&&currentMatch.status==="playing"?
      world.othelloBoard.aim(world.camera):null;
    if(matchVisible)othelloQuickState.textContent=
      currentMatch.status==="paused"?"⏸ 中断中":
      currentMatch.status==="waiting"?"参加待ち":
      currentMatch.status==="finished"?"終了":
      "● "+counts(currentMatch.board).black+" / ○ "+counts(currentMatch.board).white;
    const armed=weaponUnlocked&&!peaceful;
    combatHud.classList.remove("hidden");
    shootButton.classList.toggle("hidden",!armed);
    aimButton.classList.toggle("hidden",!armed);
    crosshair.classList.toggle("armed",armed);
    const candidate=armed?findHitscanTarget(
      {id:roomClient.playerId||"local",hp:currentHp,position:player.position},
      players.getRemoteSnapshots().map(p=>({id:p.id,position:p.position,hp:hpByPlayer.get(p.id)??100})),
      camera.yaw,camera.pitch,shotObstructed
    ):null;
    crosshair.classList.toggle("targeted",Boolean(candidate));
    if(armed&&currentHp>0){
      const note=!roomClient.online?"ソロ練習 · ダメージ同期なし":
        candidate?"TARGET LOCK · HP "+(hpByPlayer.get(candidate.id)??100):
        "FIREでブラスター発射";
      if(combatNote.textContent!==note)combatNote.textContent=note;
    }
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
  // Logo shortcut is optional: the real in-world ARMORY ATM is the main path.
  secretTrigger.addEventListener("click",()=>{
    const now=performance.now();
    logoTaps=now-lastLogoTapAt<2400?logoTaps+1:1;lastLogoTapAt=now;
    if(logoTaps>=5){logoTaps=0;openSecret()}
  });
  byId("secret-close").addEventListener("click",closeSecret);
  byId("secret-unlock").addEventListener("click",unlockSecret);
  secretCode.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();unlockSecret()}});
  peaceControl.addEventListener("change",()=>{
    const desired=peaceControl.checked;
    if(roomClient.online){
      if(!roomClient.setPeaceMode(desired))peaceControl.checked=peaceful;
    }else{peaceful=desired;syncWeaponInfo();}
  });
  othelloAction.addEventListener("click",othelloPrimaryAction);
  othelloPause.addEventListener("click",toggleOthelloPause);
  othelloReset.addEventListener("click",endOthello);
  byId("minigames-close").addEventListener("click",closeMiniGames);
  byId("minigames-return").addEventListener("click",closeMiniGames);
  byId("open-minigames").addEventListener("click",openMiniGames);
  byId("close-sign").addEventListener("click",closeSign);
  byId("save-sign").addEventListener("click",saveSign);
  signText.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();saveSign()}});
  shootButton.addEventListener("pointerdown",e=>{
    e.preventDefault();e.stopPropagation();startFiring();
  },{passive:false});
  for(const event of ["pointerup","pointercancel","lostpointercapture"]){
    shootButton.addEventListener(event,stopFiring);
  }
  shootButton.addEventListener("click",e=>{
    if(e.detail===0)fireBlaster(); // keyboard accessibility
  });
  aimButton.addEventListener("pointerdown",e=>{
    e.preventDefault();e.stopPropagation();setAimMode(true);
  },{passive:false});
  for(const event of ["pointerup","pointercancel","lostpointercapture"]){
    aimButton.addEventListener(event,()=>setAimMode(false));
  }
  window.addEventListener("pointerup",()=>{stopFiring();setAimMode(false);});
  window.addEventListener("pointercancel",()=>{stopFiring();setAimMode(false);});
  window.addEventListener("blur",()=>{stopFiring();setAimMode(false);});
  canvas.addEventListener("pointerdown",e=>{
    if(e.pointerType==="mouse"){
      if(e.button===0)startFiring();
      if(e.button===2)setAimMode(true);
    }
  });
  canvas.addEventListener("pointerup",e=>{
    if(e.pointerType==="mouse"){stopFiring();if(e.button===2)setAimMode(false);}
  });
  window.addEventListener("keydown",e=>{
    if(e.code==="KeyF"&&!e.repeat&&!state.editingSign&&!state.editingSecret&&!(document.activeElement instanceof HTMLInputElement))
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
  },openSign,openSecret,openMiniGames);
  blaster=new BlasterEffects(world.scene);
  setOthelloMatch(currentMatch);
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
      if(!state.paused&&state.playing)camera?.drag(dx,dy,settings.sensitivity*(aiming?.62:1));
    },
    onJump:()=>{if(state.playing&&!state.paused)player?.jump()},
    onMenu:()=>state.editingMiniGames?closeMiniGames():state.paused?closeMenu():openMenu(),
    onInteract:doInteraction
  });
  input.enabled=false;
  weaponUnlocked=weaponWanted;peaceful=!weaponWanted;syncWeaponInfo();
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
