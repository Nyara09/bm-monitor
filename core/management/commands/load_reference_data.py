"""Load the map and site data that ships with the bioreg-site template.

    python manage.py load_reference_data

Safe to run again: rows are matched by name or code and updated, never duplicated.
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import CompanySetting
from geography.models import County, Place, Road, State
from inventory.models import InventoryCategory
from registry.models import Mda, RegistrationSite

FIXTURE = Path(__file__).resolve().parents[2] / "fixtures" / "reference_data.json"

DEFAULT_INVENTORY_CATEGORIES = [
    "Laptops",
    "Cameras",
    "Tripods",
    "Fingerprint Scanners",
    "Document Scanners",
    "Modems",
    "Backdrops",
    "Curtains",
    "Extension Cords",
    "Clips",
    "Stamps",
    "External Hard Drives",
    "USB Hubs",
]


class Command(BaseCommand):
    help = "Load states, counties, cities and towns, roads, MDAs and registration sites from the template."

    @transaction.atomic
    def handle(self, *args, **options):
        data = json.loads(FIXTURE.read_text())
        counties_by_key = {}

        for state_data in data["states"]:
            counties = state_data.pop("counties")
            state, _ = State.objects.update_or_create(
                name=state_data.pop("name"), defaults=state_data
            )
            for county_data in counties:
                headquarters = county_data.pop("headquarters") or [None, None]
                county, _ = County.objects.update_or_create(
                    state=state,
                    name=county_data.pop("name"),
                    defaults={
                        **county_data,
                        "headquarters_lon": headquarters[0],
                        "headquarters_lat": headquarters[1],
                    },
                )
                counties_by_key[(state.name, county.name)] = county

        for place_data in data["places"]:
            Place.objects.update_or_create(
                name=place_data["name"],
                longitude=place_data["longitude"],
                latitude=place_data["latitude"],
                defaults={"kind": place_data["kind"], "has_airport": place_data["has_airport"]},
            )

        for road_data in data["roads"]:
            Road.objects.update_or_create(code=road_data.pop("code"), defaults=road_data)

        states_by_name = {state.name: state for state in State.objects.all()}
        for site_data in data["sites"]:
            mda_name = site_data.pop("mda")
            state_name = site_data.pop("state")
            county_name = site_data.pop("county")
            mda = Mda.objects.get_or_create(name=mda_name)[0] if mda_name else None
            RegistrationSite.objects.update_or_create(
                code=site_data.pop("code"),
                defaults={
                    **site_data,
                    "mda": mda,
                    "state": states_by_name.get(state_name),
                    "county": counties_by_key.get((state_name, county_name)),
                },
            )

        for order, name in enumerate(DEFAULT_INVENTORY_CATEGORIES):
            InventoryCategory.objects.get_or_create(name=name, defaults={"sort_order": order})
        CompanySetting.load()

        self.stdout.write(
            self.style.SUCCESS(
                f"Loaded {State.objects.count()} states, {County.objects.count()} counties, "
                f"{Place.objects.count()} places, {Road.objects.count()} roads, "
                f"{Mda.objects.count()} MDAs, {RegistrationSite.objects.count()} registration sites."
            )
        )
