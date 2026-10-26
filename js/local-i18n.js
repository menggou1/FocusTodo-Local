/* Local UI language and legacy translation fallback. */
(function(root) {
    'use strict';
    const catalog = root.FocusLocaleCatalog;
    const preference = localStorage.getItem('FocusTodo.language') || 'auto';
    const supported = new Set(['bn','cs','de','el','en','es','fil','fr','hi','hu','id','it','ja','ko','nb','nl','pl','pt','ro','ru','sk','sv','te','th','tr','uk','vi','zh']);
    function normalize(value) {
        const name = String(value || '').replace(/_/g, '-').toLowerCase();
        const base = name.split('-')[0];
        if (!supported.has(base)) return null;
        if (base === 'zh') return /hans/.test(name) ? 'zh-CN' : /hk|mo/.test(name) ? 'zh-HK' : /hant|tw/.test(name) ? 'zh-TW' : 'zh-CN';
        return base;
    }
    const system = (navigator.languages || [navigator.language]).map(normalize).find(Boolean) || 'en';
    const locale = preference === 'en' ? 'en' : preference === 'zh-CN' ? 'zh-CN' : system;
    const chinese = locale.startsWith('zh');
    let legacyApi = null;
    function text(value) {
        if (chinese || typeof value !== 'string') return value;
        return Object.prototype.hasOwnProperty.call(catalog.local, value) ? catalog.local[value] : /[\u3400-\u9fff]/.test(value) ? 'This content is unavailable in English.' : value;
    }
    function lookupLegacy(key, value) {
        if (value !== undefined && value !== null && value !== '' && value !== '[' + key + ']') return value;
        return catalog.english[key] ?? (chinese ? catalog.chinese[key] ?? '内容暂不可用' : 'Text unavailable');
    }
    function update(entry) {
        if (chinese) return entry;
        return { ...entry, title: entry.titleEn || 'FocusTodo update', items: entry.itemsEn || ['Application improvements and fixes.'] };
    }
    root.FocusI18n = {
        locale, preference, text, lookupLegacy, update,
        attachLegacy(api) { legacyApi=api; },
        loadLegacy(api) {
            legacyApi = api;
            // Both complete languages are already in the generated catalog.
            // Avoid synchronous requests (including a missing strings_zh.txt).
            if (locale === 'en' || locale === 'zh-CN') {
                api.map = { ...catalog.english, ...(locale === 'zh-CN' ? catalog.chinese : {}) };
                return Promise.resolve();
            }
            return new Promise(resolve => api.properties({
                name: 'strings', path: './i18n/', cache: true, mode: 'map',
                async: true, callback: resolve
            }));
        },
        legacyText(key, ...args) { return legacyApi ? legacyApi.prop.apply(legacyApi,[key,...args]) : lookupLegacy(key); },
        accountCookie(key,value) {
            if(key!=='NAME') return value;
            const original=btoa(unescape(encodeURIComponent('本地用户'))), english=btoa('Local user');
            if(value===original || value===english) return chinese?original:english;
            return value;
        },
        legacyLanguage: locale.replace('-', '_'),
        setPreference(value) {
            if (!['auto','zh-CN','en'].includes(value)) throw new Error('Unsupported language preference.');
            localStorage.setItem('FocusTodo.language', value);
        }
    };
    document.documentElement.lang = locale;
    if(!chinese) document.title='FocusTodo';
})(window);
