"""The colour theme every person sees. Everyone reads it; only an admin changes it."""

import json
import re

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from accounts.models import Role
from accounts.services import get_profile

from .models import CompanySetting

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
SYSTEM_DEFAULT = ("#A0522D", "#FFFFFF", "#000000")  # terracotta, white, black
CUSTOM_DEFAULT = ("#2E7D57", "#A0522D", "#2F353B")


def is_admin(user):
    return user.is_authenticated and (user.is_superuser or get_profile(user).role == Role.ADMIN)


def three_colours(values, default):
    """Up to three '#rrggbb' values; anything missing or wrong becomes the default."""
    values = list(values)[:3]
    return [
        value if isinstance(value, str) and HEX.match(value) else default[i]
        for i, value in enumerate(values + [None] * (3 - len(values)))
    ]


def theme_dict(setting):
    mode, _, rest = (setting.colour_theme or "system").partition(":")
    if mode not in ("system", "custom"):
        mode = "system"
    custom = three_colours(rest.split(":"), CUSTOM_DEFAULT)
    system = three_colours(setting.system_colours.split(":"), SYSTEM_DEFAULT)
    return {
        "mode": mode,
        "main": custom[0],
        "second": custom[1],
        "third": custom[2],
        "system": {"main": system[0], "second": system[1], "third": system[2]},
    }


@require_http_methods(["GET", "POST"])
def colour_theme(request):
    setting = CompanySetting.load()
    if request.method == "POST":
        if not is_admin(request.user):
            return JsonResponse({"error": "Only an admin can change the colours"}, status=403)
        try:
            body = json.loads(request.body or b"{}")
        except ValueError:
            return JsonResponse({"error": "Invalid data"}, status=400)
        if not isinstance(body, dict):
            return JsonResponse({"error": "Invalid data"}, status=400)
        mode = body.get("mode") if body.get("mode") in ("system", "custom") else "system"
        if mode == "custom":
            colours = three_colours(
                [body.get(k) for k in ("main", "second", "third")], CUSTOM_DEFAULT
            )
            setting.colour_theme = "custom:" + ":".join(colours)
        else:
            setting.colour_theme = mode
        system = body.get("system")
        if isinstance(system, dict):
            colours = three_colours(
                [system.get(k) for k in ("main", "second", "third")], SYSTEM_DEFAULT
            )
            setting.system_colours = (
                "" if tuple(c.upper() for c in colours) == SYSTEM_DEFAULT else ":".join(colours)
            )
        setting.save(update_fields=["colour_theme", "system_colours", "updated_at"])
    response = JsonResponse(theme_dict(setting))
    response["Cache-Control"] = "no-store"
    return response
