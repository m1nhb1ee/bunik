from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.universities.models import Province, University
from apps.universities.serializers import (
    ProvinceSerializer, UniversityListSerializer,
    UniversityDetailSerializer, UniversityWriteSerializer
)
from apps.universities.filters import UniversityFilterSet


class ProvinceViewSet(viewsets.ModelViewSet):
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']
    ordering = ['name']


class UniversityViewSet(viewsets.ModelViewSet):
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
