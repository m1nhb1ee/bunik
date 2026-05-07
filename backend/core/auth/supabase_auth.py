from typing import Optional
from rest_framework.authentication import BaseAuthentication
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from core.supabase_client import get_client


class SupabaseUser:
    """Wrapper around Supabase user data"""
    
    def __init__(self, user_id: str, email: str, metadata: Optional[dict] = None):
        self.id = user_id
        self.email = email
        self.metadata = metadata or {}
        self.is_authenticated = True
        # Check if user is staff/admin from metadata
        self.is_staff = self.metadata.get('is_admin', False) or self.metadata.get('role') == 'admin'
    
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
            if not user_response or not user_response.user:
                raise AuthenticationFailed('Invalid authentication token.')
            user_data = user_response.user
            user = SupabaseUser(
                user_id=user_data.id,
                email=user_data.email,
                metadata=user_data.user_metadata or {}
            )
            return (user, token)
        except Exception:
            raise AuthenticationFailed('Invalid authentication token.')

    def authenticate_header(self, request):
        return self.keyword


class SupabaseTokenAuthentication(SupabaseAuthentication):
    pass
