import logging
import uuid
from contextvars import ContextVar


request_id_ctx_var: ContextVar[str] = ContextVar('request_id', default='-')


def get_request_id() -> str:
    return request_id_ctx_var.get()


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
        request.request_id = request_id
        token = request_id_ctx_var.set(request_id)
        try:
            response = self.get_response(request)
            response['X-Request-ID'] = request_id
            return response
        finally:
            request_id_ctx_var.reset(token)


class RequestIDLogFilter(logging.Filter):
    def filter(self, record):
        record.request_id = get_request_id()
        return True
