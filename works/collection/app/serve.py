"""ローカル確認用サーバ。Windows のレジストリ設定で .js が text/plain になるのを補正する。
使い方: python serve.py [ポート(既定 8000)]
"""
import http.server
import sys

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
})

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
with http.server.ThreadingHTTPServer(('', port), Handler) as httpd:
    print(f'http://localhost:{port}')
    httpd.serve_forever()
