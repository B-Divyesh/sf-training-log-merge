# Independent verification 4 — FAIL

**Candidate:** `0077ee360fd78a7d17334ad40fac0ed1703717fd`
**Live URL:** <https://training-log-merge.sociobot.in/>
**Verified:** 2026-08-28 UTC
**Verdict:** **FAIL — do not release this candidate.**

## Release-blocking finding

### P1 — Required claim command cannot run from a clean checkout

The registry exists and has nine entries, each with one matching `@claim:` browser test. But the required exact command is not runnable from a clean clone:

```sh
npm ci
npm run test:e2e -- --grep @claim:demo-sandbox
```

It exits 1 with `Error: Timed out waiting 60000ms from config.webServer.` Playwright starts `npm run preview` (`vite preview`), but a clean checkout has no committed `dist/`, so the server cannot start until a separate `npm run build` completes. I reproduced this by temporarily moving the generated `dist/` aside and restoring it immediately after the test. The acceptance contract requires every command listed in `.factory/claims.json` to run from a clean clone via the demo entry point; any failing claim test is release-blocking.

Required repair: make the claim/e2e entry point build before preview (or otherwise serve the demo from a clean checkout), then run every listed command in that state. Do not rely on an untracked prior build.

## Claims after the explicit production build

After `npm run build`, every individual claims command passed independently, two projects each (desktop Chromium and Pixel 5):

| Claim | Result |
| --- | --- |
| `demo-sandbox` | PASS (2/2) |
| `local-privacy` | PASS (2/2) |
| `csv-gpx-merge` | PASS (2/2) |
| `manual-log` | PASS (2/2) |
| `csv-export` | PASS (2/2) |
| `import-file-limit` | PASS (2/2) |
| `timezone-import` | PASS (2/2) |
| `offline-reload` | PASS (2/2) |
| `json-backup-restore` | PASS (2/2) |

This does not clear P1: the listed commands themselves still fail in the clean-clone condition required by the contract.

## First read, identity, and local gates

Cold-loaded the live home in a fresh context before product actions. The first screen says “Merge workouts into one private weekly log,” names recreational athletes whose runs, gym sessions, and wearable exports live in different apps, and presents a one-click **Try it with sample data** action with the explanation that it opens a separate sample ledger. This passes the plain-words and demo-first-screen gate. The cold request log contained only the page, same-origin JS/CSS, and a self-hosted image; there were no console or page errors.

`npm run test:live` passed. It byte-compared the live home, application bundle, and service worker to this production build. A separate full comparison found all 26 publicly served artifacts byte-identical; the sole `dist/` file not served is the host deployment configuration `staticwebapp.config.json` (HTTP 404).

```text
npm ci                         PASS — 140 packages, 0 vulnerabilities
npm test                       PASS — 23/23
npm run typecheck              PASS
npm run lint                   PASS
npm run build                  PASS — dist/ produced
npm run test:e2e               PASS — 42/42
npm run test:update            PASS — update toast, waiting-worker activation, reload
npm run test:live              PASS — identity, policy, rate-limit check
```

The build has 42,418 B raw / 13.93 KB gzip JS and 20,310 B raw / 5.27 KB gzip application CSS, within the static-PWA budgets. The mobile hero is 46,004 B and desktop hero 203,206 B, both under 300 KB.

## Independent product exercise

- Live `/demo/` showed five sample sessions. A manual 30-minute, load-175 strength session persisted through reload.
- CSV `2026-02-31 08:00` was rejected with an actionable calendar-date error and Import remained disabled.
- Manual durations 0 and 1441 stayed in the dialog with native min/max messages; a one-minute session saved.
- After service-worker control, offline reload retained six demo sessions and showed “Offline · ready.” The update harness separately observed update toast, activation, reload, and a versioned cache.
- The full browser suite covered normal CSV/GPX duplicate merge, CSV export, 10 MB rejection, IANA-zone import, DST-gap recovery, edit/delete/undo, JSON backup/restore, keyboard dialog loops, 390px, and 200%-equivalent reflow.

## Privacy, accessibility, response policy, and billing

- In the live demo write/import/offline flow, the request-origin set was exactly `https://training-log-merge.sociobot.in`. Demo storage had only `demo:training-log-merge:workouts` in sessionStorage, no real localStorage keys, and no IndexedDB database.
- `verify-url.sh` passed for `/` and `/demo/`: title, `lang=en`, one h1, main landmark, alt text, labelled buttons, and zero console/page errors. Fresh axe scans at desktop and 390px found zero serious/critical violations. At 390px there was no horizontal overflow; Tab reached Skip and Enter moved focus to main. Reduced-motion emulation was active.
- Live headers have CSP, Permissions-Policy, HSTS, `nosniff`, and strict-origin referrer policy. Hashed JS/CSS are one-year immutable; HTML revalidates after 30 seconds; `sw.js` is no-store; unknown route is HTTP 404.
- `npm run test:live` sent 140 rapid unique invalid verify requests. It observed **30 HTTP 200**, then **110 HTTP 429**; every 429 had `Retry-After`. Observed one-client allowance: **30 requests per burst window**.

## Non-blocking coverage gap

### P2 — The $19 portion of the Field Kit claim is unasserted

`json-backup-restore` promises “The **$19 one-time** Field Kit backs up and restores…” but its tagged test verifies only backup/restore behavior. It does not assert the displayed price or one-time wording. Add a sandbox assertion for the exact visible price/copy and, where available, the test billing contract.

## Evidence paths

- `verification-artifacts/verification-4/first-read-live-desktop.png`
- `verification-artifacts/verification-4/live-first-read-mobile.png`
- `verification-artifacts/verification-4/live-demo-after-flow.png`
- `verification-artifacts/verification-4/verify-url-home/verify.json`
- `verification-artifacts/verification-4/verify-url-demo/verify.json`
