from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet
from datetime import date

from core.api.cache import get_or_set_api_payload
from core.supabase_client import get_client, paginate, parse_bool_param, parse_float_param, parse_int_param


EXAM_BLOCKS = [
    {'code': 'A00', 'name': 'Toan - Ly - Hoa', 'subjects': ['Toan', 'Ly', 'Hoa']},
    {'code': 'A01', 'name': 'Toan - Ly - Anh', 'subjects': ['Toan', 'Ly', 'Anh']},
    {'code': 'B00', 'name': 'Toan - Hoa - Sinh', 'subjects': ['Toan', 'Hoa', 'Sinh']},
    {'code': 'C00', 'name': 'Van - Su - Dia', 'subjects': ['Van', 'Su', 'Dia']},
    {'code': 'D01', 'name': 'Toan - Van - Anh', 'subjects': ['Toan', 'Van', 'Anh']},
    {'code': 'V00', 'name': 'Khoi V (Kien truc)', 'subjects': ['Toan', 'Ly', 'Ve']},
    {'code': 'DGNL', 'name': 'Danh gia nang luc', 'subjects': ['Tat ca']},
]

INTEREST_KEYWORDS = {
    'math': {'toan', 'ky thuat', 'cong nghe'},
    'science': {'khoa hoc', 'sinh', 'hoa', 'ly'},
    'art': {'nghe', 'thiet ke', 'my thuat'},
    'communication': {'truyen thong', 'quan he', 'giao tiep'},
    'tech': {'cong nghe', 'phan mem', 'may tinh'},
    'business': {'kinh te', 'quan tri', 'thuong mai'},
    'health': {'y', 'duoc', 'dieu duong'},
    'education': {'su pham', 'giao duc'},
    'law': {'luat'},
    'language': {'ngon ngu'},
    'architecture': {'kien truc', 'xay dung'},
    'music': {'am nhac'},
}


def _static_paginated_payload(rows):
    return {
        'count': len(rows),
        'page': 1,
        'page_size': len(rows),
        'results': rows,
    }


def _fetch_all_rows(query_factory, page_size=1000):
    rows = []
    start = 0
    while True:
        end = start + page_size - 1
        response = query_factory().range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return rows


def _is_scale_40(score_value, note):
    if score_value is None:
        return False
    try:
        numeric_score = float(score_value)
    except (TypeError, ValueError):
        return False
    if numeric_score >= 30:
        return True
    note_text = (note or '').lower()
    return 'thang diem 40' in note_text or 'thang điểm 40' in note_text


def _last_year():
    return date.today().year - 1


def _thpt_last_year_program_ids(client):
    last_year = _last_year()
    rows = _fetch_all_rows(
        lambda: (
            client.table('admission_scores')
            .select('university_program_id')
            .eq('admission_method_code', 'THPT')
            .eq('year', last_year)
        )
    )
    return {row.get('university_program_id') for row in rows if row.get('university_program_id')}


def _active_major_codes(client):
    programs = _fetch_all_rows(
        lambda: (
            client.table('university_programs')
            .select('major_code')
            .eq('is_active', True)
        )
    )
    return {row.get('major_code') for row in programs if row.get('major_code')}


