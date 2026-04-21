from rest_framework import viewsets, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.admissions.models import AdmissionMethod, UniversityProgram, AdmissionScore
from apps.admissions.serializers import (
    AdmissionMethodSerializer, UniversityProgramListSerializer,
    UniversityProgramDetailSerializer, UniversityProgramWriteSerializer,
    AdmissionScoreListSerializer, AdmissionScoreDetailSerializer,
    AdmissionScoreWriteSerializer
)
from apps.admissions.filters import AdmissionScoreFilterSet


class AdmissionMethodViewSet(viewsets.ModelViewSet):
    queryset = AdmissionMethod.objects.all()
    serializer_class = AdmissionMethodSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['code']
    ordering = ['code']


class UniversityProgramViewSet(viewsets.ModelViewSet):
    queryset = UniversityProgram.objects.select_related(
        'university', 'major_catalog__field'
    ).filter(university__is_active=True)
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['university', 'major_catalog', 'major_catalog__field']
    search_fields = [
        'internal_code', 'internal_name', 'major_catalog__name',
        'university__name', 'university__short_name'
    ]
    ordering_fields = ['university__name', 'major_catalog__code']
    ordering = ['university__name', 'major_catalog__code']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return UniversityProgramDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return UniversityProgramWriteSerializer
        return UniversityProgramListSerializer


class AdmissionScoreViewSet(viewsets.ModelViewSet):
    queryset = AdmissionScore.objects.select_related(
        'university_program__university',
        'university_program__major_catalog__field',
        'admission_method'
    ).filter(university_program__university__is_active=True)
    filterset_class = AdmissionScoreFilterSet
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = [
        'university_program__university__name',
        'university_program__major_catalog__name',
        'university_program__internal_code'
    ]
    ordering_fields = ['year', 'score', 'quota']
    ordering = ['-year', '-score']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AdmissionScoreDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return AdmissionScoreWriteSerializer
        return AdmissionScoreListSerializer
