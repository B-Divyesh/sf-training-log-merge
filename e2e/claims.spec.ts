import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('@claim:demo-sandbox opens seeded sample data without touching the real ledger', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add strength' }).first().click();
  await page.getByLabel('Session label').fill('Private real session');
  await page.getByLabel('Duration (minutes)').fill('25');
  await page.getByRole('button', { name: 'Save session' }).click();

  await page.getByRole('link', { name: 'Try it with sample data' }).click();
  await expect(page).toHaveURL(/\/demo\/$/);
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.locator('.session')).toHaveCount(5);
  await expect(page.getByText('Private real session', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator('.session')).toHaveCount(5);
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page.getByText('Private real session', { exact: true })).toBeVisible();
});

test('@claim:local-privacy keeps demo workout traffic same-origin and out of real storage', async ({ page }) => {
  const origins = new Set<string>();
  page.on('request', (request) => origins.add(new URL(request.url()).origin));
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Add strength' }).click();
  await page.getByLabel('Session label').fill('Private sample session');
  await page.getByLabel('Duration (minutes)').fill('20');
  await page.getByRole('button', { name: 'Save session' }).click();
  expect([...origins]).toEqual(['http://127.0.0.1:4173']);
  const storage = await page.evaluate(async () => ({
    localKeys: Object.keys(localStorage),
    sessionKeys: Object.keys(sessionStorage),
    databases: (await indexedDB.databases()).map((database) => database.name)
  }));
  expect(storage.localKeys.filter((key) => key.startsWith('tlm:') || key.startsWith('sb_license:'))).toEqual([]);
  expect(storage.sessionKeys).toContain('demo:training-log-merge:workouts');
  expect(storage.databases).not.toContain('training-log-merge');
});

test('@claim:csv-gpx-merge imports both formats, skips duplicates, and preserves source names', async ({ page }) => {
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Import workouts' }).click();
  const date = new Date().toISOString().slice(0, 10);
  await page.locator('#workoutFiles').setInputFiles([
    { name: 'watch.csv', mimeType: 'text/csv', buffer: Buffer.from(`date,type,title,duration,distance,source\n${date}T13:00:00Z,Run,Claim run,30,5,Watch export`) },
    { name: 'duplicate.csv', mimeType: 'text/csv', buffer: Buffer.from(`date,type,title,duration,distance,source\n${date}T13:01:00Z,Run,Duplicate copy,31,5.02,Second app`) },
    { name: 'route.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(`<?xml version="1.0"?><gpx><trk><name>Claim GPX</name><type>running</type><trkseg><trkpt lat="0" lon="0"><time>${date}T15:00:00Z</time></trkpt><trkpt lat="0" lon="0.02"><time>${date}T15:20:00Z</time></trkpt></trkseg></trk></gpx>`) }
  ]);
  await expect(page.getByText('1 duplicate will be skipped')).toBeVisible();
  await page.getByRole('button', { name: 'Import 2 new sessions' }).click();
  await expect(page.getByRole('button', { name: 'Edit Claim run' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Claim GPX' })).toBeVisible();
  await expect(page.locator('.session').filter({ has: page.getByRole('button', { name: 'Edit Claim run' }) }).getByText('Watch export')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Duplicate copy' })).not.toBeVisible();
});

test('@claim:manual-log saves and edits a strength session in the demo tab', async ({ page }) => {
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Add strength' }).click();
  await page.getByLabel('Session label').fill('Garage strength');
  await page.getByLabel('Duration (minutes)').fill('40');
  await page.getByLabel(/Session load/).fill('180');
  await page.getByRole('button', { name: 'Save session' }).click();
  await page.getByRole('button', { name: 'Edit Garage strength' }).click();
  await page.getByLabel('Notes').fill('Three steady sets');
  await page.getByRole('button', { name: 'Save session' }).click();
  await page.reload();
  await expect(page.getByText('Three steady sets')).toBeVisible();
});

test('@claim:csv-export downloads every demo record with its provenance', async ({ page }) => {
  await page.goto('/demo/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all CSV' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = await readFile(path!, 'utf8');
  expect(csv.split('\n')).toHaveLength(6);
  expect(csv).toContain('started_at,timezone,title,type,duration_minutes,distance_km,load,notes,source,source_id,source_url');
  expect(csv).toContain('"Watch export"');
  expect(csv).toContain('"Manual"');
});

test('@claim:import-file-limit rejects files larger than 10 MB', async ({ page }) => {
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Import workouts' }).click();
  await page.locator('#workoutFiles').setInputFiles({ name: 'too-large.csv', mimeType: 'text/csv', buffer: Buffer.alloc(10_000_001) });
  await expect(page.getByText('too-large.csv is larger than 10 MB.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import new sessions' })).toBeDisabled();
});

test('@claim:timezone-import applies the selected IANA zone to offset-free dates', async ({ page }) => {
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Review time zone').fill('America/New_York');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await page.getByRole('button', { name: 'Import workouts' }).click();
  await page.locator('#workoutFiles').setInputFiles({ name: 'zone.csv', mimeType: 'text/csv', buffer: Buffer.from('date,type,title,duration\n2026-08-28 07:30,Run,Zone check,30') });
  await page.getByRole('button', { name: 'Import 1 new session' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all CSV' }).click();
  const path = await (await downloadPromise).path();
  expect(await readFile(path!, 'utf8')).toContain('"2026-08-28T11:30:00.000Z","America/New_York","Zone check"');
});

test('@claim:offline-reload keeps the sample ledger available without a network', async ({ page, context }) => {
  await page.goto('/demo/');
  await expect(page.locator('.session')).toHaveCount(5);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.session')).toHaveCount(5);
  await expect(page.getByText('Offline · ready')).toBeAttached();
});

test('@claim:json-backup-restore backs up and restores the demo ledger', async ({ page }) => {
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Open field kit' }).first().click();
  const backupPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up JSON' }).click();
  const backupPath = await (await backupPromise).path();
  const backup = await readFile(backupPath!, 'utf8');
  expect(JSON.parse(backup).workouts).toHaveLength(5);

  await page.getByRole('button', { name: 'Close field kit' }).click();
  await page.getByRole('button', { name: /Edit Canal recovery run/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete session' }).click();
  await expect(page.locator('.session')).toHaveCount(4);

  await page.getByRole('button', { name: 'Open field kit' }).first().click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#restoreJson').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.locator('.session')).toHaveCount(5);
  await expect(page.getByText('Restored 5 sessions.')).toBeVisible();
});
