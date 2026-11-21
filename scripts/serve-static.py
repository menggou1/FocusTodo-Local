"""Optional Python fallback; serve the same browser paths as the Node launcher."""
import json
import argparse
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from socketserver import TCPServer
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent


# Portable React builds use the same explicit manifest as the Node server.
def load_manifest(root, layout):
    files = json.loads((root / 'runtime-manifest.json').read_text(encoding='utf-8'))['files']
    if not isinstance(files, list):
        raise ValueError('Invalid runtime manifest')
    for name in files:
        if not isinstance(name, str) or any(char in name for char in '\\:\0'):
            raise ValueError('Unexpected runtime path')
        parts = name.split('/')
        if (any(not part or part.startswith('.') or part.lower() in ('node_modules', 'scripts', 'tests') for part in parts)
                or name.lower().endswith('.map')
                or (name not in layout['files'] and (len(parts) < 2 or parts[0] not in layout['directories']))):
            raise ValueError('Unexpected runtime path')
    return frozenset(files)


LAYOUT = json.loads((ROOT / 'scripts/app-layout.json').read_text(encoding='utf-8'))
APP_ROOT = ROOT if (ROOT / 'build-info.json').is_file() else ROOT / LAYOUT['siteDirectory']
APP_FILES = load_manifest(APP_ROOT, LAYOUT)


class LoopbackHTTPServer(ThreadingHTTPServer):
    def server_bind(self):
        # HTTPServer resolves a host name before listening. The numeric loopback
        # address is already sufficient for this local-only server.
        TCPServer.server_bind(self)
        self.server_name, self.server_port = self.server_address


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Content-Security-Policy', "frame-ancestors 'none'")
        super().end_headers()

    def send_head(self):
        # Loopback binding alone does not stop DNS rebinding. Match the Node
        # launcher's supported names for both GET and HEAD requests.
        hosts = self.headers.get_all('Host', [])
        host = re.fullmatch(r'(127\.0\.0\.1|localhost)(?::([0-9]{1,5}))?', hosts[0], re.IGNORECASE) if len(hosts) == 1 else None
        if not host or (host[2] and not 1 <= int(host[2]) <= 65535):
            self.send_error(403)
            return None
        try:
            # SimpleHTTPRequestHandler normalizes leading slashes in self.path.
            target = self.requestline.split()[1]
            if not target.startswith('/') or target.startswith('//') or '#' in target or '\\' in target.split('?', 1)[0]:
                raise ValueError('Invalid request target')
            name = unquote(urlsplit(target).path, errors='strict')[1:]
        except ValueError:
            self.send_error(400)
            return None
        if not name:
            name = 'index.html'
        if name not in APP_FILES:
            self.send_error(404)
            return None
        file = APP_ROOT / name
        if not file.is_file() or file.resolve() != file:
            self.send_error(404)
            return None
        self.runtime_file = file
        # SimpleHTTPRequestHandler otherwise returns 304 even though an older
        # cached bundle may no longer match the database/backup code on disk.
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        return super().send_head()

    def translate_path(self, path):
        return str(self.runtime_file)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=5500)
    args = parser.parse_args()
    with LoopbackHTTPServer(('127.0.0.1', args.port), Handler) as server:
        print('Open http://127.0.0.1:{}/index.html (Ctrl+C to stop).'.format(server.server_port), flush=True)
        server.serve_forever()
