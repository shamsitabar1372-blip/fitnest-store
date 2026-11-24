from django.core.management.base import BaseCommand
from django.utils import timezone
from shop.models import Order, OTPChallenge, RateBucket
from shop.services import cancel_order,ShopError
class Command(BaseCommand):
    help='Release unpaid expired reservations; schedule once a minute.'
    def handle(self,*args,**options):
        count=0
        for order in Order.objects.filter(status='pending',expires_at__lte=timezone.now()).iterator():
            try: cancel_order(order,order.customer,expired=True);count+=1
            except ShopError as error:
                if error.status!=409: raise
        OTPChallenge.objects.filter(expires__lt=timezone.now()).delete()
        RateBucket.objects.filter(expires_at__lt=timezone.now()).delete()
        self.stdout.write(f'Expired reservations: {count}')
