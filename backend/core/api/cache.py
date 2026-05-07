import hashlib
from urllib.parse import urlencode

from django.core.cache import cache


def _sorted_query_items(query_params):
    items = []
    for key, values in query_params.lists():
        for value in values:
            items.append((key, value))
    return sorted(items)


def build_cache_key(request, namespace: str) -> str:
    query = urlencode(_sorted_query_items(request.query_params), doseq=True)
    raw = f'{namespace}:{request.path}?{query}'
    digest = hashlib.sha256(raw.encode('utf-8')).hexdigest()
    return f'api-cache:{digest}'


def get_or_set_api_payload(request, namespace: str, producer, timeout: int = 120):
    if request.method != 'GET':
        return producer()

    cache_key = build_cache_key(request, namespace)
    payload = cache.get(cache_key)
    if payload is not None:
        return payload

    payload = producer()
    cache.set(cache_key, payload, timeout=timeout)
    return payload
