import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('imports two sources, skips duplicates, adds strength, and survives offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Your training week/);
  await page.getByRole('button', { name: 'Import workouts' }).first().click();
  const date = new Date().toISOString().slice(0, 10);
  await page.locator('#workoutFiles').setInputFiles([
    { name: 'watch.csv', mimeType: 'text/csv', buffer: Buffer.from(`date,type,title,duration,distance,source\n${date} 07:00,Run,River loop,42,7.2,Watch`) },
    { name: 'running-app.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(`<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Easy 7k</name><type>running</type><trkseg><trkpt lat="0" lon="0"><time>${date}T07:01:00Z</time></trkpt><trkpt lat="0" lon="0.06475"><time>${date}T07:42:00Z</time></trkpt></trkseg></trk></gpx>`) }
  ]);
  await expect(page.getByText(/1 duplicate will be skipped/)).toBeVisible();
  await page.getByRole('button', { name: 'Import 1 new session' }).click();
  await expect(page.getByRole('button', { name: 'Edit River loop' })).toBeVisible();

  await page.getByRole('button', { name: 'Add strength' }).first().click();
  await page.getByLabel('Session label').fill('Gym A');
  await page.getByLabel('Duration (minutes)').fill('55');
  await page.getByLabel(/Session load/).fill('320');
  await page.getByRole('button', { name: 'Save session' }).click();
  await expect(page.getByText('Gym A')).toBeVisible();
  await expect(page.locator('#metrics')).toContainText('2');
  await page.getByRole('button', { name: 'Edit Gym A' }).click();
  await page.getByLabel(/Notes/).fill('Felt steady');
  await page.getByRole('button', { name: 'Save session' }).click();
  await expect(page.getByText('Felt steady')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/training-log-.*\.csv/);

  await page.reload();
  await expect(page.getByText('Gym A')).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Gym A')).toBeVisible();
  await expect(page.getByText('Offline · ready')).toBeAttached();
});

test('has no serious accessibility violations in empty and dialog states', async ({ page }) => {
  await page.goto('/');
  let results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  await page.getByRole('button', { name: 'Import workouts' }).first().click();
  results = await new AxeBuilder({ page }).include('#importDialog').analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('keeps keyboard focus inside dialogs in both directions', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Import workouts' }).first();
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Import workouts' });
  const close = page.getByRole('button', { name: 'Close import dialog' });
  const cancel = dialog.getByRole('button', { name: 'Cancel' });

  await expect(close).toBeFocused();
  await cancel.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(cancel).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('shows impossible CSV dates as errors and never enables import', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import workouts' }).first().click();
  await page.locator('#workoutFiles').setInputFiles({
    name: 'impossible.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,type,title,duration,distance\n2026-02-31 08:00,run,Impossible,30,5')
  });
  await expect(page.getByText('Some files need attention')).toBeVisible();
  await expect(page.getByText(/2026-02-31 08:00.*not a valid calendar date/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import new sessions' })).toBeDisabled();
  await expect(page.getByText('Impossible', { exact: true })).not.toBeVisible();
});

test('mobile primary path remains usable at 390 CSS pixels', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Import workouts' }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 390)).toBe(true);
  await context.close();
});

test('restores a one-time Field Kit license through the Sociobot contract', async ({ page }) => {
  await page.route('https://api.sociobot.in/api/v1/products/training-log-merge/verify?license=*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valid: true, reason: 'ok', expires_at: null }) }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open field kit' }).click();
  await page.getByLabel('Have a license?').fill('test-license-token');
  await page.getByRole('button', { name: 'Verify license' }).click();
  await expect(page.getByText('License verified. Your field kit is ready.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back up JSON' })).toBeVisible();
});

test('loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});
