"""Forms of the inventory app."""

from django import forms

from core.forms import BootstrapFormMixin

from .models import InventoryCategory, InventoryItem


class InventoryItemForm(BootstrapFormMixin, forms.ModelForm):
    class Meta:
        model = InventoryItem
        fields = [
            "category",
            "description",
            "serial_number",
            "asset_tag",
            "company_tag",
            "status",
            "assigned_to",
            "date_received",
            "note",
        ]
        widgets = {
            "date_received": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "note": forms.Textarea(attrs={"rows": 3}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["category"].queryset = InventoryCategory.objects.filter(is_hidden=False)


class InventoryCategoryForm(BootstrapFormMixin, forms.ModelForm):
    class Meta:
        model = InventoryCategory
        fields = ["name", "sort_order", "is_hidden"]
