// Shared, read-only AST discovery and checked edits for the supplied legacy bundle.
const fs = require('node:fs'), acorn = require('acorn');
function walk(node, visitor) {
    if (!node || typeof node !== 'object') return;
    visitor(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => walk(child, visitor));
        else if (value && typeof value === 'object') walk(value, visitor);
    }
}
function load(file = 'js/main.js') {
    const source = fs.readFileSync(file, 'utf8'), ast = acorn.parse(source, { ecmaVersion: 'latest' });
    let modules;
    walk(ast, node => { if (node.type === 'ArrayExpression' && node.elements.length === 1484) modules = node.elements; });
    if (!modules) throw new Error('Legacy module array changed; inspect before applying.');
    const edits = [];
    const replace = (node, code) => edits.push({ start: node.start, end: node.end, code });
    function method(id, name, code) {
        const matches = [];
        walk(modules[id], node => {
            if (node.type !== 'ObjectExpression') return;
            const key = node.properties.find(p => p.key && p.key.name === 'key');
            const value = node.properties.find(p => p.key && p.key.name === 'value');
            if (key && value && key.value.value === name) matches.push({ node, value: value.value });
        });
        if (matches.length !== 1) throw new Error(`Expected one method ${id}.${name}, found ${matches.length}`);
        if (code) replace(matches[0].value, code);
        return matches[0];
    }
    function assignment(id, name, code) {
        const matches = [];
        walk(modules[id], node => {
            if (node.type === 'AssignmentExpression' && node.left.property && node.left.property.name === name && node.left.object.type === 'Identifier') matches.push(node.right);
        });
        if (matches.length !== 1) throw new Error(`Expected one assignment ${id}.${name}, found ${matches.length}`);
        replace(matches[0], code);
    }
    function save() {
        let result = source, previousStart = source.length;
        for (const edit of edits.sort((a, b) => b.start - a.start)) {
            if (edit.end > previousStart) throw new Error('Overlapping bundle edits.');
            result = result.slice(0, edit.start) + edit.code + result.slice(edit.end); previousStart = edit.start;
        }
        acorn.parse(result, { ecmaVersion: 'latest' }); fs.writeFileSync(file, result);
    }
    return { source, modules, edits, replace, method, assignment, save };
}
module.exports = { walk, load };
