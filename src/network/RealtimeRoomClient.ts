import type { PlayerSnapshot } from "../types/Player";
import { safeDisplayName } from "../types/Player";
import { isValidRoomId } from "./protocol";
import { WebSocketTransport } from "./Transport";

export type RoomConnectionState="offline"|"connecting"|"online"|"reconnecting";
export interface RoomCallbacks{
  onState(state:RoomConnectionState,count:number):void;
  onSnapshot(players:PlayerSnapshot[]):void;
  onPlayer(player:PlayerSnapshot):void;
  onLeave(playerId:string):void;
  onError(message:string):void;
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
  private connectGeneration=0;
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
    this.peers.clear();
    this.callbacks.onSnapshot([]);
    this.state=this.attempts===0?"connecting":"reconnecting";
    this.emit();
    const server=this.baseUrl.replace(/^https:\/\//,"wss://");
    const url=server+"/rooms/"+this.currentRoomId;
    transport.subscribe(msg=>{
      if(gen!==this.connectGeneration)return;
      if(msg.type==="welcome"){
        if(msg.roomId!==this.currentRoomId)return;
        this.playerId=msg.playerId;
        this.isReady=true;this.attempts=0;
        this.state="online";this.emit();
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
          transport.disconnect();
        }
      },9000);
    }catch(error){
      if(gen!==this.connectGeneration)return;
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
    this.state="offline";
    this.callbacks.onSnapshot([]);
    this.emit();
  }
}
