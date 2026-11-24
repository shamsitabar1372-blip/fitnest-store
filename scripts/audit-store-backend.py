"""Read only the declared source allowlist. Print paths, never secret values."""
from pathlib import Path
import re, json, subprocess
ROOT=Path(__file__).resolve().parents[1]
paths=[ROOT/'index.html',ROOT/'.env.example',ROOT/'compose.yaml',ROOT/'Dockerfile']
for directory in ['backend','docs','deploy','design/admin-mockups']:
    paths += [p for p in (ROOT/directory).rglob('*') if p.is_file() and p.suffix in ['.py','.js','.css','.html','.json','.txt'] and not any(x in p.parts for x in ['__pycache__','media','staticfiles'])]
paths += [ROOT/'assets/store-api.js']
html=(ROOT/'index.html').read_text(encoding='utf-8')
paths += [ROOT/name for name in re.findall(r'assets/site\.[a-f0-9]+\.(?:js|css)',html)]
patterns=[r'(?:service|web)\.[a-fA-F0-9]{20,}',r'gh[pousr]_[A-Za-z0-9]{20,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----']
issues=[]
for path in paths:
    content=path.read_text(encoding='utf-8')
    if any(re.search(pattern,content) for pattern in patterns): issues.append(str(path.relative_to(ROOT)))
for line in (ROOT/'.env.example').read_text(encoding='utf-8').splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key,value=line.split('=',1)
        if any(part in key for part in ['SECRET','PASSWORD','API_KEY','MERCHANT']) and value.strip(): issues.append('.env.example:'+key)
for file in [ROOT/'assets/store-api.js', ROOT/'backend/static/ops/panel.js']: subprocess.run(['node','--check',str(file)],check=True)
if issues: raise SystemExit('Review sensitive content in: '+', '.join(issues))
print(json.dumps({'status':'PASS','sourceFilesScanned':len(paths),'credentialPatternMatches':0,'note':'Scoped pattern scan; not proof against every possible secret.'}))
