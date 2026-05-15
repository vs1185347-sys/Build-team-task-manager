from django.urls import path

from .views import LoginView, LogoutView, MeView, RegisterView, UserListView, UserRoleUpdateView


urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("users/", UserListView.as_view(), name="users"),
    path("users/<int:pk>/role/", UserRoleUpdateView.as_view(), name="user-role"),
]
