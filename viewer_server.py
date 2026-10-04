"""Serve the STEP viewer on this computer. No CATIA automation."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs
import json
from specification_bridge import lookup

ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.headers.get('Host') != '127.0.0.1:8765':
            self.send_error(403)
            return
        if urlsplit(self.path).path == '/api/specification':
            params = parse_qs(urlsplit(self.path).query, keep_blank_values=True)
            try:
                result = lookup(params.get('pair',[''])[0], params.get('condition',[''])[0], params.get('diameter',[''])[0])
            except ValueError as error:
                result = {'status':'error','message':str(error)}
            except (OSError, KeyError):
                result = {'status':'error','message':'Aerospace_AI_Agent 폴더의 원본 Python 코드와 규격 CSV 파일을 확인해 주세요.'}
            body = json.dumps(result, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        request = unquote(urlsplit(self.path).path)
        if request == '/':
            self.path = '/index.html'
            request = self.path
        target = (ROOT / request.lstrip('/')).resolve()
        if target.parent != ROOT or target.suffix.lower() not in {'.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico'}:
            self.send_error(404)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    print('STEP viewer: http://127.0.0.1:8765/index.html', flush=True)
    server = ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
