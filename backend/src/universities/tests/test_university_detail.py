from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient


class Result:
    def __init__(self, data):
        self.data = data


class QueryStub:
    def __init__(self, data):
        self.data = data
        self.select_value = None
        self.eq_calls = []

    def select(self, value, **_kwargs):
        self.select_value = value
        return self

    def eq(self, field, value):
        self.eq_calls.append((field, value))
        return self

    def maybe_single(self):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        return Result(self.data)


class ClientStub:
    def __init__(self, university, scores):
        self.queries = {
            'universities': QueryStub(university),
            'admission_scores': QueryStub(scores),
        }
        self.tables = []

    def table(self, name):
        self.tables.append(name)
        return self.queries[name]


class TestUniversityDetailByCode:
    def setup_method(self):
        cache.clear()
        self.api = APIClient()

    def test_returns_university_and_exactly_filtered_scores(self, monkeypatch):
        client = ClientStub(
            university={'id': 'u1', 'code': 'BKA', 'name': 'Bach khoa'},
            scores=[{'id': 's1', 'university_programs': {'university_short_name': 'BKA'}}],
        )
        monkeypatch.setattr('src.universities.views.get_client', lambda: client)

        response = self.api.get('/api/universities/by-code/bka/detail/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['university']['code'] == 'BKA'
        assert response.data['scores'] == client.queries['admission_scores'].data
        assert client.queries['universities'].eq_calls == [('code', 'BKA')]
        assert client.queries['admission_scores'].eq_calls == [
            ('university_programs.university_short_name', 'BKA')
        ]
        assert 'university_programs!inner(' in client.queries['admission_scores'].select_value

    def test_returns_empty_scores_for_a_university_without_scores(self, monkeypatch):
        client = ClientStub(
            university={'id': 'u1', 'code': 'BKA', 'name': 'Bach khoa'},
            scores=[],
        )
        monkeypatch.setattr('src.universities.views.get_client', lambda: client)

        response = self.api.get('/api/universities/by-code/BKA/detail/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['scores'] == []

    def test_returns_404_without_querying_scores_for_unknown_code(self, monkeypatch):
        client = ClientStub(university=None, scores=[])
        monkeypatch.setattr('src.universities.views.get_client', lambda: client)

        response = self.api.get('/api/universities/by-code/UNKNOWN/detail/')

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert client.tables == ['universities']
