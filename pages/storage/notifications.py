"""bioreg.notif and bioreg.notifread: notifications and who has read them."""

from django.db import transaction
from django.utils import timezone

from core.models import Notification, NotificationRead

from .access import is_manager
from .common import from_json, iso_moment, parse_moment, split_extra, to_json

MAPPED_KEYS = {"id", "type", "at", "by", "to", "title", "text"}


def read(user):
    return to_json(
        [
            {
                "id": n.client_id,
                "type": n.kind,
                "at": iso_moment(n.sent_at),
                "by": n.sender_username,
                "to": n.recipient_username,
                "title": n.title,
                "text": n.text,
                **n.extra,
            }
            for n in Notification.objects.order_by("-sent_at", "-id")
        ]
    )


@transaction.atomic
def write(user, text):
    records = from_json(text, [])
    existing = {n.client_id: n for n in Notification.objects.all()}
    sent = set()
    for record in records:
        client_id = str(record.get("id", ""))
        if not client_id:
            continue
        sent.add(client_id)
        if client_id in existing:
            continue  # notifications are never edited, only added or removed
        Notification.objects.create(
            client_id=client_id,
            sent_at=parse_moment(record.get("at")) or timezone.now(),
            kind=str(record.get("type", "")),
            sender_username=str(record.get("by", "")),
            recipient_username=str(record.get("to", "")),
            title=str(record.get("title", ""))[:200],
            text=str(record.get("text", "")),
            extra=split_extra(record, MAPPED_KEYS),
        )
    if is_manager(user):
        for client_id, notification in existing.items():
            if client_id not in sent:
                notification.delete()


def read_marks(user):
    marks = {}
    for read_mark in NotificationRead.objects.select_related("notification"):
        marks.setdefault(read_mark.username, {})[read_mark.notification.client_id] = 1
    return to_json(marks)


@transaction.atomic
def write_marks(user, text):
    """Each person can only change their own read marks."""
    username = user.get_username()
    own = from_json(text, {}).get(username) or {}
    wanted = {str(notification_id) for notification_id, flag in own.items() if flag}
    notifications = {n.client_id: n for n in Notification.objects.filter(client_id__in=wanted)}
    for client_id, notification in notifications.items():
        NotificationRead.objects.get_or_create(notification=notification, username=username)
    NotificationRead.objects.filter(username=username).exclude(
        notification__client_id__in=wanted
    ).delete()


DATASETS = {
    "bioreg.notif": (read, write),
    "bioreg.notifread": (read_marks, write_marks),
}
