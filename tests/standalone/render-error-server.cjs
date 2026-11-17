const http = require('node:http');
const path = require('node:path');

async function createRenderErrorServer() {
    const { build } = await import('vite');
    const { default: react } = await import('@vitejs/plugin-react');
    const result = await build({
        configFile: false, root: path.resolve(__dirname, '../..'), plugins: [react()], logLevel: 'silent',
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
        build: {
            write: false, minify: false, sourcemap: false,
            lib: { entry: path.join(__dirname, 'render-error-harness.tsx'), name: 'SyntheticBoundaryTest', formats: ['iife'], fileName: () => 'harness.js' }
        }
    });
    const files = new Map();
    for (const chunk of (Array.isArray(result) ? result : [result]).flatMap(item => item.output)) {
        files.set('/' + chunk.fileName, chunk.type === 'chunk' ? chunk.code : chunk.source);
    }
    const css = [...files.keys()].find(name => name.endsWith('.css'));
    return http.createServer((request, response) => {
        if (request.url === '/') {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end('<!doctype html><html lang="en"><meta charset="utf-8">' + (css ? `<link rel="stylesheet" href="${css}">` : '') +
                '<div id="test-root"></div><script src="/harness.js"></script></html>');
        } else if (files.has(request.url)) {
            response.writeHead(200, { 'Content-Type': request.url.endsWith('.css') ? 'text/css' : 'text/javascript', 'Cache-Control': 'no-store' });
            response.end(files.get(request.url));
        } else { response.writeHead(404); response.end(); }
    });
}

module.exports = { createRenderErrorServer };
