from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request,urlopen
import json,sys,io,hashlib,re,subprocess
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tmp/perf-deps'))
from PIL import Image
sources=[('category-supplements','https://images.unsplash.com/photo-1579722822163-0504256cf3a7?auto=format&fit=crop&w=2000&q=90'),('category-gear','https://www.workout.com.pe/cdn/shop/files/Copia_de_DSC05284.jpg?v=1755217525')]
def download(entry):
    name,url=entry
    try:
        req=Request(url,headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'})
        with urlopen(req,timeout=18) as r:data=r.read()
        im=Image.open(io.BytesIO(data));size=im.size;fmt=im.format;im.verify()
        extension={'JPEG':'jpg','PNG':'png','WEBP':'webp','AVIF':'avif'}[fmt]
        dest=ROOT/'assets/optimized'/f'{name}-original.{hashlib.sha256(data).hexdigest()[:10]}.{extension}'
        dest.write_bytes(data)
        return {'name':name,'source':url,'src':dest.relative_to(ROOT).as_posix(),'width':size[0],'height':size[1],'bytes':len(data)}
    except Exception as e:return {'name':name,'source':url,'error':str(e)}
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(download,sources))
p=ROOT/'index.html';html=p.read_text(encoding='utf-8')
mp=ROOT/'assets/optimized/manifest.json';manifest=json.loads(mp.read_text(encoding='utf-8'))
for result in results:
    if 'error' in result:continue
    html=html.replace(result['source'].replace('&','&amp;'),result['src']).replace(result['source'],result['src'])
    html=html.replace('src="'+result['src']+'"','src="'+result['src']+f'" width="{result["width"]}" height="{result["height"]}"')
    manifest['images'][result['name']]={'source':result['source'],'originalBytes':result['bytes'],'originalSize':[result['width'],result['height']],'unchangedOriginal':True,'variants':[{'src':result['src'],'width':result['width'],'height':result['height'],'bytes':result['bytes']}]}
p.write_text(html,encoding='utf-8');mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'output/category-download-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
