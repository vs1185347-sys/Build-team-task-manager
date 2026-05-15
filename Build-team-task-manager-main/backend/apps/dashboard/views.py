from __future__ import annotations

from collections import OrderedDict
from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import ActivityLog, Project
from apps.projects.serializers import ActivityLogSerializer, ProjectSerializer
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer


class DashboardView(APIView):
    def get(self, request):
        today = timezone.localdate()
        user = request.user

        projects = Project.objects.select_related("created_by").prefetch_related("members")
        tasks = Task.objects.select_related("project", "assigned_to", "project__created_by").prefetch_related("project__members")

        if not user.is_admin_role:
            projects = projects.filter(members=user)
            tasks = tasks.filter(project__members=user)

        total_projects = projects.distinct().count()
        total_tasks = tasks.distinct().count()
        completed_tasks = tasks.filter(status=Task.Status.DONE).distinct().count()
        overdue_tasks = tasks.filter(due_date__lt=today).exclude(status=Task.Status.DONE).distinct().count()

        status_counts = OrderedDict((status, 0) for status, _ in Task.Status.choices)
        for row in tasks.values("status").annotate(count=Count("id")):
            status_counts[row["status"]] = row["count"]

        priority_counts = OrderedDict((priority, 0) for priority, _ in Task.Priority.choices)
        for row in tasks.values("priority").annotate(count=Count("id")):
            priority_counts[row["priority"]] = row["count"]

        productivity = []
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            count = tasks.filter(status=Task.Status.DONE, updated_at__date=day).count()
            productivity.append({"date": day.isoformat(), "completed": count})

        project_progress = []
        project_qs = ProjectSerializer.with_counts(projects).distinct()[:8]
        for project in project_qs:
            progress = round((project.completed_task_count / project.task_count) * 100) if project.task_count else 0
            project_progress.append({"name": project.title, "progress": progress})

        recent_tasks = tasks.order_by("-updated_at")[:6]
        activity = ActivityLog.objects.select_related("actor", "project")
        if not user.is_admin_role:
            activity = activity.filter(project__members=user)

        return Response(
            {
                "stats": {
                    "totalProjects": total_projects,
                    "totalTasks": total_tasks,
                    "completedTasks": completed_tasks,
                    "overdueTasks": overdue_tasks,
                    "completionRate": round((completed_tasks / total_tasks) * 100) if total_tasks else 0,
                },
                "charts": {
                    "statusCounts": status_counts,
                    "priorityCounts": priority_counts,
                    "projectProgress": project_progress,
                    "productivity": productivity,
                },
                "recent": {
                    "tasks": TaskSerializer(recent_tasks, many=True).data,
                    "projects": ProjectSerializer(ProjectSerializer.with_counts(projects).order_by("-updated_at")[:6], many=True).data,
                    "activity": ActivityLogSerializer(activity[:10], many=True).data,
                },
            }
        )
