"""PostgreSQL-backed OTP budgets; no code or provider URL appears in logs/API."""
import hashlib, hmac, secrets, re, os, json
from datetime import timedelta
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import RateBucket, OTPChallenge, Customer
from .services import ShopError

def digest(value): return hmac.new(settings.SECRET_KEY.encode(),value.encode(),hashlib.sha256).hexdigest()
def mobile_number(value):
    if not isinstance(value,str) or len(value)>30: raise ShopError('شماره موبایل معتبر نیست.')
    value=value.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789')).replace(' ','').replace('-','')
    for prefix in ['+98','0098']:
        if value.startswith(prefix): value='0'+value[len(prefix):];break
    if value.startswith('98') and len(value)==12: value='0'+value[2:]
    if not re.fullmatch(r'09[0-9]{9}',value): raise ShopError('شماره موبایل معتبر نیست.')
    return value

@transaction.atomic
def budget(subject, period, maximum):
    slot=int(timezone.now().timestamp())//period
    key=digest(f'{subject}:{period}:{slot}')
    RateBucket.objects.get_or_create(key=key,defaults={'expires_at':timezone.now()+timedelta(seconds=period*2)})
    row=RateBucket.objects.select_for_update().get(key=key)
    if row.hits>=maximum: raise ShopError('تعداد درخواست زیاد است؛ کمی بعد تلاش کنید.',429)
    row.hits+=1;row.save(update_fields=['hits'])
    return key

def sender(mobile, code):
    key=os.getenv('KAVENEGAR_API_KEY','');template=os.getenv('KAVENEGAR_OTP_TEMPLATE','')
    if not settings.SMS_ENABLED or not key or not template: raise ShopError('ارسال پیامک هنوز فعال نشده است.',503)
    if not re.fullmatch(r'[A-Za-z0-9_-]+',key): raise ShopError('پیکربندی پیامک معتبر نیست.',503)
    try:
        request=Request('https://api.kavenegar.com/v1/'+key+'/verify/lookup.json',data=urlencode({'receptor':mobile,'token':code,'template':template,'type':'sms'}).encode(),headers={'Content-Type':'application/x-www-form-urlencoded'})
        with urlopen(request,timeout=10) as response: result=json.loads(response.read(65536))
        if result.get('return',{}).get('status')!=200: raise ValueError()
    except Exception: raise ShopError('ارسال پیامک انجام نشد؛ بعداً تلاش کنید.',503) from None

def request_code(mobile, ip):
    mobile=mobile_number(mobile)
    if not settings.SMS_ENABLED: raise ShopError('ارسال پیامک هنوز فعال نشده است.',503)
    daily=None
    for subject,period,maximum in [(f'send:{mobile}',60,1),(f'send:{mobile}',900,3),(f'send:{mobile}',86400,10),(f'ip:{ip}',3600,10),(f'ip:{ip}',86400,30),('all-send',86400,200)]:
        key=budget(subject,period,maximum)
        if subject==f'send:{mobile}' and period==86400: daily=key
    code=f'{secrets.randbelow(10000):04d}';token=secrets.token_urlsafe(32)
    with transaction.atomic():
        # The daily bucket serializes concurrent requests for this phone.
        RateBucket.objects.select_for_update().get(key=daily)
        prior=OTPChallenge.objects.filter(mobile=mobile).first()
        if prior and prior.expires-timedelta(seconds=120)>timezone.now(): raise ShopError('برای ارسال مجدد ۶۰ ثانیه صبر کنید.',429)
        OTPChallenge.objects.update_or_create(mobile=mobile,defaults={'token_digest':digest(token),'code_digest':digest(token+':'+code),'expires':timezone.now()+timedelta(seconds=180),'attempts':0,'sent':False})
    try: sender(mobile,code)
    except Exception:
        OTPChallenge.objects.filter(token_digest=digest(token)).delete()
        raise ShopError('ارسال پیامک انجام نشد؛ بعداً تلاش کنید.',503) from None
    OTPChallenge.objects.filter(token_digest=digest(token)).update(sent=True)
    return token

def verify_code(token,code,ip):
    budget('verify:'+ip,900,40)
    code=str(code).translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789'))
    error=None;user=None
    with transaction.atomic():
        row=OTPChallenge.objects.select_for_update().filter(token_digest=digest(token),sent=True).first()
        if not row or row.expires<=timezone.now() or row.attempts>=5: error='کد منقضی شده یا تعداد تلاش‌ها تمام شده است.'
        elif not re.fullmatch(r'[0-9]{4}',code) or not hmac.compare_digest(row.code_digest,digest(token+':'+code)):
            row.attempts+=1;row.save(update_fields=['attempts']);error='کد واردشده صحیح نیست.'
        else:
            user,created=Customer.objects.get_or_create(mobile=row.mobile,defaults={'username':'mobile-'+row.mobile})
            if created: user.set_unusable_password();user.save(update_fields=['password'])
            if not user.is_active: error='ورود به این حساب مجاز نیست.'
            row.delete()
    if error: raise ShopError(error)
    return user
