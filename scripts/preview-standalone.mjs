import { fileURLToPath } from 'node:url';
import standaloneServer from './standalone-server.cjs';

const [portArgument, ...options] = process.argv.slice(2);
const port = Number(portArgument);
if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 5500 ||
  options.some(option => !['--static', '--open'].includes(option))) {
  throw new Error('Use preview-standalone.ps1 with a preview port other than 5500.');
}

const host = '127.0.0.1';
const url = `http://${host}:${port}/`;
const useStatic = options.includes('--static');
if (useStatic) {
  const server = standaloneServer.createStandaloneServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
} else {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: fileURLToPath(new URL('../vite.standalone.config.mjs', import.meta.url)),
    server: { host, port, strictPort: true, open: false },
  });
  await server.listen();
  server.bindCLIShortcuts({
    print: true,
    customShortcuts: [{
      key: 'f',
      description: 'refresh connected browser tabs',
      action: server => server.environments.client.hot.send({ type: 'full-reload', path: '*' }),
    }],
  });
}
console.log(`FocusTodo ${useStatic ? 'static' : 'HMR'} preview: ${url}`);
console.log('This terminal is serving the preview. Press Ctrl+C to stop it, or use another terminal for commands.');

if (options.includes('--open')) {
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ channel: 'msedge', headless: false });
    const page = await browser.newPage({ viewport: null });
    page.once('close', () => void browser.close().catch(() => {}));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    await browser?.close().catch(() => {});
    console.warn(`Could not open an isolated Microsoft Edge window: ${error.message}`);
    console.warn(`The server is still running. Open ${url} in a fresh browser profile.`);
  }
} else {
  console.log('Use a fresh browser profile or rerun with -Open to open an isolated Edge window.');
}
