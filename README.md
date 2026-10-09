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
