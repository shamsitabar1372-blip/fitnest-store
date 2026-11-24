"""Scoped static/HTTP checks for this prototype, not a penetration-test certificate."""
from pathlib import Path
from html.parser import HTMLParser
import re,hashlib,base64,urllib.request,urllib.error,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text(encoding='utf-8')
class Audit(HTMLParser):
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        assert not any(k.startswith('on') for k in a),'Inline event handler'
        if tag=='script':assert a.get('src'),'Inline script'
        if tag=='form' and a.get('id') in ['profile-register','account-form','address-form']:assert a.get('method')=='post'
        if a.get('integrity'):
            path=ROOT/a.get('src',a.get('href'))
            expected='sha384-'+base64.b64encode(hashlib.sha384(path.read_bytes()).digest()).decode()
            assert a['integrity']==expected,f'Integrity mismatch: {path}'
Audit().feed(html)
js_path=ROOT/re.search(r'<script defer src="([^"]+)"',html).group(1)
js=js_path.read_text(encoding='utf-8')
assert 'localStorage.setItem(NESHAN_SERVICE_KEY_STORAGE' not in js
assert "sessionStorage.setItem(NESHAN_SERVICE_KEY_STORAGE" in js
assert 'cartItemsElement.innerHTML' not in js
assert 'script-src-attr' in html
subprocess.run(['node','--check',str(js_path)],check=True)
base='http://127.0.0.1:8080'
with urllib.request.urlopen(base+'/',timeout=10) as r:
    headers=dict(r.headers)
    assert r.headers['X-Frame-Options']=='DENY'
    assert "frame-ancestors 'none'" in r.headers['Content-Security-Policy']
    assert "script-src-attr 'none'" in r.headers['Content-Security-Policy']
    assert 'unsafe-eval' not in r.headers['Content-Security-Policy']
    assert r.headers['X-Content-Type-Options']=='nosniff'
    assert 'Python' not in r.headers['Server']
for path in ['/../serve.py','/%2e%2e/serve.py','/.git/config','/.env','/tmp/index-before-performance.html','/assets/optimized/manifest.json','/scripts/check-security.py','/%00']:
    try:urllib.request.urlopen(base+path,timeout=5);raise AssertionError(f'Unexpected exposure: {path}')
    except urllib.error.HTTPError as e:assert e.code in (400,403,404)
try:
    urllib.request.urlopen(urllib.request.Request(base+'/',headers={'Host':'attacker.invalid'}),timeout=5)
    raise AssertionError('Unexpected Host accepted')
except urllib.error.HTTPError as e:assert e.code==403
report={'staticAndHttpChecks':'PASS','controls':['CSP blocks inline script/eval and framing','SRI matches active CSS/JS bytes','forms do not fall back to GET with personal data','DOM rendering for cart','service key is not persisted and is disabled on public origins','path traversal and private files blocked','Host validation','no Python version disclosure'],'productionBlockers':['activate SMS provider and review public authentication deployment','database isolation for users/addresses/orders','server-side pricing, inventory and payment verification','server-side Neshan service proxy','production TLS, distributed abuse protection, backup and monitoring'],'scope':'Local prototype review. Not a full penetration test or production security approval.'}
(ROOT/'output/security-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
