from pathlib import Path
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor
import sys,json
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tmp/perf-deps'))
from PIL import Image
OUT=ROOT/'output/slide-1-originals';OUT.mkdir(exist_ok=True)
sources=[('slide-1-main','https://images.unsplash.com/photo-1605296867304-46d5465a13f1'),('slide-1-overlay','https://files.bodyview.co.uk/images/female-weightlifter.jpg')]
def get(item):
 name,url=item
 try:
  request=Request(url,headers={'User-Agent':'Mozilla/5.0'})
  with urlopen(request,timeout=25) as r:data=r.read()
  import io
  im=Image.open(io.BytesIO(data));im.verify()
  ext={'JPEG':'.jpg','PNG':'.png','WEBP':'.webp','AVIF':'.avif'}.get(im.format,'.img')
  path=OUT/(name+ext);path.write_bytes(data)
  return {'name':name,'source':url,'file':str(path),'bytes':len(data),'size':im.size}
 except Exception as e:return {'name':name,'source':url,'error':str(e)}
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(get,sources))
(OUT/'sources.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
