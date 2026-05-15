from __future__ import annotations

from django.conf import settings
from django.middleware.csrf import get_token
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .permissions import IsAdminRole
from .serializers import LoginSerializer, RegisterSerializer, RoleUpdateSerializer, UserSerializer


def _set_jwt_cookies(response: Response, refresh: RefreshToken) -> None:
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        access_token,
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
    )
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh_token,
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
    )
    response.data["access"] = access_token
    response.data["refresh"] = refresh_token


def _clear_jwt_cookies(response: Response) -> None:
    response.delete_cookie(settings.JWT_ACCESS_COOKIE_NAME, samesite=settings.JWT_COOKIE_SAMESITE)
    response.delete_cookie(settings.JWT_REFRESH_COOKIE_NAME, samesite=settings.JWT_COOKIE_SAMESITE)


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "user": UserSerializer(user).data,
                "message": "Account created successfully.",
            },
            status=status.HTTP_201_CREATED,
        )
        _set_jwt_cookies(response, refresh)
        return response


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "user": UserSerializer(user).data,
                "message": "Logged in successfully.",
            }
        )
        _set_jwt_cookies(response, refresh)
        return response


class LogoutView(APIView):
    def post(self, request):
        refresh_token = request.data.get("refresh") or request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except Exception:
                pass
        response = Response({"message": "Logged out successfully."})
        _clear_jwt_cookies(response)
        return response


class MeView(APIView):
    def get(self, request):
        return Response({"user": UserSerializer(request.user).data, "csrfToken": get_token(request)})


class UserListView(generics.ListAPIView):
    permission_classes = [IsAdminRole]
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.filter(is_active=True)


class UserRoleUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAdminRole]
    serializer_class = RoleUpdateSerializer
    queryset = User.objects.filter(is_active=True)

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        user = self.get_object()
        response.data = UserSerializer(user).data
        return response
