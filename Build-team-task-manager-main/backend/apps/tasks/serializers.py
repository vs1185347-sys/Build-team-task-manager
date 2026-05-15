from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer
from apps.projects.models import Project
from apps.projects.serializers import ProjectSerializer

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    assigned_to = UserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        source="assigned_to",
        write_only=True,
        required=False,
        allow_null=True,
    )
    project = ProjectSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), source="project", write_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "status",
            "priority",
            "due_date",
            "assigned_to",
            "assigned_to_id",
            "project",
            "project_id",
            "is_overdue",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_overdue", "created_at", "updated_at"]

    def validate_due_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("Task due date cannot be in the past.")
        return value

    def validate(self, attrs):
        project = attrs.get("project") or getattr(self.instance, "project", None)
        assigned_to = attrs.get("assigned_to") or getattr(self.instance, "assigned_to", None)
        due_date = attrs.get("due_date") or getattr(self.instance, "due_date", None)

        if project and due_date and due_date > project.due_date:
            raise serializers.ValidationError({"due_date": "Task due date cannot be after the project due date."})

        if assigned_to and project and not project.members.filter(id=assigned_to.id).exists():
            raise serializers.ValidationError({"assigned_to_id": "Assigned user must be a member of the project."})

        return attrs


class MemberTaskStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ["status"]
