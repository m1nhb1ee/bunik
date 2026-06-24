import re

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from core.api.cache import get_or_set_api_payload
from core.supabase_client import apply_ordering, get_client, paginate, parse_bool_param


def _sanitize_postgrest_search(value):
    text = re.sub(r'[,()*]', ' ', (value or '').strip())
    text = text.replace('%', '').replace('_', '')
    return re.sub(r'\s+', ' ', text).strip()


class ProvinceViewSet(ViewSet):
    @extend_schema(
        parameters=[OpenApiParameter('search', str, description='Tim theo ten')],
        summary='Danh sach tinh/thanh',
    )
    def list(self, request):
        def load():
            query = get_client().table('provinces').select('*', count='exact').order('name')
            if search := request.query_params.get('search'):
                query = query.ilike('name', f'%{search}%')
            return paginate(request, query)

        return Response(get_or_set_api_payload(request, 'provinces:list', load, timeout=300))

    @extend_schema(summary='Chi tiet tinh/thanh')
    def retrieve(self, request, pk=None):
        def load():
            response = get_client().table('provinces').select('*').eq('id', pk).maybe_single().execute()
            return response.data

        payload = get_or_set_api_payload(request, f'provinces:detail:{pk}', load, timeout=1800)
        if not payload:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)


class UniversityViewSet(ViewSet):
    _SELECT_LIST = 'id, name, code, type, is_active, province_id, provinces(id, code, name, region)'
    _SELECT_DETAIL = '*, provinces(*)'
    _SELECT_SCORES = (
        'id, year, score, normalized_score, normalized_scale, note, '
        'variant_key, source_program_code, variant_label, gender, region_code, subject_group_code, '
        'admission_method_code, admission_methods(code, name), '
        'university_program_id, '
        'university_programs!inner('
        '  id, university_short_name, major_code, '
        '  universities!university_programs_university_short_name_fkey(id, name, code), '
        '  major_catalog(code, name)'
        ')'
    )
    _ORDERABLE_FIELDS = {'name', 'code', 'type', 'created_at', 'updated_at'}

    @extend_schema(
        parameters=[
            OpenApiParameter('search', str, description='Tim theo ten hoac ma truong'),
            OpenApiParameter('type', str, description='Loai truong'),
            OpenApiParameter('province', int, description='ID tinh/thanh'),
            OpenApiParameter('is_active', bool, description='Con hoat dong'),
            OpenApiParameter('ordering', str, description='Sap xep theo name, code, type, created_at, updated_at'),
        ],
        summary='Danh sach truong dai hoc',
    )
    def list(self, request):
        def load():
            query = get_client().table('universities').select(self._SELECT_LIST, count='exact')

            is_active_raw = request.query_params.get('is_active')
            is_active = parse_bool_param(is_active_raw, default=True)
            if (is_active_raw or '').lower() != 'all' and is_active is not None:
                query = query.eq('is_active', is_active)

            if type_ := request.query_params.get('type'):
                query = query.eq('type', type_)
            if province := request.query_params.get('province'):
                query = query.eq('province_id', province)
            if search := request.query_params.get('search'):
                safe_search = _sanitize_postgrest_search(search)
                if safe_search:
                    query = query.or_(f'name.ilike.%{safe_search}%,code.ilike.%{safe_search}%')

            query = apply_ordering(
                query,
                request.query_params.get('ordering'),
                allowed_fields=self._ORDERABLE_FIELDS,
                default='name',
            )
            return paginate(request, query)

        return Response(get_or_set_api_payload(request, 'universities:list', load, timeout=180))

    @extend_schema(summary='Chi tiet truong dai hoc')
    def retrieve(self, request, pk=None):
        def load():
            response = (
                get_client()
                .table('universities')
                .select(self._SELECT_DETAIL)
                .eq('id', pk)
                .maybe_single()
                .execute()
            )
            return response.data

        payload = get_or_set_api_payload(request, f'universities:detail:{pk}', load, timeout=600)
        if not payload:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)

    @extend_schema(summary='Chi tiet truong va diem trung tuyen theo ma truong')
    @action(detail=False, methods=['get'], url_path=r'by-code/(?P<code>[^/.]+)/detail')
    def detail_by_code(self, request, code=None):
        university_code = (code or '').strip().upper()

        def load():
            client = get_client()
            university_response = (
                client
                .table('universities')
                .select(self._SELECT_DETAIL)
                .eq('code', university_code)
                .maybe_single()
                .execute()
            )
            if not university_response.data:
                return None

            score_response = (
                client
                .table('admission_scores')
                .select(self._SELECT_SCORES)
                .eq('university_programs.university_short_name', university_code)
                .eq('university_programs.is_active', True)
                .order('year', desc=True)
                .order('score', desc=True)
                .execute()
            )
            return {
                'university': university_response.data,
                'scores': score_response.data or [],
            }

        payload = get_or_set_api_payload(
            request,
            f'universities:detail-by-code:{university_code}',
            load,
            timeout=600,
        )
        if not payload:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)
