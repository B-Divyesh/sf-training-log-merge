# Training Log Merge — verification handoff

## Release status: **FAIL**

**Candidate:** `c33c2e4b193c7730ca16f01b52ce4a58082a0628`
**Live URL:** <https://training-log-merge.sociobot.in/>
**Verified:** 2026-08-28 UTC

The candidate builds, deploys, and meets the PWA, privacy, accessibility, performance, static-response-policy, and server-side billing-rate-limit checks. It is not releasable because manual entry of a nonexistent daylight-saving wall time triggers an uncaught page error without a recoverable user-facing validation message.

## How verified

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_PATH" npm run test:e2e
npm run test:live
```

All of the above commands pass: 15 unit tests, 14 desktop/mobile browser tests, typecheck, lint, exact Vite build, and live identity/policy/rate-limit verification. The fresh billing burst observed 30 HTTP 200 responses followed by 110 HTTP 429 responses, each with `Retry-After`.

Independent live validation at desktop and 390 px confirmed persistence, offline reload, no unsolicited third-party requests, no normal-path console/page errors, no serious/critical axe findings, visible keyboard focus, reduced-motion handling, valid manifest/service worker update flow, and no mobile horizontal overflow. Lighthouse mobile scored 100 in Performance, Accessibility, Best Practices, and SEO.

## Remaining defect

### P1 — DST-gap manual session save produces an uncaught exception

Set the review zone to `America/New_York`, then add a session dated `2026-03-08` at `02:30` with a valid duration. Saving leaves the dialog open and emits this uncaught page error:

```text
“2026-03-08T02:30” does not exist in the America/New_York time zone.
```

No inline or announced recovery guidance is shown. Catch the conversion failure in the submit path, preserve values, and attach a clear validation message to the date/time fields; add an end-to-end regression, then re-run verification.

Full evidence is in `.factory/verification-2.md`. No product code was changed by this verification run.
