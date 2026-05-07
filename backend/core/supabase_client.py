from django.conf import settings
from supabase import create_client, Client
import logging
import time

logger = logging.getLogger(__name__)

_anon_client: Client | None = None
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
TRANSIENT_ERROR_MARKERS = (
    'remoteprotocolerror',
    'server disconnected',
    'connection reset',
    'connection aborted',
    'connection refused',
    'temporarily unavailable',
    'timeout',
)


def get_client() -> Client:
    global _anon_client
    if _anon_client is None:
        _anon_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return _anon_client


def get_user_client(access_token: str) -> Client:
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    client.postgrest.auth(access_token)
    return client


def parse_int_param(value, default: int, minimum: int | None = None, maximum: int | None = None) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default

    if minimum is not None:
        parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def parse_float_param(value, default: float, minimum: float | None = None, maximum: float | None = None) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default

    if minimum is not None:
        parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def parse_bool_param(value, default: bool | None = None) -> bool | None:
    if value is None:
        return default

    normalized = str(value).strip().lower()
    if normalized in {'true', '1', 'yes', 'y', 'on'}:
        return True
    if normalized in {'false', '0', 'no', 'n', 'off'}:
        return False
    return default


def apply_ordering(query, ordering: str | None, allowed_fields: set[str], default: str):
    requested_fields = [field.strip() for field in (ordering or default).split(',') if field.strip()]
    valid_fields = []

    for field in requested_fields:
        desc = field.startswith('-')
        normalized = field.lstrip('-')
        if normalized in allowed_fields:
            valid_fields.append((normalized, desc))

    if not valid_fields:
        desc = default.startswith('-')
        valid_fields = [(default.lstrip('-'), desc)]

    for field_name, desc in valid_fields:
        query = query.order(field_name, desc=desc)
    return query


def execute_with_retry(operation, *, operation_name: str, max_retries: int = 3):
    """Retry transient Supabase HTTP failures with exponential backoff."""
    for attempt in range(max_retries):
        try:
            return operation()
        except Exception as exc:
            error_msg = str(exc).lower()
            is_transient = any(marker in error_msg for marker in TRANSIENT_ERROR_MARKERS)
            if is_transient and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(
                    'Transient Supabase error during %s, retrying in %ss: %s',
                    operation_name,
                    wait_time,
                    str(exc)[:100],
                )
                time.sleep(wait_time)
                continue

            logger.error('Supabase operation failed during %s: %s', operation_name, str(exc)[:200])
            raise


def paginate(request, query, max_retries: int = 3):
    """Apply DRF-style page/page_size pagination to a Supabase query."""
    try:
        page = parse_int_param(request.query_params.get('page'), default=1, minimum=1)
        page_size = parse_int_param(
            request.query_params.get('page_size'),
            default=DEFAULT_PAGE_SIZE,
            minimum=1,
            maximum=MAX_PAGE_SIZE,
        )
    except Exception:
        page, page_size = 1, DEFAULT_PAGE_SIZE

    offset = (page - 1) * page_size

    result = execute_with_retry(
        lambda: query.range(offset, offset + page_size - 1).execute(),
        operation_name=f'pagination page={page} page_size={page_size}',
        max_retries=max_retries,
    )
    count = result.count if result.count is not None else len(result.data or [])

    return {
        'count': count,
        'page': page,
        'page_size': page_size,
        'results': result.data or [],
    }
