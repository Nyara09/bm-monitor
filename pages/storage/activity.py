"""bioreg.audit: the activity log (newest first)."""

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.utils import timezone

from core.models import ActivityLog

from .access import is_manager
from .common import from_json, iso_moment, parse_moment, to_json

MAX_ROWS = 2000


def read(user):
    rows = ActivityLog.objects.order_by("-at", "-id")[:MAX_ROWS]
    return to_json(
        [
            {
                "t": iso_moment(row.at),
                "by": row.username,
                "a": row.action,
                "k": row.kind,
                "d": row.detail,
            }
            for row in rows
        ]
    )


@transaction.atomic
def write(user, text):
    """Anyone can add entries; only admins can clear the log."""
    if text is None:
        if not is_manager(user):
            raise PermissionDenied("Only an admin can clear the activity log")
        ActivityLog.objects.all().delete()
        return
    known = {
        (iso_moment(row.at), row.username, row.action, row.kind)
        for row in ActivityLog.objects.order_by("-at")[:MAX_ROWS]
    }
    for record in from_json(text, []):
        moment = parse_moment(record.get("t")) or timezone.now()
        signature = (
            iso_moment(moment),
            str(record.get("by", "")),
            str(record.get("a", "")),
            str(record.get("k", "")),
        )
        if signature in known:
            continue
        known.add(signature)
        ActivityLog.objects.create(
            at=moment,
            username=signature[1] or "system",
            action=signature[2][:60],
            kind=signature[3][:60],
            detail=str(record.get("d", "")),
        )


DATASETS = {"bioreg.audit": (read, write)}
