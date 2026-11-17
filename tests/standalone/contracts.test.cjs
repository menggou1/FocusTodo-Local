const test = require('node:test');
const vm = require('node:vm');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { assert, fs, path, root } = require('./helpers.cjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'FocusTodo contract tests '));

test.before(() => {
    const packageFile = require.resolve('typescript/package.json');
    const compiler = path.resolve(path.dirname(packageFile), require(packageFile).bin.tsc);
    execFileSync(process.execPath, [compiler, '--ignoreConfig', '--target', 'es2022', '--module', 'commonjs',
        '--skipLibCheck', '--outDir', temporary, '--rootDir', path.join(root, 'standalone'),
        ...['services/isolation.ts', 'domain/version.ts', 'shared/i18n.ts'].map(name => path.join(root, 'standalone', name))
    ], { cwd: root, encoding: 'utf8', windowsHide: true });
});
test.after(() => {
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    assert(path.basename(temporary).startsWith('FocusTodo contract tests '));
    fs.rmSync(temporary, { recursive: true, force: true });
});

function loadTypeScript(relative, environment = {}) {
    const code = fs.readFileSync(path.join(temporary, relative.replace(/\.ts$/, '.js')), 'utf8');
    const exports = {};
    vm.runInNewContext(code, { exports, URL, ...environment }, { filename: relative });
    return exports;
}

function isolated(overrides = {}) {
    let reads = 0;
    const environment = {
        location: { hostname: '127.0.0.1', protocol: 'http:', origin: 'http://127.0.0.1:49152' },
        document: { baseURI: 'http://127.0.0.1:49152/FocusTodo-Local/' },
        localStorage: { length: 0, key() { reads++; return null; }, setItem() { throw new Error('Unexpected storage write'); } },
        indexedDB: { databases: async () => [] },
        fetch: async (url, options) => {
            assert.equal(url.href, 'http://127.0.0.1:49152/FocusTodo-Local/__prototype/session.json');
            assert.equal(options.credentials, 'omit');
            assert.equal(options.redirect, 'error');
            return { ok: true, json: async () => ({ kind: 'isolated-prototype', origin: 'http://127.0.0.1:49152' }) };
        },
        ...overrides
    };
    return { ...loadTypeScript('services/isolation.ts', environment), reads: () => reads };
}

test('candidate origin requires a loopback server attestation before inspecting storage', async () => {
    let fetches = 0;
    for (const location of [
        { hostname: 'menggou1.github.io', protocol: 'https:', origin: 'https://menggou1.github.io' },
        { hostname: '127.0.0.1', protocol: 'https:', origin: 'https://127.0.0.1' },
        { hostname: '', protocol: 'file:', origin: 'null' }
    ]) {
        const guard = isolated({ location, fetch: () => { fetches++; throw new Error('Unexpected request'); } });
        await assert.rejects(guard.verifyIsolation(new AbortController().signal), /fresh browser context/);
        assert.equal(guard.reads(), 0);
    }
    assert.equal(fetches, 0);
    await isolated().verifyIsolation(new AbortController().signal);
});

test('candidate rejects absent or mismatching attestation and opaque databases', async () => {
    for (const fetch of [
        async () => ({ ok: false }),
        async () => ({ ok: true, json: async () => ({ kind: 'isolated-prototype', origin: 'http://localhost:49152' }) }),
        async () => ({ ok: true, json: async () => ({ kind: 'production', origin: 'http://127.0.0.1:49152' }) })
    ]) {
        await assert.rejects(isolated({ fetch }).verifyIsolation(new AbortController().signal), /fresh browser context/);
    }
    await assert.rejects(isolated({ indexedDB: {} }).verifyIsolation(new AbortController().signal), /fresh browser context/);
    await assert.rejects(isolated({ indexedDB: { databases: async () => [{ name: 'PomodoroDB6', version: 3 }] } }).verifyIsolation(new AbortController().signal), /fresh browser context/);
});

test('candidate permits its preference namespace and rejects every legacy or unknown key', async () => {
    const storage = key => ({ length: 1, key: () => key, setItem() { throw new Error('Unexpected write'); } });
    await isolated({ localStorage: storage('FocusTodoStandalone.language') }).verifyIsolation(new AbortController().signal);
    for (const key of ['WorkInterval', 'cookie.user', 'FocusTodo.language', 'OtherApplication', null]) {
        await assert.rejects(isolated({ localStorage: storage(key) }).verifyIsolation(new AbortController().signal), /fresh browser context/);
    }
});

test('version metadata models the future independent version without changing DB schema', () => {
    const { versionMetadata } = loadTypeScript('domain/version.ts');
    const legacy = versionMetadata('1.9.3', '7.1.1');
    const independent = versionMetadata('2.0.0', '7.1.1');
    assert.equal(legacy.appVersion, '7.1.1-local.1.9.3');
    assert.equal(independent.appVersion, '2.0.0');
    assert.equal(independent.sourceVersion, '7.1.1');
    assert.equal(independent.schemaVersion, 3);
    assert(Object.isFrozen(independent));
    for (const version of ['2.0', '2.0.0-beta', '02.0.0', '2.-1.0', '2.0.0.0']) {
        assert.throws(() => versionMetadata(version, '7.1.1'), /Invalid application version/);
    }
});

test('language resolution retains explicit preferences and complete bilingual fallback', () => {
    const { resolveLocale, messages } = loadTypeScript('shared/i18n.ts', { navigator: { languages: ['zh-TW', 'en'] } });
    assert.equal(resolveLocale('auto'), 'zh-CN');
    assert.equal(resolveLocale('auto', ['de-DE', 'zh-CN']), 'en');
    assert.equal(resolveLocale('auto', ['unrecognized', 'zh_CN']), 'zh-CN');
    assert.equal(resolveLocale('auto', []), 'en');
    assert.equal(resolveLocale('en', ['zh-CN']), 'en');
    assert.equal(resolveLocale('zh-CN', ['en']), 'zh-CN');
    const english = messages('en'), chinese = messages('zh-CN');
    assert.deepEqual(Object.keys(english).sort(), Object.keys(chinese).sort());
    assert(Object.values(english).every(value => typeof value === 'string' && value.length));
    assert(Object.values(chinese).every(value => typeof value === 'string' && value.length));
});
