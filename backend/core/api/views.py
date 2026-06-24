import unicodedata
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
CORE_SUBJECT_CODES = ('math', 'literature', 'english', 'history')
# Mirrors the frontend tier thresholds (mockData.getTierThreshold) so the
# ranking tier matches what the Hồ sơ page shows.
TIER_THRESHOLDS = (
    (150, 'S'),
    (100, 'A'),
    (90, 'B'),
    (75, 'C'),
    (60, 'D'),
    (45, 'E'),
)
SCORE_CAPS = {
    'base_score': 80.0,
    'special_score': 10.0,
    'award_bonus': 180.0,
    'certificate_bonus': 30.0,
}


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


def _cap_score(value: float, limit: float) -> float:
    return max(0.0, min(float(value or 0), limit))


def _normalize_text(value) -> str:
    text = unicodedata.normalize('NFD', value or '')
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    return text.replace('đ', 'd').replace('Đ', 'D').lower()


# Award bonus table — mirrors getAwardBaseBonus() in HoSoPage.tsx so the ranking
# score matches the Hồ sơ page. Keys: prize after normalization.
_AWARD_BONUS = {
    'quoc te': {'nhat': 100, 'nhi': 80, 'ba': 70, 'khuyen khich': 60},
    'quoc gia': {'nhat': 50, 'nhi': 40, 'ba': 35, 'khuyen khich': 30},
    'tinh': {'nhat': 20, 'nhi': 15, 'ba': 12, 'khuyen khich': 10},
}


def _award_bonus(level, prize) -> float:
    normalized_level = _normalize_text(level)
    prize_value = _normalize_text(prize)
    if prize_value not in {'nhat', 'nhi', 'ba'}:
        prize_value = 'khuyen khich'
    for level_key, prizes in _AWARD_BONUS.items():
        if level_key in normalized_level:
            return prizes[prize_value]
    return 0


def _award_bonus_total(achievements, award_level_by_id) -> float:
    if not achievements:
        return 0

    repeated_counts = defaultdict(int)
    total = 0.0

    for achievement in sorted(achievements, key=lambda item: item.get('id') or 0):
        level = award_level_by_id.get(achievement.get('award_id'))
        prize = achievement.get('prize')
        normalized_level = _normalize_text(level)
        prize_value = _normalize_text(prize)
        if prize_value not in {'nhat', 'nhi', 'ba'}:
            prize_value = 'khuyen khich'

        base_bonus = _award_bonus(level, prize)
        if base_bonus <= 0:
            continue

        if prize_value == 'khuyen khich':
            key = (normalized_level, prize_value)
            repeat_index = repeated_counts[key]
            total += base_bonus / (2 ** repeat_index)
            repeated_counts[key] += 1
        else:
            total += base_bonus

    return round(total, 2)


def _certificate_bonus(certificates) -> float:
    # IELTS counts ×2, SAT ÷100 — same as HoSoPage.tsx (first match wins).
    ielts = None
    sat = None
    for certificate in certificates or []:
        name = (certificate.get('name') or '').lower()
        if ielts is None and 'ielts' in name:
            ielts = float(certificate.get('score') or 0)
        if sat is None and 'sat' in name:
            sat = float(certificate.get('score') or 0)
    return (ielts or 0) * 2 + (sat or 0) / 100


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


def _legacy_base_score(score_row) -> float:
    if not score_row:
        return 0.0
    base_score = score_row.get('base_score')
    if base_score is not None:
        return _cap_score(base_score, SCORE_CAPS['base_score'])
    return _cap_score(sum(float(score_row.get(key) or 0) for key in SUBJECT_LABELS), SCORE_CAPS['base_score'])


def _academic_score_from_subject_profile(elective_codes, result_rows):
    selected_codes = [*CORE_SUBJECT_CODES, *list(elective_codes)]
    if len(elective_codes) != 4 or len(selected_codes) != 8:
        return 0.0, {}

    results_by_code = {row.get('subject_code'): row for row in result_rows if row.get('subject_code')}
    selected_results = [results_by_code.get(code) for code in selected_codes]
    if any(result is None for result in selected_results):
        return 0.0, results_by_code

    numeric_values = []
    passed_count = 0
    for code in selected_codes:
        result = results_by_code.get(code) or {}
        numeric_score = result.get('numeric_score')
        assessment_status = result.get('assessment_status')
        if numeric_score is not None:
            numeric_values.append(float(numeric_score))
            continue
        if assessment_status == 'PASSED':
            passed_count += 1
            continue
        if assessment_status == 'FAILED':
            continue
        return 0.0, results_by_code

    if not numeric_values:
        return 0.0, results_by_code

    numeric_sum = sum(numeric_values)
    numeric_average = numeric_sum / len(numeric_values)
    return _cap_score(round(numeric_sum + numeric_average * passed_count, 2), SCORE_CAPS['base_score']), results_by_code


