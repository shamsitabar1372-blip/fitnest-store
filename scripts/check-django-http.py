"""Read-only public HTTP smoke checks against the explicit local Django server."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request,build_opener,ProxyHandler
from urllib.error import HTTPError
import json,hashlib,base64
ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:8081'
client=build_opener(ProxyHandler({}))
checks=[]
def fetch(path,expected=200,headers=None):
    try:
        with client.open(Request(BASE+path,headers=headers or {}),timeout=8) as response:
            status,body,metadata=response.status,response.read(),response.headers
    except HTTPError as response: status,body,metadata=response.code,response.read(),response.headers
    assert status==expected,(path,status,expected)
    checks.append({'path':path,'status':status})
    return body,metadata
html,headers=fetch('/')
assert headers['X-Frame-Options']=='DENY'
assert headers['X-Content-Type-Options']=='nosniff'
assert "frame-ancestors 'none'" in headers['Content-Security-Policy']
assert 'unsafe-eval' not in headers['Content-Security-Policy']
class Assets(HTMLParser):
    def handle_starttag(self,tag,attrs):
        data=dict(attrs)
        url=data.get('src') if tag in ('script','img') else data.get('href') if tag=='link' and data.get('rel') in ('stylesheet','preload','icon') else None
        if not url or url.startswith(('http:','https:','data:')): return
        content,_=fetch('/'+url.lstrip('/'))
        if data.get('integrity'):
            assert data['integrity']=='sha384-'+base64.b64encode(hashlib.sha384(content).digest()).decode(),url
Assets().feed(html.decode())
session,headers=fetch('/api/auth/session');assert 'no-store' in headers.get('Cache-Control','')
assert not json.loads(session)['authenticated']
catalog,_=fetch('/api/products');products=json.loads(catalog)['products']
for product in products:
    for image in product['images']:
        if image['path'].startswith(('http:','https:')): continue
        fetch('/'+image['path'].lstrip('/'))
for path in ['/api/profile','/api/addresses','/api/orders','/api/reviews']: fetch(path,401)
for path in ['/api/manage/dashboard','/api/manage/products','/api/manage/settings']: fetch(path,403)
for path in ['/.env','/.git/config','/.private/django-secret','/.private/neshan-service-key','/backend/config/settings.py','/scripts/connect-neshan.py','/assets/../.private/neshan-service-key']: fetch(path,404)
fetch('/api/auth/session',400,{'Host':'attacker.invalid'})
_,headers=fetch('/local-map-setup/');assert 'no-store' in headers.get('Cache-Control','')
report={'status':'PASS','checks':checks,'productCountChecked':len(products),'scope':'Public HTTP, local assets, SRI and anonymous access only; no private sessions read, no provider calls or customer changes.'}
(ROOT/'output/django-http-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'status':'PASS','httpChecks':len(checks),'productsChecked':len(products)}))
