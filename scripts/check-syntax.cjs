const fs = require('node:fs');
const acorn = require('acorn');
for (const name of fs.readdirSync('scripts').filter(name => /\.(cjs|mjs)$/.test(name))) {
    acorn.parse(fs.readFileSync('scripts/' + name, 'utf8'), { ecmaVersion: 'latest', sourceType: name.endsWith('.mjs') ? 'module' : 'script' });
    console.log('PASS syntax: scripts/' + name);
}
for (const file of fs.readdirSync('standalone', { recursive: true }).filter(name => name.endsWith('.mjs'))) {
    const target = 'standalone/' + file;
    acorn.parse(fs.readFileSync(target, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
    console.log('PASS syntax: ' + target);
}
