import uuid
from urllib.parse import urlsplit
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, F
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator

class Customer(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mobile = models.CharField('موبایل تأییدشده', max_length=11, unique=True, null=True, blank=True, validators=[RegexValidator(r'^09[0-9]{9}$')])
    display_name = models.CharField('نام', max_length=100, blank=True)
    class Meta:
        verbose_name = 'مشتری'
        verbose_name_plural = 'مشتریان'

class Category(models.Model):
    name = models.CharField('نام', max_length=100)
    slug = models.SlugField(unique=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.PROTECT)
    def clean(self):
        parent=self.parent;seen={self.pk} if self.pk else set()
        for _ in range(8):
            if not parent: return
            if parent.pk in seen: raise ValidationError('دسته‌بندی چرخه دارد.')
            seen.add(parent.pk);parent=parent.parent
        raise ValidationError('حداکثر عمق دسته‌بندی ۸ سطح است.')
    def __str__(self): return self.name
    class Meta:
        verbose_name = 'دسته‌بندی'
        verbose_name_plural = 'دسته‌بندی‌ها'

class Product(models.Model):
    title = models.CharField('عنوان انگلیسی', max_length=160, validators=[RegexValidator(r"^[A-Za-z0-9 .&'()/+\-]+$")])
    name = models.CharField('نام فارسی', max_length=160)
    slug = models.SlugField(unique=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    gender = models.CharField('گروه', max_length=10, choices=[('','عمومی'),('men','مردانه'),('women','زنانه')], blank=True)
    description = models.TextField('توضیحات', blank=True)
    attributes = models.JSONField('ویژگی‌ها / جدول اندازه', default=dict, blank=True)
    active = models.BooleanField('فعال', default=False)
    is_demo = models.BooleanField('دادهٔ نمونه', default=False)
    updated_at = models.DateTimeField(auto_now=True)
    def clean(self):
        if not isinstance(self.attributes,dict) or len(str(self.attributes))>16000: raise ValidationError('ویژگی‌ها باید یک شیء JSON کوچک باشد.')
        if self.attributes.get('sizeChart') is not None and (not isinstance(self.attributes['sizeChart'],list) or len(self.attributes['sizeChart'])>20): raise ValidationError('جدول اندازه حداکثر ۲۰ ردیف دارد.')
    def __str__(self): return self.title + (' / '+self.gender if self.gender else '')
    class Meta:
        verbose_name = 'محصول'
        verbose_name_plural = 'محصولات'

class ProductImage(models.Model):
    product = models.ForeignKey(Product, related_name='images', on_delete=models.CASCADE)
    path = models.CharField('مسیر تصویر محلی', max_length=500, blank=True)
    file = models.ImageField('بارگذاری تصویر', upload_to='products/%Y/%m/', blank=True)
    alt = models.CharField('متن جایگزین', max_length=160)
    position = models.PositiveSmallIntegerField(default=0)
    def clean(self):
        if self.path and (not self.path.startswith(('/assets/','assets/','/media/')) or '..' in self.path or urlsplit(self.path).netloc):
            raise ValidationError('تصویر باید مسیر محلی امن داشته باشد.')
        if not self.path and not self.file: raise ValidationError('تصویر یا مسیر آن را وارد کنید.')
        if self.file and self.file.size > 5*1024*1024: raise ValidationError('حداکثر اندازه تصویر ۵ مگابایت است.')
        if self.file and self.file.name.lower().split('.')[-1] not in ['jpg','jpeg','png','webp','avif']: raise ValidationError('قالب تصویر مجاز نیست.')
    @property
    def url(self): return self.file.url if self.file else self.path
    class Meta: ordering = ['position','id']

class Variant(models.Model):
    product = models.ForeignKey(Product, related_name='variants', on_delete=models.PROTECT)
    sku = models.CharField('شناسه انبار', max_length=80, unique=True)
    color = models.CharField('رنگ', max_length=40, blank=True)
    size = models.CharField('اندازه', max_length=20, blank=True)
    price = models.PositiveBigIntegerField('قیمت به ریال')
    stock = models.PositiveIntegerField('موجودی قابل فروش', default=0)
    low_stock = models.PositiveIntegerField('آستانه هشدار', default=3)
    active = models.BooleanField('فعال', default=True)
    discount_price = models.PositiveBigIntegerField('قیمت تخفیف‌دار ریالی', null=True, blank=True)
    discount_start = models.DateTimeField(null=True, blank=True)
    discount_end = models.DateTimeField(null=True, blank=True)
    def clean(self):
        if self.discount_price is not None and (not self.discount_start or not self.discount_end or self.discount_start>=self.discount_end): raise ValidationError('برای تخفیف، شروع و پایان معتبر لازم است.')
    def __str__(self): return self.sku
    class Meta:
        constraints = [models.UniqueConstraint(fields=['product','color','size'],name='unique_product_option'), models.CheckConstraint(condition=Q(price__gt=0),name='positive_price'), models.CheckConstraint(condition=Q(discount_price__isnull=True)|(Q(discount_price__gt=0)&Q(discount_price__lte=F('price'))),name='valid_discount_price')]
        verbose_name = 'گونه / موجودی'
        verbose_name_plural = 'گونه‌ها و موجودی'

class Address(models.Model):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    province = models.CharField(max_length=80)
    city = models.CharField(max_length=80)
    street = models.CharField(max_length=500)
    plate = models.CharField(max_length=20)
    unit = models.CharField(max_length=20, blank=True)
    postal = models.CharField(max_length=10, validators=[RegexValidator(r'^[0-9]{10}$')])
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(24),MaxValueValidator(41)])
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, validators=[MinValueValidator(44),MaxValueValidator(64)])
    selected = models.BooleanField(default=False)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['customer'],condition=Q(selected=True),name='one_selected_address')]
        verbose_name='نشانی'
        verbose_name_plural='نشانی‌ها'

