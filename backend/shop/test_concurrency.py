"""Executed only on a real backend with SELECT FOR UPDATE support (PostgreSQL CI)."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
import uuid
from django.test import TransactionTestCase, skipUnlessDBFeature, override_settings
from django.db import close_old_connections
from django.utils import timezone
from .models import Customer,Category,Product,Variant,Address,Cart,CartLine,ShippingMethod,StoreSettings,Order
from .services import checkout,ShopError

@override_settings(LOCAL=True)
@skipUnlessDBFeature('has_select_for_update')
class ConcurrentCheckoutTests(TransactionTestCase):
    def setUp(self):
        category=Category.objects.create(name='تجهیزات',slug='gear')
        product=Product.objects.create(title='LAST ITEM',name='آخرین کالا',slug='last',category=category,active=True)
        self.variant=Variant.objects.create(product=product,sku='LAST',price=100000,stock=1)
        self.shipping=ShippingMethod.objects.create(name='ارسال آزمایشی',active=True,quote_required=False)
        StoreSettings.objects.create(ordering_enabled=True)
        self.inputs=[]
        for index in range(2):
            user=Customer.objects.create_user(username='buyer'+str(index))
            address=Address.objects.create(customer=user,province='تهران',city='تهران',street='آزمون',plate='1',postal='1234567890')
            cart=Cart.objects.create(customer=user);CartLine.objects.create(cart=cart,variant=self.variant,quantity=1)
            self.inputs.append((cart.pk,user.pk,address.pk))
    def test_two_buyers_cannot_reserve_last_item(self):
        barrier=Barrier(2)
        def buy(args):
            close_old_connections()
            try:
                cart=Cart.objects.get(pk=args[0]);user=Customer.objects.get(pk=args[1]);address=Address.objects.get(pk=args[2]);shipping=ShippingMethod.objects.get(pk=self.shipping.pk)
                barrier.wait(timeout=10)
                try: checkout(cart,user,address,shipping,uuid.uuid4());return 'reserved'
                except ShopError: return 'unavailable'
            finally: close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as executor: results=list(executor.map(buy,self.inputs))
        self.assertCountEqual(results,['reserved','unavailable']);self.variant.refresh_from_db();self.assertEqual(self.variant.stock,0);self.assertEqual(Order.objects.count(),1)
