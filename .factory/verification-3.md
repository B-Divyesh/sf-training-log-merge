# Independent verification 3 — FAIL

**Candidate:** `6d92e96d658a229219ba5b6650b43c48b7dd7ab4` (`main`)

**Live URL:** <https://training-log-merge.sociobot.in/>

**Verified:** 2026-08-28 09:57 UTC

**Verdict:** **FAIL — do not release this candidate.**

The conventional build and browser suites pass, and production is the candidate tested. The release still fails three independent P1 gates: the required claim registry is absent, the required one-click isolated demo is absent and the cold first screen fails the work-order test, and invalid imported values can silently enter or be changed in the ledger.

No product code was changed during this verification.

## Mandatory first checks

### Claims gate — FAIL

`.factory/claims.json` does not exist at the candidate commit. There were therefore no listed claim commands to run through the demo entry point. The work order explicitly defines a missing claim registry as release-blocking.

This also makes every product claim unlisted. Examples include:

- “Processed and stored on this device” and “Files never leave this device” in the app.
- “up to 10 MB each” in the importer.
- CSV export, duplicate reconciliation, source preservation, IndexedDB storage, offline use, and the paid JSON backup/restore claims in `README.md`.

These behaviors have conventional coverage in places, but none has the required one-to-one `@claim:<id>` test registered in `.factory/claims.json` and run against an isolated demo.

### Cold first-read and demo gate — FAIL

Fresh desktop (1440×900) and mobile (390×844) contexts opened the live `/` with empty storage and service workers blocked. Screenshots are in `verification-artifacts/first-read-desktop.png` and `first-read-mobile.png`.

What a cold visitor can infer: the product brings CSV and GPX exports together with manually entered strength sessions in a weekly view. The intended recreational athlete who splits records across running, wearable, and gym apps is not named. The visible first actions are **Import workouts** and **Add strength**; there is no one-click sample action.

The screen therefore fails the required “what, for whom, and what to click first” test. It also presents only the local-processing fact, not the required privacy/offline/price trio. The headline “Your training week, on one map” is a cartographic metaphor rather than the job in plain words.

Direct checks of `/demo` and `/?demo=1` both returned the ordinary empty real ledger. Neither route seeded a session, showed a persistent “Demo — sample data, nothing is saved” banner, provided Reset/Start-for-real controls, nor created a `demo:` storage namespace. `.factory/demo.md` is also absent.

## Clean-checkout gates

Run at the exact candidate after `npm ci`:

| Gate | Result | Evidence |
|---|---:|---|
| `npm ci` | PASS | 140 packages installed; 0 vulnerabilities |
| `npm test` | PASS | 15/15 Vitest tests |
| `npm run typecheck` | PASS | TypeScript emitted no errors |
| `npm run lint` | PASS | ESLint emitted no errors |
| `npm run build` | PASS | `dist/` produced |
| `npm run test:e2e` | PASS | 16/16 Playwright tests across desktop and Pixel 5 |
| `npm run test:live` | PASS | Candidate identity and response policy passed; rate limit observed |

Production output is within the static budgets: app JS 36,399 B / 11,938 B gzip, app CSS 16,360 B / 4,605 B gzip, mobile hero 46,004 B, and desktop hero 203,206 B. There are no shipped font files.

## End-to-end product exercise

### Normal workflow — PASS

In a fresh live 390 px context:

1. Imported a two-row watch CSV and a GPX version of the same run.
2. Reconciliation reported one new session and one duplicate for the overlapping run.
3. Added a one-minute strength session with load `0` and notes; `0` and `1441` minute form values remained invalid.
4. Exported CSV. It contained the header and exactly the expected walk, run, and strength rows, including source ID/link, notes, and load `0`.
5. Reloaded online, then reloaded with the browser offline. All three sessions remained in IndexedDB and “Offline · ready” appeared.

Only `https://training-log-merge.sociobot.in` was requested during the workflow. There were no console errors, page errors, or failed requests.

Existing local browser coverage also passed for impossible CSV dates, manual DST-gap recovery, editing, focus trapping, duplicate handling, paid-license restore with a mocked response, and desktop/mobile offline reload.

### Invalid/boundary imports — FAIL

The following CSV was offered as **2 new sessions** with import enabled:

```csv
date,type,title,duration,distance,load
2026-08-28 08:00,Run,Negative distance,30,-5,-50
2026-08-28 10:00,Run,Negative duration,-30,5,10
```

After import, CSV export preserved distance `-5.00` and load `-50`, while silently changing duration `-30` to `0.0`. No field/file error explained the invalid data or offered recovery. Manual entry correctly rejects negative load and non-positive duration, so import and manual constraints disagree.

An otherwise valid GPX track with coordinates but no `<time>` values was also offered as **1 new session**. The exported record used the import instant (`2026-08-28T09:52:28.166Z`) as `started_at` and `0.0` minutes. The source contains no evidence for that date or time; the importer silently invents it instead of asking the user to supply a time or rejecting the track.

