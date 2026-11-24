"""Local static preview: python serve.py (only index.html and assets are served)."""
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote, urlsplit
import argparse, gzip, hashlib, mimetypes, ipaddress, json, os, threading
from http.cookies import SimpleCookie
from auth_backend import AuthStore,AuthError

ROOT=Path(__file__).resolve().parent
CACHE={}
AUTH=None
AUTH_LOCK=threading.Lock()
def auth_store():
    global AUTH
    with AUTH_LOCK:
        if AUTH is None:AUTH=AuthStore(os.environ.get('FITNEST_DATA_DIR',str(ROOT/'.private')))
    return AUTH
CSP="default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; frame-src 'none'; form-action 'self'; script-src 'self' https://static.neshan.org; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://static.neshan.org; img-src 'self' data: blob: https://*.neshan.org; font-src 'self' https://static.neshan.org; connect-src 'self' https://*.neshan.org; worker-src 'self' blob:; media-src 'none'"
ASSET_TYPES={'.css','.js','.svg','.jpg','.jpeg','.png','.webp','.avif','.woff2','.woff','.ttf','.ico','.txt'}
class Handler(BaseHTTPRequestHandler):
    server_version='FitNestPro-Preview'
    sys_version=''
    def setup(self):
        super().setup()
        self.connection.settimeout(15)
    def end_headers(self):
        self.send_header('Content-Security-Policy',CSP)
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','DENY')
        self.send_header('Referrer-Policy','strict-origin-when-cross-origin')
        self.send_header('Permissions-Policy','camera=(), microphone=(), geolocation=(self), payment=()')
        self.send_header('Cross-Origin-Resource-Policy','same-origin')
        super().end_headers()
    def do_HEAD(self): self.respond(False)
    def do_GET(self):
        if urlsplit(self.path).path=='/api/auth/session':self.auth_request('session');return
        self.respond(True)
    def do_POST(self):
        paths={'/api/auth/request':'request','/api/auth/verify':'verify','/api/auth/logout':'logout'}
        action=paths.get(urlsplit(self.path).path)
        if action:self.auth_request(action)
        else:self.send_error(405)
    def valid_host(self):
        try:
            host=urlsplit('//'+self.headers.get('Host','')).hostname
            public=urlsplit(os.environ.get('FITNEST_PUBLIC_ORIGIN','')).hostname
            if public and host==public:return True
            if host=='localhost':return True
            address=ipaddress.ip_address(host)
            return address.is_loopback or (getattr(self.server,'allow_lan',False) and address.is_private)
        except (ValueError,TypeError):return False
    def auth_request(self,action):
        if not self.valid_host():self.send_error(403);return
        public=os.environ.get('FITNEST_PUBLIC_ORIGIN','').rstrip('/')
        secure=public.startswith('https://')
        origin=public or 'http://'+self.headers.get('Host','')
        def answer(status,data,cookies=(),retry=0):
            payload=json.dumps(data,ensure_ascii=False).encode()
            self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(payload)))
            for cookie in cookies:self.send_header('Set-Cookie',cookie)
            if retry:self.send_header('Retry-After',str(retry))
            self.end_headers();self.wfile.write(payload)
        def cookie(name,value,age):
            return f'{name}={value}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}'+('; Secure' if secure else '')
        try:
            jar=SimpleCookie();jar.load(self.headers.get('Cookie',''))
            session=jar['fitnest_session'].value if 'fitnest_session' in jar else ''
            challenge=jar['fitnest_otp'].value if 'fitnest_otp' in jar else ''
            store=auth_store()
            if action=='session':
                user=store.session(session)
                answer(200,{'authenticated':bool(user),'user':user,'smsConfigured':store.ready()});return
            if self.headers.get('Origin')!=origin or self.headers.get('Sec-Fetch-Site')=='cross-site':
                raise AuthError('درخواست ورود نامعتبر است.',403)
            if self.headers.get('Content-Type','').split(';')[0]!='application/json':raise AuthError('نوع درخواست معتبر نیست.',415)
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=2048:raise AuthError('اندازهٔ درخواست معتبر نیست.',413)
            data=json.loads(self.rfile.read(length))
            if not isinstance(data,dict):raise AuthError('درخواست معتبر نیست.')
            ip=self.client_address[0]
            if os.environ.get('FITNEST_TRUST_PROXY')=='1' and ipaddress.ip_address(ip).is_loopback:
                forwarded=self.headers.get('X-Real-IP','')
                try:ip=str(ipaddress.ip_address(forwarded))
                except ValueError:raise AuthError('تنظیم پراکسی معتبر نیست.',503)
            if action=='request':
                token,result=store.request(data.get('mobile'),ip)
                answer(200,result,[cookie('fitnest_otp',token,store.TTL)]);return
            if action=='verify':
                token,user=store.verify(challenge,data.get('code'),ip,session)
                answer(200,{'ok':True,'user':user},[cookie('fitnest_session',token,store.SESSION_TTL),cookie('fitnest_otp','',0)]);return
            store.logout(session)
            answer(200,{'ok':True},[cookie('fitnest_session','',0),cookie('fitnest_otp','',0)])
        except AuthError as error:answer(error.status,{'ok':False,'message':error.message,'retryAfter':error.retry},retry=error.retry)
        except (ValueError,TypeError,json.JSONDecodeError):answer(400,{'ok':False,'message':'درخواست معتبر نیست.'})
        except Exception:answer(503,{'ok':False,'message':'سرویس ورود موقتاً در دسترس نیست.'})
    def respond(self, body):
        # Reject arbitrary Host names (including DNS rebinding) on this local preview.
        if not self.valid_host():
            self.send_error(403);return
        try:
            name=unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
            if '\x00' in name:raise ValueError('Invalid path')
            path=(ROOT/name).resolve()
        except (ValueError,OSError):
            self.send_error(400);return
        if not (path==ROOT/'index.html' or (path.is_relative_to(ROOT/'assets') and path.suffix.lower() in ASSET_TYPES)) or not path.is_file():
            self.send_error(404); return
        stamp=path.stat().st_mtime_ns
        key=str(path)
        if key not in CACHE or CACHE[key][0]!=stamp:
            raw=path.read_bytes()
            mime=mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
            compress=mime.startswith('text/') or mime in ('application/javascript','application/json','image/svg+xml')
            CACHE[key]=(stamp,raw,gzip.compress(raw,compresslevel=6) if compress else None,mime,hashlib.sha256(raw).hexdigest())
        _,raw,zipped,mime,digest=CACHE[key]
        encoded=zipped is not None and 'gzip' in self.headers.get('Accept-Encoding','')
        data=zipped if encoded else raw
        etag='"'+digest+('-gzip' if encoded else '')+'"'
        not_modified=self.headers.get('If-None-Match')==etag
        self.send_response(304 if not_modified else 200)
        self.send_header('ETag',etag)
        self.send_header('Cache-Control','no-cache' if path.name=='index.html' else 'public, max-age=604800')
        self.send_header('Vary','Accept-Encoding')
        if not not_modified:
            self.send_header('Content-Type',mime+('; charset=utf-8' if mime.startswith('text/') else ''))
            if encoded:self.send_header('Content-Encoding','gzip')
            self.send_header('Content-Length',str(len(data)))
        self.end_headers()
        if body and not not_modified:self.wfile.write(data)

if __name__=='__main__':
    args=argparse.ArgumentParser(description=__doc__)
    args.add_argument('--lan',action='store_true',help='Allow other devices on your local network')
    args.add_argument('--port',type=int,default=8080)
    options=args.parse_args()
    public=os.environ.get('FITNEST_PUBLIC_ORIGIN','')
    if public and (not public.startswith('https://') or urlsplit(public).path not in ('','/')):
        raise SystemExit('FITNEST_PUBLIC_ORIGIN must be an HTTPS origin without a path')
    host='0.0.0.0' if options.lan else '127.0.0.1'
    print(f'FitNestPro preview: http://127.0.0.1:{options.port}',flush=True)
    if options.lan:print('LAN enabled: use this computer LAN IP on another device.',flush=True)
    server=ThreadingHTTPServer((host,options.port),Handler)
    server.allow_lan=options.lan
    server.serve_forever()
