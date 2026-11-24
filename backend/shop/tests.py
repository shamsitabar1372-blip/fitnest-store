"""Deterministic integration tests. SMS and payments use isolated test doubles only."""
import uuid
from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase, Client, override_settings
from django.utils import timezone
from django.contrib.auth.models import Group
from django.core.management import call_command
from .models import *
from .services import *
from .otp import request_code, verify_code, digest
from .payments import VerifiedPayment, verify_payment

@override_settings(LOCAL=True,SECURE_SSL_REDIRECT=False)
class StoreTests(TestCase):
    def setUp(self):
        self.user=Customer.objects.create_user(username='buyer',mobile='09123456789')
        self.other=Customer.objects.create_user(username='other',mobile='09123456788')
        self.category=Category.objects.create(name='پوشاک',slug='clothing')
        self.product=Product.objects.create(title='TRAINING TEE',name='تی‌شرت',slug='tee',category=self.category,active=True)
        self.variant=Variant.objects.create(product=self.product,sku='TEE-M',price=1000000,stock=10,size='M',color='مشکی')
        self.address=Address.objects.create(customer=self.user,province='البرز',city='کرج',street='دانش آموز',plate='12',postal='1234567890')
        self.shipping=ShippingMethod.objects.create(name='روش ثابت آزمایشی',fee=100000,active=True,quote_required=False)
        StoreSettings.objects.create(tax_bps=900,ordering_enabled=True)
        self.cart=Cart.objects.create(customer=self.user)
        self.client.force_login(self.user)
    def post(self,path,data,client=None,method='post'):
        return getattr(client or self.client,method)('/api/'+path,data=data,content_type='application/json')
    def make_order(self,key=None):
        set_cart_line(self.cart,self.variant.pk,2)
        return checkout(self.cart,self.user,self.address,self.shipping,key or uuid.uuid4())
    def test_catalog_read_and_price_tampering(self):
        self.assertEqual(self.client.get('/api/products').json()['products'][0]['variants'][0]['price'],1000000)
        r=self.post('cart',{'variantId':self.variant.pk,'quantity':2,'unitPrice':1,'total':1})
        self.assertEqual(r.json()['subtotal'],2000000)
        r=self.post('orders/create',{'addressId':self.address.pk,'shippingId':self.shipping.pk,'idempotencyKey':str(uuid.uuid4()),'total':1})
        self.assertEqual(r.status_code,200);self.assertEqual(r.json()['order']['total'],2280000)
    def test_order_snapshot_stock_and_idempotency(self):
        key=uuid.uuid4();o=self.make_order(key);self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock,8);self.assertEqual(o.total,2280000)
        again=checkout(self.cart,self.user,self.address,self.shipping,key)
        self.assertEqual(o.pk,again.pk);self.assertEqual(Order.objects.count(),1)
        self.variant.price=9999999;self.variant.save()
        self.assertEqual(o.lines.first().unit_price,1000000)
    def test_not_enough_stock_rolls_back(self):
        with self.assertRaises(ShopError):set_cart_line(self.cart,self.variant.pk,11)
        self.assertEqual(self.cart.lines.count(),0)
    def test_stock_rechecked_at_checkout(self):
        set_cart_line(self.cart,self.variant.pk,2);self.variant.stock=1;self.variant.save()
        with self.assertRaises(ShopError):checkout(self.cart,self.user,self.address,self.shipping,uuid.uuid4())
        self.assertEqual(Order.objects.count(),0);self.assertEqual(self.cart.lines.count(),1)
    def test_cross_customer_address_and_invoice_blocked(self):
        c=Client();c.force_login(self.other)
        r=self.post('addresses/'+str(self.address.pk),{'city':'تغییر'},c,'patch');self.assertEqual(r.status_code,404)
        o=self.make_order();self.assertEqual(c.get('/api/orders/'+str(o.pk)).status_code,404)
    def test_guest_cart_separate_and_not_owned_by_client_id(self):
        a,b=Client(),Client()
        self.post('cart',{'variantId':self.variant.pk,'quantity':2,'customer':str(self.user.pk)},a)
        self.assertEqual(len(a.get('/api/cart').json()['items']),1);self.assertEqual(b.get('/api/cart').json()['items'],[])
    @override_settings(SMS_ENABLED=True)
    def test_guest_merge_only_after_verified_login_once(self):
        c=Client();self.post('cart',{'variantId':self.variant.pk,'quantity':2},c)
        codes=[]
        with patch('shop.otp.sender',side_effect=lambda mobile,code:codes.append(code)):
            self.assertEqual(self.post('auth/request',{'mobile':self.user.mobile},c).status_code,200)
            self.assertEqual(self.post('auth/verify',{'code':codes[0]},c).status_code,200)
            self.assertEqual(c.get('/api/cart').json()['items'][0]['quantity'],2)
            self.assertEqual(self.post('auth/verify',{'code':codes[0]},c).status_code,400)
            self.assertEqual(c.get('/api/cart').json()['items'][0]['quantity'],2)
    def test_auth_required_for_checkout(self):
        r=self.post('orders/create',{},Client());self.assertEqual(r.status_code,401)
    def test_cancel_restores_inventory_only_once(self):
        o=self.make_order();cancel_order(o,self.user);cancel_order(o,self.user);self.variant.refresh_from_db();self.assertEqual(self.variant.stock,10)
    def test_coupon_limits_schedule_and_tax(self):
        now=timezone.now();coupon=Coupon.objects.create(code='SAVE',percent=10,starts=now-timedelta(days=1),ends=now+timedelta(days=1),max_uses=1,per_customer=1)
        set_cart_line(self.cart,self.variant.pk,2)
        o=checkout(self.cart,self.user,self.address,self.shipping,uuid.uuid4(),'SAVE')
        self.assertEqual(o.discount,200000);self.assertEqual(o.tax,162000);self.assertEqual(o.total,2062000)
        Order.objects.filter(pk=o.pk).update(status='paid')
        set_cart_line(self.cart,self.variant.pk,1)
        with self.assertRaises(ShopError):checkout(self.cart,self.user,self.address,self.shipping,uuid.uuid4(),'SAVE')
    def test_scheduled_product_discount(self):
        now=timezone.now();v=self.variant;v.discount_price=800000;v.discount_start=now-timedelta(hours=1);v.discount_end=now+timedelta(hours=1);v.save()
        self.assertEqual(price(v),800000);self.assertEqual(price(v,now+timedelta(days=1)),1000000)
    def test_shipping_unknown_not_free_checkout(self):
        self.shipping.quote_required=True;self.shipping.save();set_cart_line(self.cart,self.variant.pk,1)
        with self.assertRaises(ShopError):quote(self.cart,self.shipping,self.user)
    def test_disabled_store_and_gateway_fail_closed(self):
        StoreSettings.objects.update(ordering_enabled=False);set_cart_line(self.cart,self.variant.pk,1)
        self.assertEqual(self.post('orders/create',{'addressId':self.address.pk,'shippingId':self.shipping.pk,'idempotencyKey':str(uuid.uuid4())}).status_code,503)
        self.assertEqual(self.client.get('/api/payments/callback?Status=OK&amount=1').status_code,503)
    def test_payment_disabled_and_callback_never_fake_success(self):
        o=self.make_order();self.assertEqual(self.post('orders/'+str(o.pk)+'/payment',{}).status_code,503);o.refresh_from_db();self.assertEqual(o.status,'pending')
    def test_verified_payment_amount_replay_and_state(self):
        o=self.make_order();p=Payment.objects.create(order=o,provider='test-double',authority='test-authority',amount=o.total)
        class Wrong:
            def verify(self,**kw): return VerifiedPayment('test-authority','test-reference',1,'IRR')
        with self.assertRaises(ShopError):verify_payment(p.authority,Wrong())
        p.refresh_from_db();self.assertFalse(p.verified)
        class Valid:
            calls=0
            def verify(self,**kw): self.calls+=1;return VerifiedPayment('test-authority','test-reference',o.total,'IRR')
        gateway=Valid();verify_payment(p.authority,gateway);verify_payment(p.authority,gateway)
        o.refresh_from_db();self.assertEqual(o.status,'paid');self.assertEqual(gateway.calls,1)
    def test_csrf_required_for_otp_cart_and_addresses(self):
        c=Client(enforce_csrf_checks=True)
        self.assertEqual(self.post('cart',{'variantId':self.variant.pk,'quantity':1},c).status_code,403)
        c.get('/api/auth/session');token=c.cookies['csrftoken'].value
        r=c.post('/api/cart',data={'variantId':self.variant.pk,'quantity':1},content_type='application/json',HTTP_X_CSRFTOKEN=token);self.assertEqual(r.status_code,200)
        r=c.post('/api/cart',data={},content_type='application/json',HTTP_X_CSRFTOKEN=token,HTTP_ORIGIN='https://evil.invalid');self.assertEqual(r.status_code,403)
    def test_roles_and_management_api_access(self):
        call_command('setup_roles',verbosity=0)
        self.assertEqual(self.client.get('/api/manage/dashboard').status_code,403)
        self.user.is_staff=True;self.user.save();self.user.groups.add(Group.objects.get(name='کارمند فروشگاه'))
        self.assertEqual(self.client.get('/api/manage/dashboard').status_code,200)
        self.assertEqual(self.client.get('/api/manage/customers').status_code,403)
        self.assertEqual(self.post('manage/settings',{'orderingEnabled':True},method='patch').status_code,403)
        self.assertEqual(self.client.get('/ops/').status_code,200)
    def test_employee_cannot_mark_order_paid(self):
        call_command('setup_roles',verbosity=0);self.user.is_staff=True;self.user.save();self.user.groups.add(Group.objects.get(name='کارمند فروشگاه'))
        o=self.make_order();self.assertEqual(self.post('manage/orders/'+str(o.pk)+'/transition',{'status':'paid'}).status_code,409)
    def test_inventory_adjustment_permission_and_nonnegative(self):
        self.assertEqual(self.post('manage/inventory/'+str(self.variant.pk)+'/adjust',{'delta':1}).status_code,403)
        call_command('setup_roles',verbosity=0);self.user.is_staff=True;self.user.save();self.user.groups.add(Group.objects.get(name='مدیر فروشگاه'))
        self.assertEqual(self.post('manage/inventory/'+str(self.variant.pk)+'/adjust',{'delta':-11}).status_code,409)
        self.assertEqual(self.post('manage/inventory/'+str(self.variant.pk)+'/adjust',{'delta':2}).json()['stock'],12)
    def test_reviews_require_delivered_purchase(self):
        self.assertEqual(self.post('reviews',{'productId':self.product.pk,'rating':5,'comment':'خوب'}).status_code,403)
    def test_profile_cannot_change_verified_mobile(self):
        self.post('profile',{'name':'خریدار','mobile':self.other.mobile},method='patch');self.user.refresh_from_db();self.assertEqual(self.user.mobile,'09123456789')
    def test_address_validation_and_selection(self):
        self.assertEqual(self.post('addresses',{'postal':'not-a-postcode'}).status_code,400)
        data={'province':'تهران','city':'تهران','street':'خیابان آزمون','plate':'1','postal':'1234567890','coordinates':{'lat':35.7,'lng':51.4}}
        self.assertEqual(self.post('addresses',data).status_code,200)
        a=Address.objects.filter(customer=self.user).last();self.post('addresses/'+str(a.pk),{'select':True},method='patch')
        self.assertEqual(Address.objects.filter(customer=self.user,selected=True).count(),1)
    def test_response_no_secrets_and_static_whitelist(self):
        self.assertNotIn('code',self.client.get('/api/auth/session').json())
        self.assertEqual(self.client.get('/.private/django-secret').status_code,404)
        self.assertEqual(self.client.get('/backend/config/settings.py').status_code,404)
    def test_storefront_and_public_asset_prefix(self):
        import re
        response=self.client.get('/')
        self.assertIn(b'data-store-api="true"',response.content)
        assets=re.findall(r'(?:src|href)="((?:/?assets/)[^"]+)"',response.content.decode())
        self.assertGreater(len(assets),5)
        for asset in assets:
            self.assertEqual(self.client.get('/'+asset.lstrip('/')).status_code,200,asset)
        self.assertEqual(self.client.get('/assets/../.private/django-secret').status_code,404)
    def test_unpaid_cart_survives_and_is_not_reserved_twice(self):
        order=self.make_order()
        self.assertEqual(self.client.get('/api/cart').json()['items'][0]['quantity'],2)
        self.assertEqual(self.client.get('/api/cart').json()['pendingOrder']['code'],order.code)
        with self.assertRaises(ShopError): checkout(self.cart,self.user,self.address,self.shipping,uuid.uuid4())
        self.assertEqual(self.post('cart',{'variantId':self.variant.pk,'quantity':3}).status_code,409)
        cancel_order(order,self.user);set_cart_line(self.cart,self.variant.pk,3)
        self.assertEqual(self.cart.lines.get().quantity,3)
    def test_inactive_product_can_be_removed(self):
        set_cart_line(self.cart,self.variant.pk,1);self.variant.active=False;self.variant.save()
        self.assertEqual(self.post('cart',{'variantId':self.variant.pk,'quantity':0}).status_code,200)
        self.assertEqual(self.cart.lines.count(),0)
    def test_return_window_and_owner(self):
        order=self.make_order();Order.objects.filter(pk=order.pk).update(status='delivered',delivered_at=timezone.now())
        r=self.post('orders/'+str(order.pk)+'/return',{'reason':'اندازه مناسب انتخاب نشده است.'});self.assertEqual(r.status_code,200)
        Order.objects.filter(pk=order.pk).update(delivered_at=timezone.now()-timedelta(days=30))
        self.assertEqual(self.post('orders/'+str(order.pk)+'/return',{'reason':'اندازه مناسب انتخاب نشده است.'}).status_code,409)
    @override_settings(TRUSTED_PROXY_CIDRS=['127.0.0.1/32'])
    def test_proxy_headers_only_trusted_from_explicit_peer(self):
        r=self.client.get('/api/auth/session',REMOTE_ADDR='127.0.0.1',HTTP_X_REAL_IP='bad-ip');self.assertEqual(r.status_code,400)
        r=self.client.get('/api/auth/session',REMOTE_ADDR='192.0.2.1',HTTP_X_REAL_IP='bad-ip');self.assertEqual(r.status_code,200)
    def test_management_product_forms_and_dashboard_render(self):
        manager=Customer.objects.create_superuser(username='local-test-manager',password='only-an-isolated-test-password')
        c=Client();c.force_login(manager)
        for path in ['/ops/','/admin/shop/product/','/admin/shop/product/'+str(self.product.pk)+'/change/','/admin/shop/variant/'+str(self.variant.pk)+'/change/','/admin/shop/storesettings/','/admin/shop/coupon/']:
            self.assertEqual(c.get(path).status_code,200,path)
        self.assertFalse(c.get('/api/auth/session').json()['authenticated'])
        self.assertEqual(c.get('/').status_code,200)
    def test_admin_price_edit_does_not_overwrite_concurrent_stock(self):
        from types import SimpleNamespace
        from django.contrib import admin
        from .admin import VariantAdmin
        stale=Variant.objects.get(pk=self.variant.pk)
        Variant.objects.filter(pk=self.variant.pk).update(stock=4)
        stale.price=1200000
        VariantAdmin(Variant,admin.site).save_model(SimpleNamespace(user=self.user),stale,SimpleNamespace(changed_data=['price']),True)
        self.variant.refresh_from_db();self.assertEqual(self.variant.stock,4);self.assertEqual(self.variant.price,1200000)

