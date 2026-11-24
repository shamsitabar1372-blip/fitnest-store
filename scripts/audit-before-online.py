"""Check active local assets and the upload archive without modifying originals."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import re,json,sys,subprocess,zipfile,hashlib
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tmp/perf-deps'))
from PIL import Image,ImageChops
errors=[];checked=set();external=[];ids=[]
html=(ROOT/'index.html').read_text(encoding='utf-8')
def asset(value,parent=ROOT):
    if not value or value.startswith(('#','data:','mailto:','tel:')):return
    if value.startswith(('https:','http:')):
        external.append(value);return
    file=(parent/unquote(urlsplit(value).path)).resolve()
    if not file.is_file():errors.append(f'Missing: {value}');return
    checked.add(file.relative_to(ROOT).as_posix())
class Audit(HTMLParser):
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:ids.append(a['id'])
        if tag in ('img','script'):asset(a.get('src',''))
        if tag=='link':asset(a.get('href',''))
        for part in a.get('srcset','').split(','):
            if part.strip():asset(part.strip().split()[0])
Audit().feed(html)
assert len(ids)==len(set(ids)),'Duplicate element IDs'
js_path=ROOT/re.search(r'<script defer src="([^"]+)"',html).group(1)
subprocess.run(['node','--check',str(js_path)],check=True)
js=js_path.read_text(encoding='utf-8')
for value in re.findall(r'assets/[a-zA-Z0-9_./-]+\.(?:webp|jpg|png|svg)',js):asset(value)
for file in list(checked):
    if not file.endswith('.css'):continue
    css=(ROOT/file).read_text(encoding='utf-8')
    assert css.count('{')==css.count('}'),f'Unbalanced CSS: {file}'
    for value in re.findall(r'url\(["\']?([^\)"\']+)',css):asset(value,(ROOT/file).parent)
m=json.loads((ROOT/'assets/optimized/manifest.json').read_text(encoding='utf-8'))
pixel_checks=0;byte_checks=0
for image in m['images'].values():
    if not image.get('variants'):continue
    source=ROOT/image['source']
    if not source.is_file():continue
    output=ROOT/image['variants'][-1]['src']
    if image.get('unchangedOriginal'):
        assert source.read_bytes()==output.read_bytes();byte_checks+=1
    elif image.get('lossless'):
        a=Image.open(source).convert('RGBA');b=Image.open(output).convert('RGBA')
        assert a.size==b.size
        assert ImageChops.difference(a,b).getbbox() is None;pixel_checks+=1
with zipfile.ZipFile(ROOT/'output/FitNestPro-upload.zip') as archive:
    names=set(archive.namelist());assert archive.testzip() is None
    for name in checked|{'index.html','.htaccess'}:
        assert name in names,f'Not in archive: {name}'
        assert archive.read(name)==(ROOT/name).read_bytes(),f'Stale archive: {name}'
    assert not any(name.startswith(('tmp/','output/','scripts/')) for name in names)
assert html.index('id="profile-status"')<html.index('id="profile-register"')
if errors:raise AssertionError(errors)
report={'status':'PASS','checkedLocalAssets':len(checked),'losslessPixelComparisons':pixel_checks,'byteIdenticalOriginalPhotos':byte_checks,'externalImages':sorted(set(external)),'archiveBytes':(ROOT/'output/FitNestPro-upload.zip').stat().st_size,'note':'Live network performance and production HTTPS/CDN remain unmeasured.'}
(ROOT/'output/pre-online-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
