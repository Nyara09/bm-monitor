"""bioreg.v2: the map data (cities and towns, airports, roads, counties, registration sites and their targets)."""

import datetime

from django.core.exceptions import PermissionDenied
from django.db import transaction

from core.models import CompanySetting
from geography.models import County, Place, Road, State
from registry.models import DataCollector, Mda, RegistrationSite, SiteDataCollector

from .access import can_edit_page
from .common import from_json, iso_day, iso_moment, parse_day, split_extra, to_int, to_json

PLACE_CODES = {Place.Kind.CITY: "c", Place.Kind.TOWN: "t", Place.Kind.AIRPORT: "a"}
PLACE_KINDS = {code: kind for kind, code in PLACE_CODES.items()}

SITE_MAPPED_KEYS = {
    "id", "name", "mda", "status", "cap", "lon", "lat", "note", "_excelKey", "_st", "_cn",
    "fte", "open", "deadline", "sup", "dcaN", "cmt", "dcas",
}  # fmt: skip
COUNTY_FIELDS = [
    ("e", "workforce"),
    ("ph", "phase"),
    ("st", "security_status"),
    ("sf", "safety_level"),
    ("ac", "access_level"),
    ("rm", "remarks"),
    ("rc", "recommendation"),
    ("md", "travel_mode"),
]
COUNTY_MAPPED_KEYS = {"n"} | {short for short, _field in COUNTY_FIELDS}
SHAPE_MAPPED_KEYS = {"n", "si", "hq", "poly"}


# ---------------------------------------------------------------- read


def site_record(site, collector_names):
    record = {
        "id": site.code,
        "name": site.name,
        "mda": site.mda.name if site.mda else "",
        "status": site.status,
        "cap": site.capacity,
        "note": site.note,
    }
    if site.longitude is not None:
        record["lon"] = site.longitude
    if site.latitude is not None:
        record["lat"] = site.latitude
    if site.import_key:
        record["_excelKey"] = site.import_key
    if site.state:
        record["_st"] = site.state.name
    if site.county:
        record["_cn"] = site.county.name
    if site.target_total:
        record["fte"] = site.target_total
    if site.opening_date:
        record["open"] = iso_day(site.opening_date)
    if site.closing_date:
        record["deadline"] = iso_day(site.closing_date)
    if site.supervisor_name:
        record["sup"] = site.supervisor_name
    if site.dcas_planned:
        record["dcaN"] = site.dcas_planned
    if site.comment:
        record["cmt"] = site.comment
    if collector_names:
        record["dcas"] = collector_names
    record.update(site.extra)
    return record


def read(user):
    if not (Place.objects.exists() or Road.objects.exists() or RegistrationSite.objects.exists()):
        return None
    setting = CompanySetting.load()

    places = [
        [p.name, p.longitude, p.latitude, PLACE_CODES.get(p.kind, "t"), int(p.has_airport)]
        for p in Place.objects.order_by("id")
    ]
    roads = [
        {
            "id": r.code,
            "name": r.name,
            "type": r.road_type,
            "src": r.source,
            "from": r.start_point,
            "to": r.end_point,
            "pts": r.points,
        }
        for r in Road.objects.order_by("id")
    ]

    collectors = {}
    for link in SiteDataCollector.objects.select_related("collector").order_by("id"):
        collectors.setdefault(link.site_id, []).append(link.collector.name)
    sites = [
        site_record(site, collectors.get(site.pk, []))
        for site in RegistrationSite.objects.select_related("mda", "state", "county").order_by("id")
    ]

    states = list(State.objects.order_by("order"))
    counties_by_state = {state.pk: [] for state in states}
    shapes = []
    for county in County.objects.select_related("state").order_by("state__order", "id"):
        counties_by_state[county.state_id].append(county)
        shape = {"n": county.name, "si": county.state.order, "poly": county.boundary}
        if county.headquarters_lon is not None and county.headquarters_lat is not None:
            shape["hq"] = [county.headquarters_lon, county.headquarters_lat]
        shape.update(county.extra.get("co", {}))
        shapes.append(shape)
    attributes = []
    for state in states:
        rows = []
        for county in counties_by_state[state.pk]:
            row = {"n": county.name}
            row.update({short: getattr(county, field) for short, field in COUNTY_FIELDS})
            row.update(county.extra.get("cty", {}))
            rows.append(row)
        attributes.append(rows)

    return to_json(
        {
            "v": 2,
            "saved": iso_moment(datetime.datetime.now(datetime.timezone.utc)),
            "dirty": setting.map_dirty,
            "PL": places,
            "SITES": sites,
            "ROADS": roads,
            "COUNTIES": shapes,
            "CTY": attributes,
        }
    )


# ---------------------------------------------------------------- write


