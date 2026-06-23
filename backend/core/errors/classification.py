TRANSIENT_ERROR_MARKERS = (
    'remoteprotocolerror',
    'server disconnected',
    'connection reset',
    'connection aborted',
    'connection refused',
    'temporarily unavailable',
    'timeout',
)


def _message(exc) -> str:
    return str(exc).lower()


def is_transient_error(exc) -> bool:
    message = _message(exc)
    return any(marker in message for marker in TRANSIENT_ERROR_MARKERS)


def is_duplicate_error(exc) -> bool:
    message = _message(exc)
    return 'duplicate' in message or 'already' in message or 'unique' in message


def is_invalid_credentials_error(exc) -> bool:
    message = _message(exc)
    return 'invalid login' in message or 'invalid credentials' in message or 'email not confirmed' in message


def is_rate_limited_error(exc) -> bool:
    message = _message(exc)
    return 'too many requests' in message or 'after 5 seconds' in message or '429' in message


def is_rls_error(exc) -> bool:
    message = _message(exc)
    return 'row-level security policy' in message or 'violates row-level security' in message


def is_missing_column_error(exc, column_name: str) -> bool:
    message = _message(exc)
    return column_name.lower() in message and ('column' in message or 'schema cache' in message)
