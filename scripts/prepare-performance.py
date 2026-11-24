"""Build responsive image variants and local fonts. Original artwork stays intact."""
from pathlib import Path
import sys, re, json, hashlib, urllib.request
from concurrent.futures import ThreadPoolExecutor
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tmp/perf-deps'))
from PIL import Image, ImageOps
OUT = ROOT / 'assets/optimized'
OUT.mkdir(parents=True, exist_ok=True)
def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'})
    with urllib.request.urlopen(request, timeout=35) as response:
        return response.read()
sources = {
 'hero-first': 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&fm=jpg&q=95&w=3840',
 'hero-shadow': 'https://files.bodyview.co.uk/images/female-weightlifter.jpg',
 'category-supplements': 'https://images.unsplash.com/photo-1579722822163-0504256cf3a7?auto=format&fit=crop&w=2000&q=90',
 'category-gear': 'https://www.workout.com.pe/cdn/shop/files/Copia_de_DSC05284.jpg?v=1755217525',
 'category-clothing': 'Fitness coaches sportswear photograph – 18 Nov 2026, 2.36 am.png',
 'hero-nutrition': 'Nutri end.png', 'hero-fitness': 'New fit.png',
 'banner-men': 'Men’s sportswear hero banner.png',
 'banner-women': 'Women’s sportswear hero banner.png',
 'banner-gear': 'GEAR fitness website hero banner – 19 Nov 2026, 12.06 am.png',
}
def process(entry):
    name, source = entry
    previous=OUT/'manifest.json'
    if previous.exists():
        cached=json.loads(previous.read_text(encoding='utf-8'))['images'].get(name,{})
        if cached.get('error'): return name,cached
        if cached.get('variants') and cached.get('lossless'): return name,cached
    try:
        import io
        raw = download(source) if source.startswith('https:') else (ROOT/source).read_bytes()
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
        variants = []
        for width in [im.width]:
            size = (width, round(im.height*width/im.width))
            resized = im.resize(size, Image.Resampling.LANCZOS)
            payload = io.BytesIO(); resized.save(payload, 'WEBP', lossless=True, exact=True, method=4)
            data = payload.getvalue(); digest = hashlib.sha256(data).hexdigest()[:10]
            file = OUT/f'{name}-{width}.{digest}.webp'; file.write_bytes(data)
            variants.append({'width':width,'height':size[1],'src':file.relative_to(ROOT).as_posix(),'bytes':len(data)})
        return name, {'source':source,'originalBytes':len(raw),'originalSize':im.size,'variants':variants,'lossless':True}
    except Exception as error:
        return name, {'source':source,'error':str(error)}
with ThreadPoolExecutor(max_workers=4) as pool:
    images = dict(pool.map(process, sources.items()))
fonts=[]; errors=[]
font_dir=ROOT/'assets/fonts'; font_dir.mkdir(exist_ok=True)
families=[('Manrope','400..800',{'latin'}),('Michroma','400',{'latin'}),('Vazirmatn','400..900',{'arabic','latin'})]
for family, weights, subsets in ([] if (font_dir/'fonts.css').exists() else families):
    try:
        css=download(f'https://fonts.googleapis.com/css2?family={family}:wght@{weights}&display=swap').decode()
        (ROOT/'tmp'/f'{family}-remote.css').write_text(css,encoding='utf-8')
        rules=re.findall(r'/\* ([^*]+) \*/\s*(@font-face\s*\{[^}]+\})',css)
        if not rules:
            rules=[('all',rule) for rule in re.findall(r'@font-face\s*\{[^}]+\}',css)]
            subsets={'all'}
        for subset, rule in rules:
            if subset.strip() not in subsets: continue
            url=re.search(r'url\(([^)]+)\)',rule).group(1)
            data=download(url); extension='woff2' if data[:4]==b'wOF2' else 'ttf'
            file=font_dir/f'{family.lower()}-{subset.strip()}-{hashlib.sha256(data).hexdigest()[:10]}.{extension}'
            file.write_bytes(data)
            rule=rule.replace(url,file.name)
            fonts.append(rule)
        license_data=download(f'https://raw.githubusercontent.com/google/fonts/main/ofl/{family.lower()}/OFL.txt')
        (font_dir/f'{family}-OFL.txt').write_bytes(license_data)
    except Exception as error: errors.append(f'{family}: {error}')
if fonts: (font_dir/'fonts.css').write_text('\n'.join(fonts),encoding='utf-8')
manifest={'images':images,'fonts':len(fonts) or 4 if (font_dir/'fonts.css').exists() else 0,'fontErrors':errors}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'images':{k:({'error':v['error']} if 'error' in v else {'before':v['originalBytes'],'after1600':next((x['bytes'] for x in v['variants'] if x['width']==1600),v['variants'][-1]['bytes'])}) for k,v in images.items()},'fonts':len(fonts),'fontErrors':errors},indent=2))
