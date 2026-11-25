from django.contrib import admin
from django.urls import path
from shop import views as v

urlpatterns=[
    path('',v.storefront),path('index.html',v.storefront),path('admin/',admin.site.urls),path('ops/',v.operations),
    path('api/auth/session',v.session),path('api/auth/request',v.auth_request),path('api/auth/verify',v.auth_verify),path('api/auth/logout',v.auth_logout),
    path('api/products',v.catalog),path('api/cart',v.cart),path('api/profile',v.profile),path('api/addresses',v.addresses),path('api/addresses/<int:pk>',v.addresses),
    path('api/shipping',v.shipping),path('api/checkout/quote',v.checkout_quote),path('api/orders/create',v.create_order),path('api/orders',v.orders),path('api/orders/<uuid:pk>',v.orders),
    path('api/orders/<uuid:pk>/cancel',v.cancel),path('api/orders/<uuid:pk>/return',v.returns),path('api/orders/<uuid:pk>/payment',v.payment_start),path('api/payments/callback',v.payment_callback),path('api/reviews',v.reviews),
    path('api/manage/dashboard',v.dashboard),path('api/manage/orders',v.management_orders),path('api/manage/orders/<uuid:pk>/transition',v.management_transition),path('api/manage/products',v.management_products),path('api/manage/customers',v.management_customers),path('api/manage/settings',v.management_settings),path('api/manage/events',v.management_events),
    path('api/manage/inventory/<int:pk>/adjust',v.inventory_adjust),
    path('api/maps/reverse',v.map_reverse),
]
from django.conf import settings
if settings.LOCAL: urlpatterns += [path('api/auth/local-test',v.local_test_login),path('local-test/',v.local_test_page),path('local-map-setup/',v.local_map_setup)]
from django.urls import re_path
from django.views.static import serve
if settings.LOCAL: urlpatterns += [re_path(r'^media/(?P<path>.*)$',serve,{'document_root':settings.MEDIA_ROOT})]
handler403=v.api_error
handler500=v.server_error
