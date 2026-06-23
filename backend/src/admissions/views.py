from uuid import UUID

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from core.api.cache import get_or_set_api_payload
from core.auth.supabase_auth import SupabaseAuthentication
from core.supabase_client import DEFAULT_PAGE_SIZE, apply_ordering, get_client, get_user_client, paginate
from src.admissions.serializers import BulkAdmissionScoreItemSerializer


MAX_PROGRAM_IDS = 100
MAJOR_NAME_LOOKUP_LIMIT = 200


def _split_csv_param(value, *, max_items=MAX_PROGRAM_IDS):
    if value is None:
        return None
    items = [item.strip() for item in value.split(',') if item.strip()]
    if not items:
        raise ValidationError({'program_ids': ['Must contain at least one id.']})
    if len(items) > max_items:
        raise ValidationError({'program_ids': [f'Must contain at most {max_items} ids.']})
    return items


def _parse_uuid_csv_param(value):
    items = _split_csv_param(value)
    if items is None:
        return None
    invalid = []
    for item in items:
        try:
            UUID(item)
        except ValueError:
            invalid.append(item)
    if invalid:
        raise ValidationError({'program_ids': ['Must be valid UUID values.']})
    return items


def _escape_like_literal(value):
    return value.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


def _major_codes_by_name(client, major_name, limit=MAJOR_NAME_LOOKUP_LIMIT):
    name = (major_name or '').strip()
    if not name:
        return []

    response = (
        client
        .table('major_catalog')
        .select('code')
        .ilike('name', _escape_like_literal(name))
        .limit(limit)
        .execute()
    )
    return [row.get('code') for row in (response.data or []) if row.get('code')]


class AdmissionMethodViewSet(ViewSet):
    @extend_schema(summary='Danh sach phuong thuc tuyen sinh')
    def list(self, request):
        def load():
            response = get_client().table('admission_methods').select('*').order('code').execute()
            rows = response.data or []
            return {
                'count': len(rows),
                'page': 1,
                'page_size': len(rows),
                'results': rows,
            }

        return Response(get_or_set_api_payload(request, 'admission-methods:list', load, timeout=1800))

    @extend_schema(summary='Chi tiet phuong thuc tuyen sinh')
    def retrieve(self, request, pk=None):
        def load():
            response = (
                get_client()
                .table('admission_methods')
                .select('*')
                .eq('code', pk)
                .maybe_single()
                .execute()
            )
            return response.data

        payload = get_or_set_api_payload(request, f'admission-methods:detail:{pk}', load, timeout=1800)
        if not payload:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)


class UniversityProgramViewSet(ViewSet):
    _SELECT = (
        'id, university_short_name, major_code, is_active, program_name, program_source_code, '
        'universities!university_programs_university_short_name_fkey(id, name, code, type), '
        'major_catalog(code, name, field_code)'
    )

    @extend_schema(
        parameters=[
            OpenApiParameter('university_code', str, description='Ma truong'),
            OpenApiParameter('major_code', str, description='Ma nganh'),
            OpenApiParameter('major_name', str, description='Ten nganh'),
            OpenApiParameter('is_active', bool, description='Con hoat dong'),
        ],
        summary='Danh sach chuong trinh dao tao',
    )
    def list(self, request):
        def load():
            client = get_client()
            query = (
                client
                .table('university_programs')
                .select(self._SELECT, count='exact')
                .eq('is_active', True)
            )

            if university_code := request.query_params.get('university_code'):
                query = query.eq('university_short_name', university_code.upper())
            if major_code := request.query_params.get('major_code'):
                query = query.eq('major_code', major_code)
            if major_name := request.query_params.get('major_name'):
                major_codes = _major_codes_by_name(client, major_name)
                if not major_codes:
                    return {'count': 0, 'page': 1, 'page_size': DEFAULT_PAGE_SIZE, 'results': []}
                query = query.in_('major_code', major_codes)

            query = query.order('university_short_name').order('major_code').order('program_source_code')
            return paginate(request, query)

        return Response(get_or_set_api_payload(request, 'programs:list:v3', load, timeout=180))

    @extend_schema(summary='Chi tiet chuong trinh dao tao')
    def retrieve(self, request, pk=None):
        def load():
            response = (
                get_client()
                .table('university_programs')
                .select(self._SELECT)
                .eq('id', pk)
                .eq('is_active', True)
                .maybe_single()
                .execute()
            )
            return response.data

        payload = get_or_set_api_payload(request, f'programs:detail:v3:{pk}', load, timeout=600)
        if not payload:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)

    @extend_schema(summary='Diem trung tuyen cua mot chuong trinh')
    @action(detail=True, methods=['get'])
    def scores(self, request, pk=None):
        def load():
            query = (
                get_client()
                .table('admission_scores')
                .select(
                    'id, year, score, normalized_score, normalized_scale, note, '
                    'variant_key, source_program_code, variant_label, gender, region_code, '
                    'subject_group_code, admission_method_code, admission_methods(code, name)',
                    count='exact',
                )
                .eq('university_program_id', pk)
                .order('year', desc=True)
                .order('score', desc=True)
            )
            return paginate(request, query)

        return Response(get_or_set_api_payload(request, f'programs:scores:v2:{pk}', load, timeout=180))


