import { parseIncoming, validateOutgoing, type IncomingMessage, type OutgoingMessage } from "./protocol";
export type TransportStatus="offline"|"connecting"|"online";
export interface Transport{
  readonly status:TransportStatus;
  connect(url:string):Promise<void>;
  send(message:OutgoingMessage):boolean;
  subscribe(listener:(message:IncomingMessage)=>void):()=>void;
  disconnect():void;
}
/** Default mode: no remote connection, no network requests, safe single player. */
export class OfflineTransport implements Transport{
  readonly status="offline" as const;
  async connect(_url:string):Promise<void>{throw new Error("Offline mode: no server configured");}
  send(_message:OutgoingMessage):boolean{return false}
  subscribe(_listener:(message:IncomingMessage)=>void):()=>void{return()=>{}}
  disconnect():void{}
}
/**
 * Future multiplayer boundary. Instantiated only by a future opt-in online flow.
 * No production server URL or credentials are stored in the frontend.
 */
export class WebSocketTransport implements Transport{
  private socket:WebSocket|null=null;
  private listeners=new Set<(message:IncomingMessage)=>void>();
  status:TransportStatus="offline";
  connect(url:string):Promise<void>{
    if(this.socket)throw new Error("Transport is already in use");
    const parsed=new URL(url);
    if(parsed.protocol!=="wss:")throw new Error("Only encrypted wss:// URLs are accepted");
    this.status="connecting";
    return new Promise((resolve,reject)=>{
      let settled=false;
      try{
        const socket=new WebSocket(parsed.toString());
        this.socket=socket;
        socket.addEventListener("open",()=>{
          this.status="online";settled=true;resolve();
        });
        socket.addEventListener("message",(event:MessageEvent)=>{
          if(typeof event.data!=="string")return;
          const message=parseIncoming(event.data);
          if(message)for(const listener of this.listeners)listener(message);
        });
        socket.addEventListener("error",()=>{
          if(!settled){settled=true;this.status="offline";reject(new Error("WebSocket connection failed"));}
        });
        socket.addEventListener("close",()=>{
          this.status="offline";this.socket=null;
          if(!settled){settled=true;reject(new Error("WebSocket closed before connecting"));}
        });
      }catch(e){this.status="offline";this.socket=null;reject(e);}
    });
  }
  send(message:OutgoingMessage):boolean{
    if(this.socket?.readyState!==WebSocket.OPEN||!validateOutgoing(message))return false;
    const serialized=JSON.stringify(message);
    if(serialized.length>(message.type==="room_update"?150000:4096))return false;
    this.socket.send(serialized);return true;
  }
  subscribe(listener:(message:IncomingMessage)=>void):()=>void{
    this.listeners.add(listener);return()=>this.listeners.delete(listener);
  }
  disconnect():void{
    this.socket?.close();this.socket=null;this.status="offline";
  }
}
