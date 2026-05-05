from django.conf import settings
from supabase import create_client, Client
import logging
import time
from typing import Any, Dict

logger = logging.getLogger(__name__)

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return _client


def paginate(request, query, max_retries: int = 3):
    """
    Apply DRF-style page/page_size pagination to a Supabase query.
    Includes retry logic for connection errors.
    """
    try:
        page = max(1, int(request.query_params.get('page', 1)))
        page_size = min(int(request.query_params.get('page_size', 20)), 100)
    except (ValueError, TypeError):
        page, page_size = 1, 20

    offset = (page - 1) * page_size
    
    # Retry logic for transient errors
    for attempt in range(max_retries):
        try:
            result = query.range(offset, offset + page_size - 1).execute()
            count = result.count if result.count is not None else len(result.data or [])

            return {
                'count': count,
                'page': page,
                'page_size': page_size,
                'results': result.data or [],
            }
        except Exception as e:
            error_msg = str(e).lower()
            
            # Transient errors that should be retried
            is_transient = any([
                'remoteprotocolerror' in error_msg,
                'server disconnected' in error_msg,
                'connection' in error_msg,
                'timeout' in error_msg,
            ])
            
            if is_transient and attempt < max_retries - 1:
                wait_time = (2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
                logger.warning(
                    f'Transient Supabase error on page {page}, retrying in {wait_time}s: {str(e)[:100]}'
                )
                time.sleep(wait_time)
                continue
            else:
                # Not transient or max retries reached
                logger.error(f'Supabase pagination failed on page {page}: {str(e)[:200]}')
                raise
