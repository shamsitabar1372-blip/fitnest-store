import json, uuid
from datetime import timedelta
from functools import wraps
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse, HttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError, PermissionDenied, ObjectDoesNotExist
from django.db import transaction, IntegrityError
from django.db.models import Sum, F
from django.utils import timezone
from django.conf import settings
from django.db.models.functions import TruncDate
from .models import *
from .services import ShopError, price, quote, checkout, set_cart_line, merge_guest, cancel_order, transition_order, audit
from .otp import digest, request_code, verify_code, budget
from .payments import begin_payment, configured_gateway

def endpoint(methods=('GET',), auth=False, permission=None):
    def decorate(fn):
        @wraps(fn)
        def wrapper(request,*args,**kwargs):
            try:
                if request.method not in methods: return JsonResponse({'message':'روش درخواست مجاز نیست.'},status=405)
                if auth and not request.user.is_authenticated: raise ShopError('ابتدا وارد حساب شوید.',401)
                if auth and not request.user.mobile: raise ShopError('برای استفاده از حساب فروشگاه ابتدا شمارهٔ موبایل را تأیید کنید.',403)
                if permission and (not request.user.is_staff or not request.user.has_perm(permission)): raise ShopError('دسترسی مجاز نیست.',403)
                request.data={}
                if request.method not in ('GET','HEAD'):
                    if request.content_type!='application/json': raise ShopError('درخواست باید JSON باشد.',415)
                    if len(request.body)>32768: raise ShopError('حجم درخواست بیش از حد است.',413)
                    request.data=json.loads(request.body or b'{}')
                    if not isinstance(request.data,dict): raise ShopError('ساختار درخواست معتبر نیست.')
                    budget('api:'+str(request.user.pk if request.user.is_authenticated else request.client_ip),60,120)
                return JsonResponse(fn(request,*args,**kwargs),safe=True,json_dumps_params={'ensure_ascii':False})
            except ShopError as e: return JsonResponse({'ok':False,'message':e.message},status=e.status)
            except ObjectDoesNotExist: return JsonResponse({'message':'مورد درخواستی یافت نشد.'},status=404)
            except (ValidationError,ValueError,TypeError,InvalidOperation,IntegrityError): return JsonResponse({'message':'دادهٔ واردشده معتبر نیست؛ اطلاعات و گزینه‌ها را بررسی کنید.'},status=400)
        return wrapper
    return decorate

def user_data(user): return {'id':user.pk.hex,'mobile':user.mobile,'name':user.display_name}
def integer(data,key,default=None):
    value=data.get(key,default)
    if not isinstance(value,int) or isinstance(value,bool): raise ShopError('عدد صحیح معتبر وارد کنید: '+key)
    return value

def current_cart(request):
    if request.user.is_authenticated: return Cart.objects.get_or_create(customer=request.user)[0]
    if not request.session.session_key: request.session.create()
    token=request.session.get('guest_cart')
    if not token:
        token=__import__('secrets').token_urlsafe(32);request.session['guest_cart']=token
        request.session.set_expiry(30*86400)
    return Cart.objects.get_or_create(guest_digest=digest(token))[0]

def address_data(a):
    return {'id':str(a.pk),'province':a.province,'city':a.city,'street':a.street,'plate':a.plate,'unit':a.unit,'postal':a.postal,'selected':a.selected,'coordinates':{'lat':float(a.latitude),'lng':float(a.longitude)} if a.latitude is not None and a.longitude is not None else None}

def product_data(p):
    root=p.category;seen=set()
    while root.parent_id and root.pk not in seen:
        seen.add(root.pk);root=root.parent
    return {'id':p.pk,'title':p.title,'name':p.name,'slug':p.slug,'category':p.category.slug,'parentCategory':root.slug,'gender':p.gender,'description':p.description,'attributes':p.attributes,'active':p.active,'isDemo':p.is_demo,'images':[{'path':i.url,'alt':i.alt} for i in p.images.all()],'variants':[{'id':v.pk,'sku':v.sku,'color':v.color,'size':v.size,'price':price(v),'regularPrice':v.price,'stock':v.stock,'active':v.active} for v in p.variants.all() if v.active]}

