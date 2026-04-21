import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.academics.models import MajorCatalog
from apps.academics.tests.factories import (
    FieldFactory, SubjectGroupFactory,
    MajorCatalogFactory, MajorSubjectGroupFactory
)


@pytest.mark.django_db
class TestFieldViewSet:
    def setup_method(self):
        self.client = APIClient()

    def test_field_list_returns_200(self):
        FieldFactory.create_batch(3)
        response = self.client.get('/api/fields/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 3

    def test_field_retrieve_returns_200(self):
        field = FieldFactory()
        response = self.client.get(f'/api/fields/{field.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == field.name


@pytest.mark.django_db
class TestSubjectGroupViewSet:
    def setup_method(self):
        self.client = APIClient()

    def test_subject_group_list_returns_200(self):
        SubjectGroupFactory.create_batch(3)
        response = self.client.get('/api/subject-groups/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 3

    def test_subject_group_retrieve_returns_200(self):
        sg = SubjectGroupFactory()
        response = self.client.get(f'/api/subject-groups/{sg.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['code'] == sg.code


@pytest.mark.django_db
class TestMajorCatalogViewSet:
    def setup_method(self):
        self.client = APIClient()

    def test_major_list_returns_200(self):
        MajorCatalogFactory.create_batch(3)
        response = self.client.get('/api/majors/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 3

    def test_major_retrieve_returns_200(self):
        major = MajorCatalogFactory()
        response = self.client.get(f'/api/majors/{major.id}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == major.name

    def test_major_subject_groups_action(self):
        major = MajorCatalogFactory()
        sg1 = SubjectGroupFactory()
        sg2 = SubjectGroupFactory()
        MajorSubjectGroupFactory(major_catalog=major, subject_group=sg1)
        MajorSubjectGroupFactory(major_catalog=major, subject_group=sg2)
        
        response = self.client.get(f'/api/majors/{major.id}/subject-groups/')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_major_filter_by_field(self):
        field1 = FieldFactory()
        field2 = FieldFactory()
        major1 = MajorCatalogFactory(field=field1)
        major2 = MajorCatalogFactory(field=field2)
        
        response = self.client.get(f'/api/majors/?field={field1.id}')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == major1.id

    def test_major_search_by_code(self):
        major1 = MajorCatalogFactory(code="CS001")
        major2 = MajorCatalogFactory(code="ENG002")
        
        response = self.client.get('/api/majors/?search=CS')
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == major1.id
