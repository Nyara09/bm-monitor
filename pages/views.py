"""Views for the map page and the JavaScript screens, plus the JSON views those screens use.

Page views render the templates in pages/templates/pages/.
The JSON views are the link between those screens and the database:
  sign_in / sign_out / session_info   Django sign-in for the sign-in screen
  data_read / data_write              load every data set, save one data set
"""

import json

from django.contrib.auth import authenticate, login, logout
from django.core.exceptions import PermissionDenied
from django.http import Http404, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from accounts.services import get_profile, session_payload
from core.models import ActiveStatus
from core.services import log_activity
from pages import storage

# JavaScript screens that are still built in the browser.
# (Screens that are Django pages, such as /screens/mdas/, are in their own apps.)
SCREEN_TITLES = {
    "admin": "Administrator",
    "supervisor": "Supervisor",
    "dashboard": "Daily dashboard",
    "supervisor-report": "Supervisor report",
    "dca-report": "DCA report",
    "daily-reports": "Daily reports",
    "daily-analysis": "Daily analysis",
    "analytics": "Analytics",
    "mda-registrations": "MDA registrations",
    "inventory-report": "Inventory report",
    "incident-log": "Incident log report",
    "my-report": "My report",
    "enter-daily-report": "Enter daily report",
    "deployment-plan": "Deployment plan",
    "backup-data": "Backup data",
}


# ---------------------------------------------------------------- page views


@ensure_csrf_cookie
def map_page(request):
    """Sign-in, Switch view, the map and Map Overview."""
    return render(request, "pages/map.html")


@ensure_csrf_cookie
def admin_page(request):
    """Administrator and supervisor screens (opened from the Switch view)."""
    return render(request, "pages/admin.html")


@ensure_csrf_cookie
def screen_page(request, slug):
    """One JavaScript screen on its own URL, e.g. /screens/daily-reports/."""
    if slug not in SCREEN_TITLES:
        raise Http404("Unknown screen")
    return render(request, f"pages/screens/{slug}.html", {"screen_title": SCREEN_TITLES[slug]})


def screens_index(request):
    """/screens/ has no page of its own: go to the administrator screen."""
    return redirect("pages:screen", slug="admin")


def overview_redirect(request):
    """Map Overview lives on the map page."""
    return redirect(reverse("pages:map") + "#overview")


# ---------------------------------------------------------------- sign-in (JSON)


def active_user(request):
    """The signed-in Django user, or None (nobody signed in, or an inactive account)."""
    user = request.user
    if not user.is_authenticated or get_profile(user).status == ActiveStatus.INACTIVE:
        return None
    return user


@require_POST
def sign_in(request):
    """Check the username and password and start a Django session."""
    try:
        body = json.loads(request.body or "{}")
    except ValueError:
        return JsonResponse({"error": "Send the username and password."}, status=400)
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "Incorrect username or password."}, status=401)
    if get_profile(user).status == ActiveStatus.INACTIVE:
        return JsonResponse(
            {"error": "This account is inactive. Contact the administrator."}, status=403
        )
    login(request, user)
    log_activity(user, "Signed in", "Account")
    return JsonResponse(session_payload(user))


@require_POST
def sign_out(request):
    """End the Django session."""
    if request.user.is_authenticated:
        log_activity(request.user, "Signed out", "Account")
    logout(request)
    return JsonResponse({"authenticated": False})


@require_GET
def session_info(request):
    """Who is signed in right now."""
    user = active_user(request)
    if user is None:
        return JsonResponse({"authenticated": False})
    return JsonResponse(session_payload(user))


# ---------------------------------------------------------------- data (JSON)


@require_GET
def data_read(request):
    """Everything the screens need at start-up: the signed-in user and every data set."""
    user = active_user(request)
    if user is None:
        return JsonResponse({"authenticated": False}, status=401)
    return JsonResponse({"user": session_payload(user), "values": storage.read_all(user)})


@require_POST
def data_write(request):
    """Save one data set. The body is {"key": "bioreg.reports", "value": "<JSON text>" or null}."""
    user = active_user(request)
    if user is None:
        return JsonResponse({"error": "Sign in first."}, status=401)
    try:
        body = json.loads(request.body or "{}")
        key = str(body["key"])
        value = body.get("value")
        if value is not None and not isinstance(value, str):
            raise ValueError
    except (ValueError, KeyError):
        return JsonResponse({"error": "Send a key and a text value."}, status=400)
    if not storage.is_synced_key(key):
        return JsonResponse({"error": "Unknown data set."}, status=404)
    try:
        storage.write_one(user, key, value)
    except PermissionDenied as problem:
        return JsonResponse({"error": str(problem) or "Not allowed."}, status=403)
    return JsonResponse({"ok": True})
