const fs = require('node:fs');
const acorn = require('acorn');
for (const file of ['src/patch.js', ...fs.readdirSync('src/js').filter(name => name.endsWith('.js')).map(name => 'src/js/' + name)]) {
    acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest' });
    console.log('PASS syntax: ' + file);
}
