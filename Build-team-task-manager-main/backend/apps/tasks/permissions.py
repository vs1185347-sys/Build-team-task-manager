from rest_framework.permissions import SAFE_METHODS, BasePermission


class TaskPermission(BasePermission):
    message = "You do not have permission for this task."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        if request.user.is_admin_role:
            return True
        return view.action in {"partial_update", "update"}

    def has_object_permission(self, request, view, obj) -> bool:
        if request.user.is_admin_role:
            return True
        if request.method in SAFE_METHODS:
            return obj.project.members.filter(id=request.user.id).exists() or obj.assigned_to_id == request.user.id
        return obj.assigned_to_id == request.user.id and set(request.data.keys()).issubset({"status"})
