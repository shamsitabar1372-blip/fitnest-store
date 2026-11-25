"""Deterministic integration tests. SMS and payments use isolated test doubles only."""
import uuid
from decimal import Decimal
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
        self.assertEqual(self.post('manage/inventory/'+str(self.variant.pk)+'/adjust',{'delta':-12,'expectedStock':10}).status_code,409)
        self.assertEqual(self.post('manage/inventory/'+str(self.variant.pk)+'/adjust',{'delta':-12,'expectedStock':12}).json()['stock'],0)
        self.assertEqual(self.client.get('/api/products').json()['products'][0]['variants'][0]['stock'],0)
        self.assertEqual(self.post('cart',{'variantId':self.variant.pk,'quantity':1}).status_code,409)

    def test_management_catalog_pagination_includes_new_products_after_first_page(self):
        manager=Customer.objects.create_superuser(username='pagination-manager',password='isolated-test-password')
        self.client.force_login(manager)
        Product.objects.bulk_create([Product(title='EXTRA '+str(i),name='نمونه',slug='extra-'+str(i),category=self.category) for i in range(201)])
        first=self.client.get('/api/manage/products').json()
        last=self.client.get('/api/manage/products?offset=200').json()
        self.assertEqual(first['total'],202)
        self.assertEqual(len(first['products']),200)
        self.assertEqual(len(last['products']),2)
        self.assertFalse({p['id'] for p in first['products']}&{p['id'] for p in last['products']})
    def test_reviews_require_delivered_purchase(self):
        self.assertEqual(self.post('reviews',{'productId':self.product.pk,'rating':5,'comment':'خوب'}).status_code,403)
    def test_profile_cannot_change_verified_mobile(self):
        self.post('profile',{'name':'خریدار','mobile':self.other.mobile},method='patch');self.user.refresh_from_db();self.assertEqual(self.user.mobile,'09123456789')
    def test_map_address_with_full_precision_coordinates_and_persian_postal(self):
        data={'province':'تهران','city':'تهران','street':'تهران، پل دائج','plate':'12','unit':'4','postal':'۱۲۳۴۵۶۷۸۹۰','coordinates':{'lat':35.83152173826491,'lng':50.95871298471563}}
        response=self.post('addresses',data)
        self.assertEqual(response.status_code,200,response.content)
        address=Address.objects.filter(customer=self.user).last()
        self.assertEqual(address.postal,'1234567890')
        self.assertEqual(address.latitude,Decimal('35.831522'))
        self.assertEqual(address.longitude,Decimal('50.958713'))
        saved=self.client.get('/api/addresses').json()['addresses']
        self.assertTrue(any(str(item['id'])==str(address.pk) and item['street']==data['street'] for item in saved))

    def test_address_invalid_coordinate_and_postal_are_rejected_with_clear_errors(self):
        data={'province':'تهران','city':'تهران','street':'خیابان آزمایشی','plate':'12','postal':'1234567890'}
        for coords in [{'lat':41.0000001,'lng':51},{'lat':'NaN','lng':51},{'lat':True,'lng':51}]:
            response=self.post('addresses',{**data,'coordinates':coords})
            self.assertEqual(response.status_code,400)
            self.assertIn('مختصات',response.json()['message'])
        response=self.post('addresses',{**data,'postal':'۱۲۳'})
        self.assertEqual(response.status_code,400)
        self.assertIn('۱۰ رقم',response.json()['message'])

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

