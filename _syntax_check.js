var fs = require('fs');
var code = fs.readFileSync('d:/Program Files/Focustodo/js/main.js', 'utf8');
try {
    new Function('"use strict";' + code);
    console.log('SYNTAX OK');
} catch(e) {
    var stack = e.stack || '';
    console.log('Error:', e.message);
    // Try to find position from stack
    var lines = stack.split('\n');
    for (var i = 0; i < lines.length; i++) {
        console.log('  ' + lines[i].trim());
    }
}
