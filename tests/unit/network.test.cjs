const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const wait = () => new Promise(resolve => setTimeout(resolve, 15));
function network() {
    // Native delivery is tested separately from synthetic local responses.
    class XHR extends EventTarget {
        static DONE = 4;
        constructor() { super(); this.nativeState = 0; this.responseType = ''; this.sent = 0; }
        get readyState() { return this.nativeState; }
        get status() { return 0; }
        get responseText() { return ''; }
        get response() { return null; }
        open(method, url) { this.method = method; this.url = url; this.nativeState = 1; }
        send() { this.sent++; }
        abort() { this.nativeState = 0; }
        setRequestHeader() {}
    }
    for (const name of ['readystatechange', 'load', 'loadend', 'abort']) {
        Object.defineProperty(XHR.prototype, 'on' + name, { configurable: true,
            get() { return this['_on' + name] || null; },
            set(value) { if (this['_on' + name]) this.removeEventListener(name, this['_on' + name]);
                this['_on' + name] = value; if (value) this.addEventListener(name, value); } });
    }
    const location = new URL('http://127.0.0.1:5500/index.html');
    const window = { XMLHttpRequest: XHR, fetch: () => Promise.resolve('native') };
    vm.runInNewContext(fs.readFileSync(require.resolve('../../src/js/local-network.js'), 'utf8'), {
        window, location, URL, Request, Event, ProgressEvent: Event, DOMException, Blob, TextEncoder,
        setTimeout, clearTimeout
    });
    window.FocusLocalNetwork.install();
    return window;
}
test('blocked XHR abort cancels a pending synthetic success', async () => {
    const window = network(), xhr = new window.XMLHttpRequest(), events = [];
    xhr.open('GET', 'https://example.invalid/v63/user');
    for (const name of ['load', 'abort', 'loadend']) xhr.addEventListener(name, () => events.push(name));
    xhr.send(); xhr.abort(); await wait();
    assert(!events.includes('load'));
    assert.deepEqual(events, ['abort', 'loadend']);
    assert.equal(xhr.readyState, 0); assert.equal(xhr.status, 0);
});
test('blocked XHR delivers listener and property events once in native completion order', async () => {
    const window = network(), xhr = new window.XMLHttpRequest(), events = [];
    xhr.open('POST', 'https://example.invalid/v63/user');
    xhr.addEventListener('readystatechange', () => events.push('ready:' + xhr.readyState));
    xhr.addEventListener('load', () => events.push('load'));
    xhr.onload = event => { assert.equal(event.type, 'load'); events.push('property'); };
    xhr.addEventListener('loadend', () => events.push('end'));
    xhr.send(); await wait();
    assert.deepEqual(events, ['ready:4', 'load', 'property', 'end']);
    assert.equal(xhr.status, 200); assert.equal(xhr.responseText, '{"status":0}');
    assert.equal(xhr.response, xhr.responseText);
});
test('blocked XHR supports JSON responses and retains constructor constants', async () => {
    const window = network(), xhr = new window.XMLHttpRequest();
    assert.equal(window.XMLHttpRequest.DONE, 4);
    xhr.open('GET', 'https://example.invalid/'); xhr.responseType = 'json'; xhr.send(); await wait();
    assert.equal(xhr.response.status, 0);
    assert.throws(() => xhr.responseText, /InvalidState|responseType/);
});
test('reopening or aborting inside a completion listener suppresses stale events', async () => {
    for (const action of ['reopen', 'abort']) {
        const window = network(), xhr = new window.XMLHttpRequest(), events = [];
        xhr.open('GET', 'https://example.invalid/');
        xhr.addEventListener('readystatechange', () => {
            if (xhr.readyState !== 4 || xhr.status !== 200) return;
            if (action === 'reopen') xhr.open('GET', '/js/local-data.js'); else xhr.abort();
        });
        xhr.addEventListener('load', () => events.push('load')); xhr.send(); await wait();
        assert.deepEqual(events, []);
    }
});
test('same-origin and exact Bing requests use the native send path', async () => {
    const window = network();
    for (const url of ['/js/local-data.js', 'https://www.bing.com/HPImageArchive.aspx']) {
        const xhr = new window.XMLHttpRequest(); xhr.open('GET', url); xhr.send();
        assert.equal(xhr.sent, 1);
    }
    assert.equal(await window.fetch('/js/local-data.js'), 'native');
    await assert.rejects(window.fetch('https://bing.com.attacker.invalid/'));
});
