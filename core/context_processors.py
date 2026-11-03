"""Values every Django page needs: the company, the sidebar and the signed-in person."""

from accounts.models import Role
from accounts.permissions import page_permissions
from accounts.services import get_profile
from core.models import CompanySetting
from core.navigation import NAV_ITEMS

# Pages whose sidebar entry shows how many rows they hold.
COUNTED_PAGES = {
    "counties": ("geography", "County"),
    "places": ("geography", "Place"),
    "airports": ("geography", "Place"),
    "sites": ("registry", "RegistrationSite"),
    "roads": ("geography", "Road"),
}


def row_count(page_key):
    from django.apps import apps

    app_label, model_name = COUNTED_PAGES[page_key]
    model = apps.get_model(app_label, model_name)
    if page_key == "airports":
        return (
            model.objects.filter(has_airport=True).count()
            or model.objects.filter(kind="airport").count()
        )
    if page_key == "places":
        return model.objects.exclude(kind="airport").count()
    return model.objects.count()


def sidebar(request):
    """The groups and items this person may see, with the current page marked."""
    permissions = page_permissions(request.user)
    is_supervisor = get_profile(request.user).role == Role.SUPERVISOR
    groups = []
    for item in NAV_ITEMS:
        if not permissions[item.key]["view"]:
            continue
        if item.key == "myrep" and not is_supervisor:
            continue
        if not groups or groups[-1]["name"] != item.group:
            groups.append({"name": item.group, "items": []})
        url = item.url()
        groups[-1]["items"].append(
            {
                "key": item.key,
                "label": item.label,
                "icon": item.icon,
                "url": url,
                "active": request.path.startswith(url),
                "count": row_count(item.key) if item.key in COUNTED_PAGES else None,
            }
        )
    return groups


def shell(request):
    """Context for core/base.html. Only built for signed-in people on Django pages."""
    if not request.user.is_authenticated:
        return {}
    if not request.resolver_match or request.resolver_match.namespace in ("pages", "admin", ""):
        return {}
    return {
        "company": CompanySetting.load(),
        "sidebar_groups": sidebar(request),
        "permissions": page_permissions(request.user),
    }
