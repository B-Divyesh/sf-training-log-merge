import { defineConfig } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = new URL('.', import.meta.url).pathname;

function serviceWorkerManifest() {
  return {
    name: 'service-worker-manifest',
    async closeBundle() {
      const dist = resolve(root, 'dist');
      const pages = ['index.html', 'demo/index.html', 'privacy/index.html', 'terms/index.html', '404.html'];
      const urls = new Set(['/', '/demo/', '/privacy/', '/terms/', '/offline.html', '/offline.css', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']);
      for (const page of pages) {
        const html = await readFile(resolve(dist, page), 'utf8');
        urls.add(`/${page}`);
        for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)) urls.add(match[1]);
      }
      const template = await readFile(resolve(root, 'src/sw-template.js'), 'utf8');
      const precache = JSON.stringify([...urls]);
      const version = [...precache].reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) >>> 0), 0).toString(36);
      await writeFile(resolve(dist, 'sw.js'), template.replace('__PRECACHE__', precache).replace('__CACHE_VERSION__', `training-log-merge-${version}`));
    }
  };
}

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        app: resolve(root, 'index.html'),
        demo: resolve(root, 'demo/index.html'),
        privacy: resolve(root, 'privacy/index.html'),
        terms: resolve(root, 'terms/index.html'),
        notFound: resolve(root, '404.html')
      }
    }
  },
  plugins: [serviceWorkerManifest()]
});
