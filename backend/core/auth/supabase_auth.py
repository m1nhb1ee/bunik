from typing import Optional
from rest_framework.authentication import BaseAuthentication
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


class SupabaseTokenAuthentication(BaseAuthentication):
    """
    Authentication using Supabase JWT tokens.
    Expects Authorization header: "Bearer <access_token>"
    """
    keyword = 'Bearer'

    def authenticate(self, request):
        """
        Authenticate using Supabase JWT token from Authorization header.
        Returns (user, token) tuple if authenticated, None if no auth header, 
        or raises AuthenticationFailed if token is invalid.
        """
        # Get Authorization header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header:
            # No auth header, allow unauthenticated access
            return None
        
        # Parse header
        try:
            auth_type, token = auth_header.split(maxsplit=1)
        except ValueError:
            raise AuthenticationFailed('Invalid token header format.')
        
        if auth_type.lower() != self.keyword.lower():
            # Not our auth type, allow other auth methods
            return None
        
        # Verify token with Supabase
        return self.authenticate_credentials(token)

    def authenticate_credentials(self, token: str):
        """Verify token with Supabase"""
        try:
            client = get_client()
            # Verify the JWT token and get user info
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
        except AuthenticationFailed:
            raise
        except Exception as e:
            raise AuthenticationFailed(f'Invalid authentication token: {str(e)}')


class SupabasePermission:
    """Base class for Supabase-based permissions"""
    
    def has_permission(self, request, view):
        """Override this in subclasses"""
        return True
