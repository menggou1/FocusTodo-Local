// One-time/idempotent literal migration. User content is never DOM-translated.
const fs = require('node:fs'), acorn = require('acorn');
const { walk } = require('./lib/bundle-editor.cjs');
for (const name of ['patch.js', ...fs.readdirSync('js').filter(n=>n.startsWith('local-') && !/i18n|release|settings-ui/.test(n)).map(n=>'js/'+n)]) {
    const source = fs.readFileSync(name,'utf8'), ast = acorn.parse(source,{ecmaVersion:'latest'}), edits=[];
    const covered=[];
    walk(ast,node=>{if(node.type==='ConditionalExpression' && source.slice(node.test.start,node.test.end).includes('FocusI18n')) covered.push([node.start,node.end]);});
    walk(ast,node=>{
        if(node.type!=='Literal'||typeof node.value!=='string'||!/[\u3400-\u9fff]/.test(node.value)||/^(\/\*|\[Lexible)/.test(node.value)||covered.some(([a,b])=>node.start>=a&&node.end<=b)) return;
        const original=source.slice(node.start,node.end);
        edits.push({start:node.start,end:node.end,code:'(typeof globalThis.FocusI18n!=="undefined"?globalThis.FocusI18n.text('+original+'):'+original+')'});
    });
    let output=source;
    for(const edit of edits.sort((a,b)=>b.start-a.start)) output=output.slice(0,edit.start)+edit.code+output.slice(edit.end);
    acorn.parse(output,{ecmaVersion:'latest'});fs.writeFileSync(name,output);
    console.log(name+': '+edits.length+' localized strings');
}
