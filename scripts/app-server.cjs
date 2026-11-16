/* The production entry serves only the built React manifest, never the legacy bundle. */
const fs = require('node:fs'), path = require('node:path');
const { createStandaloneServer } = require('./standalone-server.cjs');
const layout = require('./app-layout.json');
function createAppServer(options = {}) {
  const root = options.root || (fs.existsSync(path.join(__dirname, '..', 'build-info.json'))
    ? path.resolve(__dirname, '..') : path.resolve(__dirname, '..', layout.siteDirectory));
  if (!fs.existsSync(path.join(root, 'runtime-manifest.json'))) throw new Error('Build FocusTodo first: npm ci && npm run build');
  return createStandaloneServer({ ...options, root, runtimeLayout: layout, isolated: false });
}
module.exports = { createAppServer };
