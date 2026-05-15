from __future__ import annotations

from django.utils import timezone
from rest_framework import response, status, viewsets

from apps.projects.models import ActivityLog
from apps.projects.views import log_activity

from .models import Task
from .permissions import TaskPermission
from .serializers import MemberTaskStatusSerializer, TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    permission_classes = [TaskPermission]
    filterset_fields = ["status", "priority", "project", "assigned_to"]
    search_fields = ["title", "description", "project__title", "assigned_to__name"]
    ordering_fields = ["due_date", "priority", "status", "created_at", "updated_at"]
    ordering = ["due_date"]

    def get_serializer_class(self):
        if not self.request.user.is_admin_role and self.action in {"update", "partial_update"}:
            return MemberTaskStatusSerializer
        return TaskSerializer

    def get_queryset(self):
        qs = Task.objects.select_related("project", "assigned_to", "project__created_by").prefetch_related(
            "project__members"
        )
        if not self.request.user.is_admin_role:
            qs = qs.filter(project__members=self.request.user)
        overdue = self.request.query_params.get("overdue")
        if overdue in {"1", "true", "yes"}:
            qs = qs.filter(due_date__lt=timezone.localdate()).exclude(status=Task.Status.DONE)
        return qs.distinct()

    def create(self, request, *args, **kwargs):
        if not request.user.is_admin_role:
            return response.Response({"detail": "Admin role is required."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        task = serializer.save()
        log_activity(self.request.user, ActivityLog.Action.TASK_CREATED, f"Created task '{task.title}'.", task.project)

    def perform_update(self, serializer):
        task = serializer.save()
        log_activity(self.request.user, ActivityLog.Action.TASK_UPDATED, f"Updated task '{task.title}'.", task.project)

    def perform_destroy(self, instance):
        title = instance.title
        project = instance.project
        log_activity(self.request.user, ActivityLog.Action.TASK_DELETED, f"Deleted task '{title}'.", project)
        instance.delete()
