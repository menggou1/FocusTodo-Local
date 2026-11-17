// Read-only AST discovery for archived schedule conflict regression tests.
const fs = require('node:fs'), acorn = require('acorn');
function walk(node, visitor) {
    if (!node || typeof node !== 'object') return;
    visitor(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => walk(child, visitor));
        else if (value && typeof value === 'object') walk(value, visitor);
    }
}
function load(file = require('./legacy-runtime.cjs').file('src/js/main.js')) {
    const source = fs.readFileSync(file, 'utf8'), ast = acorn.parse(source, { ecmaVersion: 'latest' });
    let modules;
    walk(ast, node => { if (node.type === 'ArrayExpression' && node.elements.length === 1484) modules = node.elements; });
    if (!modules) throw new Error('Legacy module array changed; inspect before applying.');
    function method(id, name) {
        const matches = [];
        walk(modules[id], node => {
            if (node.type !== 'ObjectExpression') return;
            const key = node.properties.find(p => p.key && p.key.name === 'key');
            const value = node.properties.find(p => p.key && p.key.name === 'value');
            if (key && value && key.value.value === name) matches.push({ node, value: value.value });
        });
        if (matches.length !== 1) throw new Error(`Expected one method ${id}.${name}, found ${matches.length}`);
        return matches[0];
    }
    return { source, modules, method };
}
module.exports = { walk, load };
