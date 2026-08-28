# Training Log Merge — repair handoff

## Release status: PASS

**Work order:** `training-log-merge-repair-2`
**Repair commit:** `b80a50c` — `fix: recover from manual DST-gap times`
**Base/report:** `bde7644a9f3188b19c131cb14732109fbd21ed46` / `.factory/verification-2.md`
**Live URL:** <https://training-log-merge.sociobot.in/>
**Deployed:** 2026-08-28 UTC with `/opt/fleet/lib/deploy-static.sh training-log-merge dist`

## Repair

The only release blocker in the independent report was reproduced: saving a manual session at `2026-03-08 02:30` in `America/New_York` correctly fails the local-time conversion because that wall time does not exist, but previously let the exception escape from the async submit listener.

`src/main.ts` now catches conversion failures at the manual-form boundary. It keeps the dialog and typed values open, associates an assertive error with both Date and Start time, marks those fields invalid, focuses Start time, and clears the error as soon as either value changes. The parser continues to reject impossible local times, so import integrity and explicit IANA-zone handling are unchanged. `src/styles.css` adds the contrast-safe inline error treatment.

`e2e/app.spec.ts` adds the exact regression: set `America/New_York`, save `2026-03-08 02:30`, assert the announced field error, retained values, open dialog, and zero page errors; then change to `03:30` and assert the session saves. It passed in both Chromium desktop and Pixel 5 projects.

## Verification evidence

Ran from a clean dependency install after the repair:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_PATH" npm run test:e2e
```

- `npm ci`: 141 packages audited, 0 vulnerabilities.
- `npm test`: 15/15 Vitest tests passed, including response-policy checks.
- Typecheck and ESLint passed.
- Production build passed and emitted `dist/` with `index.html`; app JS is 36.40 kB (12.03 kB gzip) and app CSS is 16.36 kB (4.59 kB gzip).
- `npm run test:e2e`: 16/16 Chromium checks passed across desktop and Pixel 5. This covers CSV/GPX reconciliation, manual add/edit, CSV export, IndexedDB persistence, invalid CSV recovery, dialogs and keyboard focus trapping, 390px layout, Field Kit restore, and offline reload, plus the new DST recovery path.

Post-deploy checks against the live production URL:

```sh
npm run test:live
VERIFY_NODE_MODULES=/work/repo/node_modules PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_PATH" \
  /opt/fleet/lib/verify-url.sh https://training-log-merge.sociobot.in/ <temporary-evidence-dir>
```

- `npm run test:live`: live `index.html`, `/assets/app-Dj8wd8BS.js`, and `sw.js` byte-match the local production build; CSP, Permissions-Policy, immutable asset caching, and no-store service-worker policy pass. The required 140-request invalid-license burst saw 30 `200` and 110 `429` responses; every `429` had `Retry-After`.
- `verify-url.sh`: HTTPS `200`, 651 ms browser load, no console/page errors, title present, `lang="en"`, one `h1`, a main landmark, zero images missing alt text, and zero unlabeled buttons.
- Live desktop and 390 × 844 Playwright/axe scans: zero serious or critical violations, no horizontal overflow, and no page errors. Keyboard Tab begins at `Skip to training log` (`#main`). The live DST regression shows `This local time does not exist in America/New_York. Choose another start time.` with no page error.
- Live PWA smoke: valid manifest with zero manifest errors, an active worker controls the page, and a 390px fresh context reloads successfully offline. Resource origins on the free path were only `https://training-log-merge.sociobot.in`.

## How to run and deploy

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_PATH" npm run test:e2e
npm run test:live
```

The product remains a Vite static PWA deployed from `dist/`; deployment uses the factory static work order command above. See `README.md` for development and product use.

## Known gaps / next steps

None from the verifier report. No brief scope, storage model, service worker behavior, billing contract, or existing passed behavior was changed.
