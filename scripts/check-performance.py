from pathlib import Path
import urllib.request,urllib.error,gzip,re,subprocess
html=Path('index.html').read_text(encoding='utf-8')
js=re.search(r'<script defer src="([^"]+)"',html).group(1)
subprocess.run(['node','--check',js],check=True)
base='http://127.0.0.1:8080'
request=urllib.request.Request(base+'/',headers={'Accept-Encoding':'gzip'})
with urllib.request.urlopen(request) as r:
    assert r.headers['Content-Encoding']=='gzip'
    assert gzip.decompress(r.read())==Path('index.html').read_bytes()
    etag=r.headers['ETag']
try:
    urllib.request.urlopen(urllib.request.Request(base+'/',headers={'Accept-Encoding':'gzip','If-None-Match':etag}))
    raise AssertionError('Expected 304')
except urllib.error.HTTPError as e:assert e.code==304
for name in ['/serve.py','/tmp/index-before-performance.html','/../serve.py']:
    try:
        urllib.request.urlopen(base+name)
        raise AssertionError('Private file exposed')
    except urllib.error.HTTPError as e:assert e.code==404
with urllib.request.urlopen(base+'/'+js) as r:
    assert 'max-age=604800' in r.headers['Cache-Control']
print('PASS: JS syntax, HTTP response, gzip roundtrip, ETag 304, asset caching and private-file isolation')
