"""Equipment inventory."""

from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class InventoryCategory(TimeStampedModel):
    """A kind of equipment (Laptops, Cameras, ...)."""

    name = models.CharField(max_length=80, unique=True)
    is_hidden = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "inventory categories"

    def __str__(self):
        return self.name


class InventoryItem(TimeStampedModel):
    """One piece of equipment."""

    class Status(models.TextChoices):
        IN_STOCK = "In stock", "In stock"
        ASSIGNED = "Assigned", "Assigned"
        UNDER_REPAIR = "Under repair", "Under repair"
        DAMAGED = "Damaged", "Damaged"
        LOST = "Lost", "Lost"
        RETIRED = "Retired", "Retired"

    client_id = models.CharField(
        max_length=40, blank=True, db_index=True, help_text="Id the pages gave it"
    )
    category = models.ForeignKey(InventoryCategory, on_delete=models.PROTECT, related_name="items")
    description = models.CharField(max_length=200)
    serial_number = models.CharField(max_length=120, blank=True)
    asset_tag = models.CharField(max_length=120, blank=True)
    company_tag = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_STOCK)
    assigned_to = models.CharField(
        max_length=150, blank=True, help_text="Person or site the item is with"
    )
    date_received = models.DateField()
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["category__name", "description"]

    def __str__(self):
        return f"{self.description} ({self.category})"
