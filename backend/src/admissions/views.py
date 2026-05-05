from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter

from core.supabase_client import get_client, paginate


class AdmissionMethodViewSet(ViewSet):
    @extend_schema(summary='Danh sách phương thức tuyển sinh')
    def list(self, request):
        r = get_client().table('admission_methods').select('*').order('code').execute()
        return Response(r.data or [])

    @extend_schema(summary='Chi tiết phương thức tuyển sinh')
    def retrieve(self, request, pk=None):
        r = (
            get_client()
            .table('admission_methods')
            .select('*')
            .eq('code', pk)
            .maybe_single()
            .execute()
        )
        if not r.data:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(r.data)


class UniversityProgramViewSet(ViewSet):
    _SELECT = (
        'id, university_short_name, major_code, is_active, '
        'universities!university_programs_university_short_name_fkey(id, name, code, type), '
        'major_catalog(code, name, field_code)'
    )

    @extend_schema(
        parameters=[
            OpenApiParameter('university_code', str, description='Mã trường (VD: BKA)'),
            OpenApiParameter('major_code', str, description='Mã ngành'),
            OpenApiParameter('field', str, description='Mã lĩnh vực'),
            OpenApiParameter('is_active', bool, description='Còn hoạt động'),
        ],
        summary='Danh sách chương trình đào tạo',
    )
    def list(self, request):
        q = get_client().table('university_programs').select(self._SELECT, count='exact')

        if university_code := request.query_params.get('university_code'):
            q = q.eq('university_short_name', university_code.upper())
        if major_code := request.query_params.get('major_code'):
            q = q.eq('major_code', major_code)
        if is_active := request.query_params.get('is_active'):
            q = q.eq('is_active', is_active.lower() == 'true')

        q = q.order('university_short_name').order('major_code')
        return Response(paginate(request, q))

    @extend_schema(summary='Chi tiết chương trình đào tạo')
    def retrieve(self, request, pk=None):
        r = (
            get_client()
            .table('university_programs')
            .select(self._SELECT)
            .eq('id', pk)
            .maybe_single()
            .execute()
        )
        if not r.data:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(r.data)

    @extend_schema(summary='Điểm trúng tuyển của một chương trình')
    @action(detail=True, methods=['get'])
    def scores(self, request, pk=None):
        q = (
            get_client()
            .table('admission_scores')
            .select('id, year, score, note, admission_method_code, admission_methods(code, name)', count='exact')
            .eq('university_program_id', pk)
            .order('year', desc=True)
            .order('score', desc=True)
        )
        return Response(paginate(request, q))


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

    @extend_schema(
        parameters=[
            OpenApiParameter('university_code', str, description='Mã trường (VD: BKA)'),
            OpenApiParameter('major_code', str, description='Mã ngành'),
            OpenApiParameter('admission_method', str, description='Mã phương thức (VD: THPT)'),
            OpenApiParameter('year', int, description='Năm tuyển sinh'),
            OpenApiParameter('year_min', int, description='Năm từ'),
            OpenApiParameter('year_max', int, description='Năm đến'),
            OpenApiParameter('score_min', float, description='Điểm từ'),
            OpenApiParameter('score_max', float, description='Điểm đến'),
        ],
        summary='Danh sách điểm trúng tuyển',
    )
    def list(self, request):
        q = get_client().table('admission_scores').select(self._SELECT, count='exact')

        p = request.query_params
        if year := p.get('year'):
            q = q.eq('year', year)
        if year_min := p.get('year_min'):
            q = q.gte('year', year_min)
        if year_max := p.get('year_max'):
            q = q.lte('year', year_max)
        if score_min := p.get('score_min'):
            q = q.gte('score', score_min)
        if score_max := p.get('score_max'):
            q = q.lte('score', score_max)
        if method := p.get('admission_method'):
            q = q.eq('admission_method_code', method.upper())
        if university_code := p.get('university_code'):
            q = q.eq('university_programs.university_short_name', university_code.upper())
        if major_code := p.get('major_code'):
            q = q.eq('university_programs.major_code', major_code)

        ordering = p.get('ordering', '-year')
        desc = ordering.startswith('-')
        q = q.order(ordering.lstrip('-'), desc=desc)

        return Response(paginate(request, q))

    @extend_schema(summary='Chi tiết điểm trúng tuyển')
    def retrieve(self, request, pk=None):
        r = (
            get_client()
            .table('admission_scores')
            .select(self._SELECT)
            .eq('id', pk)
            .maybe_single()
            .execute()
        )
        if not r.data:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(r.data)

    @extend_schema(
        summary='Upsert nhiều điểm trúng tuyển',
        description='Chèn hoặc cập nhật điểm. Mỗi item cần: university_program_id, admission_method_code, year, score.',
    )
    @action(detail=False, methods=['post'], url_path='bulk-upsert')
    def bulk_upsert(self, request):
        items = request.data.get('items', [])
        if not items:
            return Response({'detail': 'items is required.'}, status=status.HTTP_400_BAD_REQUEST)

        r = get_client().table('admission_scores').upsert(
            items,
            on_conflict='university_program_id,admission_method_code,year',
        ).execute()

        return Response(
            {'inserted': len(r.data or []), 'results': r.data or []},
            status=status.HTTP_200_OK,
        )
