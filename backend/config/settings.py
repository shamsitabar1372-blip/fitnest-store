"""Production defaults. SQLite and an automatically generated key require explicit local mode."""
from pathlib import Path
import os, secrets
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT = BASE_DIR.parent
LOCAL = os.getenv('DJANGO_LOCAL') == '1'
DEBUG = LOCAL and os.getenv('DJANGO_DEBUG') == '1'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '')
if not SECRET_KEY and LOCAL:
    private = ROOT / '.private'
    private.mkdir(exist_ok=True)
    key = private / 'django-secret'
    try:
        fd = os.open(key, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'w') as stream: stream.write(secrets.token_urlsafe(64))
    except FileExistsError: pass
    SECRET_KEY = key.read_text()
if len(SECRET_KEY) < 50:
    raise ImproperlyConfigured('Set a private DJANGO_SECRET_KEY of at least 50 characters.')
ALLOWED_HOSTS = [x for x in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1' if LOCAL else '').split(',') if x]
CSRF_TRUSTED_ORIGINS = [x for x in os.getenv('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if x]
TRUSTED_PROXY_CIDRS = [x for x in os.getenv('TRUSTED_PROXY_CIDRS','').split(',') if x]
INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'shop']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'shop.middleware.SecurityHeaders', 'shop.static_middleware.StoreAssetsMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware']
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND':'django.template.backends.django.DjangoTemplates', 'DIRS':[BASE_DIR/'templates'], 'APP_DIRS':True, 'OPTIONS':{'context_processors':['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'
if LOCAL and os.getenv('DB_ENGINE', 'sqlite') == 'sqlite':
    DATABASES = {'default':{'ENGINE':'django.db.backends.sqlite3', 'NAME':ROOT/'.private/store-dev.sqlite3', 'OPTIONS':{'timeout':20}}}
else:
    for name in ('POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_HOST'):
        if not os.getenv(name): raise ImproperlyConfigured('Missing database setting: '+name)
    DATABASES = {'default':{'ENGINE':'django.db.backends.postgresql','NAME':os.environ['POSTGRES_DB'],'USER':os.environ['POSTGRES_USER'],'PASSWORD':os.environ['POSTGRES_PASSWORD'],'HOST':os.environ['POSTGRES_HOST'],'PORT':os.getenv('POSTGRES_PORT','5432'),'CONN_MAX_AGE':60}}
AUTH_USER_MODEL = 'shop.Customer'
AUTH_PASSWORD_VALIDATORS = [{'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator','OPTIONS':{'min_length':12}}, {'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'}, {'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'}]
LANGUAGE_CODE = 'fa-ir'
TIME_ZONE = 'Asia/Tehran'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR/'staticfiles'
STATICFILES_DIRS = [BASE_DIR/'static']
WHITENOISE_MAX_AGE = 60
WHITENOISE_AUTOREFRESH = LOCAL
MEDIA_ROOT = BASE_DIR/'media'
MEDIA_URL = '/media/'
DATA_UPLOAD_MAX_MEMORY_SIZE = 32768
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = not LOCAL
CSRF_COOKIE_SECURE = not LOCAL
SESSION_COOKIE_AGE = 43200
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SECURE_SSL_REDIRECT = not LOCAL
SECURE_HSTS_SECONDS = 0 if LOCAL else 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'
# Only enable behind a trusted reverse proxy that strips and overwrites this header.
if os.getenv('TRUST_HTTPS_PROXY') == '1': SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO','https')
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
SMS_ENABLED = os.getenv('SMS_ENABLED') == '1'
PAYMENTS_ENABLED = False  # No production gateway has been selected or certified.
LOGGING = {'version':1,'disable_existing_loggers':False,'handlers':{'console':{'class':'logging.StreamHandler'}},'loggers':{'django':{'handlers':['console'],'level':'WARNING'}}}