@override_settings(SMS_ENABLED=True,LOCAL=True)
class OTPTests(TestCase):
    def send(self):
        codes=[]
        with patch('shop.otp.sender',side_effect=lambda mobile,code:codes.append(code)):
            token=request_code('۰۹۱۲۳۴۵۶۷۸۹','test-ip')
        return token,codes[0]
    def test_wrong_attempts_persist_and_code_not_stored_plain(self):
        token,code=self.send();row=OTPChallenge.objects.get();self.assertNotEqual(row.code_digest,code)
        for _ in range(5):
            with self.assertRaises(ShopError):verify_code(token,'xxxx','test-ip')
        with self.assertRaises(ShopError):verify_code(token,code,'test-ip')
        row.refresh_from_db();self.assertEqual(row.attempts,5)
    def test_expiry_and_single_use(self):
        token,code=self.send();OTPChallenge.objects.update(expires=timezone.now()-timedelta(seconds=1))
        with self.assertRaises(ShopError):verify_code(token,code,'test-ip')
    def test_cooldown_and_provider_failure(self):
        token,code=self.send()
        with self.assertRaises(ShopError):request_code('09123456789','test-ip')
        with patch('shop.otp.sender',side_effect=RuntimeError('private provider URL')):
            with self.assertRaises(ShopError) as e:request_code('09123456788','other-ip')
        self.assertNotIn('private',e.exception.message);self.assertFalse(OTPChallenge.objects.filter(mobile='09123456788').exists())
    @override_settings(SMS_ENABLED=False)
    def test_unconfigured_sms_has_no_bypass(self):
        with self.assertRaises(ShopError):request_code('09123456789','test-ip')
