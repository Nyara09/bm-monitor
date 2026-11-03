"""bioreg.mdas: the list of MDA names."""

from django.core.exceptions import PermissionDenied

from registry.models import Mda, RegistrationSite
from reports.models import ReportMdaEntry

from .access import can_edit_page
from .common import from_json, to_json


def read(user):
    return to_json(list(Mda.objects.order_by("id").values_list("name", flat=True)))


def write(user, text):
    if not can_edit_page(user, "mdam", "targets", "sites"):
        raise PermissionDenied("No permission to change MDAs")
    names = [str(name).strip() for name in from_json(text, []) if str(name).strip()]
    for name in names:
        Mda.objects.get_or_create(name=name)
    for mda in Mda.objects.exclude(name__in=names):
        in_use = (
            RegistrationSite.objects.filter(mda=mda).exists()
            or ReportMdaEntry.objects.filter(mda=mda).exists()
        )
        if not in_use:
            mda.delete()


DATASETS = {"bioreg.mdas": (read, write)}