def _major_overview_rows():
    client = get_client()
    last_year = _last_year()
    thpt_last_year_program_ids = _thpt_last_year_program_ids(client)
    if not thpt_last_year_program_ids:
        return []

    programs = _fetch_all_rows(
        lambda: (
            client.table('university_programs')
            .select(
                'id, university_short_name, major_code, program_name, '
                'universities!university_programs_university_short_name_fkey(name), '
                'major_catalog(code, name, field_code, fields(description), major_subject_groups(subject_group_code))'
            )
            .eq('is_active', True)
        )
    )
    programs = [program for program in programs if program.get('id') in thpt_last_year_program_ids]
    if not programs:
        return []

    scores = _fetch_all_rows(
        lambda: (
            client.table('admission_scores')
            .select('score, note, year, university_program_id')
            .eq('admission_method_code', 'THPT')
            .eq('year', last_year)
        )
    )

    program_by_id = {program.get('id'): program for program in programs if program.get('id')}

    scores_by_program = {}
    for score in scores:
        score_value = score.get('score')
        program = program_by_id.get(score.get('university_program_id'))
        if score_value is None or not program:
            continue
        program_id = program.get('id')
        year = str(score.get('year'))
        if not program_id or year != str(last_year):
            continue
        year_scores = scores_by_program.setdefault(program_id, {})
        year_scores[year] = max(year_scores.get(year, score_value), score_value)

    normalized_scores_by_program = {}
    for score_row in scores:
        program_id = score_row.get('university_program_id')
        score_value = score_row.get('score')
        if not program_id or score_value is None:
            continue
        numeric_score = float(score_value)
        if _is_scale_40(numeric_score, score_row.get('note')):
            score_40 = numeric_score
            score_30 = round((numeric_score * 30.0) / 40.0, 2)
        else:
            score_30 = numeric_score
            score_40 = round((numeric_score * 40.0) / 30.0, 2)
        bucket = normalized_scores_by_program.setdefault(program_id, {'score_30': None, 'score_40': None, 'raw': None})
        bucket['score_30'] = max(bucket['score_30'], score_30) if bucket['score_30'] is not None else score_30
        bucket['score_40'] = max(bucket['score_40'], score_40) if bucket['score_40'] is not None else score_40
        bucket['raw'] = max(bucket['raw'], numeric_score) if bucket['raw'] is not None else numeric_score

    rows = []
    for program in programs:
        major = program.get('major_catalog') or {}
        code = major.get('code') or program.get('major_code')
        if not code:
            continue
        blocks = [
            item.get('subject_group_code')
            for item in major.get('major_subject_groups') or []
            if item.get('subject_group_code')
        ]
        normalized = normalized_scores_by_program.get(program.get('id')) or {}
        best_score_30 = normalized.get('score_30')
        best_score_40 = normalized.get('score_40')
        best_raw_score = normalized.get('raw')

        rows.append({
            'id': program.get('id'),
            'code': code,
            'name': major.get('name'),
            'group': (major.get('fields') or {}).get('description') or major.get('field_code') or '',
            'program_name': program.get('program_name') or major.get('name'),
            'blocks': blocks,
            'university_short_name': program.get('university_short_name') or '',
            'university_name': (program.get('universities') or {}).get('name') or '',
            'scores': {str(last_year): best_raw_score} if best_raw_score is not None else {},
            'score_30': best_score_30,
            'score_40': best_score_40,
        })
    rows.sort(key=lambda item: ((item.get('code') or ''), (item.get('university_short_name') or '')))
    return rows


class ExamBlockViewSet(ViewSet):
    @extend_schema(summary='Danh sach khoi xet tuyen')
    def list(self, request):
        return Response(_static_paginated_payload(EXAM_BLOCKS))

    @extend_schema(summary='Chi tiet khoi xet tuyen')
    def retrieve(self, request, pk=None):
        block = next((item for item in EXAM_BLOCKS if item['code'] == pk), None)
        if not block:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(block)


class FieldViewSet(ViewSet):
    @extend_schema(summary='Danh sach linh vuc dao tao')
    def list(self, request):
        def load():
            query = get_client().table('fields').select('*', count='exact').order('code')
            if search := request.query_params.get('search'):
                query = query.or_(f'code.ilike.%{search}%,description.ilike.%{search}%')
            return paginate(request, query)

        return Response(get_or_set_api_payload(request, 'fields:list', load, timeout=300))

    @extend_schema(summary='Chi tiet linh vuc')
    def retrieve(self, request, pk=None):
        def load():
            response = get_client().table('fields').select('*').eq('id', pk).maybe_single().execute()
            return response.data

        payload = get_or_set_api_payload(request, f'fields:detail:{pk}', load, timeout=1800)
        if not payload:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)


class SubjectGroupViewSet(ViewSet):
    @extend_schema(
        parameters=[OpenApiParameter('search', str, description='Tim theo ma hoac mon hoc')],
        summary='Danh sach to hop mon',
    )
    def list(self, request):
        def load():
            query = get_client().table('subject_groups').select('*', count='exact').order('code')
            if search := request.query_params.get('search'):
                query = query.or_(
                    f'code.ilike.%{search}%,'
                    f'subject_1.ilike.%{search}%,'
                    f'subject_2.ilike.%{search}%,'
                    f'subject_3.ilike.%{search}%'
                )
            return paginate(request, query)

        return Response(get_or_set_api_payload(request, 'subject-groups:list', load, timeout=300))

    @extend_schema(summary='Chi tiet to hop mon')
    def retrieve(self, request, pk=None):
        def load():
            response = get_client().table('subject_groups').select('*').eq('code', pk).maybe_single().execute()
            return response.data

        payload = get_or_set_api_payload(request, f'subject-groups:detail:{pk}', load, timeout=1800)
        if not payload:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)


