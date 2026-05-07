from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from core.api.cache import get_or_set_api_payload
from core.supabase_client import apply_ordering, get_client, paginate, parse_bool_param


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
                query = query.or_(f'name.ilike.%{search}%,code.ilike.%{search}%')

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