def write_places(places):
    Place.objects.all().delete()
    Place.objects.bulk_create(
        Place(
            name=str(row[0]),
            longitude=float(row[1]),
            latitude=float(row[2]),
            kind=PLACE_KINDS.get(row[3], Place.Kind.TOWN),
            has_airport=bool(row[4]) if len(row) > 4 else row[3] == "a",
        )
        for row in places
        if isinstance(row, list) and len(row) >= 4
    )


def write_roads(roads):
    kept = []
    for number, road in enumerate(roads):
        code = str(road.get("id") or f"road-{number}")
        kept.append(code)
        Road.objects.update_or_create(
            code=code,
            defaults={
                "name": str(road.get("name", "")),
                "road_type": str(road.get("type", "main")),
                "source": str(road.get("src", "")),
                "start_point": str(road.get("from", "")),
                "end_point": str(road.get("to", "")),
                "points": road.get("pts") or [],
            },
        )
    Road.objects.exclude(code__in=kept).delete()


def write_counties(shapes, attributes):
    states = {state.order: state for state in State.objects.all()}
    shape_of = {(shape.get("si"), shape.get("n")): shape for shape in shapes}
    kept = []
    for order, rows in enumerate(attributes):
        state = states.get(order)
        if state is None:
            continue
        for row in rows:
            name = str(row.get("n", ""))
            shape = shape_of.get((order, name), {})
            hq = shape.get("hq") or [None, None]
            county, _ = County.objects.get_or_create(state=state, name=name)
            for short, field in COUNTY_FIELDS:
                value = row.get(short, "")
                setattr(county, field, to_int(value) if short in ("e", "ph") else str(value or ""))
            county.headquarters_lon, county.headquarters_lat = hq[0], hq[1]
            county.boundary = shape.get("poly") or []
            county.extra = {
                "co": split_extra(shape, SHAPE_MAPPED_KEYS),
                "cty": split_extra(row, COUNTY_MAPPED_KEYS),
            }
            county.save()
            kept.append(county.pk)
    County.objects.exclude(pk__in=kept).delete()


def write_sites(sites):
    states = {state.name: state for state in State.objects.all()}
    counties = {(c.state.name, c.name): c for c in County.objects.select_related("state")}
    existing = {site.code: site for site in RegistrationSite.objects.all()}
    kept = []
    for record in sites:
        code = str(record.get("id", ""))
        if not code:
            continue
        kept.append(code)
        site = existing.get(code) or RegistrationSite(code=code)
        site.name = str(record.get("name", ""))
        mda_name = str(record.get("mda", "")).strip()
        site.mda = Mda.objects.get_or_create(name=mda_name)[0] if mda_name else None
        site.status = str(record.get("status") or "Planned")
        site.capacity = to_int(record.get("cap"))
        site.longitude = record.get("lon")
        site.latitude = record.get("lat")
        site.note = str(record.get("note", ""))
        site.import_key = str(record.get("_excelKey", ""))
        site.state = states.get(record.get("_st"))
        site.county = counties.get((record.get("_st"), record.get("_cn")))
        site.target_total = to_int(record.get("fte"))
        site.opening_date = parse_day(record.get("open")) if record.get("open") else None
        site.closing_date = parse_day(record.get("deadline")) if record.get("deadline") else None
        site.supervisor_name = str(record.get("sup", ""))
        site.dcas_planned = to_int(record.get("dcaN"))
        site.comment = str(record.get("cmt", ""))
        site.is_target = bool(
            record.get("tg")
            or record.get("open")
            or record.get("deadline")
            or record.get("sup")
            or to_int(record.get("dcaN"))
            or record.get("status") == "Active"
        )
        site.extra = split_extra(record, SITE_MAPPED_KEYS)
        site.save()
        if isinstance(record.get("dcas"), list):
            write_site_collectors(site, record["dcas"])
    RegistrationSite.objects.exclude(code__in=kept).delete()


def write_site_collectors(site, names):
    wanted = []
    for name in names:
        name = str(name).strip()
        if not name:
            continue
        collector = DataCollector.objects.filter(
            name__iexact=name
        ).first() or DataCollector.objects.create(name=name)
        SiteDataCollector.objects.get_or_create(site=site, collector=collector)
        wanted.append(collector.pk)
    SiteDataCollector.objects.filter(site=site).exclude(collector__pk__in=wanted).delete()


@transaction.atomic
def write(user, text):
    if not can_edit_page(user, "counties", "places", "airports", "sites", "roads", "targets"):
        raise PermissionDenied("No permission to change the map data")
    snapshot = from_json(text, None)
    if not isinstance(snapshot, dict) or snapshot.get("v") != 2:
        return
    write_places(snapshot.get("PL") or [])
    write_roads(snapshot.get("ROADS") or [])
    write_counties(snapshot.get("COUNTIES") or [], snapshot.get("CTY") or [])
    write_sites(snapshot.get("SITES") or [])
    setting = CompanySetting.load()
    setting.map_dirty = bool(snapshot.get("dirty"))
    setting.save(update_fields=["map_dirty", "updated_at"])


DATASETS = {"bioreg.v2": (read, write)}
