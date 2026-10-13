# Forest cleanup and POKO welcome

The forest now has 84 trees (previously 167), with retained trees at their original deterministic positions. All 36 procedural purple rectangular ruins and their movement/ray collision boxes are removed. Rock and grass placement is retained.

Rock collision is bounded in Y by its rendered scale. Feet above the top can pass; a cleared rock supports landing through shared `walkableHeightAt`. The client and Worker use the same geometry. Jump launch speed is 5.0 (previously 4.5) so the largest stones can be cleared. The exterior absolute height limit now accommodates the existing highest hill and its legal jump allowance; the ground-relative anti-flight check remains active. Tree and cave walls remain obstacles.

The pond is a shallow traversable surface on the existing shared ground. Water/reeds/lilies stay visible; this is walking across the pond rather than a swimming mechanic.

Exploration Journal, discovery targets, progress storage code and obsolete progress module are removed. Cave, trail and lookout scenery remain.

## POKO

The user-supplied 67,048-byte `poko.glb` is imported byte-for-byte (SHA-256 `15b9bd5c35874f796c075a1bea77e2e6edc32485c3911308719e9e03568b9af2`). Position: `(17, groundHeightAt(17,-5.7), -5.7)`, scale `.8`, front toward the house. The model includes 2,288 triangles and `PopUp`, `Hide`, `Idle` clips.

The loader and model are requested near the house exit, rather than on initial entry. Leaving through the east doorway triggers one PopUp; returning inside triggers Hide and rearms the welcome. Idle is culled beyond 30 units. Reduced motion changes pose directly. It adds no movement/weapon collider or network authority: each viewer gets a personal welcome. A failed fetch does not prevent world startup and can retry after five seconds near the doorway.

## Validation

- 88 unit tests, including forest counts, stone clearance/support, actual jump arc accepted by shared Worker rules and pond traversal.
- TypeScript, Vite production build and Wrangler bundle checks.
- New iPhone portrait/landscape Playwright gate: deferred model load, original three animation clips, pop/hide/re-entry, reduced motion, removed journal/discovery targets, JavaScript errors, and saved in-world screenshots.
- Existing FPS, HUD editor, original-stage, cave/trail/lookout and realtime gates remain mandatory in GitHub Actions.
- Physical iPhone/iPad Safari verification remains a separate device check.
