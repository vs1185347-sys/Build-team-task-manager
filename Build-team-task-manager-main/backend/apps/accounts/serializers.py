from __future__ import annotations

from django.contrib.auth import authenticate, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "avatar", "created_at"]
        read_only_fields = ["id", "created_at", "avatar"]

    def get_avatar(self, obj: User) -> str:
        parts = [part[0] for part in obj.name.split() if part]
        return "".join(parts[:2]).upper() or obj.email[:2].upper()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    confirm_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.MEMBER)

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "password", "confirm_password"]
        read_only_fields = ["id"]

    def validate_email(self, value: str) -> str:
        email = User.objects.normalize_email(value)
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def validate(self, attrs):
        password = attrs.get("password")
        confirm = attrs.pop("confirm_password", None)
        if password != confirm:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        try:
            password_validation.validate_password(password)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs

    def create(self, validated_data):
        role = validated_data.get("role", User.Role.MEMBER)
        user = User.objects.create_user(**validated_data)
        if role == User.Role.ADMIN:
            user.is_staff = True
            user.save(update_fields=["is_staff"])
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        email = User.objects.normalize_email(attrs["email"])
        user = authenticate(
            request=self.context.get("request"),
            username=email,
            password=attrs["password"],
        )
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account is disabled.")
        attrs["user"] = user
        return attrs


class RoleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["role"]

    def validate_role(self, value: str) -> str:
        request = self.context.get("request")
        if self.instance and self.instance == request.user and value != User.Role.ADMIN:
            raise serializers.ValidationError("You cannot remove your own Admin role.")
        return value
