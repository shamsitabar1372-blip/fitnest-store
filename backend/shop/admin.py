from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.admin import GroupAdmin
from django.contrib.auth.models import Group
from django.core.exceptions import PermissionDenied
from .models import *
from .services import audit

admin.site.site_header='مدیریت فیت‌نست پرو'
admin.site.site_title='FitNestPro'
admin.site.index_title='مدیریت اطلاعات فروشگاه'

LABELS={'title':'عنوان انگلیسی','name':'نام','slug':'شناسهٔ پیوند','parent':'دستهٔ مادر','category':'دسته‌بندی','gender':'گروه پوشاک','description':'توضیحات','attributes':'ویژگی‌ها و جدول اندازه','active':'فعال','is_demo':'دادهٔ نمونه','product':'محصول','path':'مسیر تصویر','alt':'متن جایگزین','position':'ترتیب','sku':'شناسهٔ انبار','color':'رنگ','size':'اندازه','price':'قیمت به ریال','stock':'موجودی','low_stock':'آستانه هشدار','discount_price':'قیمت تخفیف‌دار به ریال','discount_start':'شروع تخفیف','discount_end':'پایان تخفیف','fee':'هزینهٔ ارسال ریالی','quote_required':'نیاز به استعلام هزینه','currency':'واحد پول','tax_bps':'مالیات: صدم درصد','ordering_enabled':'پذیرش سفارش واقعی','returns_days':'مهلت درخواست مرجوعی به روز','code':'کد','percent':'درصد تخفیف','starts':'شروع','ends':'پایان','min_subtotal':'حداقل خرید ریالی','max_discount':'سقف تخفیف ریالی','max_uses':'سقف استفادهٔ کل','per_customer':'سقف هر مشتری','categories':'دسته‌های مجاز','display_name':'نام مشتری','rating':'امتیاز','comment':'دیدگاه','approved':'تأیید انتشار','reason':'دلیل درخواست','state':'وضعیت بررسی'}

class ManagedAdmin(admin.ModelAdmin):
    def formfield_for_dbfield(self,db_field,request,**kwargs):
        if db_field.name in LABELS: kwargs['label']=LABELS[db_field.name]
        return super().formfield_for_dbfield(db_field,request,**kwargs)
    def save_model(self,request,obj,form,change):
        if isinstance(obj,Variant) and change:
            fields=[f for f in form.changed_data if f!='stock']
            if fields: obj.save(update_fields=fields)
        else: super().save_model(request,obj,form,change)
        audit(request.user,'admin.update' if change else 'admin.create',obj._meta.label+':'+str(obj.pk))
    def delete_model(self,request,obj):
        audit(request.user,'admin.delete',obj._meta.label+':'+str(obj.pk));super().delete_model(request,obj)
    def delete_queryset(self,request,queryset):
        for obj in queryset: audit(request.user,'admin.delete',obj._meta.label+':'+str(obj.pk))
        super().delete_queryset(request,queryset)

class ImageInline(admin.TabularInline):
    model=ProductImage;extra=0
class VariantInline(admin.TabularInline):
    model=Variant;extra=0
    readonly_fields=['stock']
@admin.register(Product)
class ProductAdmin(ManagedAdmin):
    list_display=['title','gender','category','active','is_demo']
    search_fields=['title','name'];list_filter=['category','gender','active','is_demo']
    inlines=[ImageInline,VariantInline]
    def save_formset(self,request,form,formset,change):
        instances=formset.save(commit=False)
        for obj in formset.deleted_objects: obj.delete()
        for obj in instances:
            if isinstance(obj,Variant) and obj.pk:
                changed=next((fields for item,fields in formset.changed_objects if item.pk==obj.pk),[])
                fields=[f for f in changed if f!='stock']
                if fields: obj.save(update_fields=fields)
            else: obj.save()
        formset.save_m2m();audit(request.user,'admin.variants_or_images',form.instance.pk)

@admin.register(Variant)
class VariantAdmin(ManagedAdmin):
    list_display=['sku','product','color','size','price','stock','active'];search_fields=['sku','product__title'];list_filter=['active','size']
    def get_readonly_fields(self,request,obj=None): return ['stock'] if obj else []

@admin.register(Customer)
class CustomerAdmin(UserAdmin):
    list_display=['username','display_name','mobile','is_active','is_staff'];search_fields=['mobile','display_name']
    fieldsets=UserAdmin.fieldsets+(('مشتری',{'fields':('display_name','mobile')}),)
    readonly_fields=['mobile']
    def has_add_permission(self,request): return request.user.is_superuser
    def has_change_permission(self,request,obj=None): return request.user.is_superuser
    def save_model(self,request,obj,form,change):
        super().save_model(request,obj,form,change);audit(request.user,'admin.customer_access_changed',obj.pk)

class OrderLineInline(admin.TabularInline):
    model=OrderLine;extra=0
    readonly_fields=[f.name for f in OrderLine._meta.fields]
    can_delete=False
    def has_add_permission(self,request,obj=None): return False
@admin.register(Order)
class OrderAdmin(ManagedAdmin):
    list_display=['code','created_at','status','customer'];list_filter=['status','created_at'];search_fields=['code','customer__mobile']
    readonly_fields=[f.name for f in Order._meta.fields];inlines=[OrderLineInline]
    def has_add_permission(self,request): return False
    def has_delete_permission(self,request,obj=None): return False

@admin.register(AuditEvent)
class AuditAdmin(ManagedAdmin):
    list_display=['created_at','actor','action','target'];readonly_fields=[f.name for f in AuditEvent._meta.fields]
    def has_add_permission(self,request): return False
    def has_change_permission(self,request,obj=None): return False
    def has_delete_permission(self,request,obj=None): return False

@admin.register(StoreSettings)
class SettingsAdmin(ManagedAdmin):
    def has_add_permission(self,request): return not StoreSettings.objects.exists() and super().has_add_permission(request)

for model in [Category,ShippingMethod,Coupon,ReturnRequest,Review]: admin.site.register(model,ManagedAdmin)
admin.site.unregister(Group)
@admin.register(Group)
class AuditedGroupAdmin(ManagedAdmin,GroupAdmin):
    def has_change_permission(self,request,obj=None): return request.user.is_superuser
    def has_add_permission(self,request): return request.user.is_superuser
    def has_delete_permission(self,request,obj=None): return request.user.is_superuser
