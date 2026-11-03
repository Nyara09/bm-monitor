"""Turns a Django user into the account data the pages need (role, permissions, Switch view cards)."""

from accounts.models import PagePermission, Role, UserProfile


def default_cards(role):
    """Switch view cards a role gets when nobody has chosen them (same rule as the template)."""
    is_manager = role in (Role.ADMIN, Role.SUBADMIN)
    return {
        "can_open_administrator_card": is_manager,
        "can_open_map_overview_card": True,
        "can_open_supervisor_card": is_manager or role == Role.SUPERVISOR,
    }


def get_profile(user):
    """Return the user's profile, creating it on first use (superusers become admins)."""
    try:
        return user.profile
    except UserProfile.DoesNotExist:
        role = Role.ADMIN if user.is_superuser else Role.SUPERVISOR
        return UserProfile.objects.create(user=user, role=role, **default_cards(role))


def session_payload(user):
    """The JSON the sign-in screen stores in the browser for this user."""
    profile = get_profile(user)
    permissions = {
        row.page_key: {"v": int(row.can_view), "e": int(row.can_edit), "d": int(row.can_delete)}
        for row in PagePermission.objects.filter(profile=profile)
    }
    payload = {
        "authenticated": True,
        "username": user.get_username(),
        "name": user.get_full_name() or user.get_username(),
        "role": profile.role,
        "status": profile.status,
        "phone": profile.phone,
        "cards": {
            "adm": int(profile.can_open_administrator_card),
            "nat": int(profile.can_open_map_overview_card),
            "sup": int(profile.can_open_supervisor_card),
        },
    }
    # No permission rows means "use the role's default pages" (the pages know those).
    if permissions:
        payload["perms"] = permissions
    return payload
