# GAME ROOM Phase 9 — Hidden Exploration World

## Deliverable — a route players really walk

1. **ECHO GROTTO**, entrance `(65,32)`: cave silhouette, shared collision-checked stone side walls, a roof above player head height, glowing mouth and a discoverable memory crystal near `(72,32)`. Walk through from either side, no teleport, no fake second floor.
2. **SECRET STONE PATH**, `(78,32) → (90,37)`: subtle stone walkway and neon waypoint pebbles, aligned to the SAME deterministic ground height used by the Worker. Players find a stamp near `(80,33)`.
3. **SKYLOOK VISTA**, `(90,37)`: smoothly elevated real terrain, static overlook markers, a viewing ring, sign and another discoverable marker. Not a floating platform; ascent uses the existing walkable slope.
4. **EXPLORATION JOURNAL**, inside the normal menu: 3 stamps with one-time discoveries. Unknown secrets appear as ???. Progress is device-only localStorage; *no server sync, leaderboard or account promise*. Existing World Map gains cave and lookout navigation targets.
5. **Mobile performance**: 4–9 instanced geometry groups, no extra reflections, shadows, moving foliage, animations, physics libraries, network messages, or new paid assets. Hide distant hidden scenery on coarse world-distance check. Preserve original continuous TerrainSurface and all interior party furniture.

## Collision and network correctness

- **`shared/worldRules.js` is the only source of new hill height, rock wall collision, and vegetation exclusion**, and is imported unchanged by the server and client. The Cloudflare Worker needs no protocol change because it already imports these shared deterministic functions.
- New cave obstacles are registered in outdoor colliders. The ceiling is above player eye height and does not incorrectly block travel underneath. Existing house, pond, Starshot Range, NEON ARENA, HP/PvP, shared photo, Othello and avatars are unchanged.
- Tests explicitly walk cave both ways, traverse every segment of the secret path, check hills against the **current** server movement validator and speed limits, and prevent procedural trees/rocks from spawning in the playable route.
- Preserve range x≈33..60/z≈12 and pond x≈57/z≈−27; exploration is built in upper-right/back-country x≈65..90/z≈28..37.

## Runtime QA

- `npm run typecheck`
- `npm test` (new tests/exploration-world.test.mjs)
- `npm run build`, `npm run check:worker`, `npm run test:realtime`
- `npm run test:visual` (FPS iPhone portrait/landscape/PC)
- Real iPhone Safari cave/secret-route/skylines/FPS: **must be checked by user on device**. Automated build/test results do not guarantee 30 or 60fps; record p50 and p95 frame times on a supported iPhone before claiming achievement.

## Rollout

1. Backup branch: `backup/pre-hidden-exploration-v9`.
2. No new WebSocket packet type. **However**, because shared world movement/collision rules are changed, publish the matching **Cloudflare Worker before the new GitHub Pages client** using `deploy-realtime.yml` then `pages.yml`. During rollout, briefly avoid online traversal of the new area until both are on the matching revision.
3. Verify 3 guests can walk the same cave and climb Skylook using normal walking; verify photo/sign/othello/weapon/avatars still sync.
4. Actual 3-player visual quality and physical Safari FPS remain unverified until real-world acceptance.

## Follow-up directions — consent before expanding

- A group-only secret gate that requires 2 players on switches (server-authoritative shared puzzle).
- A cave labyrinth/fall-through lower level (needs true 3D height/physics and server handling).
- A shared treasure hunt and room leaderboard.
- Photo spot and group selfie on the lookout.
