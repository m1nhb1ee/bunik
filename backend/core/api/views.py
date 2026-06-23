from collections import defaultdict
from datetime import date
from statistics import median

from rest_framework.response import Response
from rest_framework.views import APIView

from core.api.cache import get_or_set_api_payload
from core.supabase_client import MAX_PAGE_SIZE, get_client, parse_int_param


TREND_COLORS = ['#5B4FCF', '#FF6B6B', '#43D9A3', '#FFB347', '#FC8181']
SUBJECT_LABELS = {
    'math': 'Toan',
    'literature': 'Van',
    'english': 'Anh',
    'physics': 'Ly',
    'chemistry': 'Hoa',
    'biology': 'Sinh',
    'history': 'Su',
    'geography': 'Dia',
}
TIER_THRESHOLDS = (
    (90, 'S'),
    (80, 'A'),
    (70, 'B'),
    (60, 'C'),
    (45, 'D'),
    (30, 'E'),
)


def _paginate_rows(request, rows):
    page = parse_int_param(request.query_params.get('page'), default=1, minimum=1)
    page_size = parse_int_param(request.query_params.get('page_size'), default=20, minimum=1, maximum=MAX_PAGE_SIZE)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        'count': len(rows),
        'page': page,
        'page_size': page_size,
        'results': rows[start:end],
    }


def _fetch_all_rows(query_factory, page_size=1000, max_pages=20):
    rows = []
    for page in range(max_pages):
        start = page * page_size
        batch = query_factory().range(start, start + page_size - 1).execute().data or []
        rows.extend(batch)
        if len(batch) < page_size:
            return rows
    raise RuntimeError('Supabase fetch exceeded maximum page count')


def _score_to_tier(score: float) -> str:
    for threshold, tier in TIER_THRESHOLDS:
        if score >= threshold:
            return tier
    return 'F'


def _initials(name: str) -> str:
    parts = [part for part in (name or '').strip().split() if part]
    if not parts:
        return '?'
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f'{parts[0][0]}{parts[-1][0]}'.upper()


def _normalized_thpt_score(row):
    normalized = row.get('normalized_score')
    if normalized is not None:
        return float(normalized)
    score = float(row.get('score'))
    return round(score * 30 / 40, 2) if score > 30 else score


class RankingsListView(APIView):
    def get(self, request):
        def load():
            users = (
                get_client()
                .table('users')
                .select('id, user_name, full_name, special_score')
                .execute()
                .data
                or []
            )
            scores = (
                get_client()
                .table('score')
                .select(
                    'user_id, base_score, math, literature, english, physics, chemistry, biology, history, geography'
                )
                .execute()
                .data
                or []
            )
            score_by_user = {row.get('user_id'): row for row in scores if row.get('user_id')}

            rankings = []
            for row in users:
                score_row = score_by_user.get(row.get('id')) or {}
                if not score_row and row.get('special_score') is None:
                    continue
                subject_scores = {
                    key: float(score_row.get(key) or 0)
                    for key in SUBJECT_LABELS
                }
                base_score = score_row.get('base_score')
                if base_score is None:
                    base_score = sum(subject_scores.values())
                total_score = round(float(base_score or 0) + float(row.get('special_score') or 0), 2)
                top_subject_key = max(subject_scores, key=subject_scores.get, default='math')
                full_name = row.get('full_name') or row.get('user_name') or 'Nguoi dung'

                rankings.append({
                    'id': row.get('id'),
                    'name': full_name,
                    'tier': _score_to_tier(total_score),
                    'score': total_score,
                    'avatar': _initials(full_name),
                    'topSubject': SUBJECT_LABELS[top_subject_key],
                    'anonymous': False,
                })

            rankings.sort(key=lambda item: (-item['score'], item['name']))
            for index, item in enumerate(rankings, start=1):
                item['rank'] = index

            return _paginate_rows(request, rankings)

        return Response(get_or_set_api_payload(request, 'rankings:list:v2', load, timeout=120))


class MajorTrendsView(APIView):
    def get(self, request):
        def load():
            client = get_client()
            current_year = date.today().year
            latest = (
                client.table('admission_scores')
                .select('year')
                .eq('admission_method_code', 'THPT')
                .gt('score', 0)
                .order('year', desc=True)
                .limit(1)
                .execute()
                .data
                or []
            )
            if not latest:
                return _paginate_rows(request, [])
            end_year = min(int(latest[0]['year']), current_year)
            scores = _fetch_all_rows(
                lambda: client.table('admission_scores')
                .select(
                    'year, score, normalized_score, university_program_id, '
                    'university_programs!inner(major_code)'
                )
                .eq('admission_method_code', 'THPT')
                .gt('score', 0)
                .gte('year', end_year - 4)
                .lte('year', end_year)
            )
            majors = (
                client.table('major_catalog')
                .select('code, name')
                .execute()
                .data
                or []
            )
            major_names = {major.get('code'): major.get('name') for major in majors}
            program_scores = defaultdict(list)

            for row in scores:
                major_code = (row.get('university_programs') or {}).get('major_code')
                year = row.get('year')
                program_id = row.get('university_program_id')
                if major_code and year and program_id and row.get('score') is not None:
                    program_scores[(major_code, int(year), program_id)].append(_normalized_thpt_score(row))

            grouped_scores = defaultdict(lambda: defaultdict(list))
            for (major_code, year, _program_id), values in program_scores.items():
                grouped_scores[major_code][year].append(float(median(values)))

            results = []
            for major_code, yearly_scores in grouped_scores.items():
                series = []
                for year in range(end_year - 4, end_year + 1):
                    values = yearly_scores.get(year, [])
                    series.append(round(sum(values) / len(values), 2) if values else 0)
                if any(series):
                    results.append({
                        'name': major_names.get(major_code) or major_code,
                        'scores': series,
                    })

            results.sort(key=lambda item: item['scores'][-1], reverse=True)
            top_results = results[:5]
            for index, item in enumerate(top_results):
                item['color'] = TREND_COLORS[index % len(TREND_COLORS)]
            return _paginate_rows(request, top_results)

        return Response(get_or_set_api_payload(request, 'major-trends:list:v3', load, timeout=300))
