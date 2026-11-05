const fs = require('node:fs'), path = require('node:path');
const layout = require('./runtime-layout.json');
const root = path.resolve(__dirname, '..');
const isPrivate = parts => parts.some(part => part.startsWith('.') || ['node_modules', 'scripts', 'tests'].includes(part.toLowerCase()));
const flat = !fs.existsSync(path.join(root, 'src/index.html'));

function runtimePath(name) {
    const parts = name.split('/');
    if (/[\\:]/.test(name) || isPrivate(parts)) return null;
    if (Object.hasOwn(layout.files, name)) return flat ? name : layout.files[name];
    const [directory, ...tail] = parts;
    if (!tail.length || !tail.every(Boolean) || !Object.hasOwn(layout.directories, directory)) return null;
    return flat ? name : [layout.directories[directory], ...tail].join('/');
}

module.exports = { root, runtimePath, isPrivate };
