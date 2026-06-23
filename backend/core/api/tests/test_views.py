from django.core.cache import cache
from datetime import date
from rest_framework import status
from rest_framework.test import APIClient


class Obj:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class TableStub:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def gte(self, *_args, **_kwargs):
        return self

    def lte(self, *_args, **_kwargs):
        return self

    def order(self, field, desc=False):
        self.rows = sorted(self.rows, key=lambda row: row.get(field) or 0, reverse=desc)
        return self

    def limit(self, value):
        self.rows = self.rows[:value]
        return self

    def range(self, start, end):
        self.rows = self.rows[start:end + 1]
        return self

    def eq(self, field, value):
        self.rows = [row for row in self.rows if row.get(field) == value]
        return self

    def gt(self, field, value):
        self.rows = [row for row in self.rows if row.get(field) is not None and row.get(field) > value]
        return self

    def execute(self):
        return Obj(data=self.rows)


class FakeClient:
    def __init__(self, users=None, score_rows=None, majors=None, scores=None):
        self._users = users or []
        self._score_rows = score_rows or []
        self._majors = majors or []
        self._scores = scores or []

    def table(self, name):
        if name == 'users':
            return TableStub(self._users)
        if name == 'score':
            return TableStub(self._score_rows)
        if name == 'major_catalog':
            return TableStub(self._majors)
        if name == 'admission_scores':
            return TableStub(self._scores)
        raise AssertionError(f'Unexpected table: {name}')


class TestAnalyticsEndpoints:
    def setup_method(self):
        cache.clear()
        self.client = APIClient()

    def test_rankings_endpoint_builds_sorted_payload(self, monkeypatch):
        fake_client = FakeClient(
            users=[
                {
                    'id': 'u1',
                    'full_name': 'Nguyen Van A',
                    'user_name': 'nva',
                    'special_score': 5,
                },
                {
                    'id': 'u2',
                    'full_name': 'Tran Thi B',
                    'user_name': 'ttb',
                    'special_score': 0,
                },
            ],
            score_rows=[
                {'user_id': 'u1', 'base_score': 80, 'math': 9, 'literature': 7, 'english': 8},
                {'user_id': 'u2', 'base_score': 70, 'math': 8, 'literature': 9, 'english': 7},
            ],
        )
        monkeypatch.setattr('core.api.views.get_client', lambda: fake_client)

        response = self.client.get('/api/rankings/?page_size=1')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2
        assert response.data['results'][0]['id'] == 'u1'
        assert response.data['results'][0]['rank'] == 1
        assert response.data['results'][0]['tier'] == 'A'
        assert response.data['results'][0]['topSubject'] == 'Toan'

    def test_major_trends_endpoint_aggregates_scores(self, monkeypatch):
        current_year = date.today().year
        fake_client = FakeClient(
            majors=[
                {'code': 'CS', 'name': 'Cong nghe thong tin'},
                {'code': 'MED', 'name': 'Y da khoa'},
            ],
            scores=[
                {'year': current_year - 4, 'score': 25, 'admission_method_code': 'THPT', 'university_program_id': 'cs1', 'university_programs': {'major_code': 'CS'}},
                {'year': current_year - 3, 'score': 26, 'admission_method_code': 'THPT', 'university_program_id': 'cs1', 'university_programs': {'major_code': 'CS'}},
                {'year': current_year - 2, 'score': 27, 'admission_method_code': 'THPT', 'university_program_id': 'cs1', 'university_programs': {'major_code': 'CS'}},
                {'year': current_year - 1, 'score': 28, 'admission_method_code': 'THPT', 'university_program_id': 'cs1', 'university_programs': {'major_code': 'CS'}},
                {'year': current_year, 'score': 28, 'admission_method_code': 'THPT', 'university_program_id': 'cs1', 'university_programs': {'major_code': 'CS'}},
                {'year': current_year, 'score': 30, 'admission_method_code': 'THPT', 'university_program_id': 'cs1', 'university_programs': {'major_code': 'CS'}},
                {'year': current_year - 2, 'score': 28.5, 'admission_method_code': 'THPT', 'university_program_id': 'med1', 'university_programs': {'major_code': 'MED'}},
                {'year': current_year - 1, 'score': 29.0, 'admission_method_code': 'THPT', 'university_program_id': 'med1', 'university_programs': {'major_code': 'MED'}},
                {'year': current_year, 'score': 29.5, 'admission_method_code': 'THPT', 'university_program_id': 'med1', 'university_programs': {'major_code': 'MED'}},
                {'year': current_year, 'score': 1500, 'admission_method_code': 'SAT', 'university_program_id': 'med1', 'university_programs': {'major_code': 'MED'}},
            ],
        )
        monkeypatch.setattr('core.api.views.get_client', lambda: fake_client)

        response = self.client.get('/api/major-trends/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2
        assert response.data['results'][0]['name'] == 'Y da khoa'
        assert response.data['results'][0]['scores'][-1] == 29.5
        assert response.data['results'][1]['name'] == 'Cong nghe thong tin'
        assert response.data['results'][1]['scores'][-1] == 29.0
