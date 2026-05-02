import pytest
from rest_framework import status
from rest_framework.test import APIClient
from django.urls import reverse

from src.universities.models import Province, University
from src.universities.tests.factories import ProvinceFactory, UniversityFactory


@pytest.mark.django_db
class TestProvinceViewSet:
    def setup_method(self):
        self.client = APIClient()

    def test_province_list_returns_200(self):
        ProvinceFactory.create_batch(3)
        response = self.client.get('/api/provinces/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 3

    def test_province_retrieve_returns_200(self):
        province = ProvinceFactory()
        response = self.client.get(f'/api/provinces/{province.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == province.name

    def test_province_search_by_name(self):
        province1 = ProvinceFactory(name="Hà Nội")
        province2 = ProvinceFactory(name="Hồ Chí Minh")
        response = self.client.get('/api/provinces/?search=Hà')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['name'] == "Hà Nội"


@pytest.mark.django_db
class TestUniversityViewSet:
    def setup_method(self):
        self.client = APIClient()

    def test_university_list_returns_200(self):
        UniversityFactory.create_batch(3)
        response = self.client.get('/api/universities/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 3

    def test_university_list_filters_inactive(self):
        active = UniversityFactory(is_active=True)
        inactive = UniversityFactory(is_active=False)
        response = self.client.get('/api/universities/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == str(active.id)

    def test_university_retrieve_returns_200(self):
        university = UniversityFactory()
        response = self.client.get(f'/api/universities/{university.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == university.name

    def test_university_create_unauthenticated_returns_401(self):
        province = ProvinceFactory()
        data = {
            'name': 'Test University',
            'short_name': 'TU',
            'type': 'công_lập',
            'province': province.id,
        }
        response = self.client.post('/api/universities/', data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_university_filter_by_type(self):
        public_uni = UniversityFactory(type='công_lập')
        private_uni = UniversityFactory(type='dân_lập')
        response = self.client.get('/api/universities/?type=công_lập')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == str(public_uni.id)

    def test_university_search_by_name(self):
        uni1 = UniversityFactory(name="Đại học Bách khoa Hà Nội")
        uni2 = UniversityFactory(name="Đại học Quốc gia Hà Nội")
        response = self.client.get('/api/universities/?search=Bách')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == str(uni1.id)

