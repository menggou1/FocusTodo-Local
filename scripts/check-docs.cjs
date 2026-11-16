/* Check current and historical documentation links; entertainment literature is excluded. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function list(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
 const file=path.join(directory,entry.name),relative=path.relative(root,file).replaceAll('\\','/');
 if(relative==='docs/design-theory'||relative==='docs/CONTRIBUTING.md')return [];
 return entry.isDirectory()?list(file):entry.isFile()&&file.endsWith('.md')?[file]:[];
})}
const files=['README.md','README_en.md',...list(path.join(root,'docs')).map(file=>path.relative(root,file))];
const cache=new Map();
function anchors(file){if(cache.has(file))return cache.get(file);const body=fs.readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,''),result=new Set();
 for(const match of body.matchAll(/^#{1,6}\s+(.+)$/gm))result.add(match[1].toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}_\-\s]/gu,'').trim().replace(/\s/g,'-'));
 for(const match of body.matchAll(/\bid=["']([^"']+)["']/g))result.add(match[1]);
 cache.set(file,result);return result;
}
const failures=[];
for(const name of files){const file=path.resolve(root,name),body=fs.readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'');
 for(const match of body.matchAll(/\[[^\]]*\]\(([^)\n]+)\)/g)){
  const raw=match[1].replace(/^<|>$/g,'');if(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw))continue;
  const [pathname,anchor]=raw.split('#'),destination=pathname?path.resolve(path.dirname(file),decodeURIComponent(pathname)):file;
  if(!fs.existsSync(destination)||!fs.statSync(destination).isFile())failures.push(name+' -> '+raw+' (missing file)');
  else if(anchor&&destination.endsWith('.md')&&!destination.replaceAll('\\','/').includes('/design-theory/')&&!destination.endsWith('CONTRIBUTING.md')&&!anchors(destination).has(decodeURIComponent(anchor)))failures.push(name+' -> '+raw+' (missing anchor)');
 }
}
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}else console.log('PASS documentation files and anchors: '+files.length+' Markdown files');
