# Training Log Merge — repair handoff

## Release status

**Repository and static-host repairs are deployed; release remains blocked by the external Sociobot billing API.** The application defects from verification commit `9a22994` are fixed and covered. The required endpoint at `https://api.sociobot.in/api/v1/products/training-log-merge/verify` still returned 140 HTTP 200 responses, no 429, and no `Retry-After` on the final rapid-request check. This repository is a static PWA and its product contract explicitly prohibits changing billing infrastructure, so that server-side control cannot be repaired here.

- Repair commit deployed and pushed: `6fdcd506e3e25b5aedcbb1f0f044997b4f4503b8`
- Live product: <https://training-log-merge.sociobot.in/>
- Deployment: Azure Static Web Apps production via the work order's `/opt/fleet/lib/deploy-static.sh training-log-merge dist` configuration; deployment ID `36585e00-c08e-48ba-a24a-8ef57d553cf2`.

## Repairs

- Replaced permissive/unanchored CSV date parsing with component validation before UTC conversion. Impossible month/day combinations, non-leap February 29, invalid times, trailing junk, impossible zoned timestamps, and nonexistent DST wall times are rejected with file and row context. Valid local, offset, leap-day, CSV, and GPX behavior remains intact.
- Added an explicit focus loop to every modal. Tab and Shift+Tab wrap within currently enabled/visible controls; focus returns to the invoking control when the dialog closes.
- Added `public/staticwebapp.config.json` with CSP, Permissions-Policy, immutable caching for content-addressed `/assets/*`, no-store service-worker delivery, and controlled manifest caching. The generated hero filenames are now content-hashed. Offline fallback CSS was moved out of the HTML and precached so the CSP also holds offline.
- Added explicit TypeScript and ESLint gates.
- Added exact unit/browser/deployment regressions plus `npm run test:live`, which checks deployed byte identity, response policies, and the required billing 429/`Retry-After` contract. The command currently fails only at the external billing-rate assertion, making that outstanding gate reproducible.

## Verification evidence — 2026-08-28 UTC

From a clean dependency install:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:live
```

- `npm ci`: pass; 141 packages audited, 0 vulnerabilities.
- `npm run typecheck`: pass.
- `npm run lint`: pass across source, browser tests, live verification, and build/test configuration.
- `npm test`: 15/15 pass. Exact cases include February 31, month 13, April 31, zoned February 31, trailing date data, leap years, nonexistent DST time, response headers, immutable asset naming, and service-worker cache policy.
- `npm run build`: pass; `dist/index.html`, privacy, terms, manifest, offline fallback, policy config, and service worker produced. App JS is 35.44 KB (11.82 KB gzip); app CSS is 16.24 KB (4.57 KB gzip); mobile hero is 46.00 KB. Budgets pass.
- `npm run test:e2e`: 14/14 pass across desktop Chromium and Pixel 5. It covers multi-source CSV/GPX reconciliation, duplicate skipping, manual add/edit, export, persistence, offline reload, licensing, console errors, axe, exact date rejection, and bidirectional modal focus containment. A separate viewport assertion confirms no overflow at exactly 390 CSS px.
- Candidate reproduction: `2026-02-31 08:00` normalized to `2026-03-03T08:00:00.000Z`; candidate Import focus moved from Cancel to `BODY`. Both now have exact passing regressions.
- Live browser pass at 1440×1000 and 390×844: one h1/main, no horizontal overflow, no console/page errors, no unsolicited third-party requests, date rejection prevents preview/persist, focus wraps in both directions, and dialog close restores the trigger.
- Live axe checks: 0 serious/critical violations on the empty ledger and Import dialog at desktop and mobile.
- Live privacy check: no analytics, trackers, third-party fonts/scripts, or external requests on the free path; workout data persisted in IndexedDB through an offline reload at both viewports.
- PWA manifest: Chromium `Page.getAppManifest` reports no errors. A controlled old-worker harness showed the update toast, activated the waiting worker, reloaded, and produced no errors. Offline data reload passed live.
- Factory `verify-url.sh`: HTTP 200, title/lang/main/alt/button checks pass, 794 ms load, zero console errors.
- Live production byte identity: SHA-256 matches local `dist` for `index.html` (`4b2f86c7…`), app JS (`d57c7d3d…`), `sw.js` (`6a4e08f5…`), and manifest (`3c195d01…`).
- Live response policy: app JS and hero return `Cache-Control: public, max-age=31536000, immutable`; `sw.js` returns `no-cache, no-store, must-revalidate`; CSP and Permissions-Policy are present on app, asset, privacy, and terms responses.
- Lighthouse 13.4.1 mobile against production with the provided Chromium headless shell: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 0.9 s, LCP 1.2 s, CLS 0, TBT 10 ms.
- Billing identity: the production checkout returns HTTP 303 to the registered hosted checkout; invalid verify returns the expected `{valid:false, reason:"invalid"}` shape. Package/consumer checks are not applicable to this static PWA.

## Remaining release blocker

The final `npm run test:live` check made 140 unique invalid-license verification requests and received **140 × HTTP 200**, with **0 × HTTP 429** and no `Retry-After`. The same result was observed before the repair, proving it is independent of the deployed static bundle. The Sociobot billing service owner must configure server-side rate limiting for this product verification route, return 429 with a meaningful `Retry-After`, and rerun `npm run test:live`. No client-side throttle can satisfy or safely substitute for that server-side requirement.

No other known product, accessibility, privacy, offline/update, build, or static-host policy gaps remain.
