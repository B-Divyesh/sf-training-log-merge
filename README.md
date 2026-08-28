# Training Log Merge

Merge CSV, GPX, and gym sessions into one private weekly training log. It is for recreational athletes whose records live in different apps.

Live product: <https://training-log-merge.sociobot.in>

Try the isolated sample ledger: <https://training-log-merge.sociobot.in/demo/>

## What it does

- Import CSV and timestamped GPX files, preserve source fields, and skip likely duplicates.
- Add and edit manual strength sessions.
- Use an IANA time zone for dates that have no offset.
- Export every session and its source fields as CSV for free.
- Keep workout data in this browser and work offline after the first visit.
- Try five sessions in a separate demo that never touches your real ledger.
- Buy the optional Field Kit for $19 once to back up and restore the ledger as JSON.

It does not coach, interpret heart rate, make health/performance claims, sync devices, or create a social network.

## CSV shape

The importer recognizes common neutral header variants. A minimal file is:

```csv
date,type,title,duration,distance,source
2026-08-28 07:00,Run,River loop,42,7.2,Watch export
```

Dates with `Z` or an offset keep that instant. Dates without an offset use the review time zone shown in Settings. Duration is minutes by default; `seconds`, `elapsed_time`, and `moving_time` are treated as seconds. `distance` is kilometres by default; `distance_m` and `meters` are converted. Optional columns include `notes`, `load`, `id`/`source_id`, and `url`/`source_url`.

GPX imports read each `<trk>` as one session. Track-point timestamps set the date and duration, while coordinates set the distance. Tracks without timestamps are rejected instead of receiving an invented date. Each selected file can be up to 10 MB.

## Develop and verify

Requirements: Node.js 20+ and npm.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

The observable product promises and their individual demo tests are listed in [`.factory/claims.json`](.factory/claims.json). Demo data and storage isolation are documented in [`.factory/demo.md`](.factory/demo.md).

After deployment, `npm run test:live` checks production byte identity, security/cache headers, and the billing verification endpoint’s 429/`Retry-After` burst policy. It intentionally fails if any external release policy is unmet.

The exact production build command is `npm run build`. Static output lands in `dist/`, with home, demo, privacy, terms, and 404 pages ready for deployment. Deploy `dist/` with `public/staticwebapp.config.json`; the factory owns infrastructure and DNS. Playwright is pinned to 1.58.2; set `PLAYWRIGHT_BROWSERS_PATH` to the preinstalled browsers in factory workers or run `npx playwright install chromium` locally.

For staging billing, build with `VITE_BILLING_API=https://pilot-api.sociobot.in/api/v1`. Production defaults to the public Sociobot API. Product IDs are not embedded; the stable product slug is used.

## Privacy and data ownership

There are no accounts, analytics, third-party scripts, CDN fonts, or cloud workout storage. IndexedDB holds workouts; localStorage holds the time zone and optional license verdict. CSV export is always available. See [/privacy](https://training-log-merge.sociobot.in/privacy/) and [/terms](https://training-log-merge.sociobot.in/terms/).

The visual direction and generated-asset provenance are documented in [`.factory/design.md`](.factory/design.md). The researched scope is in [`.factory/brief.json`](.factory/brief.json).

## License

MIT — see [LICENSE](LICENSE).
