import type { PlayerSnapshot } from "../types/Player";
import { safeDisplayName } from "../types/Player";
import { isValidRoomId, type RoomSharedState } from "./protocol";
import { WebSocketTransport } from "./Transport";
import type {OthelloMatch} from "../../shared/othello.js";

export type RoomConnectionState="offline"|"connecting"|"online"|"reconnecting";
export interface RoomCallbacks{
  onState(state:RoomConnectionState,count:number):void;
  onSnapshot(players:PlayerSnapshot[]):void;
  onPlayer(player:PlayerSnapshot):void;
  onLeave(playerId:string):void;
  onError(message:string):void;
  onRoomState(state:RoomSharedState):void;
  onHealth(playerId:string,hp:number,respawnAt:number):void;
  onFire(shooterId:string,position:{x:number;y:number;z:number},yaw:number,pitch:number):void;
  onFireResult(hit:boolean,damage:number,targetId?:string):void;
  onRespawn(position:{x:number;y:number;z:number}):void;
  onOthello(match:OthelloMatch):void;
  onSpawn(position:{x:number;y:number;z:number}):void;
  onCorrection(position:{x:number;y:number;z:number}):void;
  onWeaponState(unlocked:boolean,peaceful:boolean):void;
}
/** Holds the network lifecycle; no rendering, DOM or game rules in this module. */
export class RealtimeRoomClient {
  private transport:WebSocketTransport|null=null;
  private desired=false;
  private isReady=false;
  private nextAttemptAt=0;
  private attempts=0;
  private currentRoomId="";
  private name="Guest";
  private baseUrl="";
  private peers=new Map<string,PlayerSnapshot>();
  private lastSend=0;
  private sequence=0;
  private fireSequence=0;
  private connectGeneration=0;
  private lastRoomRevision=-1;
  private handshakeTimer:ReturnType<typeof setTimeout>|null=null;
  readonly supported:boolean;
  state:RoomConnectionState="offline";
  playerId="";
  constructor(private callbacks:RoomCallbacks,baseUrl:string){
    this.baseUrl=baseUrl.trim().replace(/\/+$/,"");
    this.supported=this.baseUrl.startsWith("https://");
  }
  get roomId():string{return this.currentRoomId}
  get count():number{return this.isReady?this.peers.size+1:0}
  get online():boolean{return this.isReady&&this.transport?.status==="online"}
  setRoomImage(image:string|null):boolean{
    if(!this.online)return false;
    return this.transport?.send({type:"room_update",key:"monitorImage",value:image})??false;
  }
  setSignText(value:string):boolean{
    if(!this.online)return false;
    return this.transport?.send({type:"room_update",key:"signText",value})??false;
  }
  shoot(yaw:number,pitch:number):boolean{
    if(!this.online)return false;
    return this.transport?.send({type:"fire",sequence:++this.fireSequence,yaw,pitch})??false;
  }
  othello(action:"start"|"join"|"reset"|"place",index?:number):boolean{
    if(!this.online)return false;
    if(action==="place"){
      if(index===undefined)return false;
      return this.transport?.send({type:"othello",action:"place",index})??false;
    }
    return this.transport?.send({type:"othello",action})??false;
  }
  unlockWeapon(code:string):boolean{
    return this.online?(this.transport?.send({type:"unlock_weapon",code})??false):false;
  }
  setPeaceMode(enabled:boolean):boolean{
    return this.online?(this.transport?.send({type:"peace_mode",enabled})??false):false;
  }
  setLightShow(enabled:boolean):boolean{
    if(!this.online)return false;
    return this.transport?.send({type:"room_update",key:"lightShow",value:enabled})??false;
  }
  private emit():void{this.callbacks.onState(this.state,this.count)}
  async join(roomId:string,displayName:string):Promise<void>{
    if(!isValidRoomId(roomId))throw new Error("招待コードが正しくありません");
    if(!this.supported)throw new Error("Cloudflare接続先がまだ設定されていません");
    this.leave();
    this.currentRoomId=roomId;
    this.name=safeDisplayName(displayName);
    this.desired=true;
    this.attempts=0;
    await this.connectOnce();
  }
  private async connectOnce():Promise<void>{
    if(!this.desired)return;
    const gen=++this.connectGeneration;
    this.transport?.disconnect();
    const transport=new WebSocketTransport();
    this.transport=transport;
    this.isReady=false;
    this.playerId="";
    this.lastSend=0;
    this.sequence=0;
    this.fireSequence=0;
    this.lastRoomRevision=-1;
    this.peers.clear();
    this.callbacks.onSnapshot([]);
    this.state=this.attempts===0?"connecting":"reconnecting";
    this.emit();
    const server=this.baseUrl.replace(/^https:\/\//,"wss://");
    const url=server+"/rooms/"+this.currentRoomId;
    transport.subscribe(msg=>{
      if(gen!==this.connectGeneration)return;
      if(msg.type==="weapon_state"){
        this.callbacks.onWeaponState(msg.unlocked,msg.peaceful);
      }else if(msg.type==="position_correction"){
        this.sequence=Math.max(this.sequence,msg.sequence);
        this.lastSend=performance.now();
        this.callbacks.onCorrection(msg.position);
      }else if(msg.type==="othello_state"){
        this.callbacks.onOthello(msg.match);
      }else if(msg.type==="health_snapshot"){
        for(const p of msg.players)this.callbacks.onHealth(p.playerId,p.hp,p.respawnAt);
      }else if(msg.type==="health_state"){
        this.callbacks.onHealth(msg.playerId,msg.hp,msg.respawnAt);
      }else if(msg.type==="fire_event"){
        this.callbacks.onFire(msg.shooterId,msg.position,msg.yaw,msg.pitch);
      }else if(msg.type==="fire_result"){
        this.callbacks.onFireResult(msg.hit,msg.damage,msg.targetId);
      }else if(msg.type==="respawn"){
        this.callbacks.onRespawn(msg.position);
      }else if(msg.type==="room_state"){
        if(msg.revision<this.lastRoomRevision)return;
        this.lastRoomRevision=msg.revision;
        this.callbacks.onRoomState(msg);
      }else if(msg.type==="welcome"){
        if(msg.roomId!==this.currentRoomId)return;
        this.playerId=msg.playerId;
        this.isReady=true;this.attempts=0;
        this.state="online";this.emit();
        if(msg.position)this.callbacks.onSpawn(msg.position);
        this.clearHandshakeTimer();
      }else if(msg.type==="snapshot"){
        this.peers.clear();
        for(const p of msg.players)if(p.id!==this.playerId)this.peers.set(p.id,p);
        this.callbacks.onSnapshot([...this.peers.values()]);
        this.emit();
      }else if(msg.type==="joined"){
        if(msg.player.id===this.playerId)return;
        const prev=this.peers.get(msg.player.id);
        if(prev&&prev.sequence>=msg.player.sequence)return;
        this.peers.set(msg.player.id,msg.player);
        this.callbacks.onPlayer(msg.player);
        if(!prev)this.emit();
      }else if(msg.type==="left"){
        if(!this.peers.has(msg.playerId))return;
        this.peers.delete(msg.playerId);
        this.callbacks.onLeave(msg.playerId);this.emit();
      }else if(msg.type==="error"){
        this.callbacks.onError("通信エラー: "+msg.reason);
      }
    });
    try{
      await transport.connect(url);
      if(gen!==this.connectGeneration)return;
      if(!transport.send({type:"join",roomId:this.currentRoomId,displayName:this.name}))
        throw new Error("ルーム参加メッセージを送信できませんでした");
      this.handshakeTimer=setTimeout(()=>{
        if(gen===this.connectGeneration&&!this.isReady){
          this.callbacks.onError("サーバーから入室確認が届きません");
          this.state="reconnecting";
          this.attempts++;
          this.nextAttemptAt=performance.now()+2000;
          transport.disconnect();
          this.emit();
        }
      },9000);
    }catch(error){
      if(gen!==this.connectGeneration)return;
      transport.disconnect();
      this.nextAttemptAt=performance.now()+Math.min(16000,1000*2**this.attempts);
      this.attempts++;
      this.state="reconnecting";this.emit();
      if(this.attempts===1)this.callbacks.onError("接続できませんでした。自動再接続します");
    }
  }
  /** Call once per animation frame. Only send at ~10 Hz while playing. */
  tick(now:number,player:Omit<PlayerSnapshot,"id"|"displayName"|"sequence">):void{
    if(!this.desired)return;
    if(this.transport?.status==="offline"){
      if(!this.isReady&&this.state==="connecting"){
        this.state="reconnecting";
        this.attempts++;
        this.nextAttemptAt=now+2000;
        this.emit();
      }
      if(this.isReady){
        this.isReady=false;
        this.callbacks.onSnapshot([]);
        this.peers.clear();
        this.state="reconnecting";
        this.attempts++;
        this.nextAttemptAt=now+Math.min(16000,1000*2**Math.min(4,this.attempts-1));
        this.emit();
      }
      if(now>=this.nextAttemptAt && this.state==="reconnecting"){
        this.nextAttemptAt=Number.POSITIVE_INFINITY;
        void this.connectOnce();
      }
      return;
    }
    if(!this.isReady||now-this.lastSend<100)return;
    this.lastSend=now;
    const ok=this.transport?.send({
      type:"move",
      position:{...player.position},
      yaw:player.yaw,pitch:player.pitch,
      sequence:++this.sequence
    });
    if(!ok)this.callbacks.onError("位置の同期が一時的に失敗しました");
  }
  private clearHandshakeTimer():void{
    if(this.handshakeTimer!==null)clearTimeout(this.handshakeTimer);
    this.handshakeTimer=null;
  }
  leave():void{
    this.desired=false;
    this.clearHandshakeTimer();
    ++this.connectGeneration;
    this.transport?.disconnect();
    this.transport=null;
    this.peers.clear();
    this.playerId="";
    this.isReady=false;
    this.currentRoomId="";
    this.attempts=0;
    this.nextAttemptAt=0;
    this.lastRoomRevision=-1;
    this.state="offline";
    this.callbacks.onSnapshot([]);
    this.emit();
  }
}
