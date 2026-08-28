import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const dist = new URL('../dist/', import.meta.url).pathname;
const currentWorker = await readFile(join(dist, 'sw.js'));
const oldWorker = Buffer.from(`self.addEventListener('install',event=>event.waitUntil(Promise.resolve()));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));`);
let serveCurrentWorker = false;
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.xml': 'application/xml' };

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? '/', 'http://local.test').pathname;
    if (pathname === '/sw.js') {
      response.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
      response.end(serveCurrentWorker ? currentWorker : oldWorker);
      return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    const safe = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
    const body = await readFile(join(dist, safe));
    response.writeHead(200, { 'content-type': types[extname(safe)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Could not start update harness.');
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  serveCurrentWorker = true;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await page.locator('#updateToast').waitFor({ state: 'visible' });
  await Promise.all([
    page.waitForEvent('framenavigated'),
    page.getByRole('button', { name: 'Update app' }).click()
  ]);
  await page.getByRole('heading', { level: 1 }).waitFor();
  const caches = await page.evaluate(() => window.caches.keys());
  if (!caches.some((key) => key.startsWith('training-log-merge-'))) throw new Error('Updated worker did not install the current app shell.');
  if (errors.length) throw new Error(`Browser errors during update: ${errors.join('; ')}`);
  console.log(JSON.stringify({ updateToast: 'shown', waitingWorker: 'activated', reload: 'passed', caches }, null, 2));
} finally {
  await browser.close();
  server.close();
}
