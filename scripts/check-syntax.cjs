const fs = require('node:fs');
const acorn = require('acorn');
for (const file of ['src/patch.js', ...fs.readdirSync('src/js').filter(name => name.endsWith('.js')).map(name => 'src/js/' + name)]) {
    acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest' });
    console.log('PASS syntax: ' + file);
}
for (const file of fs.readdirSync('standalone', { recursive: true }).filter(name => name.endsWith('.mjs'))) {
    const target = 'standalone/' + file;
    acorn.parse(fs.readFileSync(target, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
    console.log('PASS syntax: ' + target);
}