class ShippingMethod(models.Model):
    name = models.CharField('روش ارسال', max_length=100)
    fee = models.PositiveBigIntegerField('هزینه ریالی', default=0)
    active = models.BooleanField('فعال', default=False)
    quote_required = models.BooleanField('نیاز به استعلام هزینه', default=True)
    def __str__(self): return self.name
    class Meta:
        verbose_name='روش ارسال'
        verbose_name_plural='روش‌های ارسال'

class StoreSettings(models.Model):
    name = models.CharField(default='FitNestPro', max_length=100)
    currency = models.CharField(max_length=3, default='IRR', choices=[('IRR','ریال')])
    tax_bps = models.PositiveSmallIntegerField('مالیات: صدم درصد', default=0, validators=[MaxValueValidator(10000)])
    ordering_enabled = models.BooleanField('پذیرش سفارش واقعی', default=False)
    returns_days = models.PositiveSmallIntegerField(default=7)
    class Meta:
        verbose_name='تنظیمات فروشگاه'
        verbose_name_plural='تنظیمات فروشگاه'

class Coupon(models.Model):
    code = models.CharField(max_length=40, unique=True)
    percent = models.PositiveSmallIntegerField(validators=[MinValueValidator(1),MaxValueValidator(100)])
    starts = models.DateTimeField()
    ends = models.DateTimeField()
    min_subtotal = models.PositiveBigIntegerField(default=0)
    max_discount = models.PositiveBigIntegerField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(default=1)
    per_customer = models.PositiveIntegerField(default=1)
    active = models.BooleanField(default=True)
    categories = models.ManyToManyField(Category, blank=True)
    def clean(self):
        if self.starts and self.ends and self.starts>=self.ends: raise ValidationError('پایان تخفیف باید بعد از شروع باشد.')
        self.code=self.code.strip().upper()
    class Meta:
        verbose_name='کد تخفیف'
        verbose_name_plural='کدهای تخفیف'

