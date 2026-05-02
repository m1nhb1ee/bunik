from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework import viewsets

from core.api.mixins import AuditWriteMixin, CachedListMixin
from src.universities.models import Province, University
from src.universities.serializers import (
    ProvinceSerializer, UniversityListSerializer,
    UniversityDetailSerializer, UniversityWriteSerializer
)
from src.universities.filters import UniversityFilterSet


class ProvinceViewSet(AuditWriteMixin, viewsets.ModelViewSet):
    audit_resource = 'province'
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']
    ordering = ['name']


class UniversityViewSet(CachedListMixin, AuditWriteMixin, viewsets.ModelViewSet):
    audit_resource = 'university'
    cache_timeout = settings.CACHE_TTL_UNIVERSITIES_LIST
    cache_namespace = 'universities-list'
    queryset = University.objects.select_related('province')
    filterset_class = UniversityFilterSet
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name', 'short_name']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return UniversityDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return UniversityWriteSerializer
        return UniversityListSerializer

    def get_queryset(self):
        return University.objects.select_related('province').filter(is_active=True)

