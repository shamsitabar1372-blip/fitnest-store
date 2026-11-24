from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
class Command(BaseCommand):
    help='Create explicit manager and employee roles without creating passwords or accounts.'
    def handle(self,*args,**options):
        manager,_=Group.objects.get_or_create(name='مدیر فروشگاه')
        manager.permissions.set(Permission.objects.filter(content_type__app_label='shop').exclude(content_type__model__in=['otpchallenge','ratebucket','payment','cart','cartline']).exclude(codename__in=['delete_order','add_order','delete_auditevent','change_auditevent','add_auditevent','add_customer','change_customer','delete_customer']))
        staff,_=Group.objects.get_or_create(name='کارمند فروشگاه')
        staff.permissions.set(Permission.objects.filter(content_type__app_label='shop',codename__in=['view_order','change_order','view_orderline','view_product','view_category','view_variant']))
        self.stdout.write(self.style.SUCCESS('Roles created. Set is_staff separately; assign membership explicitly.'))
