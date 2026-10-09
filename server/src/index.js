import { DurableObject } from "cloudflare:workers";
import { validRoomId, permittedOrigin, decodeMessage, safeName, MAX_PLAYERS, withinMovementSpeed } from "./guards.js";

const json=(data,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
});
const send=(socket,message)=>{
  try{socket.send(JSON.stringify(message));return true}catch{return false}
};
const attachment=socket=>{
  try{return socket.deserializeAttachment()||null}catch{return null}
};
const isJoined=state=>Boolean(state?.player?.id);
const publicPlayer=state=>state.player;

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==="/api/health"&&request.method==="GET")
      return json({ok:true,service:"game-room-realtime",version:1});
    const match=/^\/rooms\/([A-Za-z0-9_-]{32})$/.exec(url.pathname);
    if(!match||!validRoomId(match[1]))return json({error:"Not found"},404);
    if(request.method!=="GET"||request.headers.get("Upgrade")?.toLowerCase()!=="websocket")
      return json({error:"Upgrade required"},426);
    // Browser WebSockets send Origin. Only our Game Room and local Vite dev are accepted.
    if(!permittedOrigin(request.headers.get("Origin")))
      return json({error:"Origin not permitted"},403);
    const room=env.ROOM_HUB.getByName(match[1]);
    return room.fetch(request);
  }
};

/**
 * One SQLite-backed Durable Object per 192-bit invite room code.
 * Membership and positions are carried as per-socket hibernation attachments.
 * The room does not record photos, chat, account details or long-term position history.
 */
export class RoomHub extends DurableObject {
  constructor(ctx,env){super(ctx,env)}
  members(){
    return this.ctx.getWebSockets().filter(s=>isJoined(attachment(s)));
  }
  async fetch(request){
    const roomId=new URL(request.url).pathname.split("/").pop();
    if(!validRoomId(roomId))return json({error:"Invalid room"},400);
    if(this.ctx.getWebSockets().length>=MAX_PLAYERS)return json({error:"Room full"},429);
    const pair=new WebSocketPair();
    const [client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({roomId,player:null,lastMoveAt:0,lastPacketAt:0});
    return new Response(null,{status:101,webSocket:client});
  }
  webSocketMessage(ws,raw){
    const session=attachment(ws);
    if(!session){ws.close(1008,"Missing session");return;}
    const m=decodeMessage(raw);
    if(!m){send(ws,{type:"error",reason:"Invalid message"});return;}
    if(m.type==="join"){
      if(isJoined(session)||m.roomId!==session.roomId){ws.close(1008,"Invalid room join");return;}
      const existing=this.members();
      if(existing.length>=MAX_PLAYERS){ws.close(1013,"Room full");return;}
      const id=crypto.randomUUID();
      const spawn={
        x:Math.max(-1.6,Math.min(1.6,(existing.length%5-2)*.65)),
        y:1.65,
        z:15-Math.floor(existing.length/5)*1.2
      };
      const player={id,displayName:safeName(m.displayName),position:spawn,yaw:0,pitch:0,sequence:0};
      ws.serializeAttachment({...session,player,lastMoveAt:Date.now(),lastPacketAt:0});
      send(ws,{type:"welcome",playerId:id,roomId:session.roomId});
      send(ws,{type:"snapshot",players:existing.map(s=>publicPlayer(attachment(s))).filter(Boolean)});
      for(const client of existing)send(client,{type:"joined",player});
      return;
    }
    if(!isJoined(session)){ws.close(1008,"Join first");return;}
    if(m.type!=="move")return;
    const now=Date.now();
    if(m.sequence<=session.player.sequence)return;
    if(now-session.lastPacketAt<75)return; // per-socket max ~13 updates/s
    const elapsed=Math.max(0,Math.min(2000,now-session.lastMoveAt));
    if(!withinMovementSpeed(session.player.position,m.position,elapsed)){
      send(ws,{type:"error",reason:"Invalid movement"});return;
    }
    const player={...session.player,position:m.position,yaw:m.yaw,pitch:m.pitch,sequence:m.sequence};
    ws.serializeAttachment({...session,player,lastMoveAt:now,lastPacketAt:now});
    for(const peer of this.members())if(peer!==ws)send(peer,{type:"joined",player});
  }
  webSocketClose(ws,code,reason){
    this.onDisconnect(ws);
    try{ws.close(code,reason)}catch{}
  }
  webSocketError(ws){this.onDisconnect(ws);try{ws.close(1011,"Connection error")}catch{}}
  onDisconnect(ws){
    const session=attachment(ws);
    if(!isJoined(session))return;
    ws.serializeAttachment({...session,player:null});
    for(const peer of this.members())if(peer!==ws)send(peer,{type:"left",playerId:session.player.id});
  }
}
