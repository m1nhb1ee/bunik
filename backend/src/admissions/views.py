from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.api.mixins import AuditWriteMixin, CachedListMixin
from src.admissions.models import AdmissionMethod, UniversityProgram, AdmissionScore
from src.admissions.serializers import (
    AdmissionMethodSerializer, UniversityProgramListSerializer,
    UniversityProgramDetailSerializer, UniversityProgramWriteSerializer,
    AdmissionScoreListSerializer, AdmissionScoreDetailSerializer,
    AdmissionScoreWriteSerializer, AdmissionScoreBulkUpsertRequestSerializer
)
from src.admissions.filters import AdmissionScoreFilterSet
from src.admissions.tasks import bulk_upsert_admission_scores


class AdmissionMethodViewSet(AuditWriteMixin, viewsets.ModelViewSet):
    audit_resource = 'admission_method'
    queryset = AdmissionMethod.objects.all()
    serializer_class = AdmissionMethodSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['code']
    ordering = ['code']


class UniversityProgramViewSet(AuditWriteMixin, viewsets.ModelViewSet):
    audit_resource = 'university_program'
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
        elif self.action == 'scores':
            return AdmissionScoreListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return UniversityProgramWriteSerializer
        return UniversityProgramListSerializer

    @action(detail=True, methods=['get'])
    def scores(self, request, pk=None):
        program = self.get_object()
        queryset = program.admission_scores.select_related('admission_method').order_by('-year', '-score')
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class AdmissionScoreViewSet(CachedListMixin, AuditWriteMixin, viewsets.ModelViewSet):
    audit_resource = 'admission_score'
    cache_timeout = settings.CACHE_TTL_SCORES_LIST
    cache_namespace = 'admission-scores-list'
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
        elif self.action == 'bulk_upsert':
            return AdmissionScoreBulkUpsertRequestSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return AdmissionScoreWriteSerializer
        return AdmissionScoreListSerializer

    @action(detail=False, methods=['post'], url_path='bulk-upsert')
    def bulk_upsert(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items = serializer.validated_data['items']
        try:
            task = bulk_upsert_admission_scores.delay(items)
            self._log_write('bulk_upsert_async', None)
            return Response(
                {
                    'code': 'accepted',
                    'message': 'Bulk upsert job accepted',
                    'details': {'task_id': task.id, 'items': len(items)},
                    'request_id': getattr(request, 'request_id', None),
                },
                status=202,
            )
        except Exception:
            result = bulk_upsert_admission_scores(items)
            self._log_write('bulk_upsert_sync_fallback', None)
            return Response(
                {
                    'code': 'ok',
                    'message': 'Bulk upsert completed synchronously',
                    'details': result,
                    'request_id': getattr(request, 'request_id', None),
                }
            )

