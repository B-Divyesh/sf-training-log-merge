# Independent verification 2 — FAIL

**Candidate:** `c33c2e4b193c7730ca16f01b52ce4a58082a0628` (`main`)  
**Live URL:** <https://training-log-merge.sociobot.in/>  
**Verified:** 2026-08-28 UTC  
**Verdict:** **FAIL — do not release this candidate.**

The live site is byte-identical to this candidate and nearly all release requirements pass. One reproducible invalid-input recovery failure remains: a nonexistent local time during the daylight-saving spring transition raises an uncaught page error when a manual strength session is saved. This violates the product's clear time-zone handling and error/recovery acceptance requirements.

## Clean-checkout quality gates

From a clean worktree at the candidate SHA:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_PATH" npm run test:e2e
npm run test:live
```

- `npm ci`: PASS; 141 packages audited, 0 vulnerabilities.
- `npm test`: PASS; 15/15 Vitest tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS; production `dist/` produced.
- `npm run test:e2e`: PASS; 14/14 Chromium tests across desktop and Pixel 5 emulation.
- `npm run test:live`: PASS. It independently confirms live byte identity and browser policy, and ran the billing rate-limit burst below.

Production sizes are within the static-PWA budgets: initial app JS 35,437 B / 11,820 B gzip (under 200 KB), app CSS 16,236 B / 4,570 B gzip (under 50 KB), and mobile/desktop hero images 46,004 B / 203,206 B. Lighthouse mobile against production scored Performance 100, Accessibility 100, Best Practices 100, and SEO 100 (FCP 1.0 s, LCP 1.3 s, CLS 0, TBT 80 ms).

## Product and browser evidence

- The passing browser suite exercises CSV plus GPX import, duplicate reconciliation, manual add/edit, CSV export, IndexedDB persistence, invalid CSV dates, desktop/mobile dialogs, keyboard focus trapping, Field Kit license restore, and offline reload.
- Independent live 390 × 844 exercise: added a strength session, reloaded (session persisted), then switched the browser offline and reloaded again (session remained available). There was no horizontal overflow, console error, or page error on this normal path.
- Desktop and 390 px live axe scans found **0 serious or critical violations**. The first keyboard focus is the Skip to training log link with a visible `3px solid` focus ring.
- With `prefers-reduced-motion: reduce`, the live button transition duration is `1e-05s`.
- Chromium reports a valid manifest with no `Page.getAppManifest` errors; the live worker is active and controls the page. In an isolated dynamic-worker harness, a new worker produced “A fresh map sheet is ready”; selecting Update activated it and reloaded the app.
- No unsolicited third-party request was made on the live free path: the observed request-origin set was only `https://training-log-merge.sociobot.in`. Static inspection found no analytics, trackers, third-party fonts, or cloud workout transport. The only external app endpoint is the disclosed, user-initiated Sociobot license verification/checkout path.
- Live `/`, `/privacy/`, `/terms/`, app bundle, service worker, and manifest have CSP, Permissions-Policy, Referrer-Policy, `nosniff`, and HSTS. The hash-named JS is `Cache-Control: public, max-age=31536000, immutable`; `/sw.js` is `no-cache, no-store, must-revalidate`.
- Live `index.html`, app JS, and `sw.js` match the locally built candidate byte-for-byte (`npm run test:live` output `identity: "match"`).

## Server-side rate limiting

The required external product-unlock endpoint was tested by `npm run test:live` with 140 concurrent unique invalid-license requests to:

```text
GET https://api.sociobot.in/api/v1/products/training-log-merge/verify?license=...
```

Observed result: **30 × 200, then 110 × 429**, and every 429 included `Retry-After`. The observed threshold in this fresh burst was therefore **30 accepted requests before limiting**. This release requirement now passes.

## Blocking defect

### P1 — Manual DST-gap time throws an uncaught page error instead of offering recovery

Reproduction against the local production build (the same candidate is live):

1. Open Settings; set review time zone to `America/New_York` and save.
2. Add a strength session with a label, duration `30`, date `2026-03-08`, and start time `02:30`.
3. Save the session.

Actual result: the dialog remains open and no session is saved, but the browser emits an uncaught page error:

```text
“2026-03-08T02:30” does not exist in the America/New_York time zone.
```

There is no field-level error, live announcement, or explanatory recovery state telling the user to choose a valid time. The error originates from `localWallTimeToUtc` inside the asynchronous form-submit handler and is not caught. A spring-forward gap is predictable input under the product's explicit IANA time-zone model; silently surfacing it as a page exception fails the required invalid-input/recovery behavior and the no-page-errors quality gate for exercised flows.

## Release recommendation

Catch the manual-session date/time conversion error in the submit handler; associate a clear, announced message with the date/time controls and preserve the entered values so the user can select a valid time. Add a browser regression for the DST-gap path, then rerun this verification. No product code was changed during this QA run.
