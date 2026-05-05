import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    """Unauthenticated API client"""
    return APIClient()


@pytest.fixture
def authenticated_client(api_client):
    return api_client


