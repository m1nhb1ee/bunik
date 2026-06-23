from decouple import config, Csv

from .base import *  # noqa: F403,F401

DEBUG = False
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='', cast=Csv())

if not ALLOWED_HOSTS:
    raise ValueError('ALLOWED_HOSTS must be set in production')

if not SECRET_KEY or SECRET_KEY == 'django-insecure-change-me':
    raise ValueError('SECRET_KEY must be set in production')

CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())

if not CORS_ALLOW_ALL_ORIGINS and not CORS_ALLOWED_ORIGINS:
    raise ValueError('CORS_ALLOWED_ORIGINS must be set in production')

SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=31536000, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
