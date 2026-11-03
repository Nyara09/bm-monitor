"""bioreg.dcalist and bioreg.dcap: data collectors and their per-site profiles."""

from django.core.exceptions import PermissionDenied
from django.db import transaction

from registry.models import DataCollector, RegistrationSite, SiteDataCollector

from .access import can_edit_page
from .common import from_json, to_json


def collector_id(collector):
    return collector.client_id or f"dc{collector.pk}"


def read_list(user):
    return to_json(
        [
            {
                "id": collector_id(c),
                "name": c.name,
                "phone": c.phone,
                "photo": c.photo_data,
                "status": c.status,
            }
            for c in DataCollector.objects.order_by("id")
        ]
    )


@transaction.atomic
def write_list(user, text):
    records = from_json(text, [])
    full_access = can_edit_page(user, "dca")
    by_id = {collector_id(c): c for c in DataCollector.objects.all()}
    by_name = {c.name.lower(): c for c in by_id.values()}
    sent_names = set()
    for record in records:
        name = str(record.get("name", "")).strip()
        if not name:
            continue
        sent_names.add(name.lower())
        client_id = str(record.get("id", ""))
        collector = by_id.get(client_id) or by_name.get(name.lower())
        if collector is None:
            collector = DataCollector(client_id=client_id)
        elif not full_access:
            continue  # members may add names (when they submit a report) but not edit them
        collector.name = name
        collector.phone = str(record.get("phone", ""))
        collector.photo_data = str(record.get("photo", ""))
        collector.status = "Inactive" if record.get("status") == "Inactive" else "Active"
        collector.save()
    if full_access:
        for collector in DataCollector.objects.all():
            if collector.name.lower() not in sent_names:
                collector.delete()


def read_profiles(user):
    profiles = {}
    links = SiteDataCollector.objects.select_related("site", "collector")
    for link in links:
        if link.phone or link.photo_data or link.status:
            key = f"{link.site.code}|{link.collector.name.lower()}"
            profiles[key] = {
                "phone": link.phone,
                "photo": link.photo_data,
                "status": link.status or "Active",
            }
    return to_json(profiles)


@transaction.atomic
def write_profiles(user, text):
    if not can_edit_page(user, "dca"):
        raise PermissionDenied("No permission to change data collectors")
    profiles = from_json(text, {})
    sites = {site.code: site for site in RegistrationSite.objects.all()}
    kept = set()
    for key, profile in profiles.items():
        site_code, _, name = key.partition("|")
        site = sites.get(site_code)
        if site is None or not name:
            continue
        collector = DataCollector.objects.filter(name__iexact=name).first()
        if collector is None:
            collector = DataCollector.objects.create(name=name)
        link, _ = SiteDataCollector.objects.get_or_create(site=site, collector=collector)
        link.phone = str(profile.get("phone", ""))
        link.photo_data = str(profile.get("photo", ""))
        link.status = str(profile.get("status", ""))
        link.save()
        kept.add(link.pk)
    SiteDataCollector.objects.exclude(pk__in=kept).update(phone="", photo_data="", status="")


DATASETS = {
    "bioreg.dcalist": (read_list, write_list),
    "bioreg.dcap": (read_profiles, write_profiles),
}
