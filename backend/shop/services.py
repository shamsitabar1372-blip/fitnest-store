"""All money and stock decisions live here, inside database transactions."""
from datetime import timedelta
import secrets, uuid
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from django.db.models import Sum
from .models import Cart, CartLine, Variant, Coupon, Order, OrderLine, AuditEvent, StoreSettings

class ShopError(Exception):
    def __init__(self, message, status=400): self.message, self.status = message, status

def price(variant, now=None):
    now = now or timezone.now()
    if variant.discount_price is not None and variant.discount_start and variant.discount_end and variant.discount_start <= now < variant.discount_end:
        return min(variant.price, variant.discount_price)
    return variant.price

def settings_row():
    row = StoreSettings.objects.first()
    if not row: raise ShopError('تنظیمات فروشگاه هنوز تکمیل نشده است.', 503)
    return row

def audit(actor, action, target=''):
    AuditEvent.objects.create(actor=actor if actor and actor.is_authenticated else None, action=action, target=str(target)[:100])

@transaction.atomic
def set_cart_line(cart, variant_id, quantity):
    cart = Cart.objects.select_for_update().get(pk=cart.pk)
    variant = Variant.objects.select_for_update().select_related('product').get(pk=variant_id)
    if not isinstance(quantity, int) or isinstance(quantity, bool) or not 0 <= quantity <= 99: raise ShopError('تعداد باید بین صفر و ۹۹ باشد.')
    if cart.customer_id and Order.objects.filter(customer_id=cart.customer_id,status='pending',expires_at__gt=timezone.now()).exists():
        raise ShopError('ابتدا سفارش در انتظار پرداخت را از تاریخچه لغو یا پرداخت کنید؛ سبد شما حفظ شده است.',409)
    if quantity and (not variant.active or not variant.product.active): raise ShopError('این محصول فعلاً قابل سفارش نیست.',409)
    if quantity > variant.stock: raise ShopError('موجودی این گزینه کافی نیست.',409)
    if quantity:
        if not cart.lines.filter(variant=variant).exists() and cart.lines.count() >= 50: raise ShopError('حداکثر ۵۰ نوع کالا در هر سبد مجاز است.')
        CartLine.objects.update_or_create(cart=cart,variant=variant,defaults={'quantity':quantity})
    else: cart.lines.filter(variant=variant).delete()
    cart.save(update_fields=['updated_at'])
    return cart

@transaction.atomic
def merge_guest(guest, user):
    member, _ = Cart.objects.get_or_create(customer=user)
    if not guest or guest.pk == member.pk: return member
    locked = {c.pk:c for c in Cart.objects.select_for_update().filter(pk__in=[guest.pk,member.pk]).order_by('id')}
    if guest.pk not in locked: return member  # already consumed by a parallel login
    for line in guest.lines.select_related('variant').order_by('variant_id'):
        current = member.lines.filter(variant=line.variant).first()
        quantity = min(99, line.variant.stock, line.quantity + (current.quantity if current else 0))
        if quantity and (current or member.lines.count()<50):
            CartLine.objects.update_or_create(cart=member,variant=line.variant,defaults={'quantity':quantity})
    guest.delete()
    return member

def _totals(cart, shipping, customer, code=''):
    config = settings_row()
    if not shipping.active or shipping.quote_required: raise ShopError('هزینهٔ ارسال هنوز تعیین نشده است.',409)
    lines = list(cart.lines.select_related('variant__product').order_by('variant_id'))
    if not lines: raise ShopError('سبد خرید خالی است.')
    variants = {v.pk:v for v in Variant.objects.select_for_update().select_related('product').filter(pk__in=[l.variant_id for l in lines]).order_by('pk')}
    subtotal = 0
    now=timezone.now()
    for line in lines:
        v = variants[line.variant_id]
        if not v.active or not v.product.active or v.stock < line.quantity: raise ShopError('موجودی یا وضعیت یکی از محصولات تغییر کرده است.',409)
        if v.product.is_demo and not __import__('django.conf',fromlist=['settings']).settings.LOCAL: raise ShopError('محصول نمونه قابل سفارش واقعی نیست.',409)
        v.checkout_price=price(v,now)
        subtotal += v.checkout_price*line.quantity
    discount=0; coupon=None
    if code:
        coupon = Coupon.objects.select_for_update().filter(code=code.upper(),active=True).first()
        if not coupon or not coupon.starts <= now < coupon.ends or subtotal < coupon.min_subtotal: raise ShopError('کد تخفیف معتبر یا قابل استفاده نیست.')
        used = Order.objects.filter(coupon=coupon).exclude(status__in=['cancelled','returned'])
        if used.count()>=coupon.max_uses or used.filter(customer=customer).count()>=coupon.per_customer: raise ShopError('سهمیهٔ این کد تخفیف تمام شده است.')
        categories=set(coupon.categories.values_list('id',flat=True))
        def allowed(product):
            category=product.category
            for _ in range(8):
                if category.pk in categories: return True
                if not category.parent_id: return False
                category=category.parent
            return False
        eligible=sum(variants[l.variant_id].checkout_price*l.quantity for l in lines if not categories or allowed(variants[l.variant_id].product))
        discount=eligible*coupon.percent//100
        if coupon.max_discount is not None: discount=min(discount,coupon.max_discount)
        if not discount: raise ShopError('این کد برای اقلام سبد قابل استفاده نیست.')
    tax=(subtotal-discount)*config.tax_bps//10000
    total=subtotal-discount+tax+shipping.fee
    if not 0 < total < 10**14: raise ShopError('مبلغ سفارش خارج از محدودهٔ مجاز است.')
    return {'subtotal':subtotal,'discount':discount,'shipping_fee':shipping.fee,'tax':tax,'total':total,'currency':'IRR'}, lines, variants, coupon

