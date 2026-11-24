"""Serve only the public asset directory under its original URL prefix."""
from django.conf import settings
from whitenoise.middleware import WhiteNoiseMiddleware
class StoreAssetsMiddleware(WhiteNoiseMiddleware):
    def __init__(self,get_response=None):
        super().__init__(get_response)
        self.add_files(settings.ROOT/'assets',prefix='assets/')