class MajorCatalogViewSet(ViewSet):
    _SELECT_LIST = (
        'code, name, field_code, fields(id, code, description), '
        'major_subject_groups(subject_group_code)'
    )
    _SELECT_DETAIL = '*, fields(*), major_subject_groups(subject_group_code, subject_groups(*))'

    @extend_schema(
        parameters=[
            OpenApiParameter('search', str, description='Tim theo ma hoac ten nganh'),
            OpenApiParameter('field', str, description='Ma linh vuc'),
        ],
        summary='Danh sach nganh dao tao',
    )
    def list(self, request):
        def load():
            client = get_client()
            search = (request.query_params.get('search') or '').strip()
            field = (request.query_params.get('field') or '').strip()
            page = parse_int_param(request.query_params.get('page'), default=1, minimum=1)
            page_size = parse_int_param(request.query_params.get('page_size'), default=20, minimum=1, maximum=200)
            thpt_last_year_program_ids = _thpt_last_year_program_ids(client)
            if not thpt_last_year_program_ids:
                return _static_paginated_payload([])

            query = (
                client.table('university_programs')
                .select(
                    'id, university_short_name, major_code, program_name, '
                    'universities!university_programs_university_short_name_fkey(name), '
                    'major_catalog(code, name, field_code, fields(id, code, description), major_subject_groups(subject_group_code))',
                    count='exact',
                )
                .eq('is_active', True)
                .in_('id', list(thpt_last_year_program_ids))
                .order('major_code')
                .order('university_short_name')
            )
            if search:
                query = query.or_(
                    f'major_code.ilike.%{search}%,'
                    f'program_name.ilike.%{search}%,'
                    f'major_catalog.name.ilike.%{search}%'
                )
            if field:
                query = query.eq('major_catalog.field_code', field)

            start = (page - 1) * page_size
            end = start + page_size - 1
            response = query.range(start, end).execute()
            rows = response.data or []
            results = []
            for row in rows:
                major = row.get('major_catalog') or {}
                results.append({
                    'id': row.get('id'),
                    'code': major.get('code') or row.get('major_code'),
                    'name': major.get('name'),
                    'program_name': row.get('program_name') or major.get('name'),
                    'field_code': major.get('field_code'),
                    'fields': major.get('fields') or {},
                    'major_subject_groups': major.get('major_subject_groups') or [],
                    'university_short_name': row.get('university_short_name'),
                    'university_name': (row.get('universities') or {}).get('name'),
                })

            return {
                'count': response.count or 0,
                'page': page,
                'page_size': page_size,
                'results': results,
            }

        return Response(get_or_set_api_payload(request, 'majors:list:v3', load, timeout=300))

    @extend_schema(summary='Du lieu bang nganh hoc da tong hop')
    @action(detail=False, methods=['get'], url_path='overview')
    def overview(self, request):
        def load():
            rows = _major_overview_rows()
            return _static_paginated_payload(rows)

        return Response(get_or_set_api_payload(request, 'majors:overview:v3', load, timeout=600))

    @extend_schema(
        parameters=[
            OpenApiParameter('interests', str, description='Danh sach so thich, tach boi dau phay'),
            OpenApiParameter('block', str, description='Khoi xet tuyen'),
            OpenApiParameter('score_min', float, description='Diem toi thieu'),
            OpenApiParameter('score_max', float, description='Diem toi da'),
            OpenApiParameter('is_chuyen_class', bool, description='Hoc sinh truong chuyen'),
            OpenApiParameter('limit', int, description='So ket qua toi da'),
        ],
        summary='Goi y nganh phu hop',
    )
    @action(detail=False, methods=['get'], url_path='recommendations')
    def recommendations(self, request):
        def load():
            interests = {
                value.strip().lower()
                for value in (request.query_params.get('interests') or '').split(',')
                if value.strip()
            }
            block = (request.query_params.get('block') or '').strip().upper()
            score_min = parse_float_param(request.query_params.get('score_min'), default=0, minimum=0, maximum=30)
            score_max = parse_float_param(request.query_params.get('score_max'), default=30, minimum=0, maximum=30)
            if score_max < score_min:
                score_max = score_min
            is_chuyen_class = parse_bool_param(request.query_params.get('is_chuyen_class'))
            limit = parse_int_param(request.query_params.get('limit'), default=10, minimum=1, maximum=30)

            client = get_client()
            thpt_last_year_program_ids = _thpt_last_year_program_ids(client)
            if not thpt_last_year_program_ids:
                return []

            programs = _fetch_all_rows(
                lambda: (
                    client.table('university_programs')
                    .select(
                        'id, university_short_name, major_code, program_name, '
                        'universities!university_programs_university_short_name_fkey(name), '
                        'major_catalog(code, name, field_code, fields(description), major_subject_groups(subject_group_code))'
                    )
                    .eq('is_active', True)
                )
            )
            programs = [program for program in programs if program.get('id') in thpt_last_year_program_ids]
            if not programs:
                return []

            scores = _fetch_all_rows(
                lambda: (
                    client.table('admission_scores')
                    .select('score, year, university_program_id')
                    .order('year', desc=True)
                )
            )
            latest_score_by_program = {}
            for row in scores:
                program_id = row.get('university_program_id')
                score_value = row.get('score')
                if program_id and score_value is not None and program_id not in latest_score_by_program:
                    latest_score_by_program[program_id] = float(score_value)

            target_score = (score_min + score_max) / 2
            recommendations = []
            for program in programs:
                major = program.get('major_catalog') or {}
                major_code = major.get('code') or program.get('major_code')
                if not major_code:
                    continue
                name = (major.get('name') or '').lower()
                group_name = ((major.get('fields') or {}).get('description') or '')
                block_codes = [
                    item.get('subject_group_code')
                    for item in (major.get('major_subject_groups') or [])
                    if item.get('subject_group_code')
                ]

                if block and block not in block_codes:
                    continue

                interest_match = 25
                if interests:
                    matched = 0
                    for interest in interests:
                        keywords = INTEREST_KEYWORDS.get(interest, set())
                        if any(keyword in name for keyword in keywords):
                            matched += 1
                    interest_match = int((matched / len(interests)) * 50) if interests else 25

                block_match = 30 if block else 0
                latest_score = latest_score_by_program.get(program.get('id'))
                score_match = 15
                if latest_score is not None:
                    distance = abs(latest_score - target_score)
                    score_match = max(0, int(20 - distance * 3))
                    if latest_score < score_min - 3 or latest_score > score_max + 3:
                        continue

                bonus = 5 if is_chuyen_class is True and latest_score is not None and latest_score >= 25 else 0
                match_score = max(0, min(100, interest_match + block_match + score_match + bonus))

                recommendations.append({
                    'id': program.get('id'),
                    'code': major_code,
                    'name': major.get('name'),
                    'program_name': program.get('program_name') or major.get('name'),
                    'group': group_name,
                    'block': block_codes[0] if block_codes else '',
                    'blocks': block_codes,
                    'score_2025': latest_score,
                    'match_score': match_score,
                    'university_short_name': program.get('university_short_name'),
                    'university_name': (program.get('universities') or {}).get('name'),
                })

            recommendations.sort(key=lambda item: item['match_score'], reverse=True)
            return recommendations[:limit]

        return Response(get_or_set_api_payload(request, 'majors:recommendations:v3', load, timeout=600))

    @extend_schema(summary='Chi tiet nganh dao tao (kem to hop mon)')
    def retrieve(self, request, pk=None):
        def load():
            client = get_client()
            active_major_codes = _active_major_codes(client)
            if pk not in active_major_codes:
                return None

            response = (
                client
                .table('major_catalog')
                .select(self._SELECT_DETAIL)
                .eq('code', pk)
                .maybe_single()
                .execute()
            )
            return response.data

        payload = get_or_set_api_payload(request, f'majors:detail:v2:{pk}', load, timeout=1800)
        if not payload:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(payload)

    @extend_schema(summary='To hop mon cua mot nganh')
    @action(detail=True, methods=['get'], url_path='subject-groups')
    def subject_groups(self, request, pk=None):
        def load():
            client = get_client()
            active_major_codes = _active_major_codes(client)
            if pk not in active_major_codes:
                return []

            response = (
                client
                .table('major_subject_groups')
                .select('subject_group_code, subject_groups(*)')
                .eq('major_code', pk)
                .execute()
            )
            return response.data or []

        return Response(get_or_set_api_payload(request, f'majors:subject-groups:v2:{pk}', load, timeout=1800))
