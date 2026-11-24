import json,re
from pathlib import Path
from django.core.management.base import BaseCommand,CommandError
from django.conf import settings
from django.db import transaction
from shop.models import Category,Product,Variant,StoreSettings,ShippingMethod
class Command(BaseCommand):
    help='Import existing showcase as explicitly sample products with ZERO stock. No live SMS/payment.'
    @transaction.atomic
    def handle(self,*args,**options):
        if not settings.LOCAL: raise CommandError('Demo seeding is limited to explicit local mode.')
        entries=json.loads((Path(__file__).resolve().parents[2]/'fixtures/demo_catalog.json').read_text(encoding='utf-8'))
        StoreSettings.objects.get_or_create(pk=1)
        ShippingMethod.objects.get_or_create(name='تیپاکس',defaults={'active':False,'quote_required':True})
        for slug,name in [('supplements','مکمل‌ها'),('clothing','پوشاک ورزشی'),('gear','تجهیزات ورزشی')]:Category.objects.get_or_create(slug=slug,defaults={'name':name})
        for data in entries:
            if not data.get('english'):continue
            category=Category.objects.get(slug=data['category'])
            if data.get('supplementCategory'):category,_=Category.objects.get_or_create(slug=data['supplementCategory'],defaults={'parent':category,'name':data['supplementCategory']})
            for gender in (['men','women'] if data['category']=='clothing' else ['']):
                slug=re.sub('[^a-z0-9]+','-',data['english'].lower()).strip('-')+('-'+gender if gender else '')
                p,created=Product.objects.get_or_create(slug=slug,defaults={'title':data['english'],'name':data['name'],'category':category,'gender':gender,'description':data.get('subtitle',''),'active':True,'is_demo':True,'attributes':{'mark':data.get('mark',''),'tag':'FEATURED'}})
                if created:
                    for color in (['مشکی','بنفش','خاکستری'] if gender else ['']):
                        for size in (['S','M','L','XL'] if gender else ['']):
                            Variant.objects.create(product=p,sku=f'DEMO-{p.pk}-{len(p.variants.all())+1}',color=color,size=size,price=data['demoPriceRial'],stock=0)
        self.stdout.write(self.style.SUCCESS('Local sample catalog ready: zero stock, ordering disabled, shipping unconfigured.'))
