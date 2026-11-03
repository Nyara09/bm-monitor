"""bioreg.company, bioreg.logo, bioreg.bdrule, bioreg.mainprof: company settings and the main admin's profile."""

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied

from accounts.services import get_profile
from accounts.models import Role, UserProfile
from core.models import CompanySetting

from .access import is_manager
from .common import from_json, to_json

DEFAULT_COMPANY_NAME = "BM Monitor"


def require_manager(user):
    if not is_manager(user):
        raise PermissionDenied("Only an admin can change the settings")


def read_company(user):
    name = CompanySetting.load().company_name
    return None if name == DEFAULT_COMPANY_NAME else name


def write_company(user, text):
    require_manager(user)
    setting = CompanySetting.load()
    setting.company_name = (text or "").strip() or DEFAULT_COMPANY_NAME
    setting.save()


def read_logo(user):
    return CompanySetting.load().logo_data or None


def write_logo(user, text):
    require_manager(user)
    setting = CompanySetting.load()
    setting.logo_data = text or ""
    setting.save()


def read_backdate_rule(user):
    setting = CompanySetting.load()
    return to_json({"days": setting.backdate_days, "mode": setting.backdate_mode})


def write_backdate_rule(user, text):
    require_manager(user)
    rule = from_json(text, {})
    setting = CompanySetting.load()
    if str(rule.get("mode")) in CompanySetting.BackdateMode.values:
        setting.backdate_mode = rule["mode"]
    try:
        setting.backdate_days = max(0, min(365, int(rule.get("days", setting.backdate_days))))
    except (TypeError, ValueError):
        pass
    setting.save()


def main_admin_profile(user):
    """The profile behind the pages' 'main administrator': the signed-in admin, else the first admin."""
    profile = get_profile(user)
    if profile.role == Role.ADMIN:
        return profile
    return UserProfile.objects.filter(role=Role.ADMIN).order_by("id").first()


def read_main_profile(user):
    profile = main_admin_profile(user)
    if profile is None:
        return None
    return to_json(
        {
            "name": profile.user.get_full_name() or profile.user.get_username(),
            "phone": profile.phone,
            "photo": profile.photo_data,
            "status": "Active",
        }
    )


def write_main_profile(user, text):
    require_manager(user)
    profile = main_admin_profile(user)
    data = from_json(text, {})
    if profile is None or not data:
        return
    profile.phone = str(data.get("phone", ""))
    profile.photo_data = str(data.get("photo", ""))
    profile.save()
    name = str(data.get("name", "")).strip()
    if name:
        profile.user.first_name, profile.user.last_name = name[:150], ""
        profile.user.save(update_fields=["first_name", "last_name"])


DATASETS = {
    "bioreg.company": (read_company, write_company),
    "bioreg.logo": (read_logo, write_logo),
    "bioreg.bdrule": (read_backdate_rule, write_backdate_rule),
    "bioreg.mainprof": (read_main_profile, write_main_profile),
}
