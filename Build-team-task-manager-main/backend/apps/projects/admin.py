from django.contrib import admin

from .models import ActivityLog, Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["title", "due_date", "created_by", "created_at", "updated_at"]
    list_filter = ["due_date", "created_at"]
    search_fields = ["title", "description", "created_by__email"]
    filter_horizontal = ["members"]


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["action", "message", "actor", "project", "created_at"]
    list_filter = ["action", "created_at"]
    search_fields = ["message", "actor__email", "project__title"]
