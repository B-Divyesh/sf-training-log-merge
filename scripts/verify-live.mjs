import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const site = process.env.LIVE_BASE_URL ?? 'https://training-log-merge.sociobot.in';
const billing = process.env.BILLING_API ?? 'https://api.sociobot.in/api/v1';
const burstSize = Number(process.env.BILLING_BURST_SIZE ?? 140);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function response(url) {
  const result = await fetch(url);
  const body = Buffer.from(await result.arrayBuffer());
  return { result, body };
}

const home = await response(`${site}/`);
assert(home.result.ok, `Live home returned ${home.result.status}.`);
assert(home.body.toString().includes('<title>Training Log Merge'), 'Live identity title is missing.');
assert(home.result.headers.get('content-security-policy')?.includes("default-src 'self'"), 'CSP is missing from the live home.');
assert(home.result.headers.has('permissions-policy'), 'Permissions-Policy is missing from the live home.');

const scriptPath = home.body.toString().match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
assert(scriptPath, 'Could not identify the live application bundle.');
const script = await response(`${site}${scriptPath}`);
assert(script.result.headers.get('cache-control')?.includes('immutable'), 'The live hashed bundle is not cached immutably.');

const worker = await response(`${site}/sw.js`);
assert(worker.result.headers.get('cache-control')?.includes('no-store'), 'The live service worker can be served stale.');

for (const [path, liveBody] of [['index.html', home.body], [scriptPath.slice(1), script.body], ['sw.js', worker.body]]) {
  const localBody = await readFile(new URL(`../dist/${path}`, import.meta.url));
  assert(digest(localBody) === digest(liveBody), `${path} does not match the local production build.`);
}

const run = randomUUID();
const checks = await Promise.all(Array.from({ length: burstSize }, async (_, index) => {
  const result = await fetch(`${billing}/products/training-log-merge/verify?license=${encodeURIComponent(`policy-${run}-${index}`)}`);
  return { status: result.status, retryAfter: result.headers.get('retry-after') };
}));
const limited = checks.filter(({ status }) => status === 429);
assert(limited.length > 0, `Billing verification did not rate limit ${burstSize} rapid requests.`);
assert(limited.every(({ retryAfter }) => retryAfter), 'A 429 response omitted Retry-After.');

const statusCounts = Object.fromEntries([...new Set(checks.map(({ status }) => status))].map((status) => [status, checks.filter((item) => item.status === status).length]));
console.log(JSON.stringify({ site, scriptPath, identity: 'match', responsePolicy: 'pass', billingStatusCounts: statusCounts }, null, 2));
