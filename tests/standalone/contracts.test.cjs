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

const previewScope = { storagePrefix: 'FocusTodoStandalone.data.', databaseName: 'FocusTodoStandalone.PomodoroDB6' };

function isolated(overrides = {}) {
    const environment = {
        location: { hostname: '127.0.0.1', protocol: 'http:', origin: 'http://127.0.0.1:49152' },
        document: { baseURI: 'http://127.0.0.1:49152/FocusTodo-Local/' },
        indexedDB: { databases: async () => [] },
        fetch: async (url, options) => {
            assert.equal(url.href, 'http://127.0.0.1:49152/FocusTodo-Local/__prototype/session.json');
            assert.equal(options.credentials, 'omit');
            assert.equal(options.redirect, 'error');
            return { ok: true, json: async () => ({ kind: 'isolated-prototype', origin: 'http://127.0.0.1:49152' }) };
        },
        ...overrides
    };
    const { verifyIsolation } = loadTypeScript('services/isolation.ts', environment);
    return { verifyIsolation: (signal, scope = previewScope) => verifyIsolation(signal, scope) };
}

test('candidate origin requires a loopback server attestation before inspecting storage', async () => {
    let fetches = 0;
    for (const location of [
        { hostname: 'menggou1.github.io', protocol: 'https:', origin: 'https://menggou1.github.io' },
        { hostname: '127.0.0.1', protocol: 'https:', origin: 'https://127.0.0.1' },
        { hostname: '', protocol: 'file:', origin: 'null' },
        { hostname: '127.0.0.1', protocol: 'http:', origin: 'http://127.0.0.1:5500', port: '5500' }
    ]) {
        const guard = isolated({ location, fetch: () => { fetches++; throw new Error('Unexpected request'); } });
        await assert.rejects(guard.verifyIsolation(new AbortController().signal), /fresh browser context/);
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
});

test('candidate ignores unrelated databases but rejects incompatible versions of its own databases', async () => {
    const name = previewScope.databaseName;
    const lock = name + '-maintenance-lock';
    const signal = new AbortController().signal;
    const indexedDB = databases => ({ databases: async () => databases });
    await isolated({ indexedDB: indexedDB([
        { name: 'PomodoroDB6', version: 3 }, { name: 'AnotherApplication', version: 4 },
        { name, version: 3 }, { name: lock, version: 1 },
    ]) }).verifyIsolation(signal);
    for (const database of [{ name, version: 4 }, { name: lock, version: 2 }]) {
        await assert.rejects(isolated({ indexedDB: indexedDB([database]) }).verifyIsolation(signal), /incompatible schema version/);
    }
});

test('candidate checks the configured settings and database namespaces without accessing physical settings', async () => {
    const guard = isolated({ localStorage: new Proxy({}, { get() { throw new Error('Unexpected storage access'); } }) });
    const signal = new AbortController().signal;
    await guard.verifyIsolation(signal);
    for (const scope of [{ ...previewScope, storagePrefix: '' }, { ...previewScope, storagePrefix: 'FocusTodoStandalone.' }, { ...previewScope, databaseName: 'PomodoroDB6' }]) {
        await assert.rejects(guard.verifyIsolation(signal, scope), /namespace is not reserved/);
    }
});

test('application version metadata keeps independent version without changing DB schema', () => {
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

test('production language resolution retains explicit preferences and complete bilingual fallback', async () => {
    const { createLanguageService } = await import('../../standalone/services/language.mjs');
    const { messages } = loadTypeScript('shared/i18n.ts');
    const resolveLocale = (language, languages = ['zh-TW', 'en']) => createLanguageService({
        settings: { getSnapshot: () => ({ language }) }, catalog: {}, languages,
    }).locale;
    assert.equal(resolveLocale('auto'), 'zh-TW');
    assert.equal(resolveLocale('auto', ['de-DE', 'zh-CN']), 'de');
    assert.equal(resolveLocale('auto', ['unrecognized', 'zh_CN']), 'zh-CN');
    assert.equal(resolveLocale('auto', []), 'en');
    assert.equal(resolveLocale('en', ['zh-CN']), 'en');
    assert.equal(resolveLocale('zh-CN', ['en']), 'zh-CN');
    const english = messages('en'), chinese = messages('zh-CN');
    assert.deepEqual(Object.keys(english).sort(), Object.keys(chinese).sort());
    assert(Object.values(english).every(value => typeof value === 'string' && value.length));
    assert(Object.values(chinese).every(value => typeof value === 'string' && value.length));
    assert(!/preview|Phase|预览|阶段/i.test([...Object.values(english), ...Object.values(chinese)].join(' ')), 'Product recovery copy must describe the application');
});
