"""bioreg.draft|<username>: the unfinished Enter daily report form of one user."""

from django.core.exceptions import PermissionDenied

from reports.models import ReportDraft

from .common import from_json, to_json

PREFIX = "bioreg.draft|"


def key_for(user):
    return PREFIX + user.get_username().lower()


def read(user):
    draft = ReportDraft.objects.filter(user=user).first()
    return to_json(draft.content) if draft else None


def write(user, text):
    if text is None:
        ReportDraft.objects.filter(user=user).delete()
        return
    ReportDraft.objects.update_or_create(user=user, defaults={"content": from_json(text, {})})


def check_key(user, key):
    """A person can only save their own draft."""
    if key != key_for(user):
        raise PermissionDenied("That draft belongs to somebody else")
