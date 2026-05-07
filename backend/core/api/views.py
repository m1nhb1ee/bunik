from collections import defaultdict
from datetime import date

from rest_framework.response import Response
from rest_framework.views import APIView

from core.api.cache import get_or_set_api_payload
from core.supabase_client import get_client, parse_int_param


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
    (150, 'S'),
    (100, 'A'),
    (90, 'B'),
    (75, 'C'),
    (60, 'D'),
    (45, 'E'),
)


def _paginate_rows(request, rows):
    page = parse_int_param(request.query_params.get('page'), default=1, minimum=1)
    page_size = parse_int_param(request.query_params.get('page_size'), default=20, minimum=1, maximum=100)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        'count': len(rows),
        'page': page,
        'page_size': page_size,
        'results': rows[start:end],
    }


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

        return Response(get_or_set_api_payload(request, 'rankings:list', load, timeout=120))


class MajorTrendsView(APIView):
    def get(self, request):
        def load():
            client = get_client()
            current_year = date.today().year
            scores = (
                client.table('admission_scores')
                .select('year, score, university_programs!inner(major_code)')
                .gte('year', current_year - 4)
                .lte('year', current_year)
                .execute()
                .data
                or []
            )
            majors = (
                client.table('major_catalog')
                .select('code, name')
                .execute()
                .data
                or []
            )
            major_names = {major.get('code'): major.get('name') for major in majors}
            grouped_scores = defaultdict(lambda: defaultdict(list))

            for row in scores:
                major_code = (row.get('university_programs') or {}).get('major_code')
                year = row.get('year')
                score = row.get('score')
                if major_code and year and score is not None:
                    grouped_scores[major_code][int(year)].append(float(score))

            results = []
            for major_code, yearly_scores in grouped_scores.items():
                series = []
                for year in range(current_year - 4, current_year + 1):
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

        return Response(get_or_set_api_payload(request, 'major-trends:list', load, timeout=300))
