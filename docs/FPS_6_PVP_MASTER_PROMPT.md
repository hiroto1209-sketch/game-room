# GAME ROOM — FPS 6.0 / PvP Foundation Master Prompt

You are the engineering director for `hiroto1209-sketch/game-room`, a Three.js + TypeScript/Vite + GitHub Pages client with Cloudflare Workers/Durable Objects/WebSockets for server-authoritative rooms. **Implement and test changes rather than just drafting advice. Preserve the party house, forest/pond, photo sharing, signs, Othello, ARCADE, MINI GAMES and existing player data.**

## Verified usability problems

1. Holding FIRE starts a shot timer but the firing touch might be captured by its button. iOS Safari can cancel/re-target PointerEvents as a second or third touch enters the screen. The user cannot consistently turn the camera while firing.
2. ADS/AIM previously only changed camera FOV (zoom); no useful aiming benefit, weapon sight alignment, recoil behavior or hit feedback.
3. PvP needs clearly separated UI input ownership and authoritative server decisions; simply adding more gun textures won't solve the foundations.

## Highest-priority acceptance behavior

- Touch A, left half on canvas: movement joystick.
- Touch B, FIRE button: continuously shoot at the preexisting server-enforced cooldown.
- While B is held, dragging B must rotate the camera (not stop the shots). Movement continues.
- Touch C, free right-half canvas: also rotates the camera **independently of B** while B stays firing.
- Release A: B keeps firing. Release C: B keeps firing. Release B: firing stops immediately but A/C continue.
- Separate AIM/ADS button held (optionally Touch D) switches to precision mode and does not steal A/B/C or trigger a weapon shot.
- iOS Safari reliable fallback: use `TouchEvent.changedTouches` / `Touch.identifier` on native events when pointer capture fails or iOS cancels PointerEvents; prevent double camera drag if both event APIs fire. Keep mouse and pen PointerEvents as first-class input.
- All touches must reset on `blur`, `visibilitychange`, title/menu/modal transitions. Target 30fps stability, never invent actual FPS.

## Meaningful ADS — not just zoom

- Align a **lightweight** rendered blaster's sight to screen center, ease the FOV rather than snap.
- Reduce **real gameplay recoil** while ADS (hip ~0.027 rad vertical vs ADS ~0.006 rad per shot) and slow fine look movement; the server always receives the *actual resulting camera yaw/pitch* for subsequent hitscan.
- Add a clear precision reticle with a small inner circle and edge ticks. ADS tightens reticle; enemy under aim highlights; confirmed server hit lights hitmarker and damage.
- Render a short muzzle flash and low-poly weapon viewmodel under the camera. No huge GPU particles, complex lighting, unrealistic fully simulated projectile counts.
- If future weapon spread or headshot zones are introduced, compute hit chance/headshots **server-side**; do not allow clients to report damage or confirmed hit.
- Make ADS valuable through stability/feel and target clarity, not aim-bot auto-aim or auto-hit. No hidden hitscan advantage controlled only by a forgeable client boolean.

## Mobile and Desktop

- FIRE = held automatic fire. Drag-to-look on FIRE finger is supported, and free right-screen drag works simultaneously.
- AIM = held precision ADS (smoother sights, lower recoil and look sensitivity).
- WALK = left canvas stick; JUMP = separate immediate action. All buttons need correct `touch-action:none` and independent pointer/touch ownership.
- Desktop: WASD movement, left fire, right ADS, mouse look. Pointer Lock is optional/desktop-only; ensure Safari's mouse/touch behavior isn't broken.
- Respect safe areas, landscape/portrait, side bars, transparent HP badge at upper-left. HUD must not intercept joystick touch.

## PvP backend evolution — roadmap after controls stabilize

1. Preserve Cloudflare authority for shot cooldown, valid angle, range, obstacles, HP, spawn protection, respawn and peaceful mode.
2. Add per-player damage acknowledgments and cross-device target confirmation events, with timestamp sequencing.
3. Server-validated kills, assists and scoreboards; room match/lobby separation; leave/reconnect rules.
4. Latency measurement + interpolation/reconciliation and bounded lag-compensated hitscan history (server decides).
5. Team/free-for-all modes, spawn-zone protection and optional safe exploration areas.
6. Different weapon profiles, reload and bloom based on server-owned weapon state; rate-limit messages.
7. Mobile input options, sensitivity slider and visual target-practice session to tune aim.

## Engineering workflow and tests

- Snapshot current `main` to `backup/pre-fps-input-rework`, work in feature branch.
- Validate joystick A, FIRE drag B, independent right look C, AIM D; every release/cancel combination; no cross-finger cancellation.
- Validate ADS recoil numerical differences and camera pitch limits, and visual muzzle flash cleanup.
- Check `npm run typecheck && npm test && npm run build && npm run check:worker && npm run test:realtime`.
- Inspect iPhone Safari **on actual hardware**, 2–3 devices, including a live room, after code tests. Monitor frame times / render calls; don't claim real Safari behavior based only on synthetic touch tests.
- Keep Cloudflare Worker packet contracts backward-compatible unless necessary; do not roll out any server changes without Worker-first deployment.
- Make a PR, report exact changed files, test pass/fail, unsupported features, production update instructions and rollback branch.

## Public reference resources

- https://krunker.io/guides/controls/ — independent movement/ADS/fire principles.
- https://developer.playcanvas.com/en/tutorials/first-person-shooter-starter-kit/ — mobile FPS touch and camera patterns.
- https://threejs.org/docs/pages/PointerLockControls.html — desktop raw mouse look only.
- https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Using_Touch_Events — multiple independent Touch identifiers and changedTouches.
- https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Multi-touch_interaction — multi-pointer ownership.

**Definition of done:** The user can actively walk, repeatedly fire and continuously track a moving target in first-person on iPhone without frozen camera; holding ADS helps control recoil and sight, not merely zoom. All PvP damage remains server-authoritative.
