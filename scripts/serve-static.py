"""Optional Python fallback; serve the same browser paths as the Node launcher."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

from runtime_layout import ROOT, public_path

FLAT = not (ROOT / 'src/index.html').is_file()


class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
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
