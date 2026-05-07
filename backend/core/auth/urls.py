from django.urls import path

from core.auth.views import (
    AchievementDeleteView,
    AchievementListCreateView,
    AwardCatalogView,
    CertificateDeleteView,
    CertificateListCreateView,
    LoginView,
    LogoutView,
    ProfileView,
    RegisterView,
)


urlpatterns = [
    path('api/auth/register/', RegisterView.as_view()),
    path('api/auth/login/', LoginView.as_view()),
    path('api/auth/me/', ProfileView.as_view()),
    path('api/auth/me/achievements/', AchievementListCreateView.as_view()),
    path('api/auth/me/achievements/<int:achievement_id>/', AchievementDeleteView.as_view()),
    path('api/auth/me/certificates/', CertificateListCreateView.as_view()),
    path('api/auth/me/certificates/<int:certificate_id>/', CertificateDeleteView.as_view()),
    path('api/auth/logout/', LogoutView.as_view()),
    path('api/awards/', AwardCatalogView.as_view()),
]
