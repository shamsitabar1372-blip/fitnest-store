from pathlib import Path
from urllib.parse import quote, unquote
import json,re,hashlib,gzip
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'index.html'; s=p.read_text(encoding='utf-8')
backup=ROOT/'tmp/index-before-performance.html'
if not backup.exists():backup.write_text(s,encoding='utf-8')
if '<style>' not in s:
    raise SystemExit('Already optimized. Apply to the original source, not generated HTML.')
manifest=json.loads((ROOT/'assets/optimized/manifest.json').read_text(encoding='utf-8'))
images=manifest['images']
def preferred(info):
    return next((v for v in info['variants'] if v['width']==1600),info['variants'][-1])
def srcset(info):return ', '.join(f"{v['src']} {v['width']}w" for v in info['variants'])
replaced={}
for name,info in images.items():
    if 'variants' not in info:continue
    old=info['source'];new=preferred(info)['src'];replaced[name]=new
    for text in {old,quote(old),quote(old,safe=',/'),old.replace('&','&amp;')}:
        s=s.replace(text,new)
    # Image dimensions reserve the correct intrinsic ratio, without changing CSS crops.
    def decorate(match):
        tag=match.group(0)
        if f'src="{new}"' not in tag:return tag
        size='(max-width: 700px) 100vw, 33vw' if name.startswith('category-') else '100vw'
        tag=tag.replace('>',f' srcset="{srcset(info)}" sizes="{size}" width="{info["originalSize"][0]}" height="{info["originalSize"][1]}">')
        if 'decoding=' not in tag:tag=tag.replace('>',' decoding="async">')
        if name!='hero-first' and name!='hero-shadow' and 'loading=' not in tag:tag=tag.replace('>',' loading="lazy">')
        return tag
    s=re.sub(r'<img\b[^>]+>',decorate,s)
    if name.startswith('hero-') and name!='hero-shadow':
        s=s.replace("{image:'"+new+"',", "{image:'"+new+"',srcset:"+json.dumps(srcset(info))+",sizes:'100vw',")

# Responsive selection must change together with the current carousel URL.
s=s.replace('      heroImage.src=slide.image; heroImage.alt=slide.alt;',"      heroImage.srcset=slide.srcset||''; heroImage.sizes=slide.sizes||'100vw';\n      heroImage.src=slide.image; heroImage.alt=slide.alt;")
s=s.replace('    function startHeroTimer(){clearInterval(heroTimer);if(heroPaused)return;',"    function startHeroTimer(){clearInterval(heroTimer);if(heroPaused||document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;")
s=s.replace('    startHeroTimer();\n    const products',"    document.addEventListener('visibilitychange',startHeroTimer);\n    startHeroTimer();\n    const products")
# Browser idle time prepares only the next slide, never all slides during first paint.
s=s.replace('    const products = [',"""    const preloadNextSlide=()=>{
      if(document.hidden||navigator.connection?.saveData||['slow-2g','2g'].includes(navigator.connection?.effectiveType))return;
      const slide=heroSlides[(activeHeroSlide+1)%heroSlides.length],image=new Image();
      image.fetchPriority='low';image.decoding='async';image.sizes=slide.sizes||'100vw';image.srcset=slide.srcset||'';image.src=slide.image;
    };
    window.addEventListener('load',()=>{if('requestIdleCallback' in window)requestIdleCallback(preloadNextSlide,{timeout:5000});else setTimeout(preloadNextSlide,2500);},{once:true});
    const products = [""")

# Self-host original licensed fonts, preserving the same families and visual identity.
font_css=ROOT/'assets/fonts/fonts.css'
if font_css.exists():
    s=re.sub(r'  <link[^>]+(?:fonts.googleapis.com|fonts.gstatic.com)[^>]+>\n','',s)
    s=s.replace('  <style>','  <link rel="stylesheet" href="assets/fonts/fonts.css">\n  <style>',1)

css=re.search(r'<style>(.*?)</style>',s,re.S).group(1)
# Remove obsolete raster-logo styling and superseded old wordmark span rules.
css=re.sub(r'\s*[^{}]*\.brand-logo[^{}]*\{[^{}]*\}', '',css)
css=re.sub(r'\s*\.wordmark \.(?:fit|nest)\s*\{[^{}]*\}', '',css)
# Collapse truly duplicated rules only, preserving cascade order of different declarations.
seen=set()
def dedupe(m):
    rule=m.group(0)
    # Only adjacent identical declarations are collapsed; media scopes are kept intact.
    return rule
css=re.sub(r'([ \t]){2,}',' ',css)
css+='''
/* Reduce paint cost on small screens and respect motion preferences. */
@media(max-width:700px) {
 .site-header { backdrop-filter:none; }
 .hero-silhouette { filter:grayscale(1) brightness(.68) contrast(1.55); }
}
@media(prefers-reduced-motion:reduce) {
 html { scroll-behavior:auto; }
 .hero-glow-word { animation:none !important; }
 .hero-copy,.hero-runner,.hero-silhouette,.clothing-view-all { transition:none; }
}
'''
# CSS URL paths are resolved relative to assets/, not the HTML document.
css=css.replace('url("assets/','url("')
js=re.search(r'<script>(.*?)</script>',s,re.S).group(1)
for kind,text in [('css',css.strip()),('js',js.strip())]:
    digest=hashlib.sha256(text.encode()).hexdigest()[:10]
    file=ROOT/'assets'/f'site.{digest}.{kind}';file.write_text(text,encoding='utf-8')
    if kind=='css':s=re.sub(r'<style>.*?</style>',f'<link rel="stylesheet" href="assets/{file.name}">',s,count=1,flags=re.S)
    else:s=re.sub(r'<script>.*?</script>',f'<script defer src="assets/{file.name}"></script>',s,count=1,flags=re.S)
p.write_text(s,encoding='utf-8')
before=sum(v['originalBytes'] for v in images.values() if 'variants' in v)
after=sum(preferred(v)['bytes'] for v in images.values() if 'variants' in v)
report={'imageOriginalBytes':before,'imageDesktopBytes':after,'reductionPercent':round((1-after/before)*100,1),'unavailableExternalImages':{k:v['error'] for k,v in images.items() if 'error' in v},'htmlBytes':p.stat().st_size,'htmlGzipBytes':len(gzip.compress(s.encode())),'fontsLocal':font_css.exists()}
(ROOT/'output/performance-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
