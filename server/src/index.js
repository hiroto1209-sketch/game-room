import {residentHeightAt,EMPTY_MOTION,validResidentMotion,canTalkToResident,holdResident,currentResidentPose,POKO_ANCHOR} from "../../shared/residentRules.js";
import { DurableObject } from "cloudflare:workers";
import {freshMatch,validMatch,applyMove,BLACK,WHITE} from "../../shared/othello.js";
import { findHitscanTarget, MAX_HP, DAMAGE, SHOT_COOLDOWN_MS, RESPAWN_MS, SPAWN_SHIELD_MS, WEAPON_CODE, aimWithinRate } from "../../shared/combatRules.js";
import { applyFoeDamage, findFoeHit, fireTargetKind, freshCoop, publicCoop, reviveFoes, validCoopState } from "../../shared/coopRules.js";
import {SPAWN,shotObstructed,walkableHeightAt} from "../../shared/worldRules.js";
import {FPS_STAGE,inFpsStage} from "../../shared/playcanvasRules.js";
import "../../shared/playcanvasCollisionData.js";
import {DEFAULT_AVATAR,EMOTE_DURATION_MS} from "../../shared/avatarRules.js";
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
  constructor(ctx,env){
    super(ctx,env);this.residentMotion={...EMPTY_MOTION};this.coop=freshCoop();
    ctx.blockConcurrencyWhile(async()=>{
      const saved=await ctx.storage.get('residents_v1');if(validResidentMotion(saved))this.residentMotion=saved;
      const coop=await ctx.storage.get('coop_v1');if(validCoopState(coop))this.coop=coop;
    });
  }
  members(){
    return this.ctx.getWebSockets().filter(s=>isJoined(attachment(s)));
  }
  sendHealth(){
    const states=this.members().map(s=>attachment(s)).map(p=>({playerId:p.player.id,hp:p.hp,respawnAt:p.respawnAt}));
    for(const sock of this.members())send(sock,{type:"health_snapshot",players:states});
  }
  broadcastCoop(){
    const payload={type:"coop_state",...publicCoop(this.coop)};
    for(const sock of this.members())send(sock,payload);
  }
  async reviveCoop(now){
    if(fireTargetKind(this.coop.enabled)!=="foes")return;
    if(!this.coop.foes.some(f=>f.hp<=0&&f.downUntil>0&&now>=f.downUntil))return;
    await this.ctx.blockConcurrencyWhile(async()=>{
      const foes=reviveFoes(this.coop.foes,Date.now());
      if(foes.every((f,i)=>f.hp===this.coop.foes[i].hp&&f.downUntil===this.coop.foes[i].downUntil))return;
      this.coop={...this.coop,foes};
      await this.ctx.storage.put("coop_v1",this.coop);
      this.broadcastCoop();
    });
  }
  async fetch(request){
    const roomId=new URL(request.url).pathname.split("/").pop();
    if(!validRoomId(roomId))return json({error:"Invalid room"},400);
    if(this.ctx.getWebSockets().length>=MAX_PLAYERS)return json({error:"Room full"},429);
    const pair=new WebSocketPair();
    const [client,server]=Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({roomId,player:null,lastMoveAt:0,lastPacketAt:0,lastImageAt:0,lastLightAt:0,lastSignAt:0,lastShotAt:0,hp:MAX_HP,respawnAt:0,invulnerableUntil:0,lastFireSeq:0,weaponUnlocked:true,peaceful:false,speedBoost:false,lastUnlockAt:0,lastCorrectionAt:0,lastAvatarAt:0,lastEmoteAt:0,emoteKind:null,emoteUntil:0});
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
      const spawn={...SPAWN};
      const player={id,displayName:safeName(m.displayName),position:spawn,yaw:0,pitch:0,sequence:0,
        avatar:{...DEFAULT_AVATAR}};
      ws.serializeAttachment({...session,player,lastMoveAt:Date.now(),lastPacketAt:0,hp:MAX_HP,
        respawnAt:0,invulnerableUntil:Date.now()+2000,weaponUnlocked:true,peaceful:false,speedBoost:false,
        lastShotAt:0,lastFireSeq:0});
      send(ws,{type:"welcome",playerId:id,roomId:session.roomId,position:spawn,serverTime:Date.now()});
      send(ws,{type:"npc_state",serverTime:Date.now(),motion:this.residentMotion});
      send(ws,{type:"weapon_state",unlocked:true,peaceful:false,boosted:false});
      send(ws,{type:"coop_state",...publicCoop(this.coop)});
      send(ws,{type:"snapshot",players:existing.map(s=>publicPlayer(attachment(s))).filter(Boolean)});
      // Late joiners also see still-playing emotes (no database persistence).
      for(const other of existing){
        const meta=attachment(other);
        const remaining=Math.max(0,(meta.emoteUntil??0)-Date.now());
        if(meta.emoteKind&&remaining>0)
          send(ws,{type:"emote_event",playerId:meta.player.id,kind:meta.emoteKind,
            durationMs:Math.min(EMOTE_DURATION_MS,remaining)});
      }
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
    if(this.coop.enabled)await this.reviveCoop(Date.now());
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
          if(match.status==="playing"||match.status==="paused"||match.status==="waiting"){
            send(ws,{type:"error",reason:"オセロの対戦中です"});return;
          }
          next={...freshMatch(playerId,name),revision:match.revision+1};
        }else if(m.action==="join"){
          if(match.status!=="waiting"||match.blackId===playerId){
            send(ws,{type:"error",reason:"参加できる白席がありません"});return;
          }
          next={...match,whiteId:playerId,whiteName:name,status:"playing",revision:match.revision+1};
        }else if(m.action==="pause"||m.action==="resume"){
          if(match.blackId!==playerId&&match.whiteId!==playerId){
            send(ws,{type:"error",reason:"対局者だけが中断・再開できます"});return;
          }
          if((m.action==="pause"&&match.status!=="playing")||
            (m.action==="resume"&&match.status!=="paused")){
            send(ws,{type:"error",reason:"その状態では中断・再開できません"});return;
          }
          next={...match,status:m.action==="pause"?"paused":"playing",revision:match.revision+1};
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
    if(m.type==='npc_talk'){
      if(session.hp<=0||now-(session.lastNpcAt??0)<500)return;
      if(m.continue&&(session.lastNpcId!==m.id||now-(session.lastNpcAt??0)>14000))return;
      const pose=m.id==='poko'?POKO_ANCHOR:currentResidentPose(now,this.residentMotion);
      if(!canTalkToResident(m.id,session.player.position,now,this.residentMotion)||shotObstructed(session.player.position,{x:pose.x,y:1,z:pose.z})){
        if(!m.continue)send(ws,{type:'error',reason:'もう少し近づいて話しかけてね'});return;
      }
      ws.serializeAttachment({...session,lastNpcAt:now,lastNpcId:m.id});
      if(m.id==='tokotoko')await this.ctx.blockConcurrencyWhile(async()=>{
        this.residentMotion=holdResident(now,this.residentMotion,session.player.position,m.continue);
        await this.ctx.storage.put('residents_v1',this.residentMotion);
        for(const peer of this.members())send(peer,{type:'npc_state',serverTime:Date.now(),motion:this.residentMotion});
      });
      if(!m.continue)send(ws,{type:'npc_dialogue',id:m.id});
      return;
    }
    if(m.type==="unlock_weapon"){
      if(now-(session.lastUnlockAt??0)<1500){
        send(ws,{type:"error",reason:"コマンドの入力間隔を空けてください"});return;
      }
      if(m.code!==WEAPON_CODE){
        ws.serializeAttachment({...session,lastUnlockAt:now});
        send(ws,{type:"error",reason:"隠しコマンドが違います"});return;
      }
      ws.serializeAttachment({...session,lastUnlockAt:now,speedBoost:true});
      send(ws,{type:"weapon_state",unlocked:true,peaceful:session.peaceful,boosted:true});
      return;
    }
    if(m.type==="peace_mode"){
      ws.serializeAttachment({...session,peaceful:m.enabled});
      send(ws,{type:"weapon_state",unlocked:true,peaceful:m.enabled,boosted:session.speedBoost===true});
      return;
    }
    if(m.type==="coop_mode"){
      const stamp=Date.now();
      if(stamp-(session.lastCoopAt??0)<700){
        send(ws,{type:"error",reason:"協力モードの切り替えは少し待ってください"});
        send(ws,{type:"coop_state",...publicCoop(this.coop)});
        return;
      }
      await this.ctx.blockConcurrencyWhile(async()=>{
        const next=m.enabled?{enabled:true,cleared:false,foes:freshCoop().foes}:{...this.coop,enabled:false};
        this.coop=next;
        await this.ctx.storage.put("coop_v1",this.coop);
        const live=attachment(ws);
        if(live)ws.serializeAttachment({...live,lastCoopAt:stamp});
        this.broadcastCoop();
      });
      return;
    }
    if(m.type==="avatar_update"){
      if(now-(session.lastAvatarAt??0)<800){
        send(ws,{type:"error",reason:"アバター変更は少し待ってください"});return;
      }
      const avatar={color:m.avatar.color,hat:m.avatar.hat};
      const nextPlayer={...session.player,avatar};
      ws.serializeAttachment({...session,player:nextPlayer,lastAvatarAt:now});
      // Sender gets an ack; other peers get the same server-approved state.
      for(const peer of this.members())send(peer,{type:"avatar_state",playerId:nextPlayer.id,avatar});
      return;
    }
    if(m.type==="emote"){
      if(now-(session.lastEmoteAt??0)<1600){
        send(ws,{type:"error",reason:"エモートは少し待ってください"});return;
      }
      const until=now+EMOTE_DURATION_MS;
      ws.serializeAttachment({...session,lastEmoteAt:now,emoteKind:m.kind,emoteUntil:until});
      for(const peer of this.members())send(peer,{
        type:"emote_event",playerId:session.player.id,kind:m.kind,durationMs:EMOTE_DURATION_MS
      });
      return;
    }
    // Respawn is computed on the first message after the timer expires. The
    // authoritative player position is reset before any movement is accepted.
    if(session.respawnAt && now>=session.respawnAt){
      const revived={...session.player,position:{...(inFpsStage(session.player.position.x,session.player.position.z)?FPS_STAGE.spawn:SPAWN)}};
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
      if(session.hp<=0)return;
      if(session.peaceful){
        send(ws,{type:"error",reason:"ピースモードを解除してください"});return;
      }
      const elapsed=Math.max(0,now-(session.lastMoveAt||now));
      if(!aimWithinRate(session.player,{yaw:m.yaw,pitch:m.pitch},elapsed)){
        send(ws,{type:"error",reason:"照準の向きが同期されていません"});return;
      }
      const aimed={...session.player,yaw:m.yaw,pitch:m.pitch};
      ws.serializeAttachment({...session,player:aimed,lastShotAt:now,lastFireSeq:m.sequence});
      session.player=aimed;
      // This broadcast is cosmetic; client-supplied damage and target IDs are ignored.
      for(const peer of this.members())send(peer,{type:"fire_event",shooterId:session.player.id,
        position:session.player.position,yaw:m.yaw,pitch:m.pitch,sequence:m.sequence});
      if(fireTargetKind(this.coop.enabled)==="foes"){
        await this.ctx.blockConcurrencyWhile(async()=>{
          const stamp=Date.now();
          const revived=reviveFoes(this.coop.foes,stamp);
          const hit=findFoeHit(session.player.position,m.yaw,m.pitch,revived,shotObstructed);
          let next={...this.coop,foes:revived};
          let damage=0,targetId;
          if(hit){
            const applied=applyFoeDamage(next,hit.id,stamp);
            next=applied.state;damage=applied.damage;targetId=hit.id;
          }
          const justCleared=next.cleared&&!this.coop.cleared;
          this.coop=next;
          await this.ctx.storage.put("coop_v1",this.coop);
          this.broadcastCoop();
          if(justCleared)for(const peer of this.members())send(peer,{type:"mission_clear"});
          send(ws,{type:"fire_result",sequence:m.sequence,hit:damage>0,damage,...(targetId?{targetId}:{})});
        });
        return;
      }
      const others=this.members().filter(peer=>peer!==ws);
      const candidates=others.map(sock=>({sock,data:attachment(sock)}))
        .filter(({data})=>data.hp>0&&!data.peaceful&&now>=data.invulnerableUntil)
        .map(({sock,data})=>({sock,id:data.player.id,hp:data.hp,position:data.player.position}));
      const victim=findHitscanTarget({id:session.player.id,hp:session.hp,position:session.player.position},candidates,m.yaw,m.pitch,shotObstructed);
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
    const moved=Math.hypot(m.position.x-session.player.position.x,m.position.y-session.player.position.y,m.position.z-session.player.position.z);
    // A look update must not wait out the walk throttle, and must not
    // apply a new position (that would be a speed bypass).
    if(now-session.lastPacketAt<75){
      if(moved>.45||now-(session.lastAimAt??0)<20)return;
      const looked={...session.player,yaw:m.yaw,pitch:m.pitch,sequence:m.sequence};
      ws.serializeAttachment({...session,player:looked,lastAimAt:now});
      for(const peer of this.members())if(peer!==ws)send(peer,{type:"joined",player:looked});
      return;
    }
    const elapsed=Math.max(0,Math.min(2000,now-session.lastMoveAt));
    const foot=session.player.position.y-1.65;
    const oldFloor=Math.max(walkableHeightAt(session.player.position.x,session.player.position.z,foot+.12),
      residentHeightAt(session.player.position.x,session.player.position.z,foot+.12,now,this.residentMotion));
    const onGround=Math.abs(foot-oldFloor)<.15;
    const jumpBase=onGround?oldFloor:(now<(session.jumpBaseUntil??0)?session.jumpBase??0:0);
    const jumpBaseUntil=onGround?now+2000:session.jumpBaseUntil??0;
    if(!withinMovementSpeed(session.player.position,m.position,elapsed,session.speedBoost===true,{now,motion:this.residentMotion,jumpBase})){
      // Do not merely report "Invalid movement" forever. Send the last
      // server-approved position and let the client gracefully reconcile.
      if(now-(session.lastCorrectionAt??0)>=700){
        ws.serializeAttachment({...session,lastCorrectionAt:now});
        send(ws,{type:"position_correction",position:session.player.position,
          sequence:session.player.sequence});
      }
      return;
    }
    const player={...session.player,position:m.position,yaw:m.yaw,pitch:m.pitch,sequence:m.sequence};
    ws.serializeAttachment({...session,player,lastMoveAt:now,lastPacketAt:now,jumpBase,jumpBaseUntil});
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
