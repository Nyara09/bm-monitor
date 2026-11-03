from django.urls import reverse

from core.testing import ScreenTestCase
from inventory.models import InventoryCategory, InventoryItem


class InventoryScreenTests(ScreenTestCase):
    def setUp(self):
        self.category = InventoryCategory.objects.create(name="Laptops")
        self.sign_in(self.admin)

    def test_add_filter_and_delete_item(self):
        self.client.post(
            reverse("inventory:item_create"),
            {
                "category": self.category.pk,
                "description": "Dell 5420",
                "status": "In stock",
                "date_received": "2026-03-01",
            },
        )
        item = InventoryItem.objects.get()
        self.assertContains(
            self.client.get(reverse("inventory:item_list"), {"search": "dell"}), "Dell 5420"
        )
        self.assertNotContains(
            self.client.get(reverse("inventory:item_list"), {"search": "hp"}), "Dell 5420"
        )
        self.client.post(reverse("inventory:item_delete", args=[item.pk]))
        self.assertFalse(InventoryItem.objects.exists())

    def test_category_with_items_cannot_be_deleted(self):
        InventoryItem.objects.create(
            category=self.category, description="x", date_received="2026-03-01"
        )
        response = self.client.post(
            reverse("inventory:category_delete", args=[self.category.pk]), follow=True
        )
        self.assertContains(response, "cannot be deleted")
        self.assertTrue(InventoryCategory.objects.exists())

    def test_supervisor_cannot_open_inventory(self):
        self.sign_in(self.supervisor)
        self.assertEqual(self.client.get(reverse("inventory:item_list")).status_code, 403)
