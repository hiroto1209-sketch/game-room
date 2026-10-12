# GAME ROOM — PlayCanvas FPS Starter Kit ORIGINAL MAP IMPORT
## Source-accurate scene transfer / Three.js integration / licensing gate

**Implementation update (2026-10-13 JST):** The user supplied `game room.zip`.
Its GLB matches the official published asset hash. The source scene is now imported
inside GAME ROOM with a user-approved doorway, shared collision data, and three-client
WebSocket coverage. See [the implementation/difference report](PLAYCANVAS_FPS_IMPORT.md)
for source hashes, attribution, screenshots, tests, rendering differences and remaining
physical-device checks. The requirements below retain the original PR #24 plan.

**Goal:** Add the actual FPS level from PlayCanvas's official First Person Shooter Starter Kit as a playable location **inside the existing GAME ROOM 3D world**. This is a **source-preserving import**, NOT an inspired-by procedural recreation and NOT an iframe that opens a separate game.

### Unambiguous source identifiers

- Official tutorial: https://developer.playcanvas.com/tutorials/first-person-shooter-starter-kit/
- Original PlayCanvas project: https://playcanvas.com/project/626211/overview
- Original running game: https://playcanv.as/p/deRCEGms/
- Original visual: orange rectangular enclosing walls, tall orange pillars, gray floors, many crates and barrels, short internal partitions and cover, vivid low-poly geometry. Compare the importer visually against the upstream 3D project, not only its thumbnail.
- No arbitrary substitutes: do not use another PlayCanvas FPS project, generated geometry, a screenshot as a texture, or an iframe in place of importing the original stage.

### PHASE 0 — permission and ORIGINAL source capture (blocking)

1. Confirm the project is the original publisher's public, forkable project ID 626211, not a lookalike; check the actual project metadata and every imported model/texture license/author, recording attribution. The PlayCanvas engine's MIT license **does not grant** rights to every scene asset.
2. Use **official PlayCanvas Fork / Download**, not automated scraping of hosted app scripts/assets in violation of platform restrictions. The user may have to sign into PlayCanvas and fork project 626211.
3. Export a genuine scene/archive with scene hierarchy, transforms, mesh files, collision geometry, textures, materials and asset source references. If necessary obtain both the static playable build and the editable project source. For each asset record the origin, license, author, file path and sha256.
4. Never assert map fidelity or rights before the real export bytes are available and inspected. If no valid export or redistribution permission is available, stop map import, explain why, and seek authorized source content. Do NOT improvise a similar map and label it exact.

### PHASE A — measure / reconstruct transforms EXACTLY

- Inventory original scene entities, parent-child hierarchy, local/world transforms and orientation, scale, material colors, PBR/UV assignments and triangle counts.
- Reuse the geometry/GLB obtained from the original authorized archive; convert the PlayCanvas hierarchy to a Three.js group without rearranging props. Preserve world-space distances, occlusion and routes. Scale uniformly only if technically essential and documented.
- Export per-entity collider dimensions and non-walkable flags; separate decorations from collision bodies. Preserve real cover geometry for PvP hitscan (cover must block shots).
- Check axis convention, quaternion handedness, pivot points and winding orientation. One source-of-truth transform from original level to GAME ROOM placement.

### PHASE B — seamlessly connect to existing open world

- This is a new zone **physically reachable from the Party House/outdoor world**. Add an intentional path/gate with visible sign and map waypoint. No separate URL; no full game reload and no second camera renderer.
- Determine safe translation relative to outdoor terrain, pond, house, STARSHOT and server movement bounds *after examining real source dimensions*. Reject overlapping existing colliders and false underground floating floors.
- Extend real client `worldBlocked`, `groundHeightAt`, collider cache, entry and exit gate, and **Cloudflare shared movement validation** together. Do not loosen movement security to unbounded values.
- Preserve three-player (up to 8 existing cap) same-room synchronization, jumping, avatars/emotes, HP, blasters, accuracy, line-of-sight, ray hitscan, respawn and Peace Mode.
- Keep GAME ROOM's FPS input/HUD; PlayCanvas project's controller or physics should not conflict with the existing Three.js character and camera.

### PHASE C — iPhone PERFORMANCE FIRST

- Stream/import the arena's heavy meshes/assets **only near the zone**; do not load entire FPS level at site boot.
- Reuse materials and geometries; merge static meshes safely without destroying original silhouette. Frustum cull / distance-chunk as needed. Avoid dynamic reflections, excess lights and extra render loops.
- Prefer GLB and compressed, appropriately licensed textures; preserve original color relationships. No tree/grass animation.
- Provide before/after site build sizes, first interactive time, draw calls, triangle counts and frame timing. Target 30fps Safari, do not claim success without device measurement.

### PHASE D — QA before merge

| Gate | Requirement |
|---|---|
| Fidelity | Same walls, pillars, crates, barrels, paths, material palette, placement hierarchy; screenshot comparisons from matching positions/angles to upstream |
| Navigation | Enter/leave both directions; no invisible pond or floors, falling, wall bypass or unexplained correction |
| PvP | Cover blocks actual shared hitscan, damage server-authoritative; peers in same zone |
| iOS | FIRE+LOOK+JUMP+ADS concurrent, world-HUD unobstructed |
| Online | Three users at original positions, third late join, snapshot consistency |
| Existing features | Photo, sign, Othello, starshot, avatars/emotes, map guide untouched |
| Security | Safe asset URLs, allowlisted source archive, no third-party credentials/client secrets |
| Performance | Build, shader warm-up, GPU resources, profiling report, lazy loading |
| Tests | TS typecheck, unit, Vite build, Worker bundle, real WebSocket integration, Playwright viewport screenshots; physical iPhone still separate |

**Release order:** Backup main -> small PRs, Worker first if bounds or packet contract changed -> Pages second. Do not change public URL or introduce paid services.

### Required work report

- Exact source archive link/hash and license/attribution table.
- Difference report: original entities imported vs missing with explanations.
- Transform mapping, collision implementation, viewport screenshot evidence.
- Changed files, PR/commit, passed vs failed tests, remaining issues.
- Explicit status: ORIGINAL SOURCE IMPORTED / PARTIAL / NOT IMPORTED.
- Physical iPhone Safari and 3-device status separately.

### Stop condition / remaining user action

The initial export blocker has been resolved by the user's attached archive. Source
geometry, hierarchy, material overrides and transforms have been inspected; the map is
imported, and the creator's CC BY 4.0 credit is included. Further Fork/Export is not
required for this version. Physical iPhone/iPad Safari, three deployed devices and a
measured 30 FPS remain separate validation items; their results are not claimed here.

### Sources

- https://developer.playcanvas.com/tutorials/first-person-shooter-starter-kit/
- https://developer.playcanvas.com/user-manual/editor/projects/creating/
- https://developer.playcanvas.com/user-manual/editor/projects/downloading/
- https://playcanvas.com/terms
