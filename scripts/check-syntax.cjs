const fs = require('node:fs');
const acorn = require('acorn');
for (const file of ['js/local-network.js', 'js/local-startup.js', 'js/main.js', 'patch.js', 'js/local-i18n.js', 'js/local-i18n-catalog.js', 'js/local-settings-ui.js', 'js/local-release.js', 'js/local-timer-core.js', 'js/local-data.js', 'js/local-timer-ui.js', 'js/local-app-ui.js', 'js/local-backup.js', 'js/local-theme-storage.js']) {
    acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest' });
    console.log('PASS syntax: ' + file);
}
