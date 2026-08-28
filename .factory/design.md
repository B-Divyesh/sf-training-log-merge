# Visual thesis — the private contour ledger

## Direction and rationale

Training Log Merge uses **topographic cartography** as a working metaphor, not a decorative skin. An athlete's sources are separate tracks; the product reconciles them into one legible weekly terrain. Fine contour lines mark grouping and progress, coordinate-like microcopy explains local dates and provenance, and rust trail marks draw attention to the next useful action. The result should feel like a durable field notebook laid on a map table: private, practical, and calm.

The product is explicitly single-mode, a warm light field-notebook treatment. The background is always painted parchment; this avoids an unrelated dashboard-dark aesthetic and keeps imported records as the visual terrain.

## Tokens

- **Palette:** `paper #F4F0E6` background, `sheet #FFFCF4` surface, `ink #18332E` primary text, `lichen #4E675F` muted text, `trail #B84D2D` accent, `trail-dark #84351F` hover/contrast-safe accent, `moss #356A50` success, `ochre #8A5B12` warning, `scar #9F332B` danger, `contour #C8C1AD` rules. These are sampled conceptually from weathered survey maps, forest canopy and oxidized trail markers. All text pairings are at least 4.5:1.
- **Type:** the interface uses a system sans stack headed by **Atkinson Hyperlegible Next** when it is installed locally, falling back to `Arial`; coordinate labels and data use the system monospace stack. No font files or external font services are requested. The readable sans makes dense training entries scan well, while monospace evokes field coordinates without compromising data clarity. Two families maximum.
- **Scale:** 12 / 14 / 16 / 20 / 28 / clamp(38–64) px. Body is never below 16 px. Numbers use tabular figures.
- **Spacing:** a 4 px base; primary rhythm 8, 12, 16, 24, 32, 48, 64. Content max width is 1180 px, reading measure 68 characters.
- **Shape:** 2 px cartographic rules, 10–18 px radii, clipped-corner accents, and circular waypoint markers. Shadows are sparse and ink-colored, used only to lift dialogs and the active week.

## Interaction grammar

- The primary action is “Import workouts”; manual entry is the equal secondary path.
- Sources become compact stamped chips. Session types are represented with both icon/label and color, never color alone.
- The week navigator behaves like moving between map sheets. The day rail is chronological and grouped by local calendar date.
- Editing opens a modal sheet from the selected record; focus enters it and returns to the originating record.
- Import is a three-step field workflow: select files, inspect reconciliation, commit. Potential duplicates are shown before they can enter the ledger.
- On phones, secondary explanation and decorative map coordinates drop away; actions stack and the timeline becomes a single trail.

## Motion policy

Useful movement lasts 160–240 ms: dialogs rise 8 px from their origin, notices fade, and newly saved sessions briefly receive a contour-ring emphasis. Nothing loops. Under `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed, transition duration becomes effectively instant, and emphasis is expressed with outline/opacity only.

## Asset plan and art direction

One original raster hero, `trail-ledger`, sits behind the opening ledger summary as an explanatory landscape. It depicts multiple route traces and strength-set glyphs converging on a weekly map sheet. It must not imply GPS analysis or coaching.

**Prompt sheet**

- Subject: a top-down folded field map with seven subtle day bands, several distinct running trail traces, small abstract barbell plate/rep marks, all converging into one organized route ledger
- World: quiet cartographer's desk; private analogue notebook rather than fitness social feed
- Materials: uncoated parchment, screen-printed mineral inks, graphite, embossed contour lines
- Light/lens: soft overcast window light, orthographic top-down, tactile macro detail
- Palette words: parchment, deep pine ink, lichen gray-green, oxidized rust, muted ochre
- Composition: landscape 3:2, important forms weighted right, calm negative paper space on left, edges usable under responsive crop
- Negative list: no people, bodies, brands, app UI, screens, readable text, numbers, logos, watermarks, medals, trophies, neon gradients, photoreal device mockups

**Production prompt:** “Use case: stylized-concept. Asset type: responsive PWA hero illustration. A top-down folded cartographer's field map on a quiet desk, seven subtle vertical day bands, several distinct running route traces and small abstract barbell plate and set marks converging into one organized weekly ledger. Hand-screen-printed editorial illustration with tactile uncoated parchment, embossed contour lines, graphite details and restrained mineral ink. Soft overcast window light, orthographic framing, landscape 3:2. Place visual density to the right and preserve calm paper negative space to the left. Palette of parchment, deep pine, lichen gray-green, oxidized rust and muted ochre. No people, bodies, brands, app interface, screens, readable text, numbers, logos, watermark, medals, trophies or neon gradient.”

## Original asset provenance

- `public/assets/trail-ledger-768.01a67cdf.webp` and `trail-ledger-1536.be14f7f2.webp`: generated for this product on 2026-08-28 using the Factory Azure image deployment via `/opt/fleet/lib/gen-image.sh`, based on the production prompt above. The content-hashed responsive exports are 48 KB and 200 KB, allowing immutable production caching. Original output and prompt sidecar are kept in `assets/src/`. AI-generated imagery is disclosed in the footer. No third-party trademarks or source images were used.
- App icons and interface icons are hand-authored SVG/CSS geometric marks created for this repository and released under the repository MIT license.
