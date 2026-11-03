"""bioreg.users: accounts created by the administrator (the main administrator is handled apart).

Passwords never travel in the data. The pages swap a typed password for a token; the sync script
sends the real password as "_pw" and Django stores it with its own hashing.
"""

import re

from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.services import default_cards, get_profile
from accounts.models import PAGE_KEYS, PagePermission, Role, UserProfile

from .access import is_manager
from .common import from_json, to_json

User = get_user_model()
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]{3,32}$")
VALID_PAGE_KEYS = {key for key, _label in PAGE_KEYS}
CARD_FIELDS = {
    "adm": "can_open_administrator_card",
    "nat": "can_open_map_overview_card",
    "sup": "can_open_supervisor_card",
}


def user_record(profile):
    record = {
        "id": f"u{profile.pk}",
        "u": profile.user.get_username(),
        "name": profile.user.get_full_name() or profile.user.get_username(),
        "role": profile.role,
        "phone": profile.phone,
        "photo": profile.photo_data,
        "status": profile.status,
        "cards": {short: int(getattr(profile, field)) for short, field in CARD_FIELDS.items()},
    }
    permissions = {
        row.page_key: {"v": int(row.can_view), "e": int(row.can_edit), "d": int(row.can_delete)}
        for row in profile.page_permissions.all()
    }
    if permissions:
        record["perms"] = permissions
    if profile.must_change_password:
        record["must"] = True
    return record


def read(user):
    profiles = (
        UserProfile.objects.exclude(role=Role.ADMIN)
        .select_related("user")
        .prefetch_related("page_permissions")
    )
    return to_json([user_record(profile) for profile in profiles.order_by("id")])


def set_own_password(user, records):
    """A member can change only their own password (their record carries "_pw")."""
    for record in records:
        if str(record.get("u", "")).lower() == user.get_username().lower() and record.get("_pw"):
            user.set_password(str(record["_pw"]))
            user.save(update_fields=["password"])
            profile = get_profile(user)
            profile.must_change_password = bool(record.get("must"))
            profile.save(update_fields=["must_change_password", "updated_at"])


def apply_record(actor, record):
    username = str(record.get("u", "")).strip()
    if not USERNAME_PATTERN.match(username):
        return None
    user = User.objects.filter(username__iexact=username).first()
    if user is not None and get_profile(user).role == Role.ADMIN:
        return user  # administrators are managed in Django, not from this list
    if user is None:
        user = User(username=username)
        user.set_unusable_password()
    name = str(record.get("name", "")).strip()
    user.first_name, user.last_name = name[:150], ""
    if record.get("_pw"):
        user.set_password(str(record["_pw"]))
    user.save()

    profile = get_profile(user)
    role = record.get("role")
    if role in Role.values and (
        role != Role.ADMIN or get_profile(actor).role == Role.ADMIN or actor.is_superuser
    ):
        profile.role = role
    profile.phone = str(record.get("phone", ""))
    profile.photo_data = str(record.get("photo", ""))
    profile.status = "Inactive" if record.get("status") == "Inactive" else "Active"
    profile.must_change_password = bool(record.get("must"))
    cards = record.get("cards")
    defaults = default_cards(profile.role)
    for short, field in CARD_FIELDS.items():
        setattr(
            profile,
            field,
            bool(cards[short]) if isinstance(cards, dict) and short in cards else defaults[field],
        )
    profile.save()

    permissions = record.get("perms")
    if isinstance(permissions, dict):
        profile.page_permissions.all().delete()
        PagePermission.objects.bulk_create(
            PagePermission(
                profile=profile,
                page_key=page,
                can_view=bool(flags.get("v")),
                can_edit=bool(flags.get("e")),
                can_delete=bool(flags.get("d")),
            )
            for page, flags in permissions.items()
            if page in VALID_PAGE_KEYS and isinstance(flags, dict)
        )
    return user


@transaction.atomic
def write(actor, text):
    records = [record for record in from_json(text, []) if isinstance(record, dict)]
    if not is_manager(actor):
        set_own_password(actor, records)
        return
    kept_ids = set()
    for record in records:
        user = apply_record(actor, record)
        if user is not None:
            kept_ids.add(user.pk)
    doomed = (
        UserProfile.objects.exclude(role=Role.ADMIN)
        .exclude(user__pk__in=kept_ids)
        .exclude(user=actor)
        .exclude(user__is_superuser=True)
    )
    for profile in doomed:
        profile.user.delete()


DATASETS = {"bioreg.users": (read, write)}
