import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.admissions.models import AdmissionScore
from apps.admissions.tests.factories import (
    AdmissionMethodFactory, UniversityProgramFactory, AdmissionScoreFactory
)
from apps.universities.tests.factories import UniversityFactory, ProvinceFactory


@pytest.mark.django_db
class TestAdmissionMethodViewSet:
    def setup_method(self):
        self.client = APIClient()

    def test_admission_method_list_returns_200(self):
        AdmissionMethodFactory.create_batch(3)
        response = self.client.get('/api/admission-methods/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 3

    def test_admission_method_retrieve_returns_200(self):
        method = AdmissionMethodFactory()
        response = self.client.get(f'/api/admission-methods/{method.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == method.name


@pytest.mark.django_db
class TestUniversityProgramViewSet:
    def setup_method(self):
        self.client = APIClient()

    def test_program_list_returns_200(self):
        UniversityProgramFactory.create_batch(3)
        response = self.client.get('/api/programs/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 3

    def test_program_list_filters_inactive_universities(self):
        active_uni = UniversityFactory(is_active=True)
        inactive_uni = UniversityFactory(is_active=False)
        program_active = UniversityProgramFactory(university=active_uni)
        program_inactive = UniversityProgramFactory(university=inactive_uni)
        
        response = self.client.get('/api/programs/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == str(program_active.id)

    def test_program_retrieve_returns_200(self):
        program = UniversityProgramFactory()
        response = self.client.get(f'/api/programs/{program.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(program.id)

    def test_program_filter_by_university(self):
        uni1 = UniversityFactory()
        uni2 = UniversityFactory()
        program1 = UniversityProgramFactory(university=uni1)
        program2 = UniversityProgramFactory(university=uni2)
        
        response = self.client.get(f'/api/programs/?university={uni1.id}')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == str(program1.id)

    def test_program_search_by_internal_code(self):
        program1 = UniversityProgramFactory(internal_code="PROG001")
        program2 = UniversityProgramFactory(internal_code="PROG002")
        
        response = self.client.get('/api/programs/?search=PROG001')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == str(program1.id)


@pytest.mark.django_db
class TestAdmissionScoreViewSet:
    def setup_method(self):
        self.client = APIClient()

    def test_score_list_returns_200(self):
        AdmissionScoreFactory.create_batch(3)
        response = self.client.get('/api/scores/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 3

    def test_score_list_filters_inactive_universities(self):
        active_uni = UniversityFactory(is_active=True)
        inactive_uni = UniversityFactory(is_active=False)
        score_active = AdmissionScoreFactory(university_program__university=active_uni)
        score_inactive = AdmissionScoreFactory(university_program__university=inactive_uni)
        
        response = self.client.get('/api/scores/')
        assert response.status_code == status.HTTP_200_OK
        results_ids = [str(s['id']) for s in response.data['results']]
        assert str(score_active.id) in results_ids
        assert str(score_inactive.id) not in results_ids

    def test_score_retrieve_returns_200(self):
        score = AdmissionScoreFactory()
        response = self.client.get(f'/api/scores/{score.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['id'] == str(score.id)

    def test_score_filter_by_year(self):
        score_2023 = AdmissionScoreFactory(year=2023)
        score_2024 = AdmissionScoreFactory(year=2024)
        
        response = self.client.get('/api/scores/?year=2023')
        assert response.status_code == status.HTTP_200_OK
        results_years = [s['year'] for s in response.data['results']]
        assert 2023 in results_years

    def test_score_filter_by_year_range(self):
        score_2022 = AdmissionScoreFactory(year=2022)
        score_2023 = AdmissionScoreFactory(year=2023)
        score_2024 = AdmissionScoreFactory(year=2024)
        
        response = self.client.get('/api/scores/?year_min=2023&year_max=2024')
        assert response.status_code == status.HTTP_200_OK
        results_years = [s['year'] for s in response.data['results']]
        assert 2023 in results_years
        assert 2024 in results_years
        assert 2022 not in results_years

    def test_score_filter_by_score_range(self):
        score_low = AdmissionScoreFactory(score=15.5)
        score_mid = AdmissionScoreFactory(score=20.0)
        score_high = AdmissionScoreFactory(score=25.5)
        
        response = self.client.get('/api/scores/?score_min=20&score_max=26')
        assert response.status_code == status.HTTP_200_OK
        results_scores = [float(s['score']) for s in response.data['results']]
        assert 20.0 in results_scores
        assert 25.5 in results_scores

    def test_score_filter_by_region(self):
        north_province = ProvinceFactory(region='Bắc')
        south_province = ProvinceFactory(region='Nam')
        
        north_uni = UniversityFactory(province=north_province)
        south_uni = UniversityFactory(province=south_province)
        
        score_north = AdmissionScoreFactory(university_program__university=north_uni)
        score_south = AdmissionScoreFactory(university_program__university=south_uni)
        
        response = self.client.get('/api/scores/?region=Bắc')
        assert response.status_code == status.HTTP_200_OK
        results_ids = [str(s['id']) for s in response.data['results']]
        assert str(score_north.id) in results_ids

    def test_score_ordering_by_year_desc(self):
        score_2023 = AdmissionScoreFactory(year=2023, score=20)
        score_2024 = AdmissionScoreFactory(year=2024, score=22)
        score_2025 = AdmissionScoreFactory(year=2025, score=21)
        
        response = self.client.get('/api/scores/?ordering=-year')
        assert response.status_code == status.HTTP_200_OK
        results_years = [s['year'] for s in response.data['results'][:3]]
        assert results_years == [2025, 2024, 2023]
