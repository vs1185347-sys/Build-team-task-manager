from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


class Project(models.Model):
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    due_date = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_projects",
    )
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="projects", blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "title"]

    def __str__(self) -> str:
        return self.title

    @property
    def progress(self) -> int:
        total = self.tasks.count()
        if total == 0:
            return 0
        done = self.tasks.filter(status="DONE").count()
        return round((done / total) * 100)


class ActivityLog(models.Model):
    class Action(models.TextChoices):
        PROJECT_CREATED = "PROJECT_CREATED", "Project created"
        PROJECT_UPDATED = "PROJECT_UPDATED", "Project updated"
        PROJECT_DELETED = "PROJECT_DELETED", "Project deleted"
        TASK_CREATED = "TASK_CREATED", "Task created"
        TASK_UPDATED = "TASK_UPDATED", "Task updated"
        TASK_DELETED = "TASK_DELETED", "Task deleted"
        MEMBER_ADDED = "MEMBER_ADDED", "Member added"
        ROLE_UPDATED = "ROLE_UPDATED", "Role updated"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="activity_logs", null=True, blank=True)
    action = models.CharField(max_length=32, choices=Action.choices)
    message = models.CharField(max_length=255)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.message
