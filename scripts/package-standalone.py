"""Package the explicitly allowlisted engineering prototype, never a release."""
import hashlib
import json
from pathlib import Path
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
LAYOUT = json.loads((ROOT / 'scripts/standalone-layout.json').read_text(encoding='utf-8'))


def build():
    site = ROOT / LAYOUT['siteDirectory']
    manifest = json.loads((site / 'runtime-manifest.json').read_text(encoding='utf-8'))
    entries = {}
    for name in manifest['files']:
        parts = name.split('/')
        if (any(not part or part.startswith('.') for part in parts) or '\\' in name or ':' in name
                or name.endswith('.map') or (name not in LAYOUT['files'] and parts[0] not in LAYOUT['directories'])):
            raise ValueError('Unexpected runtime asset: ' + name)
        file = site / name
        if file.resolve() != file or not file.is_file():
            raise ValueError('Expected regular runtime file')
        entries['site/' + name] = file.read_bytes()
    for name in ('standalone-server.cjs', 'standalone-layout.json'):
        entries['scripts/' + name] = (ROOT / 'scripts' / name).read_bytes()
    entries['start.cjs'] = b"const {createStandaloneServer}=require('./scripts/standalone-server.cjs');\nconst args=process.argv.slice(2);\nif(args.length&&(args.length!==2||args[0]!=='--base'))throw Error('Usage: node start.cjs [--base /project/]');\nconst server=createStandaloneServer({root:require('node:path').join(__dirname,'site'),basePath:args[1]||'/'});\nserver.on('error',error=>{console.error(error.message);process.exitCode=1;});\nserver.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port+(args[1]||'/')));\n"
    entries['README.txt'] = ("FocusTodo isolated engineering candidate / Phase D functional migration\n"
        "Not a version 2.0.0 release. Core services persist only in an isolated namespace.\n"
        "Node.js 22.12+; no npm install, CDN, account or external network is required to run.\n"
        "Extract fully, run: node start.cjs\n"
        "For a project subpath: node start.cjs --base /FocusTodo-Local/\n"
        "Open the printed loopback URL in a fresh browser context. A random port isolates each run.\n"
        "The workspace supports isolated tasks/lists/tags and timers; additional views are delivered in later batches.\n"
        "Core services use FocusTodoStandalone.PomodoroDB6 and FocusTodoStandalone.data. settings.\n"
        "Startup rejects foreign localStorage, legacy/unknown databases and unsupported schema/client protocols.\n"
        "Existing data is never reset or migrated. The normal app remains at its existing entry.\n"
        "Offline means external network blocked while this local HTTP server is running; file:// and uncached remote offline startup are unsupported.\n"
        "License and third party copyright texts: site/LICENSE, site/licenses/, site/THIRD-PARTY-NOTICES.txt.\n").encode()
    output = ROOT / 'dist/standalone'
    stem = 'FocusTodo-standalone-prototype'
    archives = [output / (stem + '.zip'), output / (stem + '.tar.gz')]
    with zipfile.ZipFile(archives[0], 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(entries.items()):
            archive.writestr(stem + '/' + name, data)
    with tarfile.open(archives[1], 'w:gz') as archive:
        import io
        for name, data in sorted(entries.items()):
            info = tarfile.TarInfo(stem + '/' + name)
            info.size, info.mode = len(data), 0o644
            archive.addfile(info, io.BytesIO(data))
    (output / 'prototype-SHA256SUMS.txt').write_text(''.join(
        hashlib.sha256(file.read_bytes()).hexdigest() + '  ' + file.name + '\n' for file in archives), encoding='utf-8')
    for file in archives:
        print(str(file) + ' (' + str(file.stat().st_size) + ' bytes)')


if __name__ == '__main__':
    build()
