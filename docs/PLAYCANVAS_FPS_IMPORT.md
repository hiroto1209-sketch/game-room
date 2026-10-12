# PlayCanvas original FPS scene import

## Source and attribution

The input is the actual First Person Shooter scene from PlayCanvas project **626211**.
The uploaded `game room.zip` contains the same GLB as the current official published
application: both have MD5 `14f8b0eb44cadf27412b86b57cfa9b8f` and size 3,055,292 bytes.
The uploaded and official scene have identical 295 render placements/material colors.
The importer uses the official scene `776985.json`, not coordinates inferred from pictures.

- [Official tutorial](https://developer.playcanvas.com/tutorials/first-person-shooter-starter-kit/)
- [Project 626211](https://playcanvas.com/project/626211/overview)
- [Published reference](https://playcanv.as/p/deRCEGms/)
- Model: **LOWPOLY | FPS | TDM | GAME | MAP by ResoForge**, by **ResoForge (old profile)**.
- [Creator's original model](https://sketchfab.com/3d-models/lowpoly-fps-tdm-game-map-by-resoforge-d41a19f699ea421a9aa32b407cb7537b)
- [CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/)

The model author's page displays CC Attribution and links specifically to CC BY 4.0.
The matching layout, materials and model name identify this model; PlayCanvas's empty
`CC LICENSE.txt` alone was **not** taken as evidence of a license. A later Sketchfab
repost with the same normalized name was not used as the creator attribution.
The map credit is on the in-world sign; the source/license links are in the game menu.
No PlayCanvas engine, input scripts, joystick image or crosshair is distributed as
part of this import. Three.js and GAME ROOM's existing input remain the runtime.

## Scene conversion

`scripts/import-playcanvas-map.mjs` reads the export config, source scene hierarchy,
container render indices and per-entity material overrides. It checks the container
hash, applies PlayCanvas's Euler/quaternion convention and all parent transforms.
The model's original scene rotation (-90 degrees X) and scale (3) are preserved.
It must not apply the GLB wrapper's axis rotation a second time.

Original scene bounds:

| Axis | Minimum | Maximum |
| --- | ---: | ---: |
| X | -12.75 | 12.75 |
| Y | -0.15 | 12.00 |
| Z | -24.60 | 24.60 |

The original has 295 render meshes, 14 material assignments and 58,758 triangles.
Meshes are merged into 14 static material batches without moving props. The new
in-world placement adds only **(+132, 0, 0)** to the source scene.
`public/playcanvas-fps/manifest.json` retains source entity IDs, matrices, material
assignments, per-object bounds and source/converted counts for inspection.

## Recorded differences

1. The user chose to add an entrance. Triangles are clipped only inside local
   X -13..-12, Y -0.02..2.8, Z -6.6..-3.4, opening the west outer wall.
   Other buildings, barrels, boxes, stairs and props keep their original coordinates.
   The resulting triangle count is 58,804; clipping splits boundary triangles.
2. A 3.2-unit-wide connector/path and a sign link the old eastward trail to the
   doorway. The Party House, pond, forest, cave and STARSHOT RANGE remain in place.
3. PlayCanvas Blinn shading is represented with glTF/Three.js PBR materials.
   Original diffuse RGB values are retained; shader/specular appearance differs.
4. Existing GAME ROOM sky, lighting and controls remain. Original daytime sky,
   PlayCanvas SSAO and original shadow rendering are not reproduced.
5. The gameplay camera retains GAME ROOM's FOV. Comparison screenshots explicitly
   use the original 90-degree FOV, source position (-4, 1.65, 15), and zero yaw/pitch.
6. Player collision uses a sampled upright body against exact source triangle slices,
   with a 0.35-unit step allowance. This is not an Ammo rigid-body simulation.
   Projectile occlusion uses exact triangle/segment intersection in both runtimes.

## Integration, networking and performance

The source map is in the same Three.js world, reached by walking east along Z=-5.
It is not an iframe or a separate game. WORLD MAP includes an FPS destination and
a [true top-down map](../public/playcanvas-fps/map.png) rendered from imported geometry.

The loader and large collision chunk are fetched only near the new area; the lobby
does not request them. The map is blocked until its mesh is ready, avoiding invisible
walkable geometry after a load failure. The sign permits retry. Static geometry uses
shared material batches, frustum culling, distance visibility and disposal methods.

Worker and client use the same generated triangle data and spatial index. Coordinate
limits are expanded only to the map rectangle and connector, with map-specific legal
height bounds; arbitrary outside coordinates remain invalid. Server movement checks
include swept obstacle inspection and eye-level segment rejection. Damage, peace
mode, HP and respawn remain server-owned. Death inside this map respawns at the
validated open entrance position (121.2, 1.65, -5), with existing spawn protection.

## Validation

- TypeScript, unit tests, production build and Worker dry-run.
- Source hash/bounds/count audit; continuous entrance; unchanged wall solidity;
  original elevated surface support; normal/turbo movement and jump regression.
- Real local Durable Object WebSockets: three clients independently walk from the
  original spawn into the map, share avatars/emotes, miss behind original cover,
  receive server-owned damage in clear sight, die/respawn safely and walk back out.
  The test rejects any position correction or protocol error during traversal.
- Browser gate at 390×844, 844×390, 820×1180 and 1180×820: lazy loading, source
  material batch count, actual input/controller passage through the entrance and
  interior rendering. Local QA advances physics at 60 Hz to avoid measuring
  software-renderer frame throughput as mobile device speed.
- Same-position/same-FOV reference screenshots in `docs/playcanvas-comparison/`.
- Existing FPS visibility, HUD editor and exploration visual gates are retained.
- GitHub Actions is the authoritative gate, then Worker deploys before Pages.

The local environment denies OS network-interface enumeration. Local Worker tests
use a scratch-only loopback enumeration fallback; no protocol or application logic
is mocked, and that fallback is not committed or required in GitHub Actions.

**Outstanding physical checks:** real iPhone/iPad Safari ADS/FIRE/multitouch,
three physical devices on the deployed Worker, loading time and GPU/frame-rate
measurement. This change does not claim an achieved iPhone 30 FPS result.

## Rebuild from an export

```sh
node scripts/import-playcanvas-map.mjs EXPORT_DIRECTORY SCENE_JSON
```

For the attached export, use its own `config.json` and `2619195.json` together.
For official data, use its own config and `776985.json` together. Asset IDs differ
between a fork and the official project even when their GLB bytes are identical.
Official Fork/Export steps are documented in PlayCanvas's
[Creating Projects](https://developer.playcanvas.com/user-manual/editor/projects/creating/)
and [Backup and Export](https://developer.playcanvas.com/user-manual/editor/projects/backup-and-export/).
