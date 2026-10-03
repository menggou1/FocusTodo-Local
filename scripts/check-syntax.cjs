const fs = require('node:fs');
const acorn = require('acorn');
for (const file of ['js/main.js', 'patch.js', 'js/local-release.js', 'js/local-timer-core.js', 'js/local-data.js', 'js/local-timer-ui.js', 'js/local-app-ui.js']) {
    acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest' });
    console.log('PASS syntax: ' + file);
}
