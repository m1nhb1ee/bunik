from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.admissions.views import (
    AdmissionMethodViewSet, UniversityProgramViewSet, AdmissionScoreViewSet
)

router = DefaultRouter()
router.register(r'admission-methods', AdmissionMethodViewSet, basename='admission-method')
router.register(r'programs', UniversityProgramViewSet, basename='program')
router.register(r'scores', AdmissionScoreViewSet, basename='score')

urlpatterns = [
    path('', include(router.urls)),
]
