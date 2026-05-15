from __future__ import annotations

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer

from .models import ActivityLog, Project


class ActivityLogSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = ["id", "actor", "action", "message", "created_at"]


class ProjectSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    members = UserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        source="members",
        many=True,
        write_only=True,
        required=False,
    )
    task_count = serializers.IntegerField(read_only=True)
    completed_task_count = serializers.IntegerField(read_only=True)
    overdue_task_count = serializers.IntegerField(read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "title",
            "description",
            "due_date",
            "created_by",
            "members",
            "member_ids",
            "task_count",
            "completed_task_count",
            "overdue_task_count",
            "progress",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate_due_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("Project due date cannot be in the past.")
        return value

    def get_progress(self, obj: Project) -> int:
        if hasattr(obj, "task_count") and obj.task_count:
            return round((obj.completed_task_count / obj.task_count) * 100)
        return obj.progress

    @staticmethod
    def with_counts(queryset):
        today = timezone.localdate()
        return queryset.annotate(
            task_count=Count("tasks", distinct=True),
            completed_task_count=Count("tasks", filter=Q(tasks__status="DONE"), distinct=True),
            overdue_task_count=Count(
                "tasks",
                filter=Q(tasks__due_date__lt=today) & ~Q(tasks__status="DONE"),
                distinct=True,
            ),
        )
