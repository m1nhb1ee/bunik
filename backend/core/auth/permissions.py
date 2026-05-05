from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsStaffWriteOrReadOnly(BasePermission):
    """
    Allows read access to any request.
    Write access only allowed if user is authenticated and is_staff/admin via Supabase.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        # Check if user is authenticated and is staff/admin
        return bool(
            request.user 
            and hasattr(request.user, 'is_authenticated') 
            and request.user.is_authenticated 
            and hasattr(request.user, 'is_staff') 
            and request.user.is_staff
        )


class IsSupabaseAuthenticated(BasePermission):
    """Only authenticated Supabase users can access"""
    def has_permission(self, request, view):
        return bool(
            request.user 
            and hasattr(request.user, 'is_authenticated') 
            and request.user.is_authenticated
        )
