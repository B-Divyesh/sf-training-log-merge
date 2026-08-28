# Training Log Merge — build handoff

## Shipped

- Finished Vite + TypeScript local-first PWA at the static `dist/` target.
- Multi-file CSV and GPX import with flexible neutral headers, IANA time-zone handling, source metadata/links, preview errors, and cross-source duplicate fingerprints.
- IndexedDB ledger with weekly navigation, type/source filters, summaries, manual strength entry, editing, confirmed deletion plus undo, user-set load/notes, and free all-history CSV export.
- Install manifest, original 192/512 icons, generated topographic hero, versioned application-shell service worker, offline navigation fallback, offline status, and update prompt.
- Optional $19 one-time Field Kit using the Sociobot checkout/verify contract, query-string license capture, daily cached verification, offline optimistic state, paste-to-restore license flow, and JSON backup/replace restore. No product ID is hardcoded.
- Responsive 390 px design, keyboard-native dialogs/forms, visible focus states, reduced-motion fallback, semantic landmarks, one h1 per page, descriptive image alt text, privacy and terms pages.
- Full README, MIT license, recorded source brief, and product-specific visual thesis/provenance.

## Verification

Run from a clean checkout:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

Verified on 2026-08-28:

- `npm test`: 6/6 Vitest checks pass.
- `npm run build`: passes; creates `dist/index.html`, `dist/privacy/index.html`, and `dist/terms/index.html`.
- `npm run test:e2e`: 10/10 Playwright checks pass across desktop Chrome and Pixel 5 emulation. Coverage includes CSV + GPX reconciliation, duplicate skipping, manual add/edit, CSV download, persistence, `context.setOffline(true)` reload, 390 px overflow, license verification, no console errors, and axe scans with no serious/critical violations.
- Production bundle: 33.67 KB JS (11.19 KB gzip), 16.24 KB app CSS (4.57 KB gzip), responsive hero 48 KB mobile / 200 KB desktop WebP.
- Lighthouse 12.8.2 mobile against the production preview: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 0.9 s, LCP 1.7 s, CLS 0, TBT 10 ms. Lab INP was not available without a sampled interaction; browser interaction tests completed without delay assertions or errors.
- Manual visual inspection at 1440×1000 and 390×844 completed. Generated hero reviewed for unwanted text, logos, brands, people, misleading UI, and visual seams.

## Operational notes and known gaps

- The factory must register `training-log-merge` in the Sociobot billing engine before production checkout can complete. Production defaults to `https://api.sociobot.in/api/v1`; set `VITE_BILLING_API=https://pilot-api.sociobot.in/api/v1` for staging.
- CSV formats vary by provider. V1 deliberately supports documented simple/common headers rather than claiming every vendor export; errors explain the expected date and workout fields.
- GPX tracks without timestamps retain calculated distance but use import time and zero duration. The user should verify imported summaries against the source.
- Data is intentionally device-local with no account or sync. Clearing browser storage removes the ledger; free CSV export and paid JSON backup are the recovery paths.
- No infrastructure, DNS, billing registration, or deployment settings were changed.
