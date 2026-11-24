"""Provider contract. No demo provider is registered in a running application."""
from dataclasses import dataclass
from typing import Protocol
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import Payment, Order, Cart
from .services import ShopError, audit

@dataclass(frozen=True)
class VerifiedPayment:
    authority: str
    reference: str
    amount: int
    currency: str

class Gateway(Protocol):
    def begin(self, *, order_code: str, amount: int, currency: str, callback_url: str) -> tuple[str,str]: ...
    def verify(self, *, authority: str, amount: int, currency: str) -> VerifiedPayment: ...

def configured_gateway():
    raise ShopError('درگاه پرداخت هنوز متصل و فعال نشده است؛ هیچ مبلغی دریافت نشد.',503)

@transaction.atomic
def begin_payment(order, callback_url):
    order=Order.objects.select_for_update().get(pk=order.pk)
    if not settings.PAYMENTS_ENABLED: return configured_gateway()
    if order.status!='pending' or order.expires_at<=timezone.now(): raise ShopError('سفارش قابل پرداخت نیست.',409)
    gateway=configured_gateway()
    authority,url=gateway.begin(order_code=order.code,amount=order.total,currency=order.currency,callback_url=callback_url)
    Payment.objects.create(order=order,provider=gateway.name,authority=authority,amount=order.total)
    return url

@transaction.atomic
def verify_payment(authority, gateway):
    # Lock order before payment consistently with all order transitions.
    p=Payment.objects.select_related('order').get(authority=authority)
    cart=Cart.objects.select_for_update().filter(customer_id=p.order.customer_id).first()
    order=Order.objects.select_for_update().get(pk=p.order_id)
    p=Payment.objects.select_for_update().get(pk=p.pk)
    if p.verified: return order
    if order.status!='pending' or order.expires_at<=timezone.now(): raise ShopError('سفارش منقضی یا بسته شده؛ نیازمند بررسی مالی است.',409)
    result=gateway.verify(authority=p.authority,amount=p.amount,currency=order.currency)
    if result.authority!=p.authority or result.amount!=p.amount or p.amount!=order.total or result.currency!=order.currency or not result.reference: raise ShopError('تأیید مبلغ پرداخت معتبر نیست.',409)
    p.verified=True;p.reference=result.reference;p.save(update_fields=['verified','reference'])
    order.status='paid';order.paid_at=timezone.now();order.save(update_fields=['status','paid_at'])
    if cart:
        for line in order.lines.all():
            current=cart.lines.filter(variant_id=line.variant_id).first()
            if current:
                if current.quantity<=line.quantity: current.delete()
                else: current.quantity-=line.quantity;current.save(update_fields=['quantity'])
    audit(order.customer,'payment.verified',order.code)
    return order
