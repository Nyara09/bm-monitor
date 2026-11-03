"""Small helpers used by several apps."""

from django.utils import timezone

from core.models import ActivityLog


def log_activity(user, action, kind, detail=""):
    """Add a line to the activity log (who did what, shown on the Activity log)."""
    username = user.get_username() if user is not None and user.is_authenticated else "system"
    ActivityLog.objects.create(
        user=user if user is not None and user.is_authenticated else None,
        username=username,
        action=action[:60],
        kind=kind[:60],
        detail=detail,
        at=timezone.now(),
    )
