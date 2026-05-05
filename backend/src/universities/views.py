from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter

from core.supabase_client import get_client, paginate


class ProvinceViewSet(ViewSet):
    @extend_schema(
        parameters=[OpenApiParameter('search', str, description='Tìm theo tên')],
        summary='Danh sách tỉnh/thành',
    )
    def list(self, request):
        q = get_client().table('provinces').select('*', count='exact').order('name')
        if search := request.query_params.get('search'):
            q = q.ilike('name', f'%{search}%')
        return Response(paginate(request, q))

    @extend_schema(summary='Chi tiết tỉnh/thành')
    def retrieve(self, request, pk=None):
        r = get_client().table('provinces').select('*').eq('id', pk).maybe_single().execute()
        if not r.data:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(r.data)


class UniversityViewSet(ViewSet):
    _SELECT_LIST = 'id, name, code, type, is_active, province_id, provinces(id, code, name, region)'
    _SELECT_DETAIL = '*, provinces(*)'

    @extend_schema(
        parameters=[
            OpenApiParameter('search', str, description='Tìm theo tên hoặc mã trường'),
            OpenApiParameter('type', str, description='Loại trường: công_lập | dân_lập | quân_sự | cao_đẳng'),
            OpenApiParameter('province', int, description='ID tỉnh/thành'),
            OpenApiParameter('is_active', bool, description='Còn hoạt động (mặc định: true)'),
        ],
        summary='Danh sách trường đại học',
    )
    def list(self, request):
        q = get_client().table('universities').select(self._SELECT_LIST, count='exact')

        is_active = request.query_params.get('is_active', 'true').lower()
        if is_active != 'all':
            q = q.eq('is_active', is_active == 'true')
        if type_ := request.query_params.get('type'):
            q = q.eq('type', type_)
        if province := request.query_params.get('province'):
            q = q.eq('province_id', province)
        if search := request.query_params.get('search'):
            q = q.or_(f'name.ilike.%{search}%,code.ilike.%{search}%')

        ordering = request.query_params.get('ordering', 'name')
        desc = ordering.startswith('-')
        q = q.order(ordering.lstrip('-'), desc=desc)

        return Response(paginate(request, q))

    @extend_schema(summary='Chi tiết trường đại học')
    def retrieve(self, request, pk=None):
        r = (
            get_client()
            .table('universities')
            .select(self._SELECT_DETAIL)
            .eq('id', pk)
            .maybe_single()
            .execute()
        )
        if not r.data:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(r.data)
