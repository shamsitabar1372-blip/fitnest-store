import ipaddress
from django.conf import settings
from django.http import JsonResponse

class SecurityHeaders:
    def __init__(self, get_response): self.get_response = get_response
    def __call__(self, request):
        request.client_ip=request.META.get('REMOTE_ADDR','')
        try:
            remote=ipaddress.ip_address(request.client_ip)
            trusted=any(remote in ipaddress.ip_network(net) for net in settings.TRUSTED_PROXY_CIDRS)
            if trusted: request.client_ip=str(ipaddress.ip_address(request.META.get('HTTP_X_REAL_IP','')))
        except ValueError: return JsonResponse({'message':'تنظیم پراکسی معتبر نیست.'},status=400)
        if request.method=='POST' and request.path=='/admin/login/':
            from .otp import budget
            from .services import ShopError
            try: budget('admin-login:'+request.client_ip,900,10)
            except ShopError as error: return JsonResponse({'message':error.message},status=429)
        response = self.get_response(request)
        response['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(self)'
        if request.path.startswith(('/api/', '/ops/', '/admin/')): response['Cache-Control'] = 'no-store'
        response['Content-Security-Policy'] = "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://static.neshan.org; style-src 'self' 'unsafe-inline' https://static.neshan.org; img-src 'self' data: blob: https://*.neshan.org; font-src 'self' https://static.neshan.org; connect-src 'self' https://*.neshan.org; worker-src 'self' blob:"
        return response
