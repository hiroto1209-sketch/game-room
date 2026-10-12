# GAME ROOM — AI development & release contract

This repository uses the following **default** process for future GAME ROOM work, including fixes, game mechanics, mobile controls and networking:

1. **Implement** only the agreed scope, keeping existing gameplay, privacy and online fairness intact. Use a feature branch and a pull request; preserve rollback.
2. **Validate** with `npm run typecheck`, `npm test`, `npm run build`, `npm run check:worker`, `npm run test:realtime`, and applicable Playwright visual tests. Use GitHub Actions as the authoritative CI check. Never describe tests as passed unless they actually passed.
3. **Integrate approved changes** into `main` after CI succeeds, there are no merge conflicts, and no unresolved security, data-loss or compatibility concerns. When the user explicitly requests a feature and grants merge authority, a further manual "Run workflow" or repetitive merge confirmation is not required. Do **not** merge an unrelated, failed, conflicted or unreviewed third-party PR simply because it is open.
4. **Auto-release**: `.github/workflows/pages.yml` deploys the matching Cloudflare Worker **before** publishing GitHub Pages, and only after the quality job succeeds. PR events run checks, never production deployment. Main pushes and optional manual re-runs trigger the ordered pipeline.
5. **Verify the rollout**: inspect the GitHub Actions production run, report pass/fail honestly and clearly distinguish successful merge from successful deployment. If the Worker step fails, Pages must not be deployed. Do not blindly retry or downgrade the quality gate.
6. **Device verification**: simulated portrait/landscape tests are not proof of iPhone/iPad Safari behavior. Call out outstanding physical-device checks, particularly ADS/FIRE/multitouch and network play.
7. **Secrets**: never commit API tokens, IDs or secrets to source. Required Actions secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; Actions variable: `GAME_ROOM_SERVER_URL`.

## User-facing communication
Report the PR URL, checks, merge commit and deployment outcome. Do not ask the user to click separate Worker and Pages "Run workflow" buttons when automatic release is configured and operating. New major features should still follow the user-approved scope; coding autonomy is not carte blanche to add unrelated features.
