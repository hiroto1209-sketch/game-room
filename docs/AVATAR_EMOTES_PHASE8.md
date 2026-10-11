# GAME ROOM — Phase 8 Avatar & Emotes

## Overview

Social-first improvement with an actual in-world visual payoff. Keep low-poly performance and safe multiplayer.

**Visual avatar styling**
- 5 approved outfits: rose, mint, sky, amber, violet.
- 4 headgear choices: none, cap, crown, halo.
- Friendly low-poly body, face, arms, nameplate. On iPhone the player's own camera remains in first person (a DOM studio preview shows their design); other connected guests see the new outfit and headgear.
- Scene meshes are created only on player arrival and disposed on leave. Material colors change only when the owner changes their style. No texture downloads or physics additions.

**Emotes**
- Wave (right arm), dance (both arms/body), cheer (arms raised, small body hop).
- Play once for ~2.6s; avatars remain stationary and do not alter position/HP/collisions, and do not animate while idle.
- The small ☺ HUD button opens a compact quick menu; avatar customization lives inside the main menu.
- An emote initiated by the owner is broadcast to all peers as a short event, not as per-frame animation positions.

**Synchronization**
- Allowed client messages: `avatar_update {avatar:{color,hat}}`, `emote {kind}`.
- Worker validates fixed allowlists and exact packet structure, permits avatar changes at most every 800 ms, emote starts at most every 1600 ms, and broadcasts server-approved `avatar_state` / `emote_event`.
- Server adds the selected avatar to each player's existing public snapshot. Late joiners get current appearances and optionally a still-running emote's remaining duration.
- Appearance is kept in per-socket attachments while the user is connected, not added to persisted DO room photo/state. UI saves a local preference to `localStorage` and resends it after every successful online join/reconnect. No password, user ID or photo included in the preference.
- Existing movement packets, health and other game systems remain unchanged.

## Test matrix

- Invalid color, hat, extra keys, illegal emotes, huge duration rejected.
- WebSocket two-user avatar/emote broadcast, incoming snapshot containing appearance, three-person late join gets avatar and currently playing emote.
- Existing Othello, sign, shared photo, HP/PvP and outdoor traversal integration must pass.
- Playwright mobile portrait, landscape and desktop checks studio appearance selector, preview color, local saved option and quick emote buttons and archives screenshots.
- iPhone Safari real multi-touch/performance, 3 physical online devices, and actual in-world arm poses still require manual testing. Automated browser screenshots do not assert exact WebGL body silhouette without a connected second camera.

## Rollout

Deploy **Worker first** using `deploy-realtime.yml` on main after merge; server must recognize new social packets before the updated Pages client sends them. Then deploy `pages.yml`. Older clients continue to function without these optional packets.

Backup: `backup/pre-avatar-emotes-v8`.

## Next proposed social polish

1. Shared photo-spot + synchronized group selfie poses.
2. 3D avatar editor turntable / real mesh preview in the avatar modal.
3. Dance-floor synchronized emote party with a simple 3-beat timing mini challenge (server-owned).
4. Friend profiles, safe nickname report/hide tools, optional moderation or permissions before public room discovery.