class AdmissionScoreViewSet(ViewSet):
    authentication_classes = [SupabaseAuthentication]
    _SELECT = (
        'id, year, score, normalized_score, normalized_scale, note, '
        'variant_key, source_program_code, variant_label, gender, region_code, subject_group_code, '
        'admission_method_code, admission_methods(code, name), '
        'university_program_id, '
        'university_programs('
        '  id, university_short_name, major_code, '
        '  universities!university_programs_university_short_name_fkey(id, name, code), '
        '  major_catalog(code, name)'
        ')'
    )
    _ORDERABLE_FIELDS = {'year', 'score'}

    @extend_schema(
        parameters=[
            OpenApiParameter('university_code', str, description='Ma truong'),
            OpenApiParameter('major_code', str, description='Ma nganh'),
            OpenApiParameter('admission_method', str, description='Ma phuong thuc'),
            OpenApiParameter('year', int, description='Nam tuyen sinh'),
            OpenApiParameter('year_min', int, description='Nam tu'),
            OpenApiParameter('year_max', int, description='Nam den'),
            OpenApiParameter('score_min', float, description='Diem tu'),
            OpenApiParameter('score_max', float, description='Diem den'),
            OpenApiParameter('program_ids', str, description='Toi da 100 UUID university_program_id, tach boi dau phay'),
            OpenApiParameter('ordering', str, description='Sap xep theo year, score. Ho tro nhieu truong, vd: -year,-score'),
        ],
        summary='Danh sach diem trung tuyen',
    )
    def list(self, request):
        try:
            program_ids = _parse_uuid_csv_param(request.query_params.get('program_ids'))
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)

        def load():
            query = get_client().table('admission_scores').select(self._SELECT, count='exact')
            params = request.query_params

            if year := params.get('year'):
                query = query.eq('year', year)
            if year_min := params.get('year_min'):
                query = query.gte('year', year_min)
            if year_max := params.get('year_max'):
                query = query.lte('year', year_max)
            if score_min := params.get('score_min'):
                query = query.gte('score', score_min)
            if score_max := params.get('score_max'):
                query = query.lte('score', score_max)
            if method := params.get('admission_method'):
                query = query.eq('admission_method_code', method.upper())
            if program_ids is not None:
                query = query.in_('university_program_id', program_ids)
            if university_code := params.get('university_code'):
                query = query.eq('university_programs.university_short_name', university_code.upper())
            if major_code := params.get('major_code'):
                query = query.eq('university_programs.major_code', major_code)

            query = apply_ordering(
                query,
                params.get('ordering'),
                allowed_fields=self._ORDERABLE_FIELDS,
                default='-year,-score',
            )
            return paginate(request, query)

        return Response(get_or_set_api_payload(request, 'scores:list', load, timeout=120))

    @extend_schema(summary='Chi tiet diem trung tuyen')
    def retrieve(self, request, pk=None):
        def load():
            response = (
                get_client()
                .table('admission_scores')
                .select(self._SELECT)
                .eq('id', pk)
                .maybe_single()
                .execute()
            )
            return response.data

        payload = get_or_set_api_payload(request, f'scores:detail:{pk}', load, timeout=600)
        if not payload:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)

    @extend_schema(
        summary='Upsert nhieu diem trung tuyen',
        description='Chen hoac cap nhat diem theo chuong trinh, phuong thuc, nam va bien the cutoff.',
    )
    @action(detail=False, methods=['post'], url_path='bulk-upsert', permission_classes=[IsAuthenticated])
    def bulk_upsert(self, request):
        if not getattr(request.user, 'is_staff', False):
            return Response({'detail': 'You do not have permission to perform this action.'}, status=status.HTTP_403_FORBIDDEN)

        items = request.data.get('items')
        if not isinstance(items, list) or not items:
            return Response({'detail': 'items is required.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = BulkAdmissionScoreItemSerializer(data=items, many=True)
        serializer.is_valid(raise_exception=True)

        rows = list(serializer.data)
        response = get_user_client(request.auth).table('admission_scores').upsert(
            rows,
            on_conflict='university_program_id,admission_method_code,year,variant_key',
        ).execute()

        return Response(
            {'inserted': len(response.data or []), 'results': response.data or []},
            status=status.HTTP_200_OK,
        )
