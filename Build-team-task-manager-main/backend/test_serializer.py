import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.serializers import RegisterSerializer

data = {
    "name": "Admin User",
    "email": "testadmin@example.com",
    "password": "Password123!",
    "confirm_password": "Password123!",
    "role": "ADMIN"
}

serializer = RegisterSerializer(data=data)
print("Is valid:", serializer.is_valid())
if not serializer.is_valid():
    print("Errors:", serializer.errors)
else:
    user = serializer.save()
    print("User role:", user.role)
    print("User is_admin_role:", user.is_admin_role)
