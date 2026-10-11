# GAME ROOM — WORLD & FPS WOW EXPERIENCE / Phase 7

## What shipped in this phase

- A genuine **STARSHOT RANGE** landmark in the outdoor world at `(33,10)`: large glowing arch/sign, visually readable 3D lanes, three ring-shaped practice targets at increasing range, quick **six confirmed hits in 30 seconds** challenge, high score. Targets use lightweight static geometry; only material color changes when a shot is fired. A distant `HORIZON SPIRE` at `(93,23)` provides a skyline landmark. None of these change the server's movement/obstacle model.
- Physical interaction: walk to the range portal and press the existing **あそぶ** button. Unlock the blaster with `NEON777` via ARMORY first. **Peace Mode can stay ON** while practicing: the local range is safe, and none of its shots are sent to the multiplayer PvP server. While the local practice is running, firing is processed locally and **not sent as a PvP attack**, preventing accidental damage to invited friends. Practice scores are local-only; *do not claim they are multiplayer/authoritative*.
- New **WORLD MAP** in the ☰ menu and touch-transparent compass showing distance and relative direction to STARSHOT RANGE, POND, HORIZON SPIRE, NEON ARENA, PARTY HOUSE and WEAPON ATM. A player icon/dotted route on a 2D stylized map helps guests navigate without another expensive 3D render pass.
- Everything stays Three.js/TypeScript/Vite, GitHub Pages, Cloudflare Workers+Durable Objects; no copied game models, no paid services, no vegetation idle animations, no new network message types.
- Explicit quality tests: Starshot target detection, timeout, shot count, map bearing, existing game tests, WebSocket smoke and visual ADS screenshot gate.

## Research and design decision

- **Krunker controls:** https://krunker.io/guides/controls/ — independent fast movement, jump, fire and ADS; this phase adds a concrete aim-practice destination instead of changing server weapon authority.
- **PlayCanvas FPS kit:** https://developer.playcanvas.com/ja/tutorials/first-person-shooter-starter-kit/ — first-person navigation/jump plus readable level structure.
- **Three.js Raycaster:** https://threejs.org/docs/pages/Raycaster.html — industry-standard camera targeting. This phase reuses the existing deterministic ray/sphere hitscan helper from `shared/combatRules.js` to match the global blaster aim, with occlusion from shared world rules.
- Do not copy references' models/characters/textures.

## Next optional major changes — ASK FIRST

1. **Arena FFA 2–8 guests?** Dedicated arena matches, visible score, server-owned kills/assists, respawn/rules and explicit safe exploration zone. Significant combat rules and data additions, requires confirmation and Worker-first release.
2. **Character cosmetics / guest nameplates / emotes?** Pop-style customization and sync, no pay-to-win.
3. **Party co-op puzzle?** Two or more players simultaneously activate different switches to open a hidden gate; server-authoritative event state and anti-spam.
4. **Day–night moods + world photo mode?** Curated static lighting presets and in-game camera photo spots. Avoid constantly animating trees/clouds/particles.
5. **Player-built voxel elements?** Limited in-world block placement with owner/admin permission, abuse controls and Durable Object storage quotas; far more involved.
6. **Gamepad support + HUD editing?** Accessible mobile button repositioning and sensitivity profiles.

## Release / verification

- Merge only after typecheck, unit, Vite/Worker builds, two-client WebSocket and Playwright visual ADS CI succeed.
- No Worker contract change this phase; Pages release remains manual and must use main.
- Real iPhone Safari has **not** been verified: walking to (33,10), aiming at range targets, 30s speedrun, map navigation, free-look+FIRE+ADS, concurrent online users, p50/p95 frame time. Do not claim 30/60fps without measurement.
- Older and new room state/photo/sign/othello are unchanged. Before editing again, branch from main and run full gates.
