import hashlib
import logging
from urllib.parse import urlencode

from django.core.cache import cache
from rest_framework.response import Response


audit_logger = logging.getLogger('audit')


class CachedListMixin:
    cache_timeout = 120
    cache_namespace = 'list'

    def _cache_key(self, request):
        query = urlencode(sorted(request.query_params.items()), doseq=True)
        raw = f'{self.cache_namespace}:{request.path}?{query}'
        digest = hashlib.sha256(raw.encode('utf-8')).hexdigest()
        return f'api-cache:{digest}'

    def list(self, request, *args, **kwargs):
        if request.method != 'GET':
            return super().list(request, *args, **kwargs)

        key = self._cache_key(request)
        payload = cache.get(key)
        if payload is not None:
            return Response(payload)

        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(key, response.data, timeout=self.cache_timeout)
        return response


class AuditWriteMixin:
    audit_resource = 'resource'

    def _log_write(self, action, instance=None):
        request = getattr(self, 'request', None)
        user_id = getattr(getattr(request, 'user', None), 'id', None)
        request_id = getattr(request, 'request_id', None)
        object_id = getattr(instance, 'pk', None)
        audit_logger.info(
            'action=%s resource=%s object_id=%s user_id=%s request_id=%s',
            action,
            self.audit_resource,
            object_id,
            user_id,
            request_id,
        )

    def perform_create(self, serializer):
        instance = serializer.save()
        self._log_write('create', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._log_write('update', instance)

    def perform_destroy(self, instance):
        self._log_write('delete', instance)
        instance.delete()
