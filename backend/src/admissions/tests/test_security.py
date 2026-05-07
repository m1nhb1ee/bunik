from rest_framework import status
from rest_framework.test import APIClient


class Obj:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class UpsertTable:
    def upsert(self, *_args, **_kwargs):
        return self

    def execute(self):
        return Obj(data=[{'id': 1}])


class FakeClient:
    def __init__(self):
        self.auth = Obj(get_user=lambda _token: Obj(user=Obj(id='u1', email='user@example.com', user_metadata={})))

    def table(self, name):
        if name != 'admission_scores':
            raise AssertionError(f'Unexpected table: {name}')
        return UpsertTable()


class FakeAdminClient(FakeClient):
    def __init__(self):
        self.auth = Obj(get_user=lambda _token: Obj(user=Obj(id='admin1', email='admin@example.com', user_metadata={'role': 'admin'})))


class TestBulkUpsertPermissions:
    def setup_method(self):
        self.client = APIClient()

    def test_bulk_upsert_requires_authentication(self):
        response = self.client.post('/api/scores/bulk-upsert/', {'items': [{'year': 2026}]}, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_bulk_upsert_forbids_non_staff_user(self, monkeypatch):
        fake_client = FakeClient()
        monkeypatch.setattr('src.admissions.views.get_client', lambda: fake_client)
        monkeypatch.setattr('core.auth.supabase_auth.get_client', lambda: fake_client)

        response = self.client.post('/api/scores/bulk-upsert/', {'items': [{'year': 2026}]}, format='json', HTTP_AUTHORIZATION='Bearer user-token')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_bulk_upsert_allows_staff_user(self, monkeypatch):
        fake_client = FakeAdminClient()
        monkeypatch.setattr('src.admissions.views.get_client', lambda: fake_client)
        monkeypatch.setattr('core.auth.supabase_auth.get_client', lambda: fake_client)

        response = self.client.post(
            '/api/scores/bulk-upsert/',
            {'items': [{'university_program_id': 1, 'admission_method_code': 'THPT', 'year': 2026, 'score': 28}]},
            format='json',
            HTTP_AUTHORIZATION='Bearer admin-token',
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['inserted'] == 1
