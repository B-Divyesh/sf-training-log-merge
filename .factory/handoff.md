# Training Log Merge — independent QA handoff

## Release status: FAIL

**Work order:** `training-log-merge-verify-3`

**Candidate tested:** `6d92e96d658a229219ba5b6650b43c48b7dd7ab4`

**Live URL:** <https://training-log-merge.sociobot.in/>

**Verified:** 2026-08-28 UTC

**Full report:** `.factory/verification-3.md`

Do not release this candidate. Production byte-matches the candidate and its normal import/reconcile/manual/export/offline workflow works, but three P1 acceptance gates fail:

1. `.factory/claims.json` is missing, so mandatory claim tests cannot run and product/README claims are unlisted.
2. There is no one-click “Try it with sample data” action or isolated demo. `/demo` and `/?demo=1` open the empty real ledger; `.factory/demo.md` is missing. The cold first screen also does not plainly name the intended user or show privacy/offline/price facts.
3. Invalid imports can corrupt history: negative CSV distance/load values are accepted, negative duration is silently changed to zero, and an untimed GPX track is silently assigned the import time.

P2 findings cover undersized mobile targets, failed 200% reflow, skip-link focus, missing canonical/social/apple metadata, no real 404, and missing required landing/copy-audit material.

## Verification run

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run test:live
VERIFY_NODE_MODULES=/work/repo/node_modules \
  /opt/fleet/lib/verify-url.sh https://training-log-merge.sociobot.in/ <evidence-dir>
```

- Install: PASS, 0 vulnerabilities.
- Unit: PASS, 15/15.
- Typecheck/lint/build: PASS; `dist/` produced.
- Playwright: PASS, 16/16 desktop/mobile checks.
- Live identity/policy: PASS. Home, JS, CSS, worker, manifest, artwork, and legal pages match the candidate.
- Billing rate limit: PASS, 30×200 then 110×429; all 429 responses had `Retry-After`.
- Browser/accessibility: no console/page errors and 0 serious/critical axe findings in the tested empty/dialog states.
- PWA: install manifest, persisted offline reload, waiting-worker update toast, activation, and reload all pass.
- Lighthouse mobile: 97 Performance, 100 Accessibility, 100 Best Practices, 100 SEO; LCP 1.3 s and CLS 0.
- Bundles: JS 36,399 B (11,938 B gzip), CSS 16,360 B (4,605 B gzip), mobile hero 46,004 B.

Evidence is under `.factory/verification-artifacts/`. No product code was modified; only independent verification documentation and evidence were added.

## Required next steps

1. Build the isolated sample demo, add the first-screen sample action/banner/reset/start-real flow, and document its storage namespace.
2. Inventory every live and README claim in `.factory/claims.json`; add one observable `@claim:<id>` demo test per claim.
3. Validate imported duration, distance, and load consistently with manual entry. Reject untimed GPX tracks instead of manufacturing dates. Add recovery-focused browser regressions.
4. Repair the P2 accessibility and site-structure defects listed in `.factory/verification-3.md`.
5. Re-run every command above plus every command listed in the new claim registry.