Both behaviors can put inaccurate history into the wrong weekly review and violate invalid-input recovery and clear time-zone handling.

## Live deployment, privacy, and response policy

- `index.html`, app JS, app CSS, `sw.js`, manifest, both responsive hero images, privacy page, and terms page are byte-identical to the locally built candidate.
- `verify-url.sh` passed: HTTPS 200, 701 ms browser load, one `h1`, `lang=en`, a main landmark, zero missing image alts, zero unlabeled buttons, and no console/page errors.
- CSP, Permissions-Policy, HSTS, `nosniff`, and Referrer-Policy are present. Hashed JS/CSS/images use one-year immutable caching; `sw.js` is `no-store`; HTML revalidates after 30 seconds.
- Static inspection and browser interception found no analytics, tracking, third-party scripts/fonts, or workout transport. IndexedDB stores workouts; localStorage stores settings and optional licensing state. The only external application endpoint is the disclosed, user-initiated Sociobot checkout/license service.
- Link crawl passed: internal links returned 200, mail links were explicit, and the Sociobot checkout endpoint returned 303 to hosted Dodo checkout.
- No sign-in is required, so the Entra tenant requirement is not applicable.

### Required rate limit — PASS

`npm run test:live` sent 140 rapid unique invalid-license requests to the Sociobot verification endpoint. The observed result was **30 × HTTP 200 followed by 110 × HTTP 429**. Every 429 included `Retry-After`; the observed threshold was 30 accepted requests.

## PWA and performance

- Chromium `Page.getAppManifest` returned no errors. The manifest has standalone display, versioned start URL, 192/512 icons, and maskable purpose.
- Offline reload passed after first load with locally persisted workouts.
- A fresh local production harness served a changed second worker. The controlled page showed “A fresh map sheet is ready”; selecting **Update app** activated the waiting worker, cleared the waiting state, and reloaded under the new controller.
- Lighthouse mobile: Performance 97, Accessibility 100, Best Practices 100, SEO 100; FCP 1.0 s, LCP 1.3 s, CLS 0, TBT 200 ms, interactive 1.4 s. Report: `verification-artifacts/lighthouse-live.json`.

## Accessibility and site quality

- Live axe scans found **0 serious/critical findings** on the empty ledger and import, manual, settings, and Field Kit dialogs at desktop and 390 px.
- The first Tab reaches the skip link with a visible 3 px focus ring. Dialog focus cycles and Escape return pass. Reduced motion changes transitions/animations to effectively instant and disables smooth scrolling.
- No horizontal overflow occurs at normal 390 px width.

The following lower-severity defects remain:

### P2 — Mobile touch targets and 200% reflow do not meet the baseline

At 390 px, the icon-only Field Kit control measures 24×44 CSS px, while footer Privacy and Terms links measure 43×20 and 35×20. These are below 44×44. At a 195 CSS px layout width, equivalent to 200% zoom on a 390 px viewport, document width is 320 px; the page requires horizontal scrolling and content/actions extend beyond the viewport. Evidence: `verification-artifacts/mobile-200-percent.png`.

Activating the skip link changes the URL to `#main`, but focus remains on `BODY`; the main landmark is not made the active keyboard target.

### P2 — Required metadata and real 404 route are absent

The home and legal pages have no canonical link, Open Graph image metadata, Twitter card metadata, or apple-touch icon declaration. An unknown route such as `/definitely-missing-page` returns HTTP 200 and the ordinary ledger rather than a designed 404 route with a way home. The footer also omits “Built by Param Factory” and a verifiable build ID.

### P2 — Required copy audit and landing information order are absent

`.factory/copy-audit.md` is missing. The landing page moves directly from the app ledger to the paid strip; it has no three-step “How it works” section and no dedicated plain-language non-goals/privacy section in the required order.

## Defects by severity

1. **P1 / release-blocking:** `.factory/claims.json` is absent; claim tests cannot be run and all live/README claims are unlisted.
2. **P1 / release-blocking:** no one-click sample demo or isolated demo namespace; first screen does not plainly identify the intended user or show the required facts.
3. **P1 / release-blocking:** invalid negative CSV values are accepted or silently changed, and untimed GPX imports fabricate the current timestamp.
4. **P2:** undersized mobile touch targets, failed 200% reflow, and skip-link focus not transferred to main.
5. **P2:** metadata, genuine 404 handling, factory attribution/build ID, copy audit, and required landing sections are missing.

## Release gate

Do not release until all three P1 findings are fixed and regression-tested. At minimum, add the isolated sample demo and documentation, create a complete claim registry with exactly one tagged demo test per claim, reject invalid numeric imports and untimed GPX tracks with actionable messages, then rerun this full verification.
