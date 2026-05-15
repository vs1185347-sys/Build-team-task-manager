import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User

user = User.objects.filter(email='vishalmaury@gmail.com').first()
if user:
    user.role = User.Role.ADMIN
    user.is_superuser = True
    user.is_staff = True
    user.save()
    print("Updated vishal to admin")
else:
    print("User not found")