class Cart(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    guest_digest = models.CharField(max_length=64, unique=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints=[models.CheckConstraint(condition=(Q(customer__isnull=False)&Q(guest_digest__isnull=True))|(Q(customer__isnull=True)&Q(guest_digest__isnull=False)),name='cart_exactly_one_owner')]

class CartLine(models.Model):
    cart = models.ForeignKey(Cart, related_name='lines', on_delete=models.CASCADE)
    variant = models.ForeignKey(Variant, on_delete=models.CASCADE)
    quantity = models.PositiveSmallIntegerField(validators=[MinValueValidator(1),MaxValueValidator(99)])
    class Meta:
        constraints=[models.UniqueConstraint(fields=['cart','variant'],name='unique_cart_variant'),models.CheckConstraint(condition=Q(quantity__gte=1)&Q(quantity__lte=99),name='cart_qty_range')]

class Order(models.Model):
    STATUS=[('pending','در انتظار پرداخت'),('paid','پرداخت‌شده'),('processing','آماده‌سازی'),('shipped','ارسال‌شده'),('delivered','تحویل‌شده'),('cancelled','لغوشده'),('returned','مرجوع‌شده')]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=40, unique=True, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    status = models.CharField(max_length=16, choices=STATUS, default='pending')
    address = models.JSONField()
    shipping = models.ForeignKey(ShippingMethod, on_delete=models.PROTECT)
    subtotal = models.PositiveBigIntegerField()
    discount = models.PositiveBigIntegerField(default=0)
    shipping_fee = models.PositiveBigIntegerField()
    tax = models.PositiveBigIntegerField()
    total = models.PositiveBigIntegerField()
    currency = models.CharField(max_length=3, default='IRR')
    coupon = models.ForeignKey(Coupon, on_delete=models.PROTECT, null=True, blank=True)
    idempotency_key = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    stock_released = models.BooleanField(default=False)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['customer','idempotency_key'],name='unique_checkout_request')]
        ordering=['-created_at']
        verbose_name='سفارش'
        verbose_name_plural='سفارش‌ها'

class OrderLine(models.Model):
    order = models.ForeignKey(Order, related_name='lines', on_delete=models.CASCADE)
    variant = models.ForeignKey(Variant, on_delete=models.PROTECT)
    title = models.CharField(max_length=160)
    sku = models.CharField(max_length=80)
    options = models.JSONField(default=dict)
    image = models.CharField(max_length=500, blank=True)
    unit_price = models.PositiveBigIntegerField()
    quantity = models.PositiveSmallIntegerField()

class Payment(models.Model):
    order = models.ForeignKey(Order, related_name='payments', on_delete=models.PROTECT)
    provider = models.CharField(max_length=30)
    authority = models.CharField(max_length=160, unique=True)
    reference = models.CharField(max_length=160, unique=True, null=True, blank=True)
    amount = models.PositiveBigIntegerField()
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class ReturnRequest(models.Model):
    order = models.OneToOneField(Order, on_delete=models.PROTECT)
    reason = models.CharField(max_length=1000)
    state = models.CharField(max_length=16, choices=[('requested','درخواست‌شده'),('accepted','پذیرفته'),('rejected','ردشده')], default='requested')
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        verbose_name='مرجوعی'
        verbose_name_plural='درخواست‌های مرجوعی'

class Review(models.Model):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1),MaxValueValidator(5)])
    comment = models.CharField(max_length=2000)
    approved = models.BooleanField(default=False)
    class Meta: constraints=[models.UniqueConstraint(fields=['customer','product'],name='unique_customer_review')]

class AuditEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=80)
    target = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering=['-created_at']
        verbose_name='رویداد مدیریتی'
        verbose_name_plural='رویدادهای مدیریتی'

class RateBucket(models.Model):
    key = models.CharField(max_length=64, unique=True)
    hits = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(default=__import__('django.utils.timezone',fromlist=['now']).now)

class OTPChallenge(models.Model):
    token_digest = models.CharField(max_length=64, unique=True)
    mobile = models.CharField(max_length=11, unique=True)
    code_digest = models.CharField(max_length=64)
    expires = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    sent = models.BooleanField(default=False)
