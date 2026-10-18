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
import { worldBlocked, groundHeightAt, walkableHeightAt, shotObstructed, insideHouse } from "../shared/worldRules.js";
import {stageShotObstructed,inFpsStage} from "../shared/playcanvasRules.js";
import {TokotokoResident} from "./world/TokotokoResident";
import {ResidentDialogue} from "./ui/ResidentDialogue";
import {canTalkToResident,residentStepBlocked,residentHeightAt,EMPTY_MOTION,POKO_ANCHOR,type ResidentId} from "../shared/residentRules.js";
import {PokoWelcome} from "./world/PokoWelcome";
import {PlayCanvasStage} from "./world/PlayCanvasStage";
import { validSignText, MAX_HP, WEAPON_CODE, WING_CODE, findHitscanTarget, inArena } from "../shared/combatRules.js";
import {BlasterEffects} from "./combat/BlasterEffects";
import {FloatingDamage} from "./combat/FloatingDamage";
import {BlasterAudio} from "./audio/BlasterAudio";
import {PracticeDummies} from "./world/PracticeDummies";
import {SharedFoes} from "./world/SharedFoes";
import {StudioMirror} from "./world/StudioMirror";
import {canBlasterFire,shouldSendPvpShot} from "./combat/practiceRules";
import {WorldGuide} from "./ui/WorldGuide";
import {AvatarStudio,AVATAR_EMOTE_LABELS} from "./ui/AvatarStudio";
import {DEFAULT_AVATAR,validEmote,type EmoteKind} from "../shared/avatarRules.js";
import {QuickArcade} from "./games/QuickArcade";
import {FireLookGesture} from "./input/FireLookGesture";
import {FpsTouchBridge} from "./input/FpsTouchBridge";
import {WeaponViewmodel} from "./combat/WeaponViewmodel";
import {HudLayoutEditor} from "./ui/HudLayoutEditor";
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
const hitReadout=byId("hit-readout");
const secretTrigger=byId<HTMLButtonElement>("secret-trigger");
const secretOverlay=byId("secret-overlay");
const secretCode=byId<HTMLInputElement>("secret-code");
const secretError=byId("secret-error");
const weaponInfo=byId("weapon-info");
const joystick=byId("joystick");
const thumb=byId("joystick-thumb");
const interaction=byId("interaction");
const interactionText=byId("interaction-text");
const interactButton=byId<HTMLButtonElement>("interact-button");
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
const blasterAudio=new BlasterAudio();
const SHOT_SOUND_KEY="game-room-shot-sound-v1";
try{blasterAudio.enabled=localStorage.getItem(SHOT_SOUND_KEY)!=="off"}catch{}
const configuredServer=(import.meta.env.VITE_GAME_ROOM_SERVER_URL??"").trim();
const invitation=new URLSearchParams(window.location.search).get("room");
const inviteRoomId=invitation&&isValidRoomId(invitation)?invitation:null;
const settings={sensitivity:4,exposure:1,reducedMotion:false};
const SMART_ADS_KEY="game-room-smart-ads-v1";
let smartAimEnabled=true;
try{smartAimEnabled=localStorage.getItem(SMART_ADS_KEY)!=="off"}catch{}
const state={playing:false,paused:false,editingMonitor:false,editingSign:false,editingSecret:false,editingMiniGames:false,time:0,toastUntil:0};
let nearby:ReturnType<InteractionManager["closest"]>=null;
let world:ReturnType<typeof createPartyWorld>|undefined;
let player:PlayerController|undefined;
let poko:PokoWelcome|undefined;
let resident:TokotokoResident|undefined;
let residentDialogue:ResidentDialogue|undefined;
let conversationHeartbeat:ReturnType<typeof setInterval>|undefined;
let conversationCamera:{yaw:number;pitch:number;pokoYaw?:number}|null=null;
let residentTestTime:number|undefined;
const residentNow=()=>residentTestTime??roomClient.serverNow;
let camera:CameraController|undefined;
let players:PlayerManager|undefined;
let input:DualTouchController|undefined;
let blaster:BlasterEffects|undefined;
let practice:PracticeDummies|undefined;
let sharedFoes:SharedFoes|undefined;
let mirror:StudioMirror|undefined;
let floaters:FloatingDamage|undefined;
let fpsStage:PlayCanvasStage|undefined;
let stageQaFov:number|null=null;
let guide:WorldGuide|undefined;
let guideLast=0;
let weaponViewmodel:WeaponViewmodel|undefined;
let touchBridge:FpsTouchBridge|undefined;
let quickArcade:QuickArcade|undefined;
let avatarStudio:AvatarStudio|undefined;
let hudEditor:HudLayoutEditor|undefined;
let currentHp=MAX_HP;
let lastShotAt=0;
let aiming=false;
let aimLocked=false,smartAimFiring=false,keyboardAim=false;
let hitReadoutUntil=0;
let aimFov=76;
let fireHeld:ReturnType<typeof setInterval>|null=null;
let firePointerId:number|null=null,aimPointerId:number|null=null;
let aimStartedLocked=false,aimStartTime=0,aimDragDistance=0;
const fireGesture=new FireLookGesture();
const aimGesture=new FireLookGesture();
function refreshAimMode():void{
  aiming=Boolean(world)&&(aimLocked||aimPointerId!==null||smartAimFiring||keyboardAim)
    &&canBlasterFire(weaponUnlocked)
    &&state.playing&&!state.paused;
  aimButton.classList.toggle("aiming",aiming);
  crosshair.classList.toggle("aiming",aiming);
}
function setAimMode(enabled:boolean):void{
  if(!enabled){
    aimLocked=false;smartAimFiring=false;aimPointerId=null;aimGesture.reset();
  }else aimLocked=true;
  refreshAimMode();
}
function beginAimDrag(id:number,x:number,y:number):void{
  if(aimPointerId!==null||!state.playing||state.paused)return;
  aimPointerId=id;aimGesture.begin(id,x,y);
  aimStartedLocked=aimLocked;aimStartTime=performance.now();aimDragDistance=0;
  refreshAimMode();
}
function applyAimDrag(dx:number,dy:number):void{
  if(!camera||!state.playing||state.paused)return;
  aimDragDistance+=Math.hypot(dx,dy);
  camera.drag(Math.max(-65,Math.min(65,dx)),Math.max(-65,Math.min(65,dy)),settings.sensitivity*.56);
}
function endAimDrag(id:number,cancelled=false):void{
  if(aimPointerId!==id)return;
  const tapped=!cancelled&&aimDragDistance<12&&performance.now()-aimStartTime<270;
  aimPointerId=null;aimGesture.reset();
  aimLocked=tapped?!aimStartedLocked:aimStartedLocked;
  refreshAimMode();
}
function unlockAudio():void{blasterAudio.unlock()}
function showHit(text:string):void{
  hitReadout.textContent=text;
  hitReadout.classList.remove("hidden");
  hitReadoutUntil=performance.now()+700;
}
function releasePointerLock():void{
  if(document.pointerLockElement)document.exitPointerLock?.();
}
function desktopLookLocked():boolean{
  return document.pointerLockElement===canvas;
}
function stopFiring():void{
  if(fireHeld!==null){clearInterval(fireHeld);fireHeld=null;}
  fireGesture.reset();firePointerId=null;
  smartAimFiring=false;refreshAimMode();
}
function lookWhileFiring(e:PointerEvent):void{
  if(e.pointerId!==firePointerId||e.pointerType==="mouse"||!camera||!state.playing||state.paused)return;
  const delta=fireGesture.move(e.pointerId,e.clientX,e.clientY);
  if(delta&&(delta.dx||delta.dy))
    camera.drag(delta.dx,delta.dy,settings.sensitivity*(aiming?.56:1));
  e.preventDefault();
}
function startFiring():void{
  if(!state.playing||state.paused||!canBlasterFire(weaponUnlocked))return;
  // One-thumb FIRE+ADS+LOOK is optional, and does not affect server shot cooldown.
  smartAimFiring=smartAimEnabled;refreshAimMode();
  // Do not reset the just-acquired FIRE pointer when restarting auto-fire.
  if(fireHeld!==null){clearInterval(fireHeld);fireHeld=null;}
  fireBlaster();
  fireHeld=setInterval(()=>{if(state.playing&&!state.paused)fireBlaster();else stopFiring()},425);
}
let weaponUnlocked=true,weaponWanted=false,wingWanted=false,speedBoost=false,wingsOn=false;
let logoTaps=0,lastLogoTapAt=0,lastCorrectionToast=0;
try{weaponWanted=sessionStorage.getItem("game-room-weapon-easteregg")==="1"}catch{}
try{wingWanted=sessionStorage.getItem("game-room-wing-easteregg")==="1"}catch{}
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
function applyWings(on:boolean):void{
  wingsOn=on;
  if(player)player.allowDoubleJump=on;
}
function unlockSecret():void{
  const code=secretCode.value.trim().toUpperCase();
  if(code!==WEAPON_CODE&&code!==WING_CODE){
    secretError.textContent="そのコードでは解放できません";return;
  }
  if(roomClient.online){
    if(!roomClient.unlockWeapon(code)){secretError.textContent="通信できません。もう一度お試しください";return;}
    secretError.textContent="サーバーに照会しています…";
    return;
  }
  if(code===WEAPON_CODE){
    speedBoost=true;weaponWanted=true;
    try{sessionStorage.setItem("game-room-weapon-easteregg","1")}catch{}
  }else{
    wingWanted=true;applyWings(true);
    try{sessionStorage.setItem("game-room-wing-easteregg","1")}catch{}
  }
  closeSecret();syncWeaponInfo();showToast("解放されました");
}
function syncWeaponInfo():void{
  const extras=[speedBoost?"高速":"",wingsOn?"翼":""].filter(Boolean);
  weaponInfo.textContent="ブラスター初期装備"+(extras.length?" · "+extras.join(" · "):"");
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
  if(currentHp===0)residentDialogue?.close();
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
  if(!canBlasterFire(weaponUnlocked))return;
  if(currentHp<=0)return;
  const now=performance.now();if(now-lastShotAt<410)return;
  lastShotAt=now;
  const origin={...player.position};
  const shotYaw=camera.yaw,shotPitch=camera.pitch;
  unlockAudio();
  blasterAudio.shot();
  weaponViewmodel?.fire();
  let impact:{x:number;y:number;z:number}|null=null;
  const practiceHit=practice?.shoot(origin,shotYaw,shotPitch);
  if(practiceHit){
    impact=practiceHit.point;
    crosshair.classList.add("hit-confirmed");
    window.setTimeout(()=>crosshair.classList.remove("hit-confirmed"),160);
    showHit(practiceHit.head?"HEAD "+practiceHit.damage:"HIT "+practiceHit.damage);
    floaters?.spawn(practiceHit.point,String(practiceHit.damage),settings.reducedMotion);
  }else if(!roomClient.online){
    const foeHit=sharedFoes?.shoot(origin,shotYaw,shotPitch);
    if(foeHit){
      impact=foeHit.point;
      crosshair.classList.add("hit-confirmed");
      window.setTimeout(()=>crosshair.classList.remove("hit-confirmed"),160);
      showHit("HIT "+foeHit.damage);
      floaters?.spawn(foeHit.point,String(foeHit.damage),settings.reducedMotion);
    }
  }
  blaster.shoot(origin,shotYaw,shotPitch,impact);
  camera.kickRecoil(aiming);
  crosshair.animate([
    {transform:"translate(-50%, -50%) scale(1.5)"},
    {transform:"translate(-50%, -50%) scale(1)"}
  ],{duration:145,easing:"ease-out"});
  if(shouldSendPvpShot(roomClient.online) && !roomClient.shoot(shotYaw,shotPitch,origin))
    showToast("発射通信に失敗しました");
}
const clock=new THREE.Clock();
const zoneIndicator=byId("zone-indicator");
let lastOutdoorZone=false;
const roomClient=new RealtimeRoomClient({
  onResidentState:motion=>{if(resident)resident.motion={...motion};},
  onResidentDialogue:id=>openResidentDialogue(id),
  onFoes:foes=>{
    const drops=sharedFoes?.applyServer(foes)??[];
    for(const drop of drops)floaters?.spawn(drop.point,String(drop.damage),settings.reducedMotion);
  },
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
  onAvatar:(id,avatar)=>{players?.setAvatar(id,avatar);},
  onEmote:(id,kind,durationMs)=>{
    if(id===roomClient.playerId)return;
    players?.playEmote(id,kind,durationMs);
  },
  onOthello:match=>setOthelloMatch(match),
  onSpawn:position=>{
    player?.teleport(position.x,position.y,position.z);
    if(player&&camera)camera.update(player.position);
    setHealth(MAX_HP);
    speedBoost=false;applyWings(false);syncWeaponInfo();
    if(weaponWanted)roomClient.unlockWeapon(WEAPON_CODE);
    if(wingWanted)window.setTimeout(()=>{if(roomClient.online)roomClient.unlockWeapon(WING_CODE);},1700);
    // Player appearance is session-only on the Worker. Re-send saved local
    // preferences after *every* join/reconnect, no account required.
    if(avatarStudio)roomClient.setAvatar(avatarStudio.selected);
  },
  onCorrection:position=>{
    player?.teleport(position.x,position.y,position.z);
    if(player&&camera)camera.update(player.position);
    const now=performance.now();
    if(now-lastCorrectionToast>5000){
      lastCorrectionToast=now;showToast("位置の同期を調整しました");
    }
  },
  onWeaponState:(unlocked,_serverPeace,boosted,wings)=>{
    const changed=(boosted&&!speedBoost)||(wings&&!wingsOn);
    weaponUnlocked=unlocked;speedBoost=boosted;applyWings(wings);
    if(boosted){weaponWanted=true;try{sessionStorage.setItem("game-room-weapon-easteregg","1")}catch{}}
    if(wings){wingWanted=true;try{sessionStorage.setItem("game-room-wing-easteregg","1")}catch{}}
    syncWeaponInfo();refreshAimMode();
    if(changed){closeSecret();showToast("解放されました");}
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
    const prev=hpByPlayer.get(id);
    hpByPlayer.set(id,hp);
    if(id===roomClient.playerId){setHealth(hp);return;}
    players?.setHp(id,hp);
    if(prev!==undefined&&hp<prev){
      const remote=players?.getRemote(id);
      if(remote)floaters?.spawn({x:remote.position.x,y:remote.position.y+.35,z:remote.position.z},String(prev-hp),settings.reducedMotion);
    }
  },
  onFire:(shooterId,position,yaw,pitch)=>{
    if(shooterId!==roomClient.playerId){
      blasterAudio.shot();
      blaster?.shoot(position,yaw,pitch);
    }
  },
  onFireResult:(hit,damage)=>{
    if(hit){
      crosshair.classList.add("hit-confirmed");
      crosshair.animate([
        {transform:"translate(-50%, -50%) scale(1.8)",opacity:1},
        {transform:"translate(-50%, -50%) scale(1)",opacity:.7}
      ],{duration:210,easing:"ease-out"});
      window.setTimeout(()=>crosshair.classList.remove("hit-confirmed"),280);
      showHit("HIT "+damage);
    }
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
  weaponUnlocked=true;speedBoost=weaponWanted;applyWings(wingWanted);syncWeaponInfo();
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
  guide?.show(true);avatarStudio?.showQuick(true);
  startScreen.classList.add("dismissed");
  menu.classList.add("hidden");
  hud.classList.remove("hidden");
  tips.classList.remove("fading");
  window.setTimeout(()=>tips.classList.add("fading"),6900);
}
function openWorldMap():void{
  if(!guide||!player||!state.playing)return;
  state.paused=true;
  touchBridge?.reset();stopFiring();setAimMode(false);
  input?.reset();if(input)input.enabled=false;
  player.stop();
  menu.classList.add("hidden");
  guide.open(()=>{
    state.paused=false;
    input?.reset();if(input)input.enabled=state.playing;
  },player.position);
}
function openAvatarStudio():void{
  if(!avatarStudio||!state.playing)return;
  touchBridge?.reset();stopFiring();setAimMode(false);
  state.paused=true;
  input?.reset();if(input)input.enabled=false;
  player?.stop();menu.classList.add("hidden");
  avatarStudio.open(safeDisplayName(roomName.value),()=>{
    state.paused=false;
    input?.reset();if(input)input.enabled=state.playing;
  });
}
function performEmote(kind:EmoteKind):void{
  if(!state.playing||state.paused||!validEmote(kind))return;
  const online=roomClient.online;
  if(online&&!roomClient.emote(kind)){
    showToast("エモートを送れませんでした");return;
  }
  // First-person player sees a confirmation; all remote players see
  // animated arms/head, without extra per-frame WebSocket packets.
  showToast((online?"みんなに表示 ✦ ":"エモート ✦ ")+AVATAR_EMOTE_LABELS[kind]);
}
function openHudEditor():void{
  if(!hudEditor)return;
  // Release every gameplay touch before making HUD elements draggable.
  touchBridge?.reset();stopFiring();setAimMode(false);
  state.paused=true;
  input?.reset();if(input)input.enabled=false;
  player?.stop();menu.classList.add("hidden");
  hudEditor.open(()=>{
    // Return to the existing pause menu, never straight into held-fire gameplay.
    state.paused=true;menu.classList.remove("hidden");
  });
}
function openMenu():void{
  if(residentDialogue?.opened){residentDialogue.close();return;}
  touchBridge?.reset();stopFiring();setAimMode(false);
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
function openQuickGame(kind:"target"|"tic"):void{
  if(!state.playing)return;
  if(kind==="tic"&&state.editingMiniGames)closeMiniGames();
  quickArcade?.open(kind);
}
function backToTitle():void{
  residentDialogue?.close();
  avatarStudio?.close();avatarStudio?.showQuick(false);
  guide?.show(false);guide?.close();
  quickArcade?.dismiss();
  touchBridge?.reset();stopFiring();setAimMode(false);
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
function talkToResident(id:ResidentId):void{
  if(!state.playing||state.paused||!player||currentHp<=0)return;
  if(roomClient.online){roomClient.talkToResident(id);return;}
  if(id==='tokotoko')resident?.hold(residentNow(),player.position);
  openResidentDialogue(id);
}
function openResidentDialogue(id:ResidentId):void{
  if(!state.playing||currentHp<=0||residentDialogue?.opened)return;
  touchBridge?.reset();stopFiring();setAimMode(false);input?.reset();if(input)input.enabled=false;
  player?.stop();state.paused=true;interaction.classList.add('hidden');
  if(camera&&player){
    conversationCamera={yaw:camera.yaw,pitch:camera.pitch,...(id==='poko'&&poko?{pokoYaw:poko.root.rotation.y}:{})};
    const root=id==='poko'?poko?.root:resident?.root;
    if(root){
      root.rotation.y=Math.atan2(player.position.x-root.position.x,player.position.z-root.position.z);
      root.updateMatrixWorld(true);
      const focus=new THREE.Vector3(root.position.x,1,root.position.z),eyes=new THREE.Box3();
      for(const name of ['EyeLeft','EyeRight']){const eye=root.getObjectByName(name);if(eye)eyes.expandByObject(eye);}
      if(!eyes.isEmpty())eyes.getCenter(focus);
      const dx=focus.x-player.position.x,dz=focus.z-player.position.z;
      camera.yaw=Math.atan2(-dx,-dz);camera.pitch=Math.atan2(focus.y-player.position.y,Math.max(.1,Math.hypot(dx,dz)));
      if(world){aimFov=window.innerWidth<window.innerHeight?100:71;world.camera.fov=aimFov;world.camera.updateProjectionMatrix();}
      camera.update(player.position);
    }
  }
  residentDialogue?.open(id);
  clearInterval(conversationHeartbeat);
  if(id==='tokotoko')conversationHeartbeat=setInterval(()=>{
    if(!residentDialogue?.opened||!player)return;
    if(roomClient.online)roomClient.talkToResident(id,true);
    else resident?.hold(residentNow(),player.position,true);
  },6000);
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
  const actionLabel=nearby.label.includes("話しかける")?"話す":"あそぶ";
  if(interactButton.textContent!==actionLabel)interactButton.textContent=actionLabel;
  interactButton.setAttribute("aria-label",nearby.label);
  interaction.classList.remove("hidden");
}
function update(dt:number):void{
  if(!world||!player||!camera||!input||!players)return;
  state.time+=dt;
  resident?.update(player.position,dt,residentNow(),state.playing,settings.reducedMotion);
  poko?.update(player.position,dt,state.playing&&!state.paused,settings.reducedMotion);
  if(state.playing&&!state.paused){
    const bob=currentHp>0?player.update(dt,input.getMovement(),camera.yaw,settings.reducedMotion,speedBoost?6:1):0;
    camera.update(player.position,bob);
    const inOutdoor=!insideHouse(player.position.x,player.position.z);
    if(inOutdoor!==lastOutdoorZone){
      lastOutdoorZone=inOutdoor;
      showToast(inOutdoor?"🌿 THE DOOR — ようこそ月夜の世界へ！":"🏠 パーティールームにおかえり！");
    }
    const nextZone=inFpsStage(player.position.x,player.position.z)?"FPS MAP":
      inArena(player.position)?"NEON ARENA":
      inOutdoor?
      (player.position.x>45&&player.position.z< -14?"STARLIT POND":player.position.x>75?"MOONLIT FOREST":"MOONLIT PLAZA") :
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
    const armed=canBlasterFire(weaponUnlocked);
    combatHud.classList.remove("hidden");
    shootButton.classList.toggle("hidden",!armed);
    aimButton.classList.toggle("hidden",!armed);
    crosshair.classList.toggle("armed",armed);
    const foeAim=armed?sharedFoes?.aim(player.position,camera.yaw,camera.pitch)??null:null;
    const candidate=armed?findHitscanTarget(
      {id:roomClient.playerId||"local",hp:currentHp,position:player.position},
      players.getRemoteSnapshots().map(p=>({id:p.id,position:p.position,hp:hpByPlayer.get(p.id)??100})),
      camera.yaw,camera.pitch,shotObstructed
    ):null;
    const foeCloser=Boolean(foeAim&&(!candidate||foeAim.distance<=(candidate.distance??Infinity)));
    crosshair.classList.toggle("targeted",foeCloser||Boolean(candidate));
    if(armed&&currentHp>0){
      const foe=foeCloser&&foeAim?sharedFoes?.foe(foeAim.id):undefined;
      const note=foe?"TARGET · HP "+foe.hp:
        candidate?"TARGET LOCK · HP "+(hpByPlayer.get(candidate.id)??100):
        "FIREでブラスター発射";
      if(combatNote.textContent!==note)combatNote.textContent=note;
    }
    updateInteraction();
    roomClient.tick(performance.now(),{
      position:{...player.position},yaw:camera.yaw,pitch:camera.pitch
    });
  }
  // Smooth ADS interpolates FOV instead of popping into a simple zoom.
  const desiredFov=residentDialogue?.opened?(window.innerWidth<window.innerHeight?100:71):stageQaFov??(aiming?54:window.innerWidth<window.innerHeight?76:71);
  aimFov+=(desiredFov-aimFov)*Math.min(1,dt*14);
  if(Math.abs(world.camera.fov-aimFov)>.04){
    world.camera.fov=aimFov;world.camera.updateProjectionMatrix();
  }
  weaponViewmodel?.setVisible(state.playing&&!state.paused&&canBlasterFire(weaponUnlocked)&&currentHp>0);
  weaponViewmodel?.update(dt,aiming);
  if(player)fpsStage?.update(player.position);
  if(player)practice?.update(dt,player.position);
  if(player)sharedFoes?.update(world.camera,player.position);
  floaters?.update(dt);
  if(hitReadoutUntil&&performance.now()>hitReadoutUntil){
    hitReadoutUntil=0;hitReadout.classList.add("hidden");
  }
  if(state.paused&&desktopLookLocked()){releasePointerLock();stopFiring();}
  if(state.playing&&player&&camera){
    const stamp=performance.now();
    if(stamp-guideLast>200){
      guideLast=stamp;
      guide?.tick(player.position,camera.yaw,stamp);
    }
  }
  world.update(dt,state.time,settings.reducedMotion);
  blaster?.update(dt);
  players.update(dt,world.camera);
  if(player&&camera)players.syncLocal(player.position,camera.yaw,avatarStudio?.selected??DEFAULT_AVATAR,wingsOn);
  mirror?.render(world.renderer,world.scene,world.camera);
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
  byId("start-button").addEventListener("click",()=>{unlockAudio();start();});
  window.addEventListener("pointerdown",unlockAudio,{capture:true,passive:true});
  window.addEventListener("touchstart",unlockAudio,{capture:true,passive:true});
  // Logo shortcut is optional: the real in-world ARMORY ATM is the main path.
  secretTrigger.addEventListener("click",()=>{
    const now=performance.now();
    logoTaps=now-lastLogoTapAt<2400?logoTaps+1:1;lastLogoTapAt=now;
    if(logoTaps>=5){logoTaps=0;openSecret()}
  });
  byId("secret-close").addEventListener("click",closeSecret);
  byId("secret-unlock").addEventListener("click",unlockSecret);
  secretCode.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();unlockSecret()}});
  othelloAction.addEventListener("click",othelloPrimaryAction);
  othelloPause.addEventListener("click",toggleOthelloPause);
  othelloReset.addEventListener("click",endOthello);
  byId("minigames-close").addEventListener("click",closeMiniGames);
  byId("minigames-return").addEventListener("click",closeMiniGames);
  byId("open-minigames").addEventListener("click",openMiniGames);
  byId("open-world-map").addEventListener("click",openWorldMap);
  byId("open-avatar-studio").addEventListener("click",openAvatarStudio);
  byId("open-hud-editor").addEventListener("click",openHudEditor);
  canvas.addEventListener("pointerdown",()=>avatarStudio?.hideEmotes());
  byId("tic-tac-toe-open").addEventListener("click",()=>openQuickGame("tic"));
  byId("close-sign").addEventListener("click",closeSign);
  byId("save-sign").addEventListener("click",saveSign);
  signText.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();saveSign()}});
  shootButton.addEventListener("pointerdown",e=>{
    e.preventDefault();e.stopPropagation();
    if(!fireGesture.begin(e.pointerId,e.clientX,e.clientY))return;
    firePointerId=e.pointerId;
    try{shootButton.setPointerCapture(e.pointerId)}catch{}
    startFiring();
  },{passive:false});
  // Holding FIRE should not freeze the aim. The same firing thumb can drag
  // the reticle, while a different finger can look on the right half of canvas.
  shootButton.addEventListener("pointermove",e=>{
    if(e.pointerType==="touch"&&touchBridge?.firingNative)return;
    lookWhileFiring(e);
  },{passive:false});
  for(const event of ["pointerup","pointercancel","lostpointercapture"]){
    shootButton.addEventListener(event,e=>{
      const pe=e as PointerEvent;
      if(pe.pointerType==="touch"&&touchBridge?.firingNative)return;
      if(firePointerId===pe.pointerId){fireGesture.end(firePointerId);firePointerId=null;stopFiring();}
    });
  }
  shootButton.addEventListener("click",e=>{
    if(e.detail===0)fireBlaster(); // keyboard accessibility
  });
  // ADS supports drag-to-look, tap-to-lock, and existing hold-to-aim.
  aimButton.addEventListener("pointerdown",e=>{
    if(e.pointerType==="touch"&&touchBridge?.aimingNative)return;
    e.preventDefault();e.stopPropagation();
    beginAimDrag(e.pointerId,e.clientX,e.clientY);
    if(aimPointerId===e.pointerId){try{aimButton.setPointerCapture(e.pointerId)}catch{}}
  },{passive:false});
  aimButton.addEventListener("pointermove",e=>{
    if(e.pointerType==="touch"&&touchBridge?.aimingNative)return;
    if(e.pointerId!==aimPointerId||e.pointerType==="mouse")return;
    const delta=aimGesture.move(e.pointerId,e.clientX,e.clientY);
    if(delta){applyAimDrag(delta.dx,delta.dy);e.preventDefault()}
  },{passive:false});
  for(const event of ["pointerup","pointercancel","lostpointercapture"]){
    aimButton.addEventListener(event,e=>{
      const pe=e as PointerEvent;
      if(pe.pointerType==="touch"&&touchBridge?.aimingNative)return;
      endAimDrag(pe.pointerId,event!=="pointerup");
    });
  }
  aimButton.addEventListener("click",e=>{
    if(e.detail===0){aimLocked=!aimLocked;refreshAimMode();}
  });
  const releaseWeaponPointer=(e:PointerEvent)=>{
    // Lifting the LEFT movement thumb must not cancel RIGHT-thumb FIRE/ADS.
    if(e.pointerId===firePointerId&&!(e.pointerType==="touch"&&touchBridge?.firingNative)){
      fireGesture.end(e.pointerId);firePointerId=null;stopFiring();}
    if(e.pointerId===aimPointerId)endAimDrag(e.pointerId,true);
  };
  window.addEventListener("pointerup",releaseWeaponPointer);
  window.addEventListener("pointercancel",releaseWeaponPointer);
  window.addEventListener("blur",()=>{stopFiring();setAimMode(false);});
  canvas.addEventListener("pointerdown",e=>{
    // Touch and pen stay on the joystick / FIRE / ADS paths. Pointer lock is
    // mouse-only so iOS Safari multi-touch is never asked to capture the cursor.
    if(e.pointerType!=="mouse")return;
    if(e.button===0){
      if(desktopLookLocked()){
        if(fireGesture.begin(e.pointerId,e.clientX,e.clientY)){firePointerId=e.pointerId;startFiring();}
      }else if(state.playing&&!state.paused){
        canvas.requestPointerLock?.();
      }
    }
    if(e.button===2&&desktopLookLocked()){beginAimDrag(e.pointerId,e.clientX,e.clientY);aimStartTime=-Infinity;}
  });
  canvas.addEventListener("pointermove",e=>{
    if(e.pointerType!=="mouse"||!desktopLookLocked()||!camera||!state.playing||state.paused)return;
    if(!e.movementX&&!e.movementY)return;
    camera.drag(e.movementX,e.movementY,settings.sensitivity*(aiming?.56:1));
  });
  document.addEventListener("pointerlockchange",()=>{
    if(!desktopLookLocked())stopFiring();
  });
  canvas.addEventListener("pointerup",e=>{
    if(e.pointerType==="mouse")releaseWeaponPointer(e);
  });
  window.addEventListener("keydown",e=>{
    if(document.activeElement instanceof HTMLInputElement)return;
    if(e.code==="KeyF"&&!e.repeat&&!state.editingSign&&!state.editingSecret)
      fireBlaster();
    if(e.code==="KeyQ"&&!e.repeat&&state.playing&&!state.paused){keyboardAim=true;refreshAimMode();}
  });
  window.addEventListener("keyup",e=>{
    if(e.code==="KeyQ"){keyboardAim=false;refreshAimMode();}
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
  const smartAds=byId<HTMLInputElement>("one-thumb-ads");
  smartAds.checked=smartAimEnabled;
  smartAds.addEventListener("change",()=>{
    smartAimEnabled=smartAds.checked;
    smartAimFiring=smartAimEnabled&&fireHeld!==null;
    refreshAimMode();
    try{localStorage.setItem(SMART_ADS_KEY,smartAimEnabled?"on":"off")}catch{}
  });
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
  const shotSound=byId<HTMLInputElement>("shot-sound");
  shotSound.checked=blasterAudio.enabled;
  shotSound.addEventListener("change",()=>{
    blasterAudio.enabled=shotSound.checked;
    if(shotSound.checked)unlockAudio();
    try{localStorage.setItem(SHOT_SOUND_KEY,blasterAudio.enabled?"on":"off")}catch{}
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
  },openSign,openSecret,openMiniGames,()=>openQuickGame("target"));
  blaster=new BlasterEffects(world.scene);
  practice=new PracticeDummies(world.scene);
  sharedFoes=new SharedFoes(world.scene);
  mirror=new StudioMirror(world.scene,world.quality.scale);
  floaters=new FloatingDamage(world.scene);
  weaponViewmodel=new WeaponViewmodel(world.camera,world.scene);
  poko=new PokoWelcome(world.scene);
  resident=new TokotokoResident(world.scene);
  residentDialogue=new ResidentDialogue(()=>{
    if(conversationCamera&&camera&&player){camera.yaw=conversationCamera.yaw;camera.pitch=conversationCamera.pitch;camera.update(player.position);}
    if(conversationCamera?.pokoYaw!==undefined&&poko)poko.root.rotation.y=conversationCamera.pokoYaw;
    conversationCamera=null;
    clearInterval(conversationHeartbeat);state.paused=false;input?.reset();if(input)input.enabled=state.playing;
  });
  const residentTarget={x:0,z:0,label:'TOKOTOKOに話しかける',action:()=>talkToResident('tokotoko'),
    enabled:()=>Boolean(resident?.talkable&&player&&canTalkToResident('tokotoko',player.position,residentNow(),resident.motion)&&!shotObstructed(player.position,{x:resident.root.position.x,y:1,z:resident.root.position.z}))};
  Object.defineProperties(residentTarget,{x:{get:()=>resident?.root.position.x??0},z:{get:()=>resident?.root.position.z??0}});
  world.targets.push(residentTarget,{x:POKO_ANCHOR.x,z:POKO_ANCHOR.z,label:'POKOに話しかける',action:()=>talkToResident('poko'),
    enabled:()=>Boolean(poko?.talkable&&player&&canTalkToResident('poko',player.position,residentNow())&&!shotObstructed(player.position,{x:POKO_ANCHOR.x,y:1,z:POKO_ANCHOR.z}))});
  fpsStage=new PlayCanvasStage(world.scene,showToast);
  world.targets.push({x:101.7,z:-5,label:'FPS ORIGINAL MAP — 読込 / 再試行',action:()=>{void fpsStage?.load();}});
  guide=new WorldGuide();
  hudEditor=new HudLayoutEditor();
  hudEditor.applySaved();
  avatarStudio=new AvatarStudio(avatar=>{
    if(roomClient.online){
      if(!roomClient.setAvatar(avatar))showToast("アバター同期に失敗しました");
      else showToast("アバターを更新しました ✦");
    }else showToast("アバターを保存しました ✦");
  },performEmote);
  setOthelloMatch(currentMatch);
  player=new PlayerController(world.colliders,(x,z,radius,eye)=>{
    if(worldBlocked(x,z,radius,eye))return true;
    return Boolean(player&&residentStepBlocked(player.position,{x,y:eye??player.position.y,z},radius,residentNow(),resident?.motion??EMPTY_MOTION));
  },
    (x,z)=>{
      const ceiling=player?player.position.y-1.65+.35:.35;
      return Math.max(walkableHeightAt(x,z,ceiling),residentHeightAt(x,z,ceiling,residentNow(),resident?.motion??EMPTY_MOTION));
    },stageShotObstructed);
  if((location.hostname==='localhost'||location.hostname==='127.0.0.1')&&new URLSearchParams(location.search).has('stageVisualTest')){
    Object.assign(window,{__FPS_STAGE_QA__:{load:()=>fpsStage?.load(),status:()=>fpsStage?.status,
      sourceMeshes:295,materials:()=>{let n=0;fpsStage?.root.traverse(o=>{if(o instanceof THREE.Mesh)n++;});return n;},
      pose:(x:number,y:number,z:number,yaw=0,pitch=0)=>{
        player?.teleport(x,y,z);
        if(camera){camera.yaw=yaw;camera.pitch=pitch;if(player)camera.update(player.position);}
      },
      advance:(seconds:number)=>{
        if(!player||!camera||!input||!state.playing||state.paused)return;
        for(let i=0;i<Math.ceil(Math.min(5,seconds)*60);i++)player.update(1/60,input.getMovement(),camera.yaw,true,speedBoost?6:1);
        camera.update(player.position);
      },
      position:()=>({...player?.position})}});
    Object.assign((window as unknown as {__FPS_STAGE_QA__:object}).__FPS_STAGE_QA__,{
      fov:(value:number)=>{stageQaFov=value;aimFov=value;if(world){world.camera.fov=value;world.camera.updateProjectionMatrix();}},
      mapImage:()=>{
        if(!world)return '';
        const mapCamera=new THREE.OrthographicCamera(-16,16,30,-30,.1,200);
        mapCamera.position.set(132,80,0);mapCamera.up.set(0,0,-1);mapCamera.lookAt(132,0,0);
        const mapScene=new THREE.Scene();mapScene.background=new THREE.Color(0xe5e8ed);
        const clone=fpsStage?.root.clone(true);
        const previewMaterials:THREE.Material[]=[];
        clone?.traverse(obj=>{obj.visible=true;if(obj instanceof THREE.Mesh){
          const materials=Array.isArray(obj.material)?obj.material:[obj.material];
          const flat=materials.map(m=>{
            const source=m as THREE.MeshStandardMaterial;
            const material=new THREE.MeshBasicMaterial({color:source.color??0xffffff,side:THREE.DoubleSide,toneMapped:false});
            previewMaterials.push(material);return material;
          });obj.material=Array.isArray(obj.material)?flat:flat[0];
        }});
        if(clone)mapScene.add(clone);
        world.renderer.setPixelRatio(1);world.renderer.setSize(640,1200,false);
        world.renderer.render(mapScene,mapCamera);
        const result=world.renderer.domElement.toDataURL('image/png');
        for(const m of previewMaterials)m.dispose();world.resize();return result;
      }
    });
  }
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
    onMenu:()=>residentDialogue?.opened?residentDialogue.close():state.editingMiniGames?closeMiniGames():state.paused?closeMenu():openMenu(),
    onInteract:doInteraction
  });
  touchBridge=new FpsTouchBridge(shootButton,canvas,{
    canPlay:()=>state.playing&&!state.paused&&canBlasterFire(weaponUnlocked)&&currentHp>0,
    fireStart:()=>{if(fireHeld===null)startFiring();},
    fireStop:()=>stopFiring(),
    aimStart:()=>beginAimDrag(-1,0,0),
    aimLook:(dx,dy)=>{if(aimPointerId===-1)applyAimDrag(dx,dy);},
    aimStop:(cancelled)=>endAimDrag(-1,cancelled),
    fireLook:(dx,dy)=>{
      if(state.playing&&!state.paused)
        camera?.drag(dx,dy,settings.sensitivity*(aiming?.56:1));
    },
    freeLook:(dx,dy)=>{
      if(state.playing&&!state.paused)
        camera?.drag(dx,dy,settings.sensitivity*(aiming?.56:1));
    },
    nativeLook:active=>input?.setNativeLook(active)
  });
  touchBridge.bindAimButton(aimButton);
  quickArcade=new QuickArcade({
    onOpen:()=>{
      stopFiring();setAimMode(false);state.paused=true;
      player?.stop();input?.reset();if(input)input.enabled=false;
      menu.classList.add("hidden");
    },
    onClose:()=>{
      state.paused=false;input?.reset();if(input)input.enabled=state.playing;
    }
  });
  input.enabled=false;
  weaponUnlocked=true;speedBoost=weaponWanted;applyWings(wingWanted);syncWeaponInfo();
  window.addEventListener("resize",()=>world?.resize());
  registerUi();
  camera.update(player.position);
  if((location.hostname==="127.0.0.1"||location.hostname==="localhost")&&new URLSearchParams(location.search).has("forestVisualTest")){
    const qaPlayer=player,qaCamera=camera,qaWorld=world,qaPoko=poko;
    Object.assign(window,{__FOREST_QA__:{
      pose:(x:number,z:number,yaw=-Math.PI/2,pitch=0)=>{
        qaPlayer.teleport(x,groundHeightAt(x,z)+1.65,z);qaCamera.yaw=yaw;qaCamera.pitch=pitch;qaCamera.update(qaPlayer.position);
      },
      load:()=>qaPoko?.load(),status:()=>qaPoko?.status,appearances:()=>qaPoko?.appearances,
      targetLabels:()=>qaWorld.targets.map(t=>t.label),
      clips:()=>qaPoko?.clips,characterY:()=>qaPoko?.root.getObjectByName('Character')?.position.y,
      characterPose:()=>qaPoko?.root.position.toArray(),
      advance:(seconds:number)=>{for(let i=0;i<Math.ceil(seconds*60);i++)qaPoko?.update(qaPlayer.position,1/60,true,settings.reducedMotion);},
      position:()=>({...qaPlayer.position}),
      screenBounds:()=>{
        if(!qaPoko)return null;
        qaWorld.scene.updateMatrixWorld(true);qaWorld.camera.updateMatrixWorld(true);
        const box=new THREE.Box3().setFromObject(qaPoko.root),points:THREE.Vector3[]=[];
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])
          points.push(new THREE.Vector3(x,y,z).project(qaWorld.camera));
        return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
      }
    }});
  }
  if((location.hostname==='127.0.0.1'||location.hostname==='localhost')&&new URLSearchParams(location.search).has('residentVisualTest')){
    const qaWorld=world,qaPlayer=player,qaCamera=camera,qaResident=resident;
    residentTestTime=1000;
    Object.assign(window,{__RESIDENT_QA__:{
      load:()=>Promise.all([qaResident?.load(),poko?.load()]),
      pose:(x:number,z:number,yaw=0,pitch=0)=>{
        qaPlayer.teleport(x,groundHeightAt(x,z)+1.65,z);qaCamera.yaw=yaw;qaCamera.pitch=pitch;qaCamera.update(qaPlayer.position);
        // Teleports skip the door sample. Record it immediately so POKO still
        // sees an exit instead of waiting for a rendered frame that may land
        // after the next pose.
        poko?.update(qaPlayer.position,1/60,state.playing&&!state.paused,settings.reducedMotion);
      },
      time:(ms:number,reset=false)=>{residentTestTime=ms;if(reset&&qaResident)qaResident.motion={...EMPTY_MOTION};qaResident?.update(qaPlayer.position,1/60,ms,true,settings.reducedMotion);},
      walk:(seconds:number,input:{x:number;y:number},yaw:number)=>{for(let i=0;i<Math.ceil(seconds*120);i++)qaPlayer.update(1/120,input,yaw,true);qaCamera.update(qaPlayer.position);},
      jump:()=>qaPlayer.jump(),interact:doInteraction,
      data:()=>({status:qaResident?.status,position:qaResident?.root.position.toArray(),moving:qaResident?.isWalking,
        player:{...qaPlayer.position},motion:qaResident?.motion,dialogue:residentDialogue?.opened,poko:poko?.status,
        inputEnabled:input?.enabled,paused:state.paused,camera:{yaw:qaCamera.yaw,pitch:qaCamera.pitch}}),
      eyePositions:()=>{
        qaWorld.scene.updateMatrixWorld(true);qaWorld.camera.updateMatrixWorld(true);
        return ['EyeLeft','EyeRight'].map(name=>{
          const eye=qaResident?.root.getObjectByName(name);if(!eye)return null;
          return new THREE.Box3().setFromObject(eye).getCenter(new THREE.Vector3()).project(qaWorld.camera).toArray();
        });
      },
      talk:talkToResident
    }});
  }
  // LOCALHOST ONLY: screenshot-test the physical cave / secret path / hilltop.
  // Never expose teleports or debug switches to the published multiplayer app.
  if((location.hostname==="127.0.0.1"||location.hostname==="localhost")){
    const key=new URLSearchParams(location.search).get("exploreVisualTest");
    const poses:Record<string,{x:number;z:number;yaw:number;pitch:number}>={
      grotto:{x:64,z:32,yaw:-Math.PI/2,pitch:0},
      trail:{x:78.5,z:33,yaw:-1.88,pitch:-.07},
      vista:{x:87,z:35,yaw:-2.2,pitch:-.08}
    };
    const pose=key?poses[key]:undefined;
    if(pose&&world&&player&&camera){
      const qaWorld=world,qaPlayer=player;
      player.teleport(pose.x,groundHeightAt(pose.x,pose.z)+1.65,pose.z);
      camera.yaw=pose.yaw;camera.pitch=pose.pitch;
      camera.update(player.position);
      Object.assign(window,{__EXPLORATION_QA__:{
        scene:key,
        terrainCount:()=>qaWorld.scene.getObjectsByProperty(
          "name","SINGLE_CONTINUOUS_TERRAIN").length,
        hiddenVisible:()=>qaWorld.outdoor.hidden.root.visible,
        instancedGroups:()=>{
          let n=0;qaWorld.outdoor.hidden.root.traverse(obj=>{
            if(obj instanceof THREE.InstancedMesh)n++;
          });return n;
        },
        drawCalls:()=>qaWorld.renderer.info.render.calls,
        playerGround:()=>qaPlayer.position.y-1.65,
        expectedGround:()=>groundHeightAt(qaPlayer.position.x,qaPlayer.position.z)
      }});
    }
  }
  // QA-only visual fixture: a high-contrast 10m target sits EXACTLY on the
  // camera's forward ray. Only reachable on localhost via explicit query.
  // No production player, network state or combat authority is modified.
  if((location.hostname==="127.0.0.1"||location.hostname==="localhost")&&
    new URLSearchParams(location.search).has("fpsVisualTest")){
    const target=new THREE.Mesh(
      new THREE.PlaneGeometry(2,2),
      new THREE.MeshBasicMaterial({
        color:0xff16b8,toneMapped:false,depthTest:false,depthWrite:false
      })
    );
    target.name="FPS_VISUAL_QA_TARGET";
    target.position.set(0,0,-10);
    target.renderOrder=50;
    world.camera.add(target);
    Object.assign(window,{
      __GAME_ROOM_FPS_QA__:{
        sightError:()=>weaponViewmodel?.sightProjectionError()??Infinity,
        centerClear:()=>weaponViewmodel?.isTargetCorridorClear()??false,
        aiming:()=>aiming,
        fpsDrawCalls:()=>world?.renderer.info.render.calls??-1
      }
    });
  }
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
