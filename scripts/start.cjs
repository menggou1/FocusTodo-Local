/* One dependency-free launcher for Windows, macOS and Linux. */
const { spawn } = require('node:child_process');
const { createServer } = require('./server.cjs');

function parseArgs(args, env = process.env) {
    let port = env.FOCUS_PORT || '5500', noBrowser = false, help = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--no-browser') noBrowser = true;
        else if (args[i] === '--port') port = args[++i];
        else if (args[i] === '--help' || args[i] === '-h') help = true;
        else throw new Error('Unknown option: ' + args[i]);
    }
    if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) throw new Error('Port must be an integer from 1 to 65535.');
    return { port: Number(port), noBrowser, help };
}

function browserCommand(platform, url) {
    if (platform === 'win32') return ['explorer.exe', [url]];
    if (platform === 'darwin') return ['open', [url]];
    return ['xdg-open', [url]];
}

function openBrowser(url) {
    const [command, args] = browserCommand(process.platform, url);
    const warning = () => console.warn('Could not open a browser automatically. Open ' + url);
    try {
        const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
        child.once('error', warning);
        child.once('exit', code => { if (code) warning(); });
        child.unref();
    } catch (_) { warning(); }
}

function start(options) {
    const server = createServer();
    server.once('error', error => { console.error('FocusTodo startup failed: ' + error.message); process.exitCode = 1; });
    server.listen(options.port, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${server.address().port}/index.html`;
        console.log(`FocusTodo ${require('../package.json').version}: ${url}\nPress Ctrl+C to stop.`);
        if (!options.noBrowser) openBrowser(url);
    });
    return server;
}

module.exports = { parseArgs, browserCommand, start };
if (require.main === module) {
    try {
        const options = parseArgs(process.argv.slice(2));
        if (options.help) console.log('Usage: node scripts/start.cjs [--no-browser] [--port 5500]');
        else start(options);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
