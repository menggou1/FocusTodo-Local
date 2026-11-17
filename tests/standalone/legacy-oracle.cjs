/* Test-only execution of the fixed legacy managers. Never bundled into runtime. */
const vm = require('node:vm');
const { IDBKeyRange } = require('fake-indexeddb');
const { load } = require('../helpers/legacy-bundle.cjs');
let bundle;
function legacyOracle({ db, storage, now, uuid }) {
    bundle ||= load(); const cache = new Map();
    const math = Object.create(Math); math.uuid = uuid;
    class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now()])); } static now() { return now(); } }
    const window = new EventTarget();
    const context = vm.createContext({ window, localStorage: storage, navigator: {}, document: {}, console,
        Date: ClockDate, Math: math, setTimeout, clearTimeout, Event, IDBKeyRange, Promise, URL });
    const sync = new Proxy({}, { get: () => () => {} });
    function requireModule(id) {
        if (id === 77) return { default: { shared: { db } }, __esModule: true };
        if (id === 65 || id === 14) return { default: { shared: sync, Event: {} }, __esModule: true };
        if (id === 134 || id === 32) return {};
        // Widget preference 299 imports its React view only for registration.
        // The oracle exercises the original getters, never that DOM component.
        if (id === 674) return {};
        if (id === 254) return { default: { shared: { defaultPriceInfo: {} } }, __esModule: true };
        if (cache.has(id)) return cache.get(id).exports;
        const module = { exports: {} }; cache.set(id, module);
        const node = bundle.modules[id]; if (!node) throw new Error('Missing legacy oracle module ' + id);
        const factory = vm.runInContext('(' + bundle.source.slice(node.start, node.end) + ')', context);
        factory(module, module.exports, requireModule); return module.exports;
    }
    requireModule.n = value => { const getter = value?.__esModule ? () => value.default : () => value; getter.a = getter(); return getter; };
    requireModule.d = (exports, key, getter) => Object.defineProperty(exports, key, { enumerable: true, get: getter });
    requireModule.o = (value, key) => Object.hasOwn(value, key); requireModule.p = '';
    return { module: requireModule,
        tasks: () => requireModule(23).default.shared, projects: () => requireModule(29).default.shared,
        subtasks: () => requireModule(42).default.shared, schedules: () => requireModule(256).default.shared,
        records: () => requireModule(24).default.shared, settings: () => requireModule(13).default.shared,
    };
}
module.exports = { legacyOracle };
