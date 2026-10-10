# GAME ROOM 2.0 — Modular Multiplayer-Ready Party World 🎉

**Status: Phase 1 — single-player / offline only.** This version does **not** connect to a multiplayer server. Two devices cannot join each other until the next phase.

A browser-based first-person party world. Supports iPhone/iPad Safari and desktop browsers, with left-half floating joystick and right-half free-look touch controls. The original hallway, neon room, decorations, jump and settings are retained.

- Public URL (unchanged): https://hiroto1209-sketch.github.io/game-room/
- Repository: https://github.com/hiroto1209-sketch/game-room
- Pre-migration restore point: [backup/phase1-2026-10-09](https://github.com/hiroto1209-sketch/game-room/tree/backup/phase1-2026-10-09)
- Development branch: [feature/game-room-2-phase1](https://github.com/hiroto1209-sketch/game-room/tree/feature/game-room-2-phase1)

## Gameplay

- Tap **スタート** to enter the hall and walk toward the neon party room.
- On touchscreens: **left half = walk** (floating joystick), **right half = look**. Both pointers are tracked independently.
- **JUMP** to jump; nearby interactables show an **あそぶ** button.
- On PC: **WASD**, **mouse drag**, **Space** to jump, **E** to interact, **Esc** for settings.
- Settings include sensitivity, brightness, reduced motion, and an optional generated WebAudio melody.
- **Preview-only developer switch**: add `?previewAvatars=1` to see a placeholder guest model. It is local-only and **not a connected player**.

## Technical structure

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | Bootstrapping, UI state, render loop, feature integration |
| `src/world/PartyWorld.js` | Original procedural scene generation and decor animation, isolated unchanged for safe migration |
| `src/world/PartyWorld.d.ts` | Typed public boundary for world renderer, colliders, interactables |
| `src/world/InteractionManager.ts` | Find nearby interactive objects |
| `src/input/DualTouchController.ts` | Independent pointer IDs, keyboard, pointer cancellation and safe reset |
| `src/input/joystickMath.ts` | Pure joystick mapping (dead zone, direction, normalization) |
| `src/player/PlayerController.ts` | Acceleration, camera-relative motion, simple collisions and jumping |
| `src/camera/CameraController.ts` | Look rotation, pitch limits and camera follow |
| `src/player/PlayerManager.ts` | Player ID and **remote avatar presentation** (placeholder meshes + labels + interpolation) |
| `src/types/Player.ts` | Shared player state and validation helpers |
| `src/network/protocol.ts` | Random URL-safe room IDs, typed messages, inbound/outbound validation |
| `src/network/Transport.ts` | Disconnected offline default + optional encrypted WebSocket transport abstraction |
| `src/audio/MusicController.ts` | Opt-in synthesized music, independent from game logic |
| `tests/core.test.mjs` | Node tests for joystick input, random room IDs and message validation |
| `.github/workflows/pages.yml` | TypeScript typecheck, unit tests, Vite production build and GitHub Pages deploy |

**Migration note:** Three.js procedural geometry is kept in a standalone JavaScript module with TypeScript declarations. This is intentional: avoid redrawing/changing the existing visual scene while migrating the rest of the application to strict TypeScript. A full typed scene rewrite is an optional later step.

## Building

Requires Node.js 22+.

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

The Vite production output is in `dist/`; build base is explicitly set to `/game-room/`.

## GitHub Pages migration

1. In **Settings → Pages**, switch **Build and deployment → Source** from **Deploy from a branch** to **GitHub Actions**.
2. The workflow `.github/workflows/pages.yml` deploys **only after quality checks pass on `main`**.
3. The Pages URL remains **https://hiroto1209-sketch.github.io/game-room/**.
4. The old `main.js` file is deliberately preserved for rollback, but Vite uses `src/main.ts` as its entrypoint. You can revert to the backup branch if a major regression is discovered.

**Safe transition:** the repository-root `index.html` still loads legacy `main.js` when published directly from the branch, so the existing working Game Room remains playable during migration. Vite's HTML transform swaps that script to `src/main.ts` for development and compiled `dist/` builds. The modular 2.0 client appears at the existing URL only after selecting GitHub Actions as the Pages deployment source.

## Architecture and threat model

- Offline mode uses `OfflineTransport` and **never attempts a WebSocket connection**.
- An online server URL is not hard-coded, and no secrets are shipped in client assets.
- `WebSocketTransport` only allows `wss://`, validates incoming messages and limits packet size.
- Room codes use `crypto.getRandomValues` and 192-bit random identifiers. A room code is an **unguessable locator**, **not** a replacement for server-side authorization.
- Future server must enforce room membership, maximum concurrent players, rate limits, game rules and authoritative score verification. Client-side validation alone is insufficient.
- `PlayerManager` supports validated remote snapshots with monotonic sequence numbers, interpolation and avatar cleanup; **no snapshot sender exists yet**.

## Regression matrix

| Test | Target |
| --- | --- |
| UI title → game → title | Same start screen and world reset |
| Tap any point on left half | Joystick originates at touch position |
| Drag right while walking | No unintended joystick release |
| Drag either pointer across midline | Pointer ownership remains fixed |
| Hold a pointer then pause/switch away | Input clears safely |
| Walk forward after yaw rotation | Move in camera forward direction |
| Jump near furniture/walls | Preserve simple collision and ground behavior |
| iPhone Safari, iPad Safari, desktop | Verify touch feel, layout, FPS and lighting |
| Node tests & Vite build | Run automatically on pull requests |

### Performance comparison

Phase 1 keeps the **same procedural world-building functions, same decorative meshes and same 1.75 maximum pixel ratio** as the previous single-player version. A measured comparison of load time, frame rate, memory and bundle size has **not yet been completed**. Before claiming an improvement or performance regression, capture measurements on the **same iPhone, browser version and network** and record them here.

## Next Phase (not implemented)

1. Cloudflare Durable Object authoritative room server and WebSocket transport integration.
2. Create room, copy invite link, join from a second iPhone.
3. Remote avatar spawn/despawn, smoothing, reconnect handling and heartbeat.
4. First two-player minigame, server-owned rules and scores.
5. Persistence, abuse prevention, privacy/security hardening.

Do not describe Phase 1 as an online multiplayer product: it is a modularized offline client designed to support that future feature.

## Phase 2 preflight improvements (mobile input + media monitor)

- **Walk + Jump**: The JUMP button responds directly to a touch/pen `pointerdown` to avoid iOS Safari suppressing the synthesized click while a different finger maintains movement. Keyboard and mouse activation remain supported. Walking velocity is not reset when jumping. Moving-jump regression tests are included.
- **Custom wall display**: Walk from the start corridor into the party room, then turn right and approach the wall-mounted **YOUR PHOTO** monitor near the entrance. Press **あそぶ** when the "モニターに画像を表示" prompt appears.
- In the monitor editor, choose an image from your device (**JPEG, PNG, WebP, GIF; up to 8MB**) or paste a direct HTTPS image URL from a host supporting browser CORS, then press **モニターに表示する**. Use **画像をリセットする** to restore the default placeholder.
- The selected image is **rendered only on the current player's browser**. It is not uploaded, synchronized with other players, or persisted across reloads. GIFs are displayed as static frames.
- Shared/persistent images in a multiplayer room will require server authorization, size/type checks, content handling and object storage (e.g., private Cloudflare R2 with server-authorized upload flows). Do **not** put R2 secrets in the browser.

### Manual mobile checks
1. Hold left-thumb movement forward while tapping **JUMP** with the right thumb; movement must continue throughout the jump.
2. Keep the left joystick active and rotate the camera with the right thumb.
3. Approach the wall monitor; choose a photo from iOS Photos and confirm the textured monitor updates in 3D.
4. Open the editor, try an invalid URL or oversize file, and verify a clear error without breaking controls.
5. Close the editor and resume free movement; the joystick must not remain stuck.

## Phase 2 — invitation rooms (Cloudflare deployment required)

> **Important:** The GitHub Pages frontend still works offline before a Worker is deployed. The invitation buttons activate only after the public GitHub Actions Variable `GAME_ROOM_SERVER_URL` is configured and a new Pages build succeeds. A Cloudflare account on its own does not activate multiplayer.

### Current Phase 2 functionality

- **Create room:** Browser creates a cryptographically random 192-bit / 32-character ID; a different Durable Object is selected for each room. No human-readable, sequential, or guessable room IDs.
- **Join room:** Other guests open the invitation URL `https://hiroto1209-sketch.github.io/game-room/?room=ROOM_ID`, choose a display name and tap `招待ルームに参加`.
- **Remote avatars:** PlayerManager renders named low-poly avatars and interpolates their movement. Remote movements are sent at approximately 10Hz; connection limits are enforced on the server.
- **Connection lifecycle:** Welcome, snapshot, join, leave, basic reconnection and room departure. Normal offline Start mode remains available. The monitor photo remains **local-only**.
- **Server controls:** Room capacity 8; accepted browser Origin restricted to the official Pages origin (and local Vite development); 4KB packet limit; bounded coordinates, yaw, pitch, sequence, and minimum interval between accepted movements. Server assigns client IDs. These checks are a foundation, not authoritative physics or comprehensive anti-cheat.
- **No persistent rooms, auth/accounts, chat, audio chat, storage of images, scores or minigame networking** in this phase. Anyone who has the invitation URL can join while room capacity remains.

### The 3 things the project owner must configure (never paste secrets into a chat)

**Step A — Cloudflare credentials in GitHub Secrets**

1. In [Cloudflare Dashboard](https://dash.cloudflare.com/) find **Account ID**.
2. Create a scoped Cloudflare API token for deploying Workers (the initial creation of a Worker may need product-level Workers Admin; constrain permissions as far as possible). Token values must not be committed or shared in messages.
3. In [Repository → Settings → Secrets and variables → Actions](https://github.com/hiroto1209-sketch/game-room/settings/secrets/actions), add repository secrets:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`

**Step B — Deploy Worker**

Open [Actions](https://github.com/hiroto1209-sketch/game-room/actions) → **Deploy Game Room Cloudflare Realtime Worker** → **Run workflow**, on `main`. Successful logs report the real URL, typically `https://game-room-realtime.<YOUR_WORKERS_SUBDOMAIN>.workers.dev`. Do not assume your subdomain; copy it from the successful deploy log or Cloudflare dashboard.

The Worker uses `server/wrangler.jsonc` with a SQLite-backed Durable Object `RoomHub` and endpoint `GET /rooms/{32-character-token}` (WebSocket upgrade). You can verify deployment by visiting `https://<your-worker-url>/api/health` in a browser, expecting an `ok:true` response.

**Step C — Connect GitHub Pages to the Worker**

In [Repository → Settings → Secrets and variables → Actions → Variables](https://github.com/hiroto1209-sketch/game-room/settings/variables/actions), add the non-secret repository **variable** `GAME_ROOM_SERVER_URL` whose value is the complete HTTPS Worker origin (do not include a `/rooms/...` suffix). Example only: `https://game-room-realtime.example.workers.dev`.

Then open GitHub Actions → **Game Room 2.0 — test, build and deploy** → **Run workflow** on `main`. The production Vite build reads this URL via `VITE_GAME_ROOM_SERVER_URL`; **never put an API token in a VITE_ variable**, since frontend variables become public.

### Two-device acceptance test

1. Open Game Room on iPhone A, choose a name and tap **ルームを作る**.
2. Wait until HUD reads **オンライン**, then tap **招待リンク** and send it to iPhone B.
3. Open URL on iPhone B, choose another name, tap **招待ルームに参加**.
4. Both devices must see the second avatar and `2人` in the HUD, observe the other walking, turning and jumping.
5. Tap **退出** on B; A's avatar list should remove B.
6. Temporarily disconnect Wi-Fi on B, then reconnect; check the status changes to **再接続中…** and the client recovers.
7. Return to normal Start solo mode, verify two-finger controls, jump, monitor and styling are unchanged.

**Limitations:** Browser interactions with the Cloudflare Worker cannot be fully tested until the account credentials and public URL are installed and deployed. iPhone Safari real-device and distant-network latency tests are manual acceptance gates.

### Local development

```bash
npm install
npm run check
npm run test:realtime
npx wrangler dev --config server/wrangler.jsonc
```

In another terminal, set `VITE_GAME_ROOM_SERVER_URL=http://localhost:8787` only after you have adjusted local URL handling: the production client currently requires HTTPS/WSS and intentionally refuses insecure server endpoints. For secure published testing, use the deployed `https://...` Worker URL with `npm run dev`.

## Phase 3 — World-state synchronization (room photo + lights)

**Motivation:** two users could see one another, but the wall monitor was local to each browser. Phase 3 adds a **server-authoritative shared room state** rather than merely synchronizing player movement.

- **Light show:** Activating the existing light switch broadcasts its current on/off state to every connected peer.
- **Shared monitor:** When entering the monitor editor in an online room, users can explicitly opt into **オンラインの参加者全員へ共有する**. A screenshot-quality JPEG is generated from the visible monitor image in the browser, downscaled and capped to roughly 80 KiB encoded; the original photo is never sent or stored.
- **Privacy:** The share checkbox is always **off by default**, and absent in offline mode. Sharing photos is optional; private local monitor changes continue to work.
- **Persistence:** The room's light mode and shared monitor JPEG are stored in the SQLite-backed Durable Object with a revision number. New joiners and reconnecting players receive the current room state. Saved room customization is scheduled for deletion after **7 days without changes**. Anyone possessing an invite URL may currently join and alter the image, so do not share private photos or sensitive content. A future host/moderator permission system should gate shared customization.
- **Bandwidth discipline:** Photos are only broadcast **on edit**, never every frame. Player movement retains its existing ~10Hz update interval; shared images are capped, while small messages retain 4KB limits.
- **Future growth:** This is the first version of a shared room document. Furniture layouts, room selection, interactions and game state should use typed, server-owned edits with specific permissions rather than transmitting whole scenes every frame.
- **No image moderation or durable R2 asset gallery yet.** Room photo sharing is a small-room prototype and is unsuitable for unrestricted public uploads.

### Release after merge — IMPORTANT

Deploy the **Worker first**, using [Deploy Game Room Cloudflare Realtime Worker](https://github.com/hiroto1209-sketch/game-room/actions/workflows/deploy-realtime.yml) → **Run workflow** on `main`. Then verify its health endpoint, and rerun [Game Room Pages](https://github.com/hiroto1209-sketch/game-room/actions/workflows/pages.yml) on `main` if the browser is still showing a previous build.

Re-deploying the Worker is essential because its new `room_state` and `room_update` protocol handlers are not present in the previous deployment. **No new API keys, GitHub Secrets, Cloudflare accounts, R2 buckets or variables are required** if the existing Cloudflare deployment works.

### Manual acceptance

1. A and B join the same room via invite URL; confirm both show `オンライン / 2人`.
2. A approaches the wall monitor, selects a photo, **checks the sharing box**, and presses **モニターに表示する**.
3. B should see the new image on the same 3D monitor. A should see it too.
4. A toggles the existing light show switch. B should see the same lighting mode.
5. B reloads with the invitation URL. The shared photo and lighting mode should be restored from Durable Object storage.
6. C joins that same invitation URL later; the shared photo and lighting mode should also be restored.
7. Test solo mode: image edits are private, and the room UI does not request uploads.
8. When A chooses reset while sharing is checked, the other monitor should revert to the default screen.

### iPhone performance measurements

Use a real iPhone for FPS and display measurements; code/build tests do not guarantee a stable 60fps. For future expansion, split the map into independently loaded or activated rooms, minimize draw calls through instancing, share materials and textures, and cull distant geometry. Do not extrapolate maximum map size from square meters alone.

## Phase 4-A — THE DOOR / Moonlit Outside (new)

**Purpose:** preserve the multiplayer party room while allowing real movement through a new door to a lightweight, deterministic night-time outdoor region. The new areas are scenery/exploration only: HP, blasters, live sign editor and playable arcade games belong to subsequent Phase 4 PRs.

- Exit location: **east wall of main lounge**, near `x=10,z=-5` (opposite the photo monitor side of the room). The original wall's 3D mesh **and** horizontal collider have been split so you can walk out and come back. A glowing portal frame leads to the exterior.
- Destination: **MOONLIT WORLD** with a plaza path, lamp posts, pond with lily pads, instanced trees/grasses/stones, distant stars/fireflies and voxel-style ruins.
- Shared map: all devices use `shared/worldRules.js` with a fixed `WORLD_SEED`, deterministic chunk geometry and identical world boundaries. **The world mesh is built locally**, not streamed over WebSocket; player movement still syncs with Durable Objects.
- Rendering: 16×16-unit outdoor tiles, a **3×3 active neighborhood**, `InstancedMesh` vegetation, shared geometries/materials and a low-detail fallback terrain under unloaded cells. No model downloads or additional texture assets.
- Movement: extends `PlayerController` with optional ground-height and outdoor collision predicates without changing legacy indoor AABB/JUMP controls. First outdoor terrain is flat; future stairs/slopes require a separate physics upgrade.
- Network: Worker uses the same shared `validWorldPosition`, pond blocking and door crossing constraints. The original Cloudflare room ID, RoomHub Durable Object class/binding, existing photo state and current invitations are preserved.
- Wayfinding: a non-interactive HUD location label changes from **PARTY LOUNGE** to **MOONLIT PLAZA**, **STARLIT POND**, or **BLOCK GROVE**.

### Release order (essential)

1. Review GitHub Actions for this PR — TypeScript, Node unit tests, Vite production build, Cloudflare Wrangler bundling and local WebSocket integration must all succeed. **The Pages deploy job has been deliberately changed to manual-only for release safety**; future feature releases will also require a manual Pages workflow run unless this setting is deliberately revised.
2. **Deploy Cloudflare Worker first:** [Run GAME ROOM Cloudflare Realtime Worker workflow](https://github.com/hiroto1209-sketch/game-room/actions/workflows/deploy-realtime.yml) on `main` after merge.
3. **Then deploy Pages:** [Run Game Room Pages workflow](https://github.com/hiroto1209-sketch/game-room/actions/workflows/pages.yml) on `main`. The existing `GAME_ROOM_SERVER_URL` variable remains unchanged; no new Cloudflare token is required.
4. Open [GAME ROOM](https://hiroto1209-sketch.github.io/game-room/) on iPhone, iPad and a second connected device. From the central hall, move right toward the decorated doorway near the main dance floor.
5. Walk out together, look at the pond, walk around the trees, return through the same doorway. All peers should see positions and jumping; confirm that shared photo, lights, invite URL and 2-thumb controls still work.
6. **Measure Safari performance** before assuming the world meets a particular FPS target. Low-power devices may require a smaller active chunk radius, fewer lighting effects or a reduced pixel ratio.

### Known limits

- The first release is a **walkable connected night landscape**, not infinite terrain. Bounds are intentionally limited and the pond is non-swimmable.
- No stairs, climbing, shooting, health or mini-games are implemented in Phase 4-A.
- The fixed common world seed ensures deterministic terrain for all visitors in this version. Room-specific editable terrains require a future world-state migration.
- The authoritative server validates basic door traversal, position/speed, pond and tree/block obstacles, but it is not yet a full 3D physics server. Avoid calling the multiplayer world exploit-proof.
- New scenery and HUD behavior require real iPhone/iPad visual/interaction verification; build tests alone cannot guarantee a specific FPS.

## Phase 4-B/C/D implementation

- **WILD WORLD:** reuses the existing deterministic outdoor terrain, instanced vegetation, moonlit pond, boardwalk and block ruins, adding a new glowing outdoor arena.
- **LIVE SIGN:** keeps the original GAME ROOM sign, overlays a scrolling ticker, and lets guests near the sign edit Japanese/English text (80 characters). Online changes are broadcast and persisted for later joiners.
- **AIM & BLASTER:** inside the marked arena, the center aim activates an energy-blaster mode. The server owns HP (100), hit tests, 25-point changes, cooldown (400ms), respawn (4 seconds) and a short respawn shield. The lobby and general outdoor world remain safe zones. Solo play shows visual effects only.
- **No new credentials:** existing Cloudflare Worker and Pages connection remain; the Worker must be deployed **before** Pages after merge.

### Release verification

1. Confirm GitHub Actions: TypeScript, unit tests, Vite build, Worker dry run, and local WebSocket integration all green.
2. Run `deploy-realtime.yml` on `main` first.
3. Run `pages.yml` on `main` second.
4. Test with three devices: outdoor travel, shared photos, lights, marquee edits, HP synchronization and respawn.
5. Confirm the existing two-thumb movement/jump controls still work on iPhone Safari.
6. Log performance on actual iPhone/iPad; do not assume or claim a measured FPS before testing.

### Limitations

This version is a prototype: no advanced lag compensation, comprehensive host permissions, or fully hardened game anti-cheat yet. MINI GAMES and ARCADE machines are not included in Phase 4-D. For feature creation ideas, see `docs/GAME_ROOM_IDEA_AUTOPILOT.md`.


## Phase 4.1 — Room-first UI, full-width LIVE SIGN and multiplayer FLOOR OTHELLO

### What is new

1. The former central **LIGHT SHOW** kiosk, sign face and **blocking collider** are gone. The dance floor and large sign behind it are visible without a pillar obstruction.
2. The original fixed **GAME ROOM** wall lettering is replaced by a full-width editable, shared high-contrast sign. Short text is large and centered, longer text scrolls from right to left, and Reduced Motion avoids continuous scrolling. The existing **`signText`** room state remains the authoritative source (80-character validation and later-join restoration).
3. The existing eight-by-eight dance-floor tile arrangement doubles as a **server-authoritative Othello/Reversi board**. Near the floor, press **対局を始める**; the second online player presses **白で参加する**. Everyone else spectates the same board. Aim at a glowing legal square with the screen-center crosshair, then tap **あそぶ** to place a disc. Captures, pass turns, final scores and win/draw are computed by a shared pure `shared/othello.js` reducer and accepted only by the Cloudflare server. A single browser without online connection offers offline hot-seat practice (alternate black/white).
4. **Low overhead:** board uses five instanced draw collections (64 tiles, black discs, white discs, legal hints and a single selected-square marker), and only changes after game-state updates. Othello snapshots are separate from photo/lighting/sign room updates, so placing a disc does not re-send the shared image.
5. Top-right hamburger now opens a menu containing **online status, player count, invite URL and leave** actions. While exploring, just the minimal logo, menu and interaction/jump/arena HUD remain visible. The zone indicator appears only for a short interval after changing areas, then fades.

### Controls and rules

- Black starts. White must join before online moves are accepted; other players automatically spectate.
- Move the camera to point its crosshair at the dance-floor square. Valid destinations glow; press the existing interaction button (**あそぶ**) to place.
- The server rejects spectator moves, out-of-turn moves and non-flipping moves. No client can claim a win or send its own board.
- When a player disconnects, a waiting game is released or an ongoing game ends by forfeit, preventing abandoned seats from blocking a new match.
- **In single-player mode:** enter the lounge, start Othello locally and take turns as both colors from one device. No AI opponent in Phase 4.1.
- No change to photo-sharing permissions, light data retention, names/invites, 3-person movement, arena, outdoor boundaries or gameplay.

### Production rollout (after GitHub CI passes)

1. [Deploy Worker workflow](https://github.com/hiroto1209-sketch/game-room/actions/workflows/deploy-realtime.yml) → **Run workflow** on **main**. Confirm green and the existing `/api/health` endpoint responds.
2. [Deploy Pages workflow](https://github.com/hiroto1209-sketch/game-room/actions/workflows/pages.yml) → **Run workflow** on **main**, after the Worker has been updated. Existing GitHub Secrets and `GAME_ROOM_SERVER_URL` remain unchanged.
3. On iPhone A, join the room, approach the floor and press **対局を始める**. On iPhone B, press **白で参加する**. On iPad C, join and verify spectators see every legal move and the count. Test reload/new join restoring the current board.
4. Enter an English and Japanese announcement and confirm the entire rear wall sign updates for all devices, including on a later join.
5. Verify the center is no longer blocked and the menu contains **online / count / invite / leave**. Verify the zone banner disappears after its brief transition.
6. Regression check: wall monitor photo, arena HP/FIRE, jump while walking, outdoor return and offline Start.
7. Profile iPhone Safari. Source/build tests do not establish actual FPS or a guaranteed mobile appearance.

### Known limitations

- Active match persists in the existing Durable Object storage per invite room. Anyone with the invite can start a new match when idle/finished, but only seated players may cancel an active match.
- No built-in CPU, tournament lobby, timers, host-only permissions or room-wide leaderboards yet.
- Othello accepts a move only while joined online and assigned to the correct color. Offline mode is practice/hot-seat, not AI.
- iOS Safari visual and touch testing still requires real devices; three-device CI tests are a server-side WebSocket integration, not real Safari.

## WORLD EVOLUTION 5.0 — performance-first terrain and global secret blaster

**Status:** code branch implementation; actual iPhone 30/60fps, three-device live play and production deployment must be verified separately.

- **Static Coastal-inspired terrain** uses a deterministic low-amplitude hill height function in `shared/worldRules.js` and low-poly, vertex-colored terrain patches in `src/world/OutdoorWorld.ts`. Existing interior, entrance, pond, protected walkways and arena remain navigable. Instanced grass, trees, rocks and blocks use the same terrain height and shared world seed. This is an **original** environment, not Coastal World assets.
- **Performance:** replaces continuous balloon/disco/tile-light animations and pond/firefly opacity updates with static scenery. QualityManager observes frame times and slowly lowers or restores `WebGLRenderer.pixelRatio` within safe bounds. No per-leaf/grass animation, expensive water reflections or continuous particle system is introduced. Three.js doesn't promise FPS; measure the actual device before claiming success.
- **Movement correction:** movement failures that violate the **existing** server limits now emit a bounded `position_correction` with last accepted position and sequence. The local PlayerController resets its velocity/position on receipt rather than continuing to send impossible coordinates and repeated Invalid movement errors. Initial connection also sends authoritative spawn. The legal outdoor bounds, pond blocking, anti-teleport thresholds and door-wall validation are **not disabled**.
- **Hidden gun:** five taps within 2.4s on the upper left GAME ROOM logo (while playing) show a code input. Enter `NEON777` to request server authorization. The worker validates the code with rate limiting, enables the blaster and turns off Peace Mode for the player. The easter egg is not an authentication credential or real security barrier.
- **Reconnect:** the browser records only a session-level "previously unlocked" flag and **re-sends the code** after each new online spawn. The server revalidates on every new connection. Offline sessions can use local visual-only blasts after discovery.
- **Global Health:** every joined player already has HP=100 in server state; the browser now shows a tiny HP HUD across the world. Unlocking enables firing *everywhere*; server checks firing cooldown, previously authorized weapon state, firing/target Peace Mode, alive state, muzzle direction, 28-unit range and coarse ground/static-object/building occlusion. Damage remains 25 per hit; HP0 respawns at the safe original lobby spawn after ~4 seconds and gains 2 seconds shield.
- **Peace Mode:** on joining, all guests are peaceful by default. Unlocking the weapon automatically opts the unlocking player into PvP; players can enable Peace Mode again from the existing settings menu to opt out of dealing and receiving PvP damage. It does not remove HP. Guests who never unlock remain protected from shots.
- **Retention and safety:** no new Cloudflare product, API token, secrets, third-party assets or Durable Object migration. Existing photo/sign/othello room state remains unaffected. This is a hobby-world combat prototype; professional lag compensation/anti-cheat, true account identity and full 3D authoritative physics remain future work.

### Controlled rollout

1. Verify GitHub CI: TypeScript, unit, Vite build, Worker dry run and local Durable Object multi-WebSocket integration must be green. Keep `backup/pre-world-evolution-5` for recovery.
2. Run **[Cloudflare Worker deploy](https://github.com/hiroto1209-sketch/game-room/actions/workflows/deploy-realtime.yml)** on `main` FIRST.
3. Run **[GitHub Pages deploy](https://github.com/hiroto1209-sketch/game-room/actions/workflows/pages.yml)** on `main` SECOND. Pages remains manual-only.
4. With three devices in the same room, verify roof/door, hilly ground, no water entry, photo sharing, sign, Othello, motion/jump. Then tap GAME ROOM logo 5 times, unlock with `NEON777` on two devices, aim from outside ARENA and verify HP decreases on both screens. Toggle Peace Mode and confirm a shot no longer damages the protected player.
5. Disconnect/rejoin and verify code auto-revalidated, HP resumes at server-provided spawn; test deliberate impossible movement only in local dev scripts to ensure reconciliation and wall/teleport prevention.
6. On actual iPhone/iPad, record p50/p95 frame times, frame calls, resolution scaling, initial load and memory compared to the pre-update backup; **test success is not a substitute for FPS measurement**.

### Known constraints

- Player identity is transient per WebSocket; the 5-tap discovery is restored only per browser tab session via `sessionStorage`, not as a permanent server-owned user achievement. Persisted identity would require authentication.
- Shot obstruction is a coarse deterministic 3D sampling approximation for current static geometry; it is not a complete moving-furniture/navmesh anti-cheat solution.
- The new terrain uses static vertex colors and a cheap height field, not a full production terrain texture-splatting pipeline.
- Client geometry and server movement both use shared height data, but obstacles and legacy AABBs still limit steep slopes. Do not declare advanced climbing or perfect physics.