@override_settings(LOCAL=True,SECURE_SSL_REDIRECT=False)
class LocalCustomerPreviewTests(TestCase):
    def setUp(self):
        self.admin=Customer.objects.create_superuser(username='preview-test-admin',password='test-only-local-password')
        self.client.force_login(self.admin)
    def start(self,**headers):
        return self.client.post('/api/auth/local-test',data={},content_type='application/json',HTTP_HOST='127.0.0.1',**headers)
    def test_direct_launcher_requires_local_admin(self):
        self.assertContains(self.client.get('/local-test/',HTTP_HOST='127.0.0.1'),'local-test-form')
        self.client.logout();self.assertEqual(self.client.get('/local-test/',HTTP_HOST='127.0.0.1').status_code,302)
        with override_settings(LOCAL=False):self.assertEqual(self.client.get('/local-test/',HTTP_HOST='127.0.0.1').status_code,404)
    def test_admin_loopback_preview_preserves_cart_without_sms_or_phone(self):
        category=Category.objects.create(name='تجهیزات',slug='gear')
        product=Product.objects.create(title='TEST GEAR',name='نمونه',slug='preview-gear',category=category,active=True)
        variant=Variant.objects.create(product=product,sku='PREVIEW',price=100000,stock=5)
        cart=Cart.objects.create(customer=self.admin);CartLine.objects.create(cart=cart,variant=variant,quantity=2)
        with patch('shop.otp.sender') as sms:
            result=self.start();self.assertEqual(result.status_code,200);sms.assert_not_called()
        user=result.json()['user'];self.assertTrue(user['isTest']);self.assertIsNone(user['mobile'])
        customer=Customer.objects.get(username='local-test-customer');self.assertFalse(customer.is_staff);self.assertFalse(customer.has_usable_password())
        session=self.client.get('/api/auth/session',HTTP_HOST='127.0.0.1').json();self.assertTrue(session['authenticated']);self.assertTrue(session['user']['isTest'])
        self.assertEqual(self.client.get('/api/cart',HTTP_HOST='127.0.0.1').json()['items'][0]['quantity'],2)
        self.assertEqual(self.client.get('/api/profile',HTTP_HOST='127.0.0.1').status_code,200)
        self.assertEqual(self.client.get('/api/manage/dashboard',HTTP_HOST='127.0.0.1').status_code,403)
    @override_settings(LOCAL=False)
    def test_preview_disabled_in_production_even_for_admin(self):
        self.assertEqual(self.start().status_code,404)
        self.assertFalse(Customer.objects.filter(username='local-test-customer').exists())
    def test_preview_denied_from_remote_peer_or_nonlocal_host(self):
        self.assertEqual(self.start(REMOTE_ADDR='192.0.2.1').status_code,404)
        self.assertFalse(self.client.get('/api/auth/session',HTTP_HOST='127.0.0.1',REMOTE_ADDR='192.0.2.1').json()['localTestLoginAvailable'])
    def test_preview_requires_admin_and_csrf(self):
        self.client.logout();self.assertEqual(self.start().status_code,403)
        c=Client(enforce_csrf_checks=True);c.force_login(self.admin)
        self.assertEqual(c.post('/api/auth/local-test',data={},content_type='application/json',HTTP_HOST='127.0.0.1').status_code,403)
    def test_preview_session_cannot_be_used_after_switching_to_production(self):
        self.assertEqual(self.start().status_code,200)
        with override_settings(LOCAL=False):
            self.assertFalse(self.client.get('/api/auth/session',HTTP_HOST='127.0.0.1').json()['authenticated'])
            self.assertEqual(self.client.get('/api/profile',HTTP_HOST='127.0.0.1').status_code,403)
    def test_test_order_can_never_start_real_payment(self):
        from .payments import begin_payment
        self.start();customer=Customer.objects.get(username='local-test-customer')
        shipping=ShippingMethod.objects.create(name='ارسال آزمایشی')
        order=Order.objects.create(customer=customer,shipping=shipping,code='TEST-ONLY',idempotency_key=uuid.uuid4(),address={},subtotal=100000,shipping_fee=0,tax=0,total=100000,expires_at=timezone.now()+timedelta(minutes=20))
        with override_settings(PAYMENTS_ENABLED=True),patch('shop.payments.configured_gateway') as gateway:
            with self.assertRaises(ShopError): begin_payment(order,'http://127.0.0.1/callback')
            gateway.assert_not_called()

