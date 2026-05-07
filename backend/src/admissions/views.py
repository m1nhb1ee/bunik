from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from core.api.cache import get_or_set_api_payload
from core.supabase_client import apply_ordering, get_client, paginate


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
        'id, university_short_name, major_code, is_active, '
        'universities!university_programs_university_short_name_fkey(id, name, code, type), '
        'major_catalog(code, name, field_code)'
    )

    @extend_schema(
        parameters=[
            OpenApiParameter('university_code', str, description='Ma truong'),
            OpenApiParameter('major_code', str, description='Ma nganh'),
            OpenApiParameter('is_active', bool, description='Con hoat dong'),
        ],
        summary='Danh sach chuong trinh dao tao',
    )
    def list(self, request):
        def load():
            query = (
                get_client()
                .table('university_programs')
                .select(self._SELECT, count='exact')
                .eq('is_active', True)
            )

            if university_code := request.query_params.get('university_code'):
                query = query.eq('university_short_name', university_code.upper())
            if major_code := request.query_params.get('major_code'):
                query = query.eq('major_code', major_code)

            query = query.order('university_short_name').order('major_code')
            return paginate(request, query)

        return Response(get_or_set_api_payload(request, 'programs:list:v2', load, timeout=180))

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

        payload = get_or_set_api_payload(request, f'programs:detail:v2:{pk}', load, timeout=600)
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
                    'id, year, score, note, admission_method_code, admission_methods(code, name)',
                    count='exact',
                )
                .eq('university_program_id', pk)
                .order('year', desc=True)
                .order('score', desc=True)
            )
            return paginate(request, query)

        return Response(get_or_set_api_payload(request, f'programs:scores:v2:{pk}', load, timeout=180))


class AdmissionScoreViewSet(ViewSet):
    _SELECT = (
        'id, year, score, note, '
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
            OpenApiParameter('ordering', str, description='Sap xep theo year, score. Ho tro nhieu truong, vd: -year,-score'),
        ],
        summary='Danh sach diem trung tuyen',
    )
    def list(self, request):
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
        description='Chen hoac cap nhat diem theo khoa hop university_program_id, admission_method_code, year.',
    )
    @action(detail=False, methods=['post'], url_path='bulk-upsert', permission_classes=[IsAuthenticated])
    def bulk_upsert(self, request):
        if not getattr(request.user, 'is_staff', False):
            return Response({'detail': 'You do not have permission to perform this action.'}, status=status.HTTP_403_FORBIDDEN)

        items = request.data.get('items')
        if not isinstance(items, list) or not items:
            return Response({'detail': 'items is required.'}, status=status.HTTP_400_BAD_REQUEST)

        response = get_client().table('admission_scores').upsert(
            items,
            on_conflict='university_program_id,admission_method_code,year',
        ).execute()

        return Response(
            {'inserted': len(response.data or []), 'results': response.data or []},
            status=status.HTTP_200_OK,
        )
