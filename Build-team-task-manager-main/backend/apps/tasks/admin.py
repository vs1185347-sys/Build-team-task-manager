from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ["title", "project", "assigned_to", "status", "priority", "due_date", "updated_at"]
    list_filter = ["status", "priority", "due_date", "project"]
    search_fields = ["title", "description", "project__title", "assigned_to__email"]
