from django.contrib import admin

from .models import InventoryCategory, InventoryItem


@admin.register(InventoryCategory)
class InventoryCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "is_hidden", "sort_order")


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = (
        "description",
        "category",
        "status",
        "assigned_to",
        "asset_tag",
        "date_received",
    )
    list_filter = ("category", "status")
    search_fields = ("description", "asset_tag", "serial_number", "company_tag", "assigned_to")