def cart_data(cart):
    lines=[];subtotal=0
    pending=Order.objects.filter(customer_id=cart.customer_id,status='pending',expires_at__gt=timezone.now()).first() if cart.customer_id else None
    held={l.variant_id:l.quantity for l in pending.lines.all()} if pending else {}
    locked_prices={l.variant_id:l.unit_price for l in pending.lines.all()} if pending else {}
    for l in cart.lines.select_related('variant__product').order_by('pk'):
        v=l.variant;image=v.product.images.first();amount=locked_prices.get(v.pk,price(v));subtotal+=amount*l.quantity
        lines.append({'id':l.pk,'variantId':v.pk,'productId':v.product_id,'title':v.product.title,'category':v.product.category.parent.slug if v.product.category.parent else v.product.category.slug,'gender':v.product.gender,'size':v.size,'color':v.color,'quantity':l.quantity,'unitPrice':amount,'available':v.active and v.product.active and v.stock+held.get(v.pk,0)>=l.quantity,'image':image.url if image else ''})
    return {'id':str(cart.pk),'items':lines,'subtotal':subtotal,'currency':'IRR','pendingOrder':{'id':str(pending.pk),'code':pending.code,'expiresAt':pending.expires_at.isoformat()} if pending else None}

def order_data(o, invoice=False):
    data={'id':str(o.pk),'code':o.code,'status':o.status,'statusLabel':o.get_status_display(),'createdAt':o.created_at.isoformat(),'paidAt':o.paid_at.isoformat() if o.paid_at else None,'items':[{'productId':l.variant.product_id,'title':l.title,'quantity':l.quantity,'image':l.image,'options':l.options,**({'unitPrice':l.unit_price} if invoice else {})} for l in o.lines.select_related('variant')]}
    if invoice: data.update({key:getattr(o,key) for key in ['subtotal','discount','shipping_fee','tax','total','currency','address']});data['shipping']=o.shipping.name
    return data

@ensure_csrf_cookie
def storefront(request):
    html=(settings.ROOT/'index.html').read_text(encoding='utf-8')
    html=html.replace('<html lang="fa" dir="rtl">','<html lang="fa" dir="rtl" data-store-api="true">')
    html=html.replace('</head>','<link rel="stylesheet" href="/assets/store-api.css"></head>')
    html=html.replace('</body>','<script defer src="/assets/store-api.js"></script></body>')
    return HttpResponse(html,content_type='text/html; charset=utf-8')

@ensure_csrf_cookie
@endpoint()
def session(request):
    customer=request.user.is_authenticated and bool(request.user.mobile)
    return {'authenticated':customer,'user':user_data(request.user) if customer else None,'smsConfigured':settings.SMS_ENABLED,'storeApi':True,'paymentEnabled':False}

@endpoint(('POST',))
def auth_request(request):
    token=request_code(request.data.get('mobile'),request.client_ip)
    request.session['otp_token']=token
    return {'ok':True,'expiresIn':180,'retryAfter':60}

@endpoint(('POST',))
def auth_verify(request):
    user=verify_code(request.session.get('otp_token',''),request.data.get('code',''),request.client_ip)
    guest_token=request.session.get('guest_cart');guest=Cart.objects.filter(guest_digest=digest(guest_token)).first() if guest_token else None
    login(request,user,backend='django.contrib.auth.backends.ModelBackend')
    request.session.set_expiry(settings.SESSION_COOKIE_AGE)
    request.session.pop('otp_token',None);request.session.pop('guest_cart',None)
    merge_guest(guest,user)
    return {'ok':True,'user':user_data(user)}

@endpoint(('POST',))
def auth_logout(request): logout(request);return {'ok':True}

@endpoint()
def catalog(request):
    products=Product.objects.filter(active=True).select_related('category__parent').prefetch_related('images','variants').order_by('id')
    if request.GET.get('gender') in ['men','women']: products=products.filter(gender=request.GET['gender'])
    if request.GET.get('category'): products=products.filter(Q(category__slug=request.GET['category'])|Q(category__parent__slug=request.GET['category']))
    if request.GET.get('q'): products=products.filter(Q(title__icontains=request.GET['q'][:120])|Q(name__icontains=request.GET['q'][:120]))
    offset=max(0,min(100000,int(request.GET.get('offset',0))))
    return {'products':[product_data(p) for p in products[offset:offset+100]],'total':products.count(),'offset':offset,'limit':100,'categories':list(Category.objects.values('id','name','slug','parent_id'))}

@endpoint(('GET','POST','DELETE'))
def cart(request):
    c=current_cart(request)
    if request.method=='POST': set_cart_line(c,integer(request.data,'variantId'),integer(request.data,'quantity'))
    if request.method=='DELETE':
        with transaction.atomic():
            Cart.objects.select_for_update().get(pk=c.pk)
            if c.customer_id and Order.objects.filter(customer_id=c.customer_id,status='pending',expires_at__gt=timezone.now()).exists(): raise ShopError('ابتدا سفارش در انتظار پرداخت را لغو کنید.',409)
            c.lines.all().delete()
    return cart_data(c)

