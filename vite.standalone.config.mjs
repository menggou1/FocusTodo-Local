import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
const release = JSON.parse(readFileSync(new URL('./release.json', import.meta.url), 'utf8'));
export default defineConfig({
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
      return context.server ? html.replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:* ws://localhost:*") : html;
    },
  }],
  server: { host: '127.0.0.1', port: 5511, strictPort: true },
  define: {
    __LOCAL_VERSION__: JSON.stringify(release.localVersion),
    __SOURCE_VERSION__: JSON.stringify(release.officialVersion),
  },
  build: {
    outDir: '../dist/standalone/site',
    emptyOutDir: true,
    target: ['chrome111', 'edge111', 'firefox114', 'safari16.4'],
    sourcemap: 'hidden',
    assetsInlineLimit: 0,
    manifest: true,
  },
});
