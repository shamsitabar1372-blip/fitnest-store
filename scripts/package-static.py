"""Create a clean upload archive containing the website and its active assets."""
from pathlib import Path
import re,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text(encoding='utf-8')
files={'index.html','.htaccess','assets/fitnestpro-favicon-concept-03.svg'}
files.update(re.findall(r'(assets/site\.[a-f0-9]+\.(?:css|js))',html))
files.update(p.relative_to(ROOT).as_posix() for p in (ROOT/'assets/fonts').iterdir() if p.is_file())
manifest=json.loads((ROOT/'assets/optimized/manifest.json').read_text(encoding='utf-8'))
for image in manifest['images'].values():
    files.update(v['src'] for v in image.get('variants',[]))
archive=ROOT/'output/FitNestPro-upload.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name in sorted(files):z.write(ROOT/name,name)
print(f'Upload archive: {archive} ({archive.stat().st_size:,} bytes; {len(files)} files)')
