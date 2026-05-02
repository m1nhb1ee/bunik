from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_patterns = [
    path('', include('src.universities.urls')),
    path('', include('src.academics.urls')),
    path('', include('src.admissions.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('api/v1/auth/token/', TokenObtainPairView.as_view(), name='v1_token_obtain_pair'),
    path('api/v1/auth/token/refresh/', TokenRefreshView.as_view(), name='v1_token_refresh'),

    path('api/', include(api_patterns)),
    path('api/v1/', include(api_patterns)),

    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='v1_schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/docs/', SpectacularSwaggerView.as_view(url_name='v1_schema'), name='v1_swagger-ui'),
]

