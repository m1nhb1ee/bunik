from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.academics.models import Field, SubjectGroup, MajorCatalog
from apps.academics.serializers import (
    FieldSerializer, SubjectGroupSerializer,
    MajorCatalogListSerializer, MajorCatalogDetailSerializer,
    MajorCatalogWriteSerializer
)
from apps.academics.filters import MajorCatalogFilterSet


class FieldViewSet(viewsets.ModelViewSet):
    queryset = Field.objects.all()
    serializer_class = FieldSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['code', 'name']
    ordering = ['code']


class SubjectGroupViewSet(viewsets.ModelViewSet):
    queryset = SubjectGroup.objects.all()
    serializer_class = SubjectGroupSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['code', 'subjects']
    ordering_fields = ['code']
    ordering = ['code']


class MajorCatalogViewSet(viewsets.ModelViewSet):
    queryset = MajorCatalog.objects.select_related('field').prefetch_related('subject_groups')
    filterset_class = MajorCatalogFilterSet
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['code', 'name']
    ordering = ['code']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return MajorCatalogDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return MajorCatalogWriteSerializer
        return MajorCatalogListSerializer

    @action(detail=True, methods=['get'])
    def subject_groups(self, request, pk=None):
        major = self.get_object()
        subject_groups = major.subject_groups.all()
        serializer = SubjectGroupSerializer(subject_groups, many=True)
        return Response(serializer.data)
