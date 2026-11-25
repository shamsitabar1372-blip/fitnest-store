"""Server-side Neshan adapter using the contract of the existing map integration."""
import json,os,math,ssl
from urllib.error import HTTPError,URLError
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from .services import ShopError
from django.conf import settings

def service_key():
    key=os.getenv('NESHAN_SERVICE_API_KEY','') if os.getenv('NESHAN_SERVICES_ENABLED')=='1' else ''
    if not key and settings.LOCAL:
        try: key=(settings.ROOT/'.private/neshan-service-key').read_text(encoding='utf-8').strip()
        except OSError: pass
    return key if key.startswith('service.') and len(key)<=512 and not any(c.isspace() for c in key) else ''

def ready(): return bool(service_key())

def tls_context():
    # CryptoAPI validates against Windows trust and can fetch missing intermediates.
    # Keep certificate AND hostname verification enabled; no global SSL patching.
    if os.name=='nt':
        import truststore
        return truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    return ssl.create_default_context()

def save_local_key(key):
    if not settings.LOCAL: raise ShopError('تنظیم محلی غیرفعال است.',404)
    if not isinstance(key,str) or not key.startswith('service.') or len(key)>512 or any(c.isspace() for c in key):
        raise ShopError('کلید سرویس‌ها باید با service. شروع شود؛ کلید نقشهٔ وب مناسب این قسمت نیست.')
    target=settings.ROOT/'.private/neshan-service-key'
    target.parent.mkdir(exist_ok=True)
    temporary=target.with_suffix('.tmp')
    fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w',encoding='utf-8') as stream: stream.write(key)
    os.replace(temporary,target)

def reverse(latitude,longitude):
    try: lat,lng=float(latitude),float(longitude)
    except (TypeError,ValueError): raise ShopError('مختصات معتبر نیست.')
    if not math.isfinite(lat) or not math.isfinite(lng) or not 24<=lat<=41 or not 44<=lng<=64: raise ShopError('نقطهٔ انتخابی در محدودهٔ مجاز نیست.')
    if not ready(): raise ShopError('موقعیت ثبت شد؛ تکمیل خودکار نشانی هنوز به کلید سرویس نشان در سرور نیاز دارد. فعلاً نشانی کامل را دستی وارد کنید.',503)
    try:
        req=Request('https://api.neshan.org/v5/reverse?'+urlencode({'lat':lat,'lng':lng}),headers={'Api-Key':service_key()})
        with urlopen(req,timeout=8,context=tls_context()) as response: data=json.loads(response.read(65536))
        if not isinstance(data,dict) or data.get('status') not in (None,'OK','ok'): raise ValueError()
        result={key:str(data.get(field) or '')[:limit] for key,field,limit in [('province','state',80),('city','city',80),('street','formatted_address',500)]}
        if not result['city']: result['city']=str(data.get('village') or '')[:80]
        if not result['street']: raise ValueError()
        return result
    except HTTPError as error:
        if error.code in (401,403): message='نشان دسترسی کلید سرویس را رد کرد؛ مجوز «تبدیل نقطه به آدرس» و محدودیت IP کلید را بررسی کنید.'
        elif error.code==429: message='محدودیت درخواست یا اعتبار سرویس نشان؛ کمی بعد دوباره تلاش کنید.'
        else: message='سرویس نشانی نشان موقتاً پاسخ نمی‌دهد؛ دوباره تلاش کنید.'
        raise ShopError(message,503) from None
    except URLError as error:
        message='اتصال امن به نشان برقرار نشد؛ گواهی‌های معتبر سیستم و اتصال اینترنت سرور را بررسی کنید.' if isinstance(error.reason,ssl.SSLCertVerificationError) else 'ارتباط سرور با نشان برقرار نشد؛ اتصال اینترنت سرور را بررسی کنید.'
        raise ShopError(message,503) from None
    except Exception: raise ShopError('نشانی معتبر از نشان دریافت نشد؛ نقطه حفظ شده است. دوباره تلاش کنید.',503) from None
