import { defineConfig, normalizePath } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { dataStoragePrefix } from './standalone/services/scoped-storage.mjs';
const devAssetURL = path => '/@fs/' + encodeURI(normalizePath(fileURLToPath(new URL(path, import.meta.url))));
const releaseFile = fileURLToPath(new URL('./release.json', import.meta.url));
export default defineConfig(({ mode }) => ({
  root: 'standalone',
  base: './',
  publicDir: false,
  cacheDir: '../node_modules/.vite/focus-preview',
  plugins: [{
    name: 'isolated-prototype-development',
    enforce: 'pre',
    config(_, { command, isPreview }) {
      // A preview server can be started after a production build in the same process.
      if (command === 'serve' && !isPreview) process.env.NODE_ENV = 'development';
    },
    configureServer(server) {
      server.watcher.add(releaseFile);
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
      // A long-running preview can serve multiple versions over its lifetime.
      const release = JSON.parse(readFileSync(releaseFile, 'utf8'));
      html = html.replace('__FOCUS_APP_TITLE__', release.localVersion + (mode === 'release' ? '' : ' — Preview'))
        .replace('__FOCUS_PREF_PREFIX__', mode === 'release' ? '' : dataStoragePrefix);
      if (!context.server) return html;
      // Vite hashes this HTML asset at build time. The dev root is standalone/,
      // so the initial HTML needs an explicit Vite URL for its sibling asset.
      return html.replace(/\.\.\/public\/(?:focus-app\.ico|img\/focus-app_\d+\.png)/g, path => devAssetURL(path.slice(1)))
        .replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:* ws://localhost:*");
    },
  }, react()],
  server: { host: '127.0.0.1', port: 5511, strictPort: true },
  define: {
    __APP_ISOLATED__: JSON.stringify(mode !== 'release'),
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
