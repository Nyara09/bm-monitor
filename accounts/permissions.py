"""Page permissions: who may view, edit and delete on each admin page.

The page keys ("mdam", "inv", "users" ...) are the same ones the JavaScript screens use.
"""

from functools import wraps

from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied

from accounts.models import PAGE_KEYS, PagePermission, Role
from accounts.services import get_profile
from core.models import ActiveStatus

ACTIONS = ("view", "edit", "delete")

# Pages every supervisor and reader starts with, until an admin chooses otherwise.
SUPERVISOR_PAGES = ["supr", "dcar", "regt", "myrep", "new"]
READER_PAGES = ["dash", "supr", "dcar", "rep", "ana", "anl", "mda", "msum", "regt"]


def role_defaults(role):
    """{page_key: {"view": bool, "edit": bool, "delete": bool}} for a role with no saved choices."""
    result = {}
    for key, _label in PAGE_KEYS:
        view = edit = delete = False
        if role == Role.ADMIN:
            view = edit = delete = True
        elif role == Role.SUBADMIN:
            if key not in ("users", "myrep"):
                view = edit = delete = True
        elif role == Role.SUPERVISOR:
            view = key in SUPERVISOR_PAGES
            edit = key == "new"
        elif key in READER_PAGES:
            view = True
        result[key] = {"view": view, "edit": edit, "delete": delete}
    return result


def page_permissions(user):
    """What this user may do on every page: {page_key: {"view": .., "edit": .., "delete": ..}}."""
    nothing = {key: {"view": False, "edit": False, "delete": False} for key, _ in PAGE_KEYS}
    if not user.is_authenticated:
        return nothing
    profile = get_profile(user)
    if user.is_superuser:
        return role_defaults(Role.ADMIN)
    if profile.status == ActiveStatus.INACTIVE:
        return role_defaults(Role.READER)
    rows = list(PagePermission.objects.filter(profile=profile))
    if not rows:
        return role_defaults(profile.role)
    saved = {row.page_key: row for row in rows}
    result = {}
    for key, _label in PAGE_KEYS:
        row = saved.get(key)
        result[key] = {
            "view": bool(row and row.can_view),
            "edit": bool(row and row.can_view and row.can_edit),
            "delete": bool(row and row.can_view and row.can_delete),
        }
    return result


def has_permission(user, page_key, action="view"):
    return page_permissions(user).get(page_key, {}).get(action, False)


def is_manager(user):
    """Admins and sub admins."""
    if not user.is_authenticated:
        return False
    return user.is_superuser or get_profile(user).role in (Role.ADMIN, Role.SUBADMIN)


def screen_permission(page_key, action="view"):
    """Decorator for a view: sign in first, then need this permission on this page."""

    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect_to_login(request.get_full_path())
            if not has_permission(request.user, page_key, action):
                raise PermissionDenied
            return view(request, *args, **kwargs)

        return wrapper

    return decorator


def first_allowed_url(user):
    """Where to send someone after sign in: the first sidebar page they may open."""
    from core.navigation import NAV_ITEMS

    permissions = page_permissions(user)
    for item in NAV_ITEMS:
        if permissions[item.key]["view"]:
            return item.url()
    return "/"