@override_settings(LOCAL=True,SECURE_SSL_REDIRECT=False)
class MapReverseTests(TestCase):
    def setUp(self):
        self.user=Customer.objects.create_user(username='map-test',mobile='09123456789');self.client.force_login(self.user)
    def test_disabled_service_never_calls_provider(self):
        with patch.dict('os.environ',{'NESHAN_SERVICES_ENABLED':'0'}),patch('pathlib.Path.read_text',side_effect=FileNotFoundError),patch('shop.maps.urlopen') as provider:
            response=self.client.post('/api/maps/reverse',{'lat':35.8,'lng':50.9},content_type='application/json')
            self.assertEqual(response.status_code,503);provider.assert_not_called()
    def test_private_key_stays_server_side_and_address_is_filtered(self):
        import json
        with patch.dict('os.environ',{'NESHAN_SERVICES_ENABLED':'1','NESHAN_SERVICE_API_KEY':'service.test-only-not-real'}),patch('shop.maps.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value=json.dumps({'status':'OK','state':'البرز','city':'کرج','formatted_address':'خیابان آزمایشی','private_extra':'hidden'}).encode()
            response=self.client.post('/api/maps/reverse',{'lat':35.8,'lng':50.9},content_type='application/json')
            self.assertEqual(response.status_code,200);self.assertEqual(response.json()['address']['street'],'خیابان آزمایشی')
            self.assertNotIn('service.test-only-not-real',response.content.decode());self.assertNotIn('private_extra',response.content.decode())
            provider.assert_called_once()
    def test_invalid_coordinate_and_anonymous_request_are_rejected(self):
        with patch('shop.maps.urlopen') as provider:
            response=self.client.post('/api/maps/reverse',{'lat':0,'lng':0},content_type='application/json');self.assertEqual(response.status_code,400);provider.assert_not_called()
        self.client.logout();self.assertEqual(self.client.post('/api/maps/reverse',{},content_type='application/json').status_code,401)

    def test_tls_keeps_certificate_and_hostname_verification(self):
        import ssl
        from .maps import tls_context
        context=tls_context()
        self.assertEqual(context.verify_mode,ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)

    def test_provider_errors_are_specific_without_exposing_key(self):
        from urllib.error import HTTPError,URLError
        import ssl
        failures=[(HTTPError('https://api.neshan.org',403,'denied',{},None),'مجوز'),(URLError(ssl.SSLCertVerificationError('test')),'گواهی')]
        with patch.dict('os.environ',{'NESHAN_SERVICES_ENABLED':'1','NESHAN_SERVICE_API_KEY':'service.unit-test-only'}):
            for failure,message in failures:
                with patch('shop.maps.urlopen',side_effect=failure):
                    response=self.client.post('/api/maps/reverse',{'lat':35.8,'lng':50.9},content_type='application/json')
                    self.assertEqual(response.status_code,503)
                    self.assertIn(message,response.json()['message'])
                    self.assertNotIn('service.unit-test-only',response.content.decode())

@override_settings(LOCAL=True,SECURE_SSL_REDIRECT=False)
class LocalMapSetupTests(TestCase):
    def setUp(self): self.client.defaults['HTTP_HOST']='127.0.0.1'
    def test_admin_can_store_key_without_echo_and_provider_reads_it(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from . import maps
        admin=Customer.objects.create_superuser(username='map-admin',password='test-only-password')
        self.client.force_login(admin)
        with TemporaryDirectory() as directory,override_settings(ROOT=Path(directory)),patch.dict('os.environ',{'NESHAN_SERVICES_ENABLED':'0'}):
            response=self.client.post('/local-map-setup/',{'service_key':'service.unit-test-only'})
            self.assertEqual(response.status_code,200)
            self.assertNotContains(response,'service.unit-test-only')
            self.assertTrue(maps.ready())
            self.assertEqual(maps.service_key(),'service.unit-test-only')
            with override_settings(LOCAL=False): self.assertFalse(maps.ready())
    def test_guest_customer_remote_and_csrf_cannot_save(self):
        with patch('shop.maps.save_local_key') as save:
            self.assertEqual(self.client.post('/local-map-setup/',{'service_key':'service.test'}).status_code,302)
            customer=Customer.objects.create_user(username='not-admin',mobile='09123456780')
            self.client.force_login(customer)
            self.assertEqual(self.client.post('/local-map-setup/',{'service_key':'service.test'}).status_code,302)
            admin=Customer.objects.create_superuser(username='map-admin',password='test-only-password')
            self.client.force_login(admin)
            self.assertEqual(self.client.post('/local-map-setup/',{},REMOTE_ADDR='203.0.113.9').status_code,404)
            strict=Client(enforce_csrf_checks=True,HTTP_HOST='127.0.0.1');strict.force_login(admin)
            self.assertEqual(strict.post('/local-map-setup/',{'service_key':'service.test'}).status_code,403)
            save.assert_not_called()