@transaction.atomic
def quote(cart, shipping, customer, code=''):
    Cart.objects.select_for_update().get(pk=cart.pk)
    return _totals(cart,shipping,customer,code)[0]

@transaction.atomic
def checkout(cart, customer, address, shipping, key, code=''):
    if customer.username=='local-test-customer' and not settings.LOCAL: raise ShopError('حساب آزمایشی در محیط اصلی قابل استفاده نیست.',403)
    if address.customer_id != customer.pk or cart.customer_id != customer.pk: raise ShopError('دسترسی به سبد یا نشانی مجاز نیست.',403)
    Cart.objects.select_for_update().get(pk=cart.pk)
    previous=Order.objects.filter(customer=customer,idempotency_key=key).first()
    if previous: return previous
    if Order.objects.filter(customer=customer,status='pending',expires_at__gt=timezone.now()).exists():
        raise ShopError('یک سفارش در انتظار پرداخت دارید؛ آن را از تاریخچه ادامه دهید یا لغو کنید.',409)
    if not settings_row().ordering_enabled: raise ShopError('پذیرش سفارش هنوز فعال نشده است.',503)
    totals, lines, variants, coupon = _totals(cart,shipping,customer,code)
    snapshot={k:getattr(address,k) for k in ['province','city','street','plate','unit','postal']}
    snapshot.update({'name':customer.display_name,'mobile':customer.mobile})
    order=Order.objects.create(code='FNP-'+timezone.localdate().strftime('%Y%m%d')+'-'+secrets.token_hex(6).upper(),customer=customer,address=snapshot,shipping=shipping,idempotency_key=key,coupon=coupon,expires_at=timezone.now()+timedelta(minutes=20),**totals)
    for line in lines:
        v=variants[line.variant_id];image=v.product.images.first()
        OrderLine.objects.create(order=order,variant=v,title=v.product.title,sku=v.sku,options={'gender':v.product.gender,'size':v.size,'color':v.color},image=image.url if image else '',unit_price=v.checkout_price,quantity=line.quantity)
        v.stock-=line.quantity;v.save(update_fields=['stock'])
    # Keep an abandoned unpaid basket. A verified payment clears its purchased lines.
    audit(customer,'order.created',order.code)
    return order

@transaction.atomic
def cancel_order(order, actor, expired=False):
    order=Order.objects.select_for_update().get(pk=order.pk)
    if not expired and actor.pk!=order.customer_id and not actor.has_perm('shop.change_order'): raise ShopError('دسترسی مجاز نیست.',403)
    if order.status=='cancelled': return order
    if order.status!='pending': raise ShopError('لغو خودکار فقط پیش از پرداخت امکان‌پذیر است.',409)
    if not order.stock_released:
        for line in order.lines.order_by('variant_id'):
            v=Variant.objects.select_for_update().get(pk=line.variant_id)
            v.stock+=line.quantity;v.save(update_fields=['stock'])
        order.stock_released=True
    order.status='cancelled';order.save(update_fields=['stock_released','status'])
    audit(actor,'order.expired' if expired else 'order.cancelled',order.code)
    return order

@transaction.atomic
def transition_order(order, actor, target):
    order=Order.objects.select_for_update().get(pk=order.pk)
    if not actor.has_perm('shop.change_order'): raise ShopError('اجازهٔ مدیریت سفارش ندارید.',403)
    allowed={'paid':'processing','processing':'shipped','shipped':'delivered'}
    if allowed.get(order.status)!=target: raise ShopError('تغییر وضعیت مجاز نیست؛ پرداخت دستی موفق اعلام نمی‌شود.',409)
    order.status=target
    fields=['status']
    if target=='delivered': order.delivered_at=timezone.now();fields.append('delivered_at')
    order.save(update_fields=fields);audit(actor,'order.'+target,order.code)
    return order
