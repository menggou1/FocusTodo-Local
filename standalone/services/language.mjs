const supported = new Set(['bn','cs','de','el','en','es','fil','fr','hi','hu','id','it','ja','ko','nb','nl','pl','pt','ro','ru','sk','sv','te','th','tr','uk','vi','zh']);
export function normalizeLocale(value) {
    const name = String(value || '').replace(/_/g, '-').toLowerCase(), base = name.split('-')[0];
    if (!supported.has(base)) return null;
    return base === 'zh' ? /hans/.test(name) ? 'zh-CN' : /hk|mo/.test(name) ? 'zh-HK' : /hant|tw/.test(name) ? 'zh-TW' : 'zh-CN' : base;
}
export function createLanguageService({ settings, catalog, languages, encodeBase64 }) {
    const locale = () => {
        const preference = settings.getSnapshot().language;
        return ['en','zh-CN'].includes(preference) ? preference : languages.map(normalizeLocale).find(Boolean) || 'en';
    };
    const chinese = () => locale().startsWith('zh');
    const lookup = (key, value) => {
        if (key.startsWith('frt_guide_')) return (chinese() ? catalog.chinese : catalog.english)[key] ?? value;
        if (value !== undefined && value !== null && value !== '' && value !== '[' + key + ']') return value;
        return catalog.english[key] ?? (chinese() ? catalog.chinese[key] ?? '内容暂不可用' : 'Text unavailable');
    };
    return Object.freeze({
        get locale() { return locale(); },
        text(value) {
            if (chinese() || typeof value !== 'string') return value;
            return Object.hasOwn(catalog.local, value) ? catalog.local[value] : /[\u3400-\u9fff]/.test(value) ? 'This content is unavailable in English.' : value;
        },
        lookup,
        legacyText(key, ...args) {
            let value = (locale() === 'zh-CN' ? catalog.chinese[key] : catalog.languages?.[locale()]?.[key]) || lookup(key);
            args.forEach((arg, index) => { value = value.replaceAll('{' + index + '}', String(arg)); }); return value;
        },
        update: entry => chinese() ? entry : { ...entry, title: entry.titleEn || 'FocusTodo update', items: entry.itemsEn || ['Application improvements and fixes.'] },
        accountName(value) { return [encodeBase64('本地用户'), encodeBase64('Local user')].includes(value) ? encodeBase64(chinese() ? '本地用户' : 'Local user') : value; },
        setPreference: value => settings.set('language', value),
    });
}
