import { DurableObject } from "cloudflare:workers";
import {freshMatch,validMatch,applyMove,BLACK,WHITE} from "../../shared/othello.js";
import { inArena, findHitscanTarget, MAX_HP, DAMAGE, SHOT_COOLDOWN_MS, RESPAWN_MS, SPAWN_SHIELD_MS, ARENA_RESPAWN } from "../../shared/combatRules.js";
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
 * Photos are stored only as constrained, consented JPEG room state in Durable Object storage.
 * No chat, account details or long-term position history are stored.
 */
export class RoomHub extends DurableObject {
  constructor(ctx,env){super(ctx,env)}
  members(){
    return this.ctx.getWebSockets().filter(s=>isJoined(attachment(s)));
  }
  sendHealth(){
    const states=this.members().map(s=>attachment(s)).map(p=>({playerId:p.player.id,hp:p.hp,respawnAt:p.respawnAt}));
    for(const sock of this.members())send(sock,{type:"health_snapshot",players:states});
  }
  async fetch(request){
    const roomId=new URL(request.url).pathname.split("/").pop();
    if(!validRoomId(roomId))return json({error:"Invalid room"},400);
    if(this.ctx.getWebSockets().length>=MAX_PLAYERS)return json({error:"Room full"},429);
    const pair=new WebSocketPair();
    const [client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({roomId,player:null,lastMoveAt:0,lastPacketAt:0,lastImageAt:0,lastLightAt:0,lastSignAt:0,lastShotAt:0,hp:MAX_HP,respawnAt:0,invulnerableUntil:0,lastFireSeq:0});
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,raw){
    const session=attachment(ws);
    if(!session){ws.close(1008,"Missing session");return;}
    const m=decodeMessage(raw);
    if(!m){send(ws,{type:"error",reason:"Invalid message"});return;}
    if(m.type==="join"){
      if(isJoined(session)||m.roomId!==session.roomId){ws.close(1008,"Invalid room join");return;}
      const existing=this.members();
      if(existing.length>=MAX_PLAYERS){ws.close(1013,"Room full");return;}
      const id=crypto.randomUUID();
      // Phase 2 client starts at (0, 1.65, 15). Keep the initial authoritative
      // snapshot in sync, otherwise a first move may fail displacement validation.
      // Avatars are non-blocking; spawn spacing can be negotiated in a later protocol.
      const spawn={x:0,y:1.65,z:15};
      const player={id,displayName:safeName(m.displayName),position:spawn,yaw:0,pitch:0,sequence:0};
      ws.serializeAttachment({...session,player,lastMoveAt:Date.now(),lastPacketAt:0,hp:MAX_HP,respawnAt:0,invulnerableUntil:Date.now()+2000});
      send(ws,{type:"welcome",playerId:id,roomId:session.roomId});
      send(ws,{type:"snapshot",players:existing.map(s=>publicPlayer(attachment(s))).filter(Boolean)});
      const saved=await this.ctx.storage.get("shared_room_v1");
      send(ws,{type:"room_state",revision:saved?.revision??0,
        monitorImage:saved?.monitorImage??null,lightShow:saved?.lightShow??false,
        signText:saved?.signText??"WELCOME TO GAME ROOM"});
      for(const client of existing)send(client,{type:"joined",player});
      this.sendHealth();
      const match=await this.ctx.storage.get("othello_match_v1");
      send(ws,{type:"othello_state",match:validMatch(match)?match:freshMatch()});
      return;
    }
    if(!isJoined(session)){ws.close(1008,"Join first");return;}
    if(m.type==="room_update"){
      const now=Date.now();
      const image=m.key==="monitorImage";
      const sign=m.key==="signText";
      const last=sign?(session.lastSignAt??0):(image?(session.lastImageAt??0):(session.lastLightAt??0));
      if(now-last<(image?2500:sign?1300:400)){
        send(ws,{type:"error",reason:"変更が速すぎます。少し待ってください"});return;
      }
      const old=await this.ctx.storage.get("shared_room_v1");
      const saved={
        revision:(old?.revision??0)+1,
        monitorImage:old?.monitorImage??null,
        lightShow:old?.lightShow??false,
        signText:old?.signText??"WELCOME TO GAME ROOM",
      };
      saved[m.key]=m.value;
      await this.ctx.storage.put("shared_room_v1",saved);
      // Delete room customization after seven days of no edits to limit photo retention.
      await this.ctx.storage.setAlarm(now+7*24*60*60*1000);
      ws.serializeAttachment({
        ...session,
        ...(image?{lastImageAt:now}:sign?{lastSignAt:now}:{lastLightAt:now})
      });
      for(const peer of this.members())send(peer,{type:"room_state",...saved});
      return;
    }
    if(m.type==="othello"){
      // Server alone owns both seats, legal moves and the final board.
      // blockConcurrencyWhile serializes read-modify-write across sockets.
      await this.ctx.blockConcurrencyWhile(async()=>{
        const old=await this.ctx.storage.get("othello_match_v1");
        const match=validMatch(old)?old:freshMatch();
        const playerId=session.player.id,name=safeName(session.player.displayName);
        let next=null;
        if(m.action==="start"){
          if(match.status==="playing"||match.status==="waiting"){
            send(ws,{type:"error",reason:"オセロの対戦中です"});return;
          }
          next={...freshMatch(playerId,name),revision:match.revision+1};
        }else if(m.action==="join"){
          if(match.status!=="waiting"||match.blackId===playerId){
            send(ws,{type:"error",reason:"参加できる白席がありません"});return;
          }
          next={...match,whiteId:playerId,whiteName:name,status:"playing",revision:match.revision+1};
        }else if(m.action==="reset"){
          if(match.blackId!==playerId&&match.whiteId!==playerId){
            send(ws,{type:"error",reason:"対戦者だけが終了できます"});return;
          }
          next={...freshMatch(),revision:match.revision+1};
        }else if(m.action==="place"){
          if(match.status!=="playing"||
            (match.turn===BLACK?match.blackId:match.whiteId)!==playerId){
            send(ws,{type:"error",reason:"あなたの手番ではありません"});return;
          }
          next=applyMove(match,m.index);
          if(!next){send(ws,{type:"error",reason:"そこには置けません"});return;}
        }
        if(next){
          await this.ctx.storage.put("othello_match_v1",next);
          for(const peer of this.members())send(peer,{type:"othello_state",match:next});
        }
      });
      return;
    }
    const now=Date.now();
    // Respawn is computed on the first message after the timer expires. The
    // authoritative player position is reset before any movement is accepted.
    if(session.respawnAt && now>=session.respawnAt){
      const revived={...session.player,position:{...ARENA_RESPAWN},sequence:session.player.sequence+1};
      ws.serializeAttachment({...session,player:revived,hp:MAX_HP,respawnAt:0,
        invulnerableUntil:now+SPAWN_SHIELD_MS,lastMoveAt:now,lastPacketAt:now});
      send(ws,{type:"respawn",position:revived.position,health:MAX_HP});
      for(const peer of this.members())if(peer!==ws)send(peer,{type:"joined",player:revived});
      this.sendHealth();
      return;
    }
    if(m.type==="fire"){
      if(m.sequence<=session.lastFireSeq)return;
      if(now-(session.lastShotAt??0)<SHOT_COOLDOWN_MS)return;
      if(session.hp<=0 || !inArena(session.player.position)){
        send(ws,{type:"error",reason:"ブラスターはアリーナ内だけで使えます"});return;
      }
      const yawDiff=Math.atan2(Math.sin(m.yaw-session.player.yaw),Math.cos(m.yaw-session.player.yaw));
      if(Math.abs(yawDiff)>1.4||Math.abs(m.pitch-session.player.pitch)>.9){
        send(ws,{type:"error",reason:"照準の向きが同期されていません"});return;
      }
      ws.serializeAttachment({...session,lastShotAt:now,lastFireSeq:m.sequence});
      const others=this.members().filter(peer=>peer!==ws);
      const candidates=others.map(sock=>({sock,data:attachment(sock)}))
        .filter(({data})=>data.hp>0&&now>=data.invulnerableUntil)
        .map(({sock,data})=>({sock,id:data.player.id,hp:data.hp,position:data.player.position}));
      const victim=findHitscanTarget({id:session.player.id,hp:session.hp,position:session.player.position},candidates,m.yaw,m.pitch);
      // This broadcast is cosmetic; client-supplied damage and target IDs are ignored.
      for(const peer of this.members())send(peer,{type:"fire_event",shooterId:session.player.id,
        position:session.player.position,yaw:m.yaw,pitch:m.pitch,sequence:m.sequence});
      if(victim){
        const peer=victim.sock, target=attachment(peer),hp=Math.max(0,target.hp-DAMAGE);
        const respawnAt=hp===0?now+RESPAWN_MS:0;
        peer.serializeAttachment({...target,hp,respawnAt});
        for(const member of this.members())send(member,{type:"health_state",playerId:victim.id,hp,respawnAt});
        send(ws,{type:"fire_result",sequence:m.sequence,hit:true,targetId:victim.id,damage:DAMAGE});
      }else send(ws,{type:"fire_result",sequence:m.sequence,hit:false,damage:0});
      return;
    }
    if(m.type!=="move")return;
    if(session.hp<=0)return;
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
  async alarm(){
    // Remove room-uploaded photo after its retention window; keep short sign
    // text and lighting preferences so the world remains personalized.
    const saved=await this.ctx.storage.get("shared_room_v1");
    if(!saved||saved.monitorImage===null)return;
    const next={...saved,monitorImage:null,revision:(saved.revision??0)+1};
    await this.ctx.storage.put("shared_room_v1",next);
    for(const peer of this.members())send(peer,{type:"room_state",...next});
  }
  async webSocketClose(ws,code,reason){
    await this.onDisconnect(ws);
    try{ws.close(code,reason)}catch{}
  }
  async webSocketError(ws){
    await this.onDisconnect(ws);
    try{ws.close(1011,"Connection error")}catch{}
  }
  async onDisconnect(ws){
    const session=attachment(ws);
    if(!isJoined(session))return;
    const departedId=session.player.id;
    ws.serializeAttachment({...session,player:null});
    for(const peer of this.members())if(peer!==ws)send(peer,{type:"left",playerId:departedId});
    this.sendHealth();
    await this.ctx.blockConcurrencyWhile(async()=>{
      const old=await this.ctx.storage.get("othello_match_v1");
      if(!validMatch(old)||old.status==="idle"||old.status==="finished")return;
      if(old.blackId!==departedId&&old.whiteId!==departedId)return;
      // A seat leaving cannot strand a board in "waiting" forever.
      const next=old.status==="waiting"?
        {...freshMatch(),revision:old.revision+1}:
        {...old,status:"finished",winner:old.blackId===departedId?WHITE:BLACK,
          revision:old.revision+1};
      await this.ctx.storage.put("othello_match_v1",next);
      for(const peer of this.members())send(peer,{type:"othello_state",match:next});
    });
  }
}
