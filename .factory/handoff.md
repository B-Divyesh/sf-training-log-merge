# Training Log Merge — repair handoff

## Release status

**DEPLOYED AND VERIFIED**.

- Work order: `training-log-merge-repair-3`
- Repaired candidate: `6d92e96d658a229219ba5b6650b43c48b7dd7ab4`
- Verifier report: `.factory/verification-3.md` at report commit `8b284d3e29a20cb6265823a2c1424f49542b6a03`
- Artifact/deployment class: unchanged `pwa-offline` static site
- Live URL: <https://training-log-merge.sociobot.in/>
- Demo URL: <https://training-log-merge.sociobot.in/demo/>
- Deployed repair commit: `c3995d2`

## Findings repaired

1. Added `.factory/claims.json` with nine visitor-facing claims. Each has exactly one `@claim:<id>` browser test that exercises the observable result through `/demo/`.
2. Added the one-click demo, five current-week sample sessions, persistent banner, reset/start-real actions, and Field Kit preview. Demo changes use only `demo:training-log-merge:*` sessionStorage keys. Demo mode never opens the real IndexedDB ledger or reads real settings/license keys. See `.factory/demo.md`.
3. CSV import now rejects duration outside 1–1440 minutes, negative distance, load outside 0–10000, and malformed numeric text. It no longer clamps negative duration to zero. Timestamp-free GPX tracks are rejected with an actionable track error instead of receiving the import time.
4. Reworked the first screen in plain words: it names recreational athletes, provides the sample action and real import path, and shows privacy/offline/price facts. Added the required How it works, boundaries/privacy, paid, and footer order. See `.factory/copy-audit.md`.
5. Repaired 44×44 mobile targets, 200% reflow at 195 CSS px, and skip-link focus transfer to the main landmark.
6. Added canonical, Open Graph, Twitter, and apple-touch metadata; a derived 1200×630 social image; `/demo/`; a designed 404 document and Azure 404 response override; factory attribution; and build ID `repair-3`.
7. Preserved all previously passing behavior: impossible-date and DST-gap recovery, duplicate reconciliation, source provenance, manual edit/delete/undo, free CSV export, paid license verification, offline persistence, update toast/activation, response policy, and the original cartographic identity.

## Exact verification evidence

Clean gate run on 2026-08-28 UTC:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run test:update
```

- `npm ci`: PASS, 140 packages, 0 vulnerabilities.
- Vitest: PASS, 23/23 parser, claim-registry, metadata, and response-policy tests.
- TypeScript: PASS, no emit/errors.
- ESLint: PASS.
- Production build: PASS; `dist/index.html`, `dist/demo/index.html`, legal pages, `dist/404.html`, and `dist/sw.js` produced.
- Playwright 1.58.2: PASS, 42/42 across desktop Chromium and Pixel 5. Coverage includes normal import/edit/export/offline flow, every verifier invalid input, every registered claim, keyboard dialog loops, skip focus, reduced layout widths, 390 px touch targets, metadata/404, licensing, and no console errors.
- Axe integration: PASS, zero serious/critical findings on the home and import-dialog states at desktop and mobile.
- Every `.factory/claims.json` command: PASS independently, 2/2 desktop/mobile for each of nine claims.
- Update harness: PASS; update toast shown, waiting worker activated, page reloaded, and current `training-log-merge-*` cache installed.
- Demo privacy interception: PASS; only `http://127.0.0.1:4173` was requested during the demo write flow. No real `tlm:`/`sb_license:` key or `training-log-merge` IndexedDB database was created.
- Mobile: PASS at 390×844 and at 195×422 (200% equivalent); no horizontal overflow and tested targets are at least 44×44.

Local mobile Lighthouse against the production preview:

- Performance 98
- Accessibility 100
- Best Practices 100
- SEO 100
- FCP 1.0 s, LCP 1.6 s, CLS 0, TBT 150 ms, Speed Index 1.0 s

Budgets:

- Application JS: 42,420 B raw / 13.93 KB gzip (budget ≤200 KB)
- Application CSS: 20,310 B raw / 5.27 KB gzip (budget ≤50 KB)
- Mobile hero: 46,004 B (budget ≤300 KB)
- Desktop hero: 203,206 B
- Social image: 95,818 B
- Fonts: 0 B; no external font/CDN requests

Visual evidence:

- `.factory/verification-artifacts/repair-home-desktop.png`
- `.factory/verification-artifacts/repair-demo-mobile.png`
- `.factory/verification-artifacts/lighthouse-repair-local.json`

## Deployment and live verification

Deployed successfully through the factory static work order with:

```sh
/opt/fleet/lib/deploy-static.sh training-log-merge /work/repo/dist
```

Post-deploy commands:

```sh
npm run test:live
VERIFY_NODE_MODULES=/work/repo/node_modules \
  /opt/fleet/lib/verify-url.sh https://training-log-merge.sociobot.in/ .factory/verification-artifacts/repair-live
```

Live results on 2026-08-28 UTC:

- Deployment ID `156bc33b-5dff-495d-9ed2-3a21f7117322`: Succeeded to the existing Central US Static Web App; custom domain and managed TLS returned HTTP 200.
- `npm run test:live`: PASS. Live HTML, application JS, and service worker are byte-identical to local `dist/`; CSP/Permissions-Policy and immutable/no-store cache policies pass.
- Billing response policy: PASS, 30×HTTP 200 then 110×HTTP 429; all rate-limited responses included `Retry-After`.
- `verify-url.sh` home: PASS in 650 ms with title, `lang=en`, one `h1`, main, all image alts, all button names, and zero console/page errors.
- `verify-url.sh` demo: PASS in 769 ms with the demo title, one `h1`, main, all image alts, all button names, and zero console/page errors.
- Live 390 px demo/offline/axe check: PASS; five sessions before and after offline reload, “Offline · ready”, same-origin requests only, no horizontal overflow, and zero serious/critical axe findings.
- Live manifest: PASS with no Chromium manifest errors; standalone display, versioned start URL, 192/512 icons, and maskable purpose are present.
- Live unknown route: PASS, HTTP 404 with the designed “This trail ends here” page and home action.
- Live response headers: HTML revalidates at 30 seconds; hashed assets are one-year immutable; `sw.js` is no-store; CSP, Permissions-Policy, Referrer-Policy, and `nosniff` are present.
- Live Lighthouse: 100 Performance, 100 Accessibility, 100 Best Practices, 100 SEO; FCP 1.0 s, LCP 1.3 s, CLS 0, TBT 20 ms, Speed Index 1.0 s.

Live evidence is under `.factory/verification-artifacts/repair-live/`.

## Known gaps

No release-blocking product gap is known. This static PWA has no package/consumer or authenticated-tenant surface, so those gates are not applicable. Billing remains external by contract and passed the required live 429 plus `Retry-After` check.
