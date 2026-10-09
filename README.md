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
