import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def api_client():
    """Unauthenticated API client"""
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, db):
    """Authenticated API client with a test user"""
    user = User.objects.create_user(username='testuser', password='testpass123')
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def test_user(db):
    """Create a test user"""
    return User.objects.create_user(username='testuser', password='testpass123')

