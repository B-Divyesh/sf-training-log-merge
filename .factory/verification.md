# Independent verification — FAIL

**Candidate:** `1e4588385a412aff21988b4d46ae88ba5bf6f67e` (`main`)  
**Live URL:** <https://training-log-merge.sociobot.in/>  
**Verified:** 2026-08-28 (UTC)  
**Verdict:** **FAIL — do not release this candidate.**

The application build and deployed static files are sound, but two release-blocking acceptance requirements fail: malformed calendar dates can silently corrupt imported workout dates, and the product's required Sociobot license-verification API has no observable rate limit.

## Environment and build

- Started at the specified candidate from a clean worktree; `npm ci` completed with 0 vulnerabilities.
- `npm test`: PASS — 6/6 Vitest tests.
- `npm run build`: PASS — type check and Vite production build; `dist/` produced.
- `npm run test:e2e`: PASS — 10/10 Playwright tests across desktop Chromium and Pixel 5 emulation.
- No lint script is defined in `package.json`; TypeScript is checked by the production build.
- Production bundle: application JS 33,665 B (11,190 B gzip), app CSS 16,236 B (4,570 B gzip), mobile hero 46,004 B, desktop hero 203,206 B. Initial JS/CSS meet the stated static-PWA budgets.

## Live deployment and browser checks

- The live `index.html`, `manifest.webmanifest`, application JS, application CSS, and `sw.js` are byte-identical to this candidate's production build (SHA-256 checked). Deployment is therefore the tested candidate, not an older build.
- Desktop (1440×1000) and 390×844 mobile visual inspection: PASS; no horizontal overflow at 390 px.
- Live load: one `h1`, `main`, `lang=en`, title, descriptive hero alt text, no page errors, console errors, failed requests, analytics, trackers, third-party fonts, or unsolicited outbound fetch/XHR requests.
- Live axe scans: PASS — no serious/critical findings on the empty screen or import dialog at desktop and 390 px.
- Keyboard smoke test: skip link is first focusable control and reaches `#main`; Enter/Space opens import; Escape closes it. A focus-cycle defect is recorded below.
- Reduced-motion rules are present in the application CSS. Forms use native required/min/max recovery paths; 0 and 1441 minute manual durations remained invalid, while a valid one-minute manual session saved and persisted through reload.
- Privacy review: workouts are stored in IndexedDB; CSV export is free; no workout data leaves the browser. The only application network code is optional Sociobot license verification after a user supplies/captures a license, which the privacy page discloses.

## PWA checks

- Live manifest parses successfully in Chromium (`Page.getAppManifest` reported no errors); standalone display, versioned start URL, 192/512 and maskable icon declarations are present.
- Offline reload: PASS. After import/manual entry and service-worker control, `context.setOffline(true)` reload retained the IndexedDB ledger and showed “Offline · ready”. This is also covered by the passing desktop and mobile e2e test.
- Update flow: PASS. Against an isolated static serving harness, an existing controlled old worker was updated to this candidate's `sw.js`; the “A fresh map sheet is ready” toast appeared, Update activated the waiting worker, and reload completed without page errors.

## Blocking defects

### P1 — Required API rate limiting is absent

`GET https://api.sociobot.in/api/v1/products/training-log-merge/verify?license=<unique-invalid-token>` was burst with 140 simultaneous/rapid unique invalid-license requests in two fresh bursts (40 then 100; completed in about seven seconds total).

- Observed: **140 × HTTP 200** (`{"valid":false,"reason":"invalid","expires_at":null}`).
- Observed threshold: **none through 140 requests**.
- Observed: **no HTTP 429 and no `Retry-After` header**.

The work order explicitly requires any server-side endpoint, including product-unlock calls, to begin returning 429 with `Retry-After` under a burst. This is a factory billing API/deployment boundary rather than code in this static repository, but it remains a release blocker for this product.

### P1 — Impossible CSV dates are accepted and changed silently

Importing this otherwise valid CSV row did not produce an error:

```csv
date,type,title,duration,distance
2026-02-31 08:00,run,Impossible,30,5
```

The import preview offered one new session and displayed **3/3/2026**; Import was enabled. The parser accepts the numeric components and relies on JavaScript date normalization, changing the user's impossible February 31 date into March 3 instead of rejecting it. This can place historical training sessions in the wrong week without any recovery prompt, violating the import invalid-input/data-integrity acceptance path.

## Non-blocking defects and deployment observations

### P2 — Modal keyboard focus briefly escapes to `body`

In the import dialog, Tab order was Close → file input → Cancel → **`BODY`** → Close. Background controls remain inert and another Tab returns to the dialog, but there is a focus-less cycle with no visible focus indicator. A modal dialog needs an explicit/complete focus loop so focus never leaves its interactive controls.

### P3 — Static caching/security policy gaps

Live HTML, JS, CSS, images, manifest, and service worker all return `Cache-Control: public, must-revalidate, max-age=30`; hashed JS/CSS are not served with a long-lived immutable policy. The service worker mitigates application-shell use, but this misses the stated immutable-asset caching target.

Live response headers include HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff`, but no Content-Security-Policy or Permissions-Policy. `X-XSS-Protection` is obsolete and does not substitute for CSP.

## Recommended release gate

1. Add rate limiting to the Sociobot verify endpoint (return 429 plus a meaningful `Retry-After`), then re-run the burst test and record the threshold.
2. Make CSV local-date parsing validate calendar components before conversion; reject invalid/impossible dates with the existing import error UI and add tests for February 31, invalid month/day, and trailing junk.
3. Keep focus inside every modal dialog across the complete Tab/Shift+Tab cycle.
4. Configure immutable caching for fingerprinted assets and add CSP/Permissions-Policy at the static host.
