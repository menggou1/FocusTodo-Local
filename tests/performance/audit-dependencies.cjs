const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const acorn = require('acorn');
const { load, walk } = require('../../scripts/lib/bundle-editor.cjs');
const baseline = 'f102da8919e810006b6611aabcef5f0159057d61';
process.chdir(path.resolve(__dirname, '../..'));
const changed = execFileSync('git', ['diff', '--name-only', baseline, '--', 'src'], { encoding:'utf8' }).trim();
if (changed) throw Error('Source differs from audit baseline: ' + changed);
function collect(ast) {
    const names = new Map();
    walk(ast, node => {
        if (node.type !== 'MemberExpression' || node.computed || node.object.type !== 'Identifier' ||
            !['window', 'root', 'globalThis'].includes(node.object.name) || node.property.type !== 'Identifier') return;
        const name = node.property.name;
        if (/^Focus|^webBridge$/.test(name)) names.set(name, (names.get(name) || 0) + 1);
    });
    return Object.fromEntries([...names].sort((a,b) => a[0].localeCompare(b[0])));
}
const { modules } = load(), legacy = [];
for (let id = 0; id < modules.length; id++) {
    if (!modules[id]) continue;
    const globals = collect(modules[id]);
    if (Object.keys(globals).length) legacy.push({ module:id, globals });
}
const local = fs.readdirSync('src/js').filter(name => /^local-.*\.js$/.test(name)).map(name => {
    const file = 'src/js/' + name;
    return { file, globals: collect(acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion:'latest' })) };
});
const result = { baseline, method:'Acorn static non-computed window/root/globalThis member expressions starting Focus or webBridge, occurrence counts; does not resolve aliases, dynamic property names, computed access, indirect calls or reachability. IDs are audit references only.', legacy, local };
const output = 'dist/acceptance/audit-dependencies.json';
fs.mkdirSync(path.dirname(output), { recursive:true });
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(`Audited ${legacy.length} legacy modules and ${local.length} local files: ${output}`);
