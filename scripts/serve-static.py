"""Optional Python fallback; serve the same browser paths as the Node launcher."""
import argparse
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

from runtime_layout import ROOT, public_path

FLAT = not (ROOT / 'src/index.html').is_file()


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
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
            name = unquote(urlsplit(self.path).path).lstrip('/')
        except ValueError:
            self.send_error(400)
            return None
        if not name:
            name = 'index.html'
        source = public_path(name, FLAT)
        if not source or '\0' in source:
            self.send_error(404)
            return None
        file = ROOT / source
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
    with ThreadingHTTPServer(('127.0.0.1', args.port), Handler) as server:
        print('Open http://127.0.0.1:{}/index.html (Ctrl+C to stop).'.format(server.server_port), flush=True)
        server.serve_forever()
