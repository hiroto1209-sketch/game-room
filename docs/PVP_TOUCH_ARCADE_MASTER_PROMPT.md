# GAME ROOM — PvP-Ready Mobile Controls & Arcade Expansion

This file is a **reusable implementation prompt**, not a claim that every desired future PvP feature is implemented.

> You are the lead game interaction engineer and QA lead for `hiroto1209-sketch/game-room`. Preserve Three.js/Vite, GitHub Pages and the Cloudflare Durable Object multiplayer system. Prioritize iPhone Safari.

## Problem to fix

The existing FIRE button starts repeated shots but its pointer-down touch never sends drag deltas to `CameraController`; while holding FIRE the player cannot comfortably track targets with that finger. The fix is not to make the fire interval faster or to remove touch shielding. Use independent pointer IDs for movement (left thumb), camera look (right open screen), FIRE drag-to-aim (firing thumb), AIM (optional right thumb) and JUMP.

## Interaction contract

1. Press and hold FIRE to begin shooting at the server-limited shot interval (existing cooldown and HP validation must remain authoritative).
2. While holding FIRE, dragging that **same finger** horizontally or vertically rotates the camera continuously. Treat small deltas consistently with normal right-half look sensitivity.
3. An **additional** right-side finger on the world canvas can also turn the view while FIRE is held; canvas pointer ownership must be independent of the FIRE button's pointer.
4. A third left thumb can walk at the same time; lifting that thumb must not cancel FIRE. JUMP must be usable without resetting other pointers.
5. Stop FIRE **only** when its own pointer ends, cancels, is lost, the menu opens, the app becomes hidden or gameplay pauses. Do not stop FIRE because another pointer ends.
6. FIRE uses `setPointerCapture(pointerId)` for the firing finger; ensure `touch-action:none` on the button. Never capture *all* fingers globally.
7. AIM may be held for zoom / reduced sensitivity without changing the world server's hit validation. Use the same `camera.yaw`/`camera.pitch` used by normal crosshair.
8. The client draws only visual shots. **Server still owns** unlock eligibility, Peace Mode, firing rate, raycast and occlusion, damage, HP, respawn and PvP state. No client-reported HP/hit.
9. Always keep HP in a small **top-left translucent touch-transparent badge** under the logo, without overlapping menu or mobile system bars.

## Casual arcade scope (implemented as local-only first)

- LEFT `ARCADE`: **NEON TARGET** — 20-second 3×3 reaction test, one highlighted target, tap to score, restart and close.
- RIGHT `MINI GAMES`: preserve existing multiplayer **FLOOR OTHELLO** and add **三目並べ / TIC TAC TOE** against a deterministic CPU that can win or block. Both games open in an accessible 3×3 DOM modal. They must not add Three.js materials, extra lights or render loops.
- Keep offline-only scores/moves labeled as local; do not present these as shared multiplayer features. Open game modals must pause movement and stop firing, and closing them must reliably restore the previous world controls.

## Tests

- `npm run typecheck`, `npm test`, `npm run build`, `npm run check:worker` and `npm run test:realtime`.
- Test tic-tac-toe all win lines, draw, invalid moves, CPU wins/blocks, reaction target bounds.
- On two iPhones with an unlocked weapon, separately exercise FIRE-hold+FIRE-drag, FIRE-hold+independent canvas look, simultaneous left joystick, AIM, JUMP and pointer cancel. Confirm server-authoritative 25-damage hits still respect ~400ms cooldown.
- Open/close each game, reload, resume Othello with third player. Confirm ARMORY terminal and all media/room updates remain functional.
- Distinguish automated success from **unverified actual device frame time/touch feel**. Target smooth 30 FPS with up to 60 FPS when hardware permits, never claim unmeasured results.

**Desired result:** The shooter tracks a moving opponent while firing; the left thumb keeps walking; input zones never steal/cancel other fingers; world view is unobstructed; two casual minigames can be enjoyed from their own arcade cabinets.
