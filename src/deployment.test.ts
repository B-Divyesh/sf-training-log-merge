import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface RoutePolicy { route: string; headers?: Record<string, string> }
interface StaticWebAppConfig { globalHeaders: Record<string, string>; routes: RoutePolicy[] }

const config = JSON.parse(readFileSync('public/staticwebapp.config.json', 'utf8')) as StaticWebAppConfig;

describe('production response policy', () => {
  it('ships restrictive browser security headers', () => {
    expect(config.globalHeaders['Content-Security-Policy']).toContain("default-src 'self'");
    expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(config.globalHeaders['Permissions-Policy']).toContain('camera=()');
    expect(config.globalHeaders['Permissions-Policy']).toContain('payment=()');
    expect(readFileSync('public/offline.html', 'utf8')).not.toContain('<style>');
  });

  it('caches only content-addressed application assets immutably', () => {
    const assetPolicy = config.routes.find(({ route }) => route === '/assets/*');
    expect(assetPolicy?.headers?.['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(readFileSync('src/main.ts', 'utf8')).toMatch(/trail-ledger-768\.[a-f0-9]{8}\.webp/);
    expect(readFileSync('src/main.ts', 'utf8')).toMatch(/trail-ledger-1536\.[a-f0-9]{8}\.webp/);
  });

  it('forces service-worker update checks instead of edge caching', () => {
    const workerPolicy = config.routes.find(({ route }) => route === '/sw.js');
    expect(workerPolicy?.headers?.['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
  });

  it('publishes demo, social metadata, and a real 404 response policy', () => {
    const home = readFileSync('index.html', 'utf8');
    expect(home).toContain('rel="canonical"');
    expect(home).toContain('property="og:image"');
    expect(home).toContain('rel="apple-touch-icon"');
    expect(readFileSync('demo/index.html', 'utf8')).toContain('<title>Demo — Training Log Merge</title>');
    expect(readFileSync('404.html', 'utf8')).toContain('This trail ends here.');
    expect((config as StaticWebAppConfig & { responseOverrides?: Record<string, { statusCode?: number }> }).responseOverrides?.['404']?.statusCode).toBe(404);
  });

  it('registers every claim with exactly one tagged browser test', () => {
    const claims = JSON.parse(readFileSync('.factory/claims.json', 'utf8')) as Array<{ id: string; test: string }>;
    const browserTests = readFileSync('e2e/claims.spec.ts', 'utf8');
    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) {
      expect(claim.test).toBe(`npm run test:e2e -- --grep @claim:${claim.id}`);
      expect(browserTests.match(new RegExp(`@claim:${claim.id}`, 'g'))).toHaveLength(1);
    }
  });
});
