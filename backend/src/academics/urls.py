from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.academics.views import FieldViewSet, SubjectGroupViewSet, MajorCatalogViewSet

router = DefaultRouter()
router.register(r'fields', FieldViewSet, basename='field')
router.register(r'subject-groups', SubjectGroupViewSet, basename='subject-group')
router.register(r'majors', MajorCatalogViewSet, basename='major')

urlpatterns = [
    path('', include(router.urls)),
]
