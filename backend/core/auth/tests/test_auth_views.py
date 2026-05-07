from rest_framework import status
from rest_framework.test import APIClient


class Obj:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class TestAuthEndpoints:
    def setup_method(self):
        self.client = APIClient()

    def _mock_clients(self, monkeypatch, fake_client):
        monkeypatch.setattr('core.auth.views.get_client', lambda: fake_client)
        monkeypatch.setattr('core.auth.views.get_user_client', lambda _token: fake_client)
        monkeypatch.setattr('core.auth.supabase_auth.get_client', lambda: fake_client)

    def test_register_success(self, monkeypatch):
        fake_client = Obj(
            auth=Obj(sign_up=lambda _: Obj(user=Obj(id='u1'), session=Obj(access_token='a1'))),
            table=lambda name: Obj(
                select=lambda *_args, **_kwargs: Obj(
                    or_=lambda *_a, **_k: Obj(limit=lambda *_l, **_lk: Obj(execute=lambda: Obj(data=[])))
                ),
                insert=lambda *_a, **_k: Obj(execute=lambda: Obj(data=[{'id': 'u1'}])),
            ),
        )
        self._mock_clients(monkeypatch, fake_client)
        response = self.client.post('/api/auth/register/', {
            'user_name': 'm1nhb1e',
            'full_name': 'Nguyen Trong Minh',
            'grade': 11,
            'dob': '2005-10-16',
            'gender': 'MALE',
            'gmail': 'minh@example.com',
            'password': 'securepassword123',
        }, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['access_token'] == 'a1'

    def test_register_duplicate(self, monkeypatch):
        fake_client = Obj(
            auth=Obj(sign_up=lambda _: Obj(user=Obj(id='u1'), session=Obj(access_token='a1'))),
            table=lambda name: Obj(
                insert=lambda *_a, **_k: Obj(execute=lambda: (_ for _ in ()).throw(Exception('duplicate key value violates unique constraint')))
            ),
        )
        self._mock_clients(monkeypatch, fake_client)
        response = self.client.post('/api/auth/register/', {
            'user_name': 'm1nhb1e',
            'full_name': 'Nguyen Trong Minh',
            'grade': 11,
            'dob': '2005-10-16',
            'gender': 'MALE',
            'gmail': 'dup@example.com',
            'password': 'securepassword123',
        }, format='json')
        assert response.status_code == status.HTTP_409_CONFLICT

    def test_login_wrong_password(self, monkeypatch):
        def bad_login(_):
            raise Exception('invalid login credentials')

        fake_client = Obj(auth=Obj(sign_in_with_password=bad_login), table=lambda name: None)
        self._mock_clients(monkeypatch, fake_client)
        response = self.client.post('/api/auth/login/', {'gmail': 'a@b.com', 'password': 'wrong'}, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_missing_token(self):
        response = self.client.get('/api/auth/me/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_me_logout_success(self, monkeypatch):
        def table(_name):
            return Obj(
                select=lambda *_a, **_k: Obj(
                    eq=lambda *_e, **_ek: Obj(maybe_single=lambda: Obj(execute=lambda: Obj(data={
                        'id': 'u1',
                        'user_name': 'm1nhb1e',
                        'full_name': 'Nguyen Trong Minh',
                        'grade': 11,
                        'dob': '2005-10-16',
                        'gender': 'MALE',
                        'gmail': 'minh@example.com',
                    })))
                )
            )

        fake_client = Obj(
            auth=Obj(
                sign_in_with_password=lambda _: Obj(user=Obj(id='u1'), session=Obj(access_token='a1', refresh_token='r1')),
                get_user=lambda token: Obj(user=Obj(id='u1', email='minh@example.com', user_metadata={})),
                sign_out=lambda: None,
            ),
            table=table,
        )
        self._mock_clients(monkeypatch, fake_client)

        login_response = self.client.post('/api/auth/login/', {'gmail': 'minh@example.com', 'password': 'securepassword123'}, format='json')
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.data['access_token']

        me_response = self.client.get('/api/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        assert me_response.status_code == status.HTTP_200_OK
        assert me_response.data['user']['gmail'] == 'minh@example.com'

        logout_response = self.client.post('/api/auth/logout/', HTTP_AUTHORIZATION=f'Bearer {token}')
        assert logout_response.status_code == status.HTTP_200_OK

    def test_logout_uses_user_scoped_client(self, monkeypatch):
        global_client = Obj(auth=Obj(sign_out=lambda: (_ for _ in ()).throw(Exception('must not call global sign_out'))))
        user_client = Obj(
            auth=Obj(sign_out=lambda: None, get_user=lambda _token: Obj(user=Obj(id='u1', email='minh@example.com', user_metadata={}))),
            table=lambda _name: Obj(),
        )
        monkeypatch.setattr('core.auth.views.get_client', lambda: global_client)
        monkeypatch.setattr('core.auth.views.get_user_client', lambda _token: user_client)
        monkeypatch.setattr('core.auth.supabase_auth.get_client', lambda: user_client)

        response = self.client.post('/api/auth/logout/', HTTP_AUTHORIZATION='Bearer a1')
        assert response.status_code == status.HTTP_200_OK

    def test_profile_patch_success(self, monkeypatch):
        class UsersTable:
            def __init__(self):
                self._payload = None
                self._mode = None

            def update(self, payload):
                self._payload = payload
                self._mode = 'update'
                return self

            def select(self, *_a, **_k):
                self._mode = 'select'
                return self

            def eq(self, *_a, **_k):
                return self

            def maybe_single(self):
                return self

            def execute(self):
                if self._mode == 'select':
                    return Obj(data={
                        'id': 'u1',
                        'user_name': 'm1nhb1e',
                        'full_name': 'Updated Name',
                        'grade': 11,
                        'dob': '2005-10-16',
                        'gender': 'MALE',
                        'gmail': 'minh@example.com',
                    })
                return Obj(data=[{
                    'id': 'u1',
                    'user_name': 'm1nhb1e',
                    'full_name': 'Updated Name',
                    'grade': 11,
                    'dob': '2005-10-16',
                    'gender': 'MALE',
                    'gmail': 'minh@example.com',
                }])

        class ScoreTable:
            def upsert(self, *_a, **_k):
                return self

            def select(self, *_a, **_k):
                return self

            def eq(self, *_a, **_k):
                return self

            def maybe_single(self):
                return self

            def execute(self):
                return Obj(data={'user_id': 'u1', 'math': 8.5, 'base_score': 8.5})

        users_table = UsersTable()
        score_table = ScoreTable()
        fake_client = Obj(
            auth=Obj(get_user=lambda _token: Obj(user=Obj(id='u1', email='minh@example.com', user_metadata={}))),
            table=lambda name: users_table if name == 'users' else score_table if name == 'score' else Obj(),
        )
        self._mock_clients(monkeypatch, fake_client)
        response = self.client.patch('/api/auth/me/', {'full_name': 'Updated Name', 'math': 8.5}, format='json', HTTP_AUTHORIZATION='Bearer a1')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['user']['full_name'] == 'Updated Name'

    def test_profile_patch_falls_back_when_special_subject_column_missing(self, monkeypatch):
        class UsersTable:
            def __init__(self):
                self._payload = None
                self._mode = None
                self._update_calls = 0

            def update(self, payload):
                self._payload = payload
                self._mode = 'update'
                self._update_calls += 1
                return self

            def select(self, *_a, **_k):
                self._mode = 'select'
                return self

            def eq(self, *_a, **_k):
                return self

            def maybe_single(self):
                return self

            def execute(self):
                if self._mode == 'select':
                    return Obj(data={
                        'id': 'u1',
                        'user_name': 'm1nhb1e',
                        'full_name': 'Updated Name',
                        'grade': 11,
                        'dob': '2005-10-16',
                        'gender': 'MALE',
                        'gmail': 'minh@example.com',
                    })
                if self._update_calls == 1:
                    raise Exception("Could not find the 'special_subject' column of 'users' in the schema cache")
                return Obj(data=[{
                    'id': 'u1',
                    'user_name': 'm1nhb1e',
                    'full_name': 'Updated Name',
                    'grade': 11,
                    'dob': '2005-10-16',
                    'gender': 'MALE',
                    'gmail': 'minh@example.com',
                }])

        class ScoreTable:
            def upsert(self, *_a, **_k):
                return self

            def select(self, *_a, **_k):
                return self

            def eq(self, *_a, **_k):
                return self

            def maybe_single(self):
                return self

            def execute(self):
                return Obj(data={'user_id': 'u1', 'math': 8.5, 'base_score': 8.5})

        users_table = UsersTable()
        score_table = ScoreTable()
        fake_client = Obj(
            auth=Obj(get_user=lambda _token: Obj(user=Obj(id='u1', email='minh@example.com', user_metadata={}))),
            table=lambda name: users_table if name == 'users' else score_table if name == 'score' else Obj(),
        )
        self._mock_clients(monkeypatch, fake_client)
        response = self.client.patch(
            '/api/auth/me/',
            {'full_name': 'Updated Name', 'special_subject': 'toan', 'math': 8.5},
            format='json',
            HTTP_AUTHORIZATION='Bearer a1',
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['user']['full_name'] == 'Updated Name'

    def test_awards_catalog_success(self, monkeypatch):
        class AwardsTable:
            def select(self, *_a, **_k):
                return self

            def order(self, *_a, **_k):
                return self

            def execute(self):
                return Obj(data=[{'id': 1, 'name': 'HSG Tinh', 'level': 'tinh'}])

        fake_client = Obj(table=lambda name: AwardsTable() if name == 'awards' else Obj())
        self._mock_clients(monkeypatch, fake_client)
        response = self.client.get('/api/awards/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['results'][0]['name'] == 'HSG Tinh'

    def test_create_achievement_success(self, monkeypatch):
        class AchievementsTable:
            def __init__(self):
                self._mode = None

            def insert(self, *_a, **_k):
                self._mode = 'insert'
                return self

            def select(self, *_a, **_k):
                self._mode = 'select'
                return self

            def eq(self, *_a, **_k):
                return self

            def maybe_single(self):
                return self

            def execute(self):
                if self._mode == 'insert':
                    return Obj(data=[{'id': 10, 'user_id': 'u1', 'award_id': 1}])
                return Obj(data={'id': 10, 'user_id': 'u1', 'award_id': 1, 'name': 'HSG Tinh', 'prize': 'Nhat', 'date': '2025-01-01', 'is_verified': None})

        class AwardsTable:
            def __init__(self):
                self._mode = None

            def select(self, *_a, **_k):
                return self

            def eq(self, *_a, **_k):
                self._mode = 'single'
                return self

            def maybe_single(self):
                return self

            def in_(self, *_a, **_k):
                self._mode = 'many'
                return self

            def execute(self):
                if self._mode == 'single':
                    return Obj(data={'id': 1, 'name': 'HSG Tinh', 'level': 'tinh'})
                return Obj(data=[{'id': 1, 'name': 'HSG Tinh', 'level': 'tinh'}])

        ach_table = AchievementsTable()
        awards_table = AwardsTable()
        fake_client = Obj(
            auth=Obj(get_user=lambda _token: Obj(user=Obj(id='u1', email='minh@example.com', user_metadata={}))),
            table=lambda name: ach_table if name == 'achievements' else awards_table if name == 'awards' else Obj(),
        )
        self._mock_clients(monkeypatch, fake_client)
        response = self.client.post('/api/auth/me/achievements/', {'award_id': 1, 'prize': 'Nhat', 'date': '2025-01-01'}, format='json', HTTP_AUTHORIZATION='Bearer a1')
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['achievement']['award_id'] == 1

    def test_create_achievement_defaults_date_when_missing(self, monkeypatch):
        class AchievementsTable:
            def __init__(self):
                self._mode = None
                self.insert_payload = None

            def insert(self, payload, *_a, **_k):
                self._mode = 'insert'
                self.insert_payload = payload
                return self

            def select(self, *_a, **_k):
                self._mode = 'select'
                return self

            def eq(self, *_a, **_k):
                return self

            def maybe_single(self):
                return self

            def execute(self):
                if self._mode == 'insert':
                    return Obj(data=[{'id': 10, 'user_id': 'u1', 'award_id': 1}])
                return Obj(data={'id': 10, 'user_id': 'u1', 'award_id': 1, 'name': 'HSG Tinh', 'prize': 'Nhất', 'date': '2025-01-01', 'is_verified': None})

        class AwardsTable:
            def __init__(self):
                self._mode = None

            def select(self, *_a, **_k):
                return self

            def eq(self, *_a, **_k):
                self._mode = 'single'
                return self

            def maybe_single(self):
                return self

            def in_(self, *_a, **_k):
                self._mode = 'many'
                return self

            def execute(self):
                if self._mode == 'single':
                    return Obj(data={'id': 1, 'name': 'HSG Tinh', 'level': 'tinh'})
                return Obj(data=[{'id': 1, 'name': 'HSG Tinh', 'level': 'tinh'}])

        ach_table = AchievementsTable()
        awards_table = AwardsTable()
        fake_client = Obj(
            auth=Obj(get_user=lambda _token: Obj(user=Obj(id='u1', email='minh@example.com', user_metadata={}))),
            table=lambda name: ach_table if name == 'achievements' else awards_table if name == 'awards' else Obj(),
        )
        self._mock_clients(monkeypatch, fake_client)
        response = self.client.post('/api/auth/me/achievements/', {'award_id': 1, 'prize': 'Nhat'}, format='json', HTTP_AUTHORIZATION='Bearer a1')
        assert response.status_code == status.HTTP_201_CREATED
        assert ach_table.insert_payload['date']

    def test_certificates_list_and_create_success(self, monkeypatch):
        class CertificatesTable:
            def __init__(self):
                self._mode = None

            def select(self, *_a, **_k):
                self._mode = 'select'
                return self

            def insert(self, *_a, **_k):
                self._mode = 'insert'
                return self

            def eq(self, *_a, **_k):
                return self

            def order(self, *_a, **_k):
                return self

            def execute(self):
                if self._mode == 'insert':
                    return Obj(data=[{'id': 7, 'user_id': 'u1', 'name': 'IELTS', 'score': 7.5, 'date': '2024-12-01', 'is_verified': None}])
                return Obj(data=[{'id': 7, 'user_id': 'u1', 'name': 'IELTS', 'score': 7.5, 'date': '2024-12-01', 'is_verified': None}])

        cert_table = CertificatesTable()
        fake_client = Obj(
            auth=Obj(get_user=lambda _token: Obj(user=Obj(id='u1', email='minh@example.com', user_metadata={}))),
            table=lambda name: cert_table if name == 'certificates' else Obj(),
        )
        self._mock_clients(monkeypatch, fake_client)

        list_response = self.client.get('/api/auth/me/certificates/', HTTP_AUTHORIZATION='Bearer a1')
        assert list_response.status_code == status.HTTP_200_OK
        assert list_response.data['results'][0]['name'] == 'IELTS'

        create_response = self.client.post(
            '/api/auth/me/certificates/',
            {'name': 'IELTS', 'score': 7.5, 'date': '2024-12-01'},
            format='json',
            HTTP_AUTHORIZATION='Bearer a1',
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        assert create_response.data['certificate']['name'] == 'IELTS'
