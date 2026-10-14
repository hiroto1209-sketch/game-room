# Residents and dialogue

## TOKOTOKO

The uploaded `tokotoko-threejs-pack(1).zip` GLB is imported unchanged (245,500 bytes; SHA-256 `ad401f3f1c91a36099dcb0a7935c37989c62f6cfdc34fe86d7fa73b1ed49e191`). It retains rounded ears and the provided Walk/Idle clips. World scale is 0.65, with 11,744 triangles and 14 meshes. Loader/model downloads are deferred until the player approaches outdoors.

The resident roams the rear courtyard, west lawn and north side of the house, alternating movement and pauses at twelve waypoints. Every sampled route point has clearance from the original house/walls/terrain. This is bounded autonomous ambient roaming, not an enemy or a quest. A shared clock drives position and foot phase without continuous NPC broadcasts. Network clients estimate the server clock from the join round trip.

A conversation holds the resident at the current position and turns it toward the speaker. In multiplayer, the Worker validates the player's proximity and line of sight, persists the hold in the room Durable Object and broadcasts it to all members and late joiners. Holds last at most twelve seconds per renewal; an active conversation renews every six seconds. Closing dialogue stops renewal, and walking resumes smoothly when the remaining hold expires. No external chatbot or player-written conversation is used.

## Body collision and POKO

Both residents have bounded cylindrical body colliders, shared between client and Worker. Movement cannot pass through their bodies; feet above the top can pass. POKO supports landing on top after clearing it. A player who is already overlapped by a roaming resident can always move away. NPCs are neutral, with no damage or combat targeting.

POKO retains its pop/hide welcome. Its anchor changes from (17,-5.7) to (18,-6.1) so its solid body does not block the straight doorway path. Talk prompts are disabled before models load or while POKO is underground. Both prompts use the existing proximity interaction button. The conversation panel pauses local controls and firing, has large touch buttons, traps keyboard focus, supports Escape, and restores controls on close. There is no forced reading timeout.

## Jump

The launch velocity is 5.0 × 1.3 = 6.5. Gravity remains 11.8, so the physical apex increases from approximately 1.06 to 1.79 units (height scales with velocity squared). The bounded server jump allowance and exterior height limit remain active. A two-second server-owned takeoff-height allowance supports legitimate jumps off stones or POKO without rejecting an elevated departure; it cannot be supplied by a client packet.

## Verification

New unit tests cover route clearance and continuity, pauses/holds/renewal, body blocking and escape, grounded support, strict protocol IDs, interaction visibility and the exact jump launch multiplier. Phone portrait/landscape visual tests cover actual GLB rendering, roaming, collisions, conversation pages, focus/close and control restoration. A real two-client/late-join Worker test covers shared holds, rejected distant conversation and body movement corrections. Existing FPS/HUD/forest/exploration and realtime gates remain mandatory. Physical iPhone/iPad Safari validation remains outstanding.
