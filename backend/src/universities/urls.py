from django.urls import path, include
from rest_framework.routers import DefaultRouter
from src.universities.views import ProvinceViewSet, UniversityViewSet

router = DefaultRouter()
router.register(r'provinces', ProvinceViewSet, basename='province')
router.register(r'universities', UniversityViewSet, basename='university')

urlpatterns = [
    path('', include(router.urls)),
]

