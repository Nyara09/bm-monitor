"""bioreg.inv, bioreg.invcat, bioreg.invcathide, bioreg.invcat3: equipment inventory."""

import datetime

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Max

from inventory.models import InventoryCategory, InventoryItem

from .access import can_edit_page
from .common import from_json, iso_day, parse_day, to_json


def item_id(item):
    return item.client_id or f"inv{item.pk}"


def read_items(user):
    return to_json(
        [
            {
                "id": item_id(item),
                "cat": item.category.name,
                "desc": item.description,
                "sn": item.serial_number,
                "at": item.asset_tag,
                "ct": item.company_tag,
                "st": item.status,
                "as": item.assigned_to,
                "dr": iso_day(item.date_received),
                "nt": item.note,
            }
            for item in InventoryItem.objects.select_related("category").order_by("id")
        ]
    )


def get_category(name):
    category = InventoryCategory.objects.filter(name__iexact=name).first()
    if category is None:
        last = InventoryCategory.objects.aggregate(last=Max("sort_order"))["last"]
        category = InventoryCategory.objects.create(name=name, sort_order=(last or 0) + 1)
    return category


@transaction.atomic
def write_items(user, text):
    if not can_edit_page(user, "inv"):
        raise PermissionDenied("No permission to change the inventory")
    records = from_json(text, [])
    existing = {item_id(item): item for item in InventoryItem.objects.all()}
    sent = set()
    for record in records:
        client_id = str(record.get("id", ""))
        category_name = str(record.get("cat", "")).strip()
        if not client_id or not category_name:
            continue
        sent.add(client_id)
        item = existing.get(client_id) or InventoryItem(client_id=client_id)
        item.category = get_category(category_name)
        item.description = str(record.get("desc", ""))
        item.serial_number = str(record.get("sn", ""))
        item.asset_tag = str(record.get("at", ""))
        item.company_tag = str(record.get("ct", ""))
        item.status = str(record.get("st") or InventoryItem.Status.IN_STOCK)
        item.assigned_to = str(record.get("as", ""))
        item.date_received = (
            parse_day(record.get("dr")) or item.date_received or datetime.date.today()
        )
        item.note = str(record.get("nt", ""))
        item.save()
    for client_id, item in existing.items():
        if client_id not in sent:
            item.delete()


def read_categories(user):
    names = list(
        InventoryCategory.objects.order_by("sort_order", "id").values_list("name", flat=True)
    )
    return to_json(names) if names else None


@transaction.atomic
def write_categories(user, text):
    if not can_edit_page(user, "inv"):
        raise PermissionDenied("No permission to change the inventory")
    names = [str(name).strip() for name in from_json(text, []) if str(name).strip()]
    for order, name in enumerate(names):
        category = InventoryCategory.objects.filter(name__iexact=name).first()
        if category is None:
            InventoryCategory.objects.create(name=name, sort_order=order)
        else:
            category.name = name
            category.sort_order = order
            category.save()
    for category in InventoryCategory.objects.exclude(name__in=names):
        if not category.items.exists():
            category.delete()


def read_hidden(user):
    return to_json(
        list(InventoryCategory.objects.filter(is_hidden=True).values_list("name", flat=True))
    )


@transaction.atomic
def write_hidden(user, text):
    if not can_edit_page(user, "inv"):
        raise PermissionDenied("No permission to change the inventory")
    hidden = [str(name) for name in from_json(text, [])]
    InventoryCategory.objects.exclude(name__in=hidden).update(is_hidden=False)
    InventoryCategory.objects.filter(name__in=hidden).update(is_hidden=True)


def read_migration_flag(user):
    """The pages use bioreg.invcat3 only to remember that the category list was updated."""
    return "1"


def ignore(user, text):
    return None


DATASETS = {
    "bioreg.inv": (read_items, write_items),
    "bioreg.invcat": (read_categories, write_categories),
    "bioreg.invcathide": (read_hidden, write_hidden),
    "bioreg.invcat3": (read_migration_flag, ignore),
}
