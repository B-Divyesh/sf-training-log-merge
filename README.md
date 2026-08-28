# Training Log Merge

Training Log Merge is a private, installable weekly training ledger for recreational athletes whose running, wearable, and strength records live in different apps. It imports existing exports instead of asking people to adopt another training platform.

Live product: <https://training-log-merge.sociobot.in>

## What it does

- Imports multiple simple CSV and GPX files entirely in the browser.
- Reconciles likely duplicates across sources using time, type, duration, and distance.
- Keeps original source names, IDs, and links when the export provides them.
- Adds and edits manual strength sessions with user-defined load and notes.
- Reviews any week in an explicit IANA time zone, with type and source filters.
- Exports the complete ledger to CSV for free.
- Stores everything in IndexedDB and works offline after the first visit.
- Offers an optional $19 one-time Field Kit for versioned JSON backup and restore through the Sociobot license service.

It does not coach, interpret heart rate, make health/performance claims, sync devices, or create a social network.

## CSV shape

The importer recognizes common neutral header variants. A minimal file is:

```csv
date,type,title,duration,distance,source
2026-08-28 07:00,Run,River loop,42,7.2,Watch export
```

Dates with `Z` or an offset keep that instant. Dates without an offset use the review time zone shown in Settings. Duration is minutes by default; `seconds`, `elapsed_time`, and `moving_time` are treated as seconds. `distance` is kilometres by default; `distance_m` and `meters` are converted. Optional columns include `notes`, `load`, `id`/`source_id`, and `url`/`source_url`.

GPX imports read each `<trk>` as one session, using track-point timestamps and coordinates to calculate duration and distance. Imported values should always be checked against the source export.

## Develop and verify

Requirements: Node.js 20+ and npm.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
```

The exact production build command is `npm run build`. Static output lands in `dist/`, with `index.html`, `/privacy/`, and `/terms/` ready for deployment. Playwright is pinned to 1.58.2; set `PLAYWRIGHT_BROWSERS_PATH` to the preinstalled browsers in factory workers or run `npx playwright install chromium` locally.

For staging billing, build with `VITE_BILLING_API=https://pilot-api.sociobot.in/api/v1`. Production defaults to the public Sociobot API. Product IDs are not embedded; the stable product slug is used.

## Privacy and data ownership

There are no accounts, analytics, third-party scripts, CDN fonts, or cloud workout storage. IndexedDB holds workouts; localStorage holds the time zone and optional license verdict. CSV export is always available. See [/privacy](https://training-log-merge.sociobot.in/privacy/) and [/terms](https://training-log-merge.sociobot.in/terms/).

The visual direction and generated-asset provenance are documented in [`.factory/design.md`](.factory/design.md). The researched scope is in [`.factory/brief.json`](.factory/brief.json).

## License

MIT — see [LICENSE](LICENSE).
