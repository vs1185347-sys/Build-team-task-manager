from rest_framework.permissions import SAFE_METHODS, BasePermission


class ProjectPermission(BasePermission):
    message = "You do not have access to this project."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_admin_role

    def has_object_permission(self, request, view, obj) -> bool:
        if request.user.is_admin_role:
            return True
        if request.method in SAFE_METHODS:
            return obj.members.filter(id=request.user.id).exists() or obj.created_by_id == request.user.id
        return False
