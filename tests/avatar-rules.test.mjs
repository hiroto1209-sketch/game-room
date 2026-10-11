import test from "node:test";
import assert from "node:assert/strict";
import {AVATAR_COLORS,AVATAR_HATS,EMOTES,DEFAULT_AVATAR,
 validAvatar,validEmote,sanitizedAvatar,EMOTE_DURATION_MS} from "../shared/avatarRules.js";
import {parseIncoming,validateOutgoing} from "../src/network/protocol.ts";

test("avatar presets are bounded, color-safe and immutable in contract",()=>{
  assert.equal(AVATAR_COLORS.length,5);
  assert.equal(AVATAR_HATS.length,4);
  assert.equal(EMOTES.length,3);
  assert.equal(EMOTE_DURATION_MS,2600);
  for(const color of AVATAR_COLORS)for(const hat of AVATAR_HATS)
    assert.equal(validAvatar({color,hat}),true);
  assert.equal(validAvatar({color:"<script>",hat:"cap"}),false);
  assert.equal(validAvatar({color:"mint",hat:"cap",extra:"evil"}),false);
  assert.equal(validAvatar({color:null,hat:"cap"}),false);
  assert.deepEqual(sanitizedAvatar({color:"violet",hat:"halo"}),{color:"violet",hat:"halo"});
  assert.deepEqual(sanitizedAvatar(null),DEFAULT_AVATAR);
});
test("outgoing social packets admit only allowlisted values",()=>{
  assert.equal(validateOutgoing({type:"avatar_update",avatar:{color:"sky",hat:"crown"}}),true);
  assert.equal(validateOutgoing({type:"avatar_update",avatar:{color:"teal",hat:"none"}}),false);
  assert.equal(validateOutgoing({type:"emote",kind:"wave"}),true);
  assert.equal(validateOutgoing({type:"emote",kind:"debug"}),false);
  assert.ok(EMOTES.every(validEmote));
});
test("incoming avatar events and late-player snapshots are strictly parsed",()=>{
  const ID="b12345678-abcd-4dcb-aaaa-1234567890ab";
  const event=parseIncoming(JSON.stringify({type:"avatar_state",playerId:ID,avatar:{color:"amber",hat:"halo"}}));
  assert.equal(event?.type,"avatar_state");
  if(event?.type==="avatar_state")assert.equal(event.avatar.hat,"halo");
  const emote=parseIncoming(JSON.stringify({type:"emote_event",playerId:ID,kind:"cheer",durationMs:1210}));
  assert.equal(emote?.type,"emote_event");
  assert.equal(parseIncoming(JSON.stringify({type:"emote_event",playerId:ID,kind:"dance",durationMs:50000})),null);
  assert.equal(parseIncoming(JSON.stringify({type:"avatar_state",playerId:ID,avatar:{color:"red",hat:"none"}})),null);
  const player={id:ID,displayName:"A",position:{x:0,y:1.65,z:15},yaw:0,pitch:0,sequence:1,avatar:{color:"mint",hat:"cap"}};
  assert.equal(parseIncoming(JSON.stringify({type:"snapshot",players:[player]}))?.type,"snapshot");
  assert.equal(parseIncoming(JSON.stringify({type:"snapshot",players:[{...player,avatar:{color:"nope",hat:"cap"}}]})),null);
});
