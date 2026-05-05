from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from core.api.views import RankingsListView, MajorTrendsView

api_patterns = [
    path('', include('src.universities.urls')),
    path('', include('src.academics.urls')),
    path('', include('src.admissions.urls')),
    path('rankings/', RankingsListView.as_view(), name='rankings'),
    path('major-trends/', MajorTrendsView.as_view(), name='major-trends'),
]

urlpatterns = [
    path('api/', include(api_patterns)),
    path('api/v1/', include(api_patterns)),

    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='v1_schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/docs/', SpectacularSwaggerView.as_view(url_name='v1_schema'), name='v1_swagger-ui'),
]
