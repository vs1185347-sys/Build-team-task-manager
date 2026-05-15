from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import User
from apps.projects.models import Project
from apps.tasks.models import Task


class Command(BaseCommand):
    help = "Create demo users, projects, and tasks for assessment walkthroughs."

    def handle(self, *args, **options):
        admin, _ = User.objects.get_or_create(
            email="admin@taskmanager.dev",
            defaults={"name": "Avery Admin", "role": User.Role.ADMIN, "is_staff": True},
        )
        admin.set_password("AdminPass123!")
        admin.role = User.Role.ADMIN
        admin.is_staff = True
        admin.save()

        member, _ = User.objects.get_or_create(
            email="member@taskmanager.dev",
            defaults={"name": "Mira Member", "role": User.Role.MEMBER},
        )
        member.set_password("MemberPass123!")
        member.role = User.Role.MEMBER
        member.save()

        today = timezone.localdate()
        launch, _ = Project.objects.get_or_create(
            title="Platform Launch",
            defaults={
                "description": "Coordinate API, product, and QA work for the launch milestone.",
                "due_date": today + timedelta(days=21),
                "created_by": admin,
            },
        )
        launch.members.set([admin, member])

        quality, _ = Project.objects.get_or_create(
            title="Quality Sprint",
            defaults={
                "description": "Tighten regression coverage and handoff notes before release.",
                "due_date": today + timedelta(days=12),
                "created_by": admin,
            },
        )
        quality.members.set([admin, member])

        samples = [
            (launch, "Finalize dashboard metrics", Task.Status.IN_PROGRESS, Task.Priority.HIGH, admin, 5),
            (launch, "QA auth permissions", Task.Status.REVIEW, Task.Priority.HIGH, member, 7),
            (launch, "Prepare release checklist", Task.Status.TODO, Task.Priority.MEDIUM, member, 10),
            (quality, "Write API smoke tests", Task.Status.DONE, Task.Priority.MEDIUM, admin, 2),
            (quality, "Review mobile layout", Task.Status.TODO, Task.Priority.LOW, member, 6),
        ]

        for project, title, status, priority, assignee, days in samples:
            Task.objects.update_or_create(
                project=project,
                title=title,
                defaults={
                    "description": f"Demo task for {project.title}.",
                    "status": status,
                    "priority": priority,
                    "assigned_to": assignee,
                    "due_date": today + timedelta(days=days),
                },
            )

        self.stdout.write(self.style.SUCCESS("Demo workspace ready."))