def _top_subject_key(subject_scores):
    non_zero_scores = {key: value for key, value in subject_scores.items() if value > 0}
    if non_zero_scores:
        return max(non_zero_scores, key=non_zero_scores.get)
    return 'math'


class RankingsListView(APIView):
    def get(self, request):
        def load():
            client = get_client()
            users = (
                client
                .table('users')
                .select('id, user_name, full_name, special_score')
                .execute()
                .data
                or []
            )
            scores = (
                client
                .table('score')
                .select(
                    'user_id, base_score, math, literature, english, physics, chemistry, biology, history, geography'
                )
                .execute()
                .data
                or []
            )
            score_by_user = {row.get('user_id'): row for row in scores if row.get('user_id')}
            elective_rows = (
                client
                .table('user_elective_subjects')
                .select('user_id, subject_code')
                .execute()
                .data
                or []
            )
            elective_codes_by_user = defaultdict(list)
            for elective_row in elective_rows:
                user_id = elective_row.get('user_id')
                subject_code = elective_row.get('subject_code')
                if user_id and subject_code:
                    elective_codes_by_user[user_id].append(subject_code)
            subject_result_rows = (
                client
                .table('user_subject_results')
                .select('user_id, subject_code, numeric_score, assessment_status')
                .execute()
                .data
                or []
            )
            results_by_user = defaultdict(list)
            for result_row in subject_result_rows:
                user_id = result_row.get('user_id')
                if user_id:
                    results_by_user[user_id].append(result_row)

            # Achievements (with award level) + certificates, grouped per user, so
            # the ranking score includes the same bonuses as the Hồ sơ page.
            achievements = (
                client.table('achievements').select('id, user_id, award_id, prize').execute().data or []
            )
            award_ids = list({a.get('award_id') for a in achievements if a.get('award_id') is not None})
            award_level_by_id = {}
            if award_ids:
                award_rows = client.table('awards').select('id, level').in_('id', award_ids).execute().data or []
                award_level_by_id = {row.get('id'): row.get('level') for row in award_rows}
            achievements_by_user = defaultdict(list)
            for achievement in achievements:
                achievements_by_user[achievement.get('user_id')].append(achievement)

            certificates = client.table('certificates').select('user_id, name, score').execute().data or []
            certificates_by_user = defaultdict(list)
            for certificate in certificates:
                certificates_by_user[certificate.get('user_id')].append(certificate)

            rankings = []
            for row in users:
                user_id = row.get('id')
                score_row = score_by_user.get(user_id) or {}
                normalized_base_score, normalized_results = _academic_score_from_subject_profile(
                    elective_codes_by_user.get(user_id, []),
                    results_by_user.get(user_id, []),
                )
                base_score = normalized_base_score if normalized_base_score > 0 else _legacy_base_score(score_row)
                subject_scores = {key: 0.0 for key in SUBJECT_LABELS}
                if normalized_results:
                    for subject_code, result in normalized_results.items():
                        if subject_code in subject_scores and result.get('numeric_score') is not None:
                            subject_scores[subject_code] = float(result.get('numeric_score') or 0)
                if not any(subject_scores.values()) and score_row:
                    subject_scores = {
                        key: float(score_row.get(key) or 0)
                        for key in SUBJECT_LABELS
                    }
                award_bonus = _award_bonus_total(
                    achievements_by_user.get(user_id, []),
                    award_level_by_id,
                )
                certificate_bonus = _certificate_bonus(certificates_by_user.get(user_id, []))
                total_score = round(
                    base_score
                    + _cap_score(row.get('special_score') or 0, SCORE_CAPS['special_score'])
                    + _cap_score(award_bonus, SCORE_CAPS['award_bonus'])
                    + _cap_score(certificate_bonus, SCORE_CAPS['certificate_bonus']),
                    2,
                )
                if total_score <= 0:
                    continue
                top_subject_key = _top_subject_key(subject_scores)
                full_name = row.get('full_name') or row.get('user_name') or 'Nguoi dung'

                rankings.append({
                    'id': user_id,
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