@endpoint(('GET','PATCH'),auth=True)
def profile(request):
    if request.method=='PATCH':
        name=request.data.get('name','')
        if not isinstance(name,str) or len(name)>100: raise ShopError('نام معتبر وارد کنید.')
        request.user.display_name=name.strip();request.user.save(update_fields=['display_name'])
    return {'user':user_data(request.user)}

@endpoint(('GET','POST','PATCH','DELETE'),auth=True)
def addresses(request,pk=None):
    if request.method!='GET':
        with transaction.atomic():
            Customer.objects.select_for_update().get(pk=request.user.pk)
            a=Address.objects.get(pk=pk,customer=request.user) if pk else Address(customer=request.user)
            if request.method=='DELETE': a.delete()
            elif request.data.get('select') is True:
                if not a.pk: raise ShopError('نشانی یافت نشد.')
                Address.objects.filter(customer=request.user,selected=True).update(selected=False)
                a.selected=True;a.save(update_fields=['selected'])
            else:
                if not pk and Address.objects.filter(customer=request.user).count()>=30: raise ShopError('حداکثر ۳۰ نشانی مجاز است.')
                for key in ['province','city','street','plate','unit','postal']:
                    if key in request.data: setattr(a,key,request.data[key])
                coords=request.data.get('coordinates')
                if coords is not None:
                    if not isinstance(coords,dict) or set(coords)!={'lat','lng'}: raise ShopError('مختصات معتبر نیست.')
                    a.latitude=Decimal(str(coords['lat']));a.longitude=Decimal(str(coords['lng']))
                if not Address.objects.filter(customer=request.user).exists(): a.selected=True
                a.full_clean();a.save()
    return {'addresses':[address_data(a) for a in Address.objects.filter(customer=request.user).order_by('pk')]}

@endpoint()
def shipping(request): return {'methods':list(ShippingMethod.objects.filter(active=True).values('id','name','fee','quote_required')),'currency':'IRR','paymentEnabled':False}

def checkout_inputs(request):
    a=Address.objects.get(pk=request.data.get('addressId'),customer=request.user)
    s=ShippingMethod.objects.get(pk=request.data.get('shippingId'),active=True)
    code=request.data.get('coupon','')
    if not isinstance(code,str) or len(code)>40: raise ShopError('کد تخفیف معتبر نیست.')
    return a,s,code.strip()

@endpoint(('POST',),auth=True)
def checkout_quote(request):
    a,s,code=checkout_inputs(request)
    return {'quote':quote(current_cart(request),s,request.user,code),'address':address_data(a),'paymentEnabled':False}

@endpoint(('POST',),auth=True)
def create_order(request):
    a,s,code=checkout_inputs(request)
    key=uuid.UUID(request.data.get('idempotencyKey',''))
    o=checkout(current_cart(request),request.user,a,s,key,code)
    return {'order':order_data(o,True),'paymentEnabled':False}

@endpoint(auth=True)
def orders(request,pk=None):
    qs=Order.objects.filter(customer=request.user).select_related('shipping').prefetch_related('lines__variant')
    if pk: return {'order':order_data(qs.get(pk=pk),True)}
    return {'orders':[order_data(o) for o in qs[:100]]}

@endpoint(('POST',),auth=True)
def cancel(request,pk): return {'order':order_data(cancel_order(Order.objects.get(pk=pk,customer=request.user),request.user),True)}

@endpoint(('POST',),auth=True)
def returns(request,pk):
    o=Order.objects.get(pk=pk,customer=request.user,status='delivered')
    config=StoreSettings.objects.first()
    if not config or not o.delivered_at or timezone.now()>o.delivered_at+timedelta(days=config.returns_days):
        raise ShopError('مهلت درخواست مرجوعی تمام شده یا زمان تحویل ثبت نشده است؛ با پشتیبانی تماس بگیرید.',409)
    reason=request.data.get('reason','')
    if not isinstance(reason,str) or not 10<=len(reason.strip())<=1000: raise ShopError('دلیل مرجوعی را بین ۱۰ تا ۱۰۰۰ نویسه وارد کنید.')
    r,_=ReturnRequest.objects.get_or_create(order=o,defaults={'reason':reason.strip()})
    return {'id':r.pk,'state':r.state,'message':'درخواست ثبت شد؛ به‌معنی بازپرداخت یا پذیرش مرجوعی نیست.'}

@endpoint(('POST',),auth=True)
def payment_start(request,pk):
    o=Order.objects.get(pk=pk,customer=request.user)
    return {'redirect':begin_payment(o,request.build_absolute_uri('/api/payments/callback'))}

@endpoint()
def payment_callback(request): return configured_gateway()

