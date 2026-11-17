// Generate a synchronous fallback catalog; no extra startup network requests.
const fs = require('node:fs');
function properties(name) {
    const out = {};
    for (const line of fs.readFileSync(name, 'utf8').split(/\r?\n/)) {
        const match = /^\s*([^#\s][^=]*?)\s*=\s*(.*)$/.exec(line);
        if (match) out[match[1].trim()] = match[2].replace(/\\u([0-9a-f]{4})/gi, (_, n) => String.fromCharCode(parseInt(n,16)));
    }
    return out;
}
const local = JSON.parse(fs.readFileSync('public/i18n/local-en.json', 'utf8'));
const data = { local, english: { ...properties('public/i18n/strings.txt'), ...properties('public/i18n/strings_en.txt') }, chinese: properties('public/i18n/strings_zh_CN.txt') };
const languages = {};
for (const name of fs.readdirSync('public/i18n').filter(name => /^strings_.+\.txt$/.test(name)).sort()) {
    languages[name.slice(8, -4).replaceAll('_', '-')] = properties('public/i18n/' + name);
}
fs.writeFileSync('standalone/shared/catalog.json', JSON.stringify({ ...data, languages }) + '\n');
console.log('Generated English/local fallback catalog.');
