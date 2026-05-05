from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter

from core.supabase_client import get_client, paginate


# Static exam block reference data
EXAM_BLOCKS = [
    {'code': 'A00', 'name': 'Toán – Lý – Hóa', 'subjects': ['Toán', 'Lý', 'Hóa']},
    {'code': 'A01', 'name': 'Toán – Lý – Anh', 'subjects': ['Toán', 'Lý', 'Anh']},
    {'code': 'B00', 'name': 'Toán – Hóa – Sinh', 'subjects': ['Toán', 'Hóa', 'Sinh']},
    {'code': 'C00', 'name': 'Văn – Sử – Địa', 'subjects': ['Văn', 'Sử', 'Địa']},
    {'code': 'D01', 'name': 'Toán – Văn – Anh', 'subjects': ['Toán', 'Văn', 'Anh']},
    {'code': 'V00', 'name': 'Khối V (Kiến trúc)', 'subjects': ['Toán', 'Lý', 'Vẽ']},
    {'code': 'ĐGNL', 'name': 'Đánh giá năng lực', 'subjects': ['Tất cả']},
]


class ExamBlockViewSet(ViewSet):
    @extend_schema(summary='Danh sách khối xét tuyển')
    def list(self, request):
        return Response({
            'count': len(EXAM_BLOCKS),
            'page': 1,
            'page_size': len(EXAM_BLOCKS),
            'results': EXAM_BLOCKS,
        })

    @extend_schema(summary='Chi tiết khối xét tuyển')
    def retrieve(self, request, pk=None):
        block = next((b for b in EXAM_BLOCKS if b['code'] == pk), None)
        if not block:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(block)


class FieldViewSet(ViewSet):
    @extend_schema(summary='Danh sách lĩnh vực đào tạo')
    def list(self, request):
        q = get_client().table('fields').select('*', count='exact').order('code')
        if search := request.query_params.get('search'):
            q = q.or_(f'code.ilike.%{search}%,description.ilike.%{search}%')
        return Response(paginate(request, q))

    @extend_schema(summary='Chi tiết lĩnh vực')
    def retrieve(self, request, pk=None):
        r = get_client().table('fields').select('*').eq('id', pk).maybe_single().execute()
        if not r.data:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(r.data)


class SubjectGroupViewSet(ViewSet):
    @extend_schema(
        parameters=[OpenApiParameter('search', str, description='Tìm theo mã hoặc môn học')],
        summary='Danh sách tổ hợp môn',
    )
    def list(self, request):
        q = get_client().table('subject_groups').select('*', count='exact').order('code')
        if search := request.query_params.get('search'):
            q = q.or_(
                f'code.ilike.%{search}%,'
                f'subject_1.ilike.%{search}%,'
                f'subject_2.ilike.%{search}%,'
                f'subject_3.ilike.%{search}%'
            )
        return Response(paginate(request, q))

    @extend_schema(summary='Chi tiết tổ hợp môn')
    def retrieve(self, request, pk=None):
        r = get_client().table('subject_groups').select('*').eq('code', pk).maybe_single().execute()
        if not r.data:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(r.data)


class MajorCatalogViewSet(ViewSet):
    _SELECT_LIST = 'code, name, field_code, fields(id, code, description)'
    _SELECT_DETAIL = '*, fields(*), major_subject_groups(subject_group_code, subject_groups(*))'

    @extend_schema(
        parameters=[
            OpenApiParameter('search', str, description='Tìm theo mã hoặc tên ngành'),
            OpenApiParameter('field', str, description='Mã lĩnh vực (field_code)'),
        ],
        summary='Danh sách ngành đào tạo',
    )
    def list(self, request):
        q = get_client().table('major_catalog').select(self._SELECT_LIST, count='exact').order('code')
        if search := request.query_params.get('search'):
            q = q.or_(f'code.ilike.%{search}%,name.ilike.%{search}%')
        if field := request.query_params.get('field'):
            q = q.eq('field_code', field)
        return Response(paginate(request, q))

    @extend_schema(summary='Chi tiết ngành đào tạo (kèm tổ hợp môn)')
    def retrieve(self, request, pk=None):
        r = (
            get_client()
            .table('major_catalog')
            .select(self._SELECT_DETAIL)
            .eq('code', pk)
            .maybe_single()
            .execute()
        )
        if not r.data:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(r.data)

    @extend_schema(summary='Tổ hợp môn của một ngành')
    @action(detail=True, methods=['get'], url_path='subject-groups')
    def subject_groups(self, request, pk=None):
        r = (
            get_client()
            .table('major_subject_groups')
            .select('subject_group_code, subject_groups(*)')
            .eq('major_code', pk)
            .execute()
        )
        return Response(r.data or [])
