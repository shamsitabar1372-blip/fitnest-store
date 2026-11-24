"""Create a reproducible source handoff, excluding databases, user uploads and credentials."""
from pathlib import Path
import json,re,zipfile
ROOT=Path(__file__).resolve().parents[1]
names={'index.html','.env.example','.gitignore','.gitattributes','.dockerignore','Dockerfile','compose.yaml','assets/store-api.js','assets/store-api.css','assets/optimized/manifest.json','assets/fitnestpro-favicon-concept-03.svg'}
html=(ROOT/'index.html').read_text(encoding='utf-8')
names.update(re.findall(r'assets/site\.[a-f0-9]+\.(?:css|js)',html))
names.update(p.relative_to(ROOT).as_posix() for p in (ROOT/'assets/fonts').iterdir() if p.is_file())
manifest=json.loads((ROOT/'assets/optimized/manifest.json').read_text(encoding='utf-8'))
for item in manifest['images'].values(): names.update(v['src'] for v in item.get('variants',[]))
for folder in ['backend','docs','deploy','design/admin-mockups','.github/workflows']:
    for p in (ROOT/folder).rglob('*'):
        if not p.is_file() or any(x in p.relative_to(ROOT/folder).parts for x in ['__pycache__','media','staticfiles']): continue
        if p.name.startswith('.env') or p.suffix in ['.sqlite3','.pyc','.log','.dump']:continue
        names.add(p.relative_to(ROOT).as_posix())
for p in (ROOT/'scripts').glob('*'):
    if p.is_file() and (p.suffix=='.ps1' or p.name in ['audit-store-backend.py','package-backend.py']): names.add(p.relative_to(ROOT).as_posix())
archive=ROOT/'output/FitNestPro-Django-source.zip';archive.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name in sorted(names):
        assert not any(x in Path(name).parts for x in ['.private','.venv','tmp','.git','output']),name
        z.write(ROOT/name,name)
print(f'Source handoff: {archive.name}; {len(names)} files; {archive.stat().st_size} bytes; credentials and user data excluded.')
