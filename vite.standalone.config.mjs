import { defineConfig, normalizePath } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { dataStoragePrefix } from './standalone/services/scoped-storage.mjs';
const devIconURL = '/@fs/' + encodeURI(normalizePath(fileURLToPath(new URL('./public/focus-app.ico', import.meta.url))));
const release = JSON.parse(readFileSync(new URL('./standalone/app-version.json', import.meta.url), 'utf8'));
export default defineConfig(({ mode }) => ({
  root: 'standalone',
  base: './',
  publicDir: false,
  plugins: [react(), {
    name: 'isolated-prototype-development',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/__prototype/session.json') return next();
        if (req.method !== 'GET' || !/^(127\.0\.0\.1|localhost):\d{1,5}$/.test(req.headers.host || '')) {
          res.writeHead(403); res.end(); return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ kind: 'isolated-prototype', origin: 'http://' + req.headers.host }));
      });
    },
    transformIndexHtml(html, context) {
      html = html.replace('__FOCUS_APP_TITLE__', release.localVersion + (mode === 'release' ? '' : ' — Preview'))
        .replace('__FOCUS_PREF_PREFIX__', mode === 'release' ? '' : dataStoragePrefix);
      if (!context.server) return html;
      // Vite hashes this HTML asset at build time. The dev root is standalone/,
      // so the initial HTML needs an explicit Vite URL for its sibling asset.
      return html.replaceAll('../public/focus-app.ico', devIconURL)
        .replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:* ws://localhost:*");
    },
  }],
  server: { host: '127.0.0.1', port: 5511, strictPort: true },
  define: {
    __APP_ISOLATED__: JSON.stringify(mode !== 'release'),
    __LOCAL_VERSION__: JSON.stringify(release.localVersion),
    __SOURCE_VERSION__: JSON.stringify(release.officialVersion),
  },
  build: {
    outDir: mode === 'release' ? '../dist/app/site' : '../dist/standalone/site',
    emptyOutDir: true,
    target: ['chrome111', 'edge111', 'firefox114', 'safari16.4'],
    sourcemap: 'hidden',
    assetsInlineLimit: 0,
    manifest: true,
  },
}));
