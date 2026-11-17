/* Explicit manual input only. Never prints or persists backup contents/filenames. */
const fs=require('node:fs'),path=require('node:path');
const {createHarness}=require('./core-helpers.cjs');
const {localData}=require('../helpers/local-data.cjs');
const legacyCodec=require(require('../helpers/legacy-runtime.cjs').file('src/js/local-backup.js'));
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function normalize(value){return canonical({localStorage:value.localStorage,indexedDB:Object.fromEntries(Object.entries(value.indexedDB).map(([table,rows])=>[table,rows.slice().sort((a,b)=>String(a[table==='Group'?'groupId':table==='Message'?'messageId':'id']).localeCompare(String(b[table==='Group'?'groupId':table==='Message'?'messageId':'id'])))]))})}
async function main(){
    if(process.argv.length!==3)throw new Error('Usage: node tests/standalone/private-backups.cjs <authorized-backup-directory>');
    const folder=path.resolve(process.argv[2]),files=fs.readdirSync(folder).filter(name=>/^FocusTodo-backup.*\.json(?:\.gz)?$/.test(name)).sort();
    if(!files.length)throw new Error('No explicitly scoped backup files found');
    const results=[];
    for(let index=0;index<files.length;index++){
        const h=await createHarness();
        try{
            const bytes=fs.readFileSync(path.join(folder,files[index])),old=await localData();
            const decoded=await h.codec.decode(bytes),original=await legacyCodec.decode(bytes);
            if(JSON.stringify(canonical(decoded))!==JSON.stringify(canonical(original)))throw new Error('codec-differential');
            const expected=old.data.validate(original.data),target=h.data.validate(decoded.data);
            if(JSON.stringify(canonical(target))!==JSON.stringify(canonical(expected)))throw new Error('validation-differential');
            await h.data.replace(target,{backup:false});
            if(JSON.stringify(normalize(await h.data.snapshot()))!==JSON.stringify(normalize(target)))throw new Error('restore-differential');
            results.push({index:index+1,passed:true,format:decoded.format,exportVersion:decoded.data.meta.exportVersion,dbVersion:decoded.data.meta.dbVersion});
        }catch(error){results.push({index:index+1,passed:false,errorType:error.name});}
        finally{h.dispose();}
    }
    const evidence=path.resolve(process.env.FOCUS_ACCEPTANCE_DIR||'dist/acceptance');fs.mkdirSync(evidence,{recursive:true});
    fs.writeFileSync(path.join(evidence,'standalone-private-backups-results.json'),JSON.stringify({method:'Explicitly authorized historical backup bytes; in-memory fake IndexedDB only. No browser profile, raw backups, filenames, task text, images or settings values are written to evidence.',results},null,2)+'\n');
    console.log('Historical backup differential: '+results.filter(row=>row.passed).length+'/'+results.length+' passed. No private content retained.');
    if(results.some(row=>!row.passed))throw new Error('Historical backup differential failed; evidence contains only case indices and error types');
}
main().catch(()=>{console.error('Private-backup verification failed; diagnostic details were suppressed to protect input data.');process.exitCode=1});
