from typing import Optional
import logging

from rest_framework.authentication import BaseAuthentication
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import APIException, AuthenticationFailed

from core.errors.classification import is_transient_error
from core.supabase_client import get_client

logger = logging.getLogger(__name__)


class SupabaseUnavailable(APIException):
    status_code = 503
    default_detail = 'Authentication service temporarily unavailable.'
    default_code = 'service_unavailable'


class SupabaseUser:
    """Wrapper around Supabase user data"""

    def __init__(self, user_id: str, email: str, metadata: Optional[dict] = None, profile_is_admin: bool = False):
        self.id = user_id
        self.email = email
        self.metadata = metadata or {}
        self.is_authenticated = True
        self.is_staff = (
            profile_is_admin
            or bool(self.metadata.get('is_admin'))
            or self.metadata.get('role') == 'admin'
        )

    def __str__(self):
        return self.email


class SupabaseAuthentication(BaseAuthentication):
    keyword = 'Bearer'

    def authenticate(self, request):
        auth = get_authorization_header(request).split()
        if not auth:
            return None
        if auth[0].lower() != self.keyword.lower().encode():
            return None
        if len(auth) != 2:
            raise AuthenticationFailed('Invalid token header format.')
        token = auth[1].decode()
        return self.authenticate_credentials(token)

    def authenticate_credentials(self, token):
        try:
            client = get_client()
            user_response = client.auth.get_user(token)
        except Exception as exc:
            if is_transient_error(exc):
                raise SupabaseUnavailable() from exc
            raise AuthenticationFailed('Invalid authentication token.') from exc

        if not user_response or not user_response.user:
            raise AuthenticationFailed('Invalid authentication token.')

        user_data = user_response.user
        profile_is_admin = False
        try:
            profile_response = (
                get_client()
                .table('users')
                .select('is_admin')
                .eq('id', user_data.id)
                .maybe_single()
                .execute()
            )
            profile_is_admin = bool((profile_response.data or {}).get('is_admin'))
        except Exception as exc:
            logger.warning('Could not read profile admin flag for user %s: %s', user_data.id, exc)

        user = SupabaseUser(
            user_id=user_data.id,
            email=user_data.email,
            metadata=getattr(user_data, 'app_metadata', None) or {},
            profile_is_admin=profile_is_admin,
        )
        return (user, token)

    def authenticate_header(self, request):
        return self.keyword