@endpoint(('GET','POST'),auth=True)
def reviews(request):
    if request.method=='POST':
        product=Product.objects.get(pk=integer(request.data,'productId'))
        if not OrderLine.objects.filter(order__customer=request.user,order__status='delivered',variant__product=product).exists(): raise ShopError('دیدگاه فقط برای کالای تحویل‌شده قابل ثبت است.',403)
        rating=integer(request.data,'rating');comment=request.data.get('comment','')
        if not 1<=rating<=5 or not isinstance(comment,str) or not 1<=len(comment.strip())<=2000: raise ShopError('امتیاز یا دیدگاه معتبر نیست.')
        Review.objects.update_or_create(customer=request.user,product=product,defaults={'rating':rating,'comment':comment.strip(),'approved':False})
    return {'reviews':list(Review.objects.filter(customer=request.user).values('id','product_id','rating','comment','approved'))}

@login_required(login_url='/admin/login/')
def operations(request):
    if not request.user.is_staff: raise PermissionDenied
    return render(request,'shop/operations.html')

@endpoint(permission='shop.view_order')
def dashboard(request):
    paid=Order.objects.filter(status__in=['paid','processing','shipped','delivered'])
    low=Variant.objects.filter(active=True,stock__lte=F('low_stock'))
    return {'paidTotal':paid.aggregate(value=Sum('total'))['value'] or 0,'orders':Order.objects.count(),'customers':Customer.objects.filter(is_staff=False).count() if request.user.has_perm('shop.view_customer') else None,'lowStock':list(low.values('id','sku','stock')[:50]),'lowStockCount':low.count(),'recent':[order_data(o) for o in Order.objects.all()[:8]],'sales':list(paid.annotate(day=TruncDate('paid_at')).values('day').annotate(total=Sum('total')).order_by('-day')[:30]),'currency':'IRR'}

@endpoint(permission='shop.view_order')
def management_orders(request): return {'orders':[order_data(o,True) for o in Order.objects.select_related('shipping').all()[:100]]}

@endpoint(('POST',),permission='shop.change_order')
def management_transition(request,pk): return {'order':order_data(transition_order(Order.objects.get(pk=pk),request.user,request.data.get('status')),True)}

@endpoint(permission='shop.view_product')
def management_products(request): return {'products':[product_data(p) for p in Product.objects.select_related('category__parent').prefetch_related('images','variants').all()[:200]]}

@endpoint(permission='shop.view_customer')
def management_customers(request): return {'customers':list(Customer.objects.values('id','display_name','mobile','date_joined','is_active')[:100])}

@endpoint(('GET','PATCH'),permission='shop.view_storesettings')
def management_settings(request):
    row=StoreSettings.objects.first()
    if request.method=='PATCH':
        if not request.user.has_perm('shop.change_storesettings'): raise ShopError('اجازهٔ ویرایش تنظیمات ندارید.',403)
        if not row: row=StoreSettings()
        if 'name' in request.data: row.name=request.data['name']
        if 'taxBps' in request.data: row.tax_bps=integer(request.data,'taxBps')
        if 'orderingEnabled' in request.data:
            if not isinstance(request.data['orderingEnabled'],bool): raise ShopError('وضعیت معتبر نیست.')
            row.ordering_enabled=request.data['orderingEnabled']
        row.full_clean();row.save();audit(request.user,'settings.updated',row.pk)
    return {'settings':{'name':row.name,'currency':row.currency,'taxBps':row.tax_bps,'orderingEnabled':row.ordering_enabled} if row else {},'smsEnabled':settings.SMS_ENABLED,'paymentEnabled':False,'shipping':list(ShippingMethod.objects.values('id','name','fee','active','quote_required'))}

@endpoint(permission='shop.view_auditevent')
def management_events(request): return {'events':list(AuditEvent.objects.values('action','target','created_at')[:100])}

@endpoint(('POST',),permission='shop.change_variant')
def inventory_adjust(request,pk):
    delta=integer(request.data,'delta')
    if not -100000<=delta<=100000 or delta==0: raise ShopError('تغییر موجودی باید عدد صحیح غیرصفر در محدوده مجاز باشد.')
    with transaction.atomic():
        v=Variant.objects.select_for_update().get(pk=pk)
        if v.stock+delta<0: raise ShopError('موجودی نمی‌تواند منفی شود.',409)
        v.stock+=delta;v.save(update_fields=['stock']);audit(request.user,'inventory.adjusted:'+str(delta),v.sku)
    return {'id':v.pk,'stock':v.stock}

def api_error(request, exception=None): return JsonResponse({'message':'درخواست معتبر نیست یا اجازهٔ دسترسی ندارید.'},status=403)
def server_error(request): return JsonResponse({'message':'خطای داخلی؛ بعداً دوباره تلاش کنید.'},status=500)
