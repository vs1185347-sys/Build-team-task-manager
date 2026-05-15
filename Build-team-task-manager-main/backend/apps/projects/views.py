from __future__ import annotations

from django.db.models import Prefetch
from rest_framework import decorators, response, status, viewsets

from apps.accounts.models import User
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer

from .models import ActivityLog, Project
from .permissions import ProjectPermission
from .serializers import ActivityLogSerializer, ProjectSerializer


def log_activity(actor, action: str, message: str, project: Project | None = None) -> None:
    ActivityLog.objects.create(actor=actor if actor.is_authenticated else None, action=action, message=message, project=project)


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [ProjectPermission]
    search_fields = ["title", "description", "members__name", "members__email"]
    ordering_fields = ["due_date", "created_at", "updated_at", "title"]
    ordering = ["due_date"]

    def get_queryset(self):
        qs = Project.objects.select_related("created_by").prefetch_related("members")
        if not self.request.user.is_admin_role:
            qs = qs.filter(members=self.request.user)
        return ProjectSerializer.with_counts(qs).distinct()

    def perform_create(self, serializer):
        project = serializer.save(created_by=self.request.user)
        project.members.add(self.request.user)
        log_activity(self.request.user, ActivityLog.Action.PROJECT_CREATED, f"Created project '{project.title}'.", project)

    def perform_update(self, serializer):
        project = serializer.save()
        if self.request.user not in project.members.all():
            project.members.add(self.request.user)
        log_activity(self.request.user, ActivityLog.Action.PROJECT_UPDATED, f"Updated project '{project.title}'.", project)

    def perform_destroy(self, instance):
        title = instance.title
        log_activity(self.request.user, ActivityLog.Action.PROJECT_DELETED, f"Deleted project '{title}'.", instance)
        instance.delete()

    @decorators.action(detail=True, methods=["get"])
    def detail(self, request, pk=None):
        project = self.get_object()
        tasks = Task.objects.filter(project=project).select_related("assigned_to", "project")
        activity = project.activity_logs.select_related("actor")[:12]
        return response.Response(
            {
                "project": self.get_serializer(project).data,
                "tasks": TaskSerializer(tasks, many=True).data,
                "activity": ActivityLogSerializer(activity, many=True).data,
            }
        )

    @decorators.action(detail=True, methods=["post"], url_path="members")
    def add_members(self, request, pk=None):
        if not request.user.is_admin_role:
            return response.Response({"detail": "Admin role is required."}, status=status.HTTP_403_FORBIDDEN)
        project = self.get_object()
        member_ids = request.data.get("member_ids", [])
        users = User.objects.filter(id__in=member_ids, is_active=True)
        project.members.add(*users)
        log_activity(request.user, ActivityLog.Action.MEMBER_ADDED, f"Updated members for '{project.title}'.", project)
        return response.Response(self.get_serializer(project).data)
