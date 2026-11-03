from django.urls import reverse

from core.testing import ScreenTestCase
from geography.models import State
from registry.models import DataCollector, Mda, RegistrationSite


class MdaScreenTests(ScreenTestCase):
    def test_sign_in_is_required(self):
        response = self.client.get(reverse("registry:mda_list"))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/sign-in/", response["Location"])

    def test_admin_adds_edits_and_deletes(self):
        self.sign_in(self.admin)
        self.client.post(reverse("registry:mda_create"), {"name": "Ministry of Health"})
        mda = Mda.objects.get(name="Ministry of Health")
        self.client.post(
            reverse("registry:mda_edit", args=[mda.pk]), {"name": "Ministry of Health and Care"}
        )
        mda.refresh_from_db()
        self.assertEqual(mda.name, "Ministry of Health and Care")
        page = self.client.get(reverse("registry:mda_list"))
        self.assertContains(page, "Ministry of Health and Care")
        self.assertContains(page, "table-responsive")
        self.client.post(reverse("registry:mda_delete", args=[mda.pk]))
        self.assertFalse(Mda.objects.filter(pk=mda.pk).exists())

    def test_search_filters_rows(self):
        Mda.objects.create(name="Alpha")
        Mda.objects.create(name="Beta")
        self.sign_in(self.admin)
        page = self.client.get(reverse("registry:mda_list"), {"search": "alp"})
        self.assertContains(page, "Alpha")
        self.assertNotContains(page, "Beta")

    def test_reader_cannot_open_mdas(self):
        self.sign_in(self.reader)
        self.assertEqual(self.client.get(reverse("registry:mda_list")).status_code, 403)

    def test_delete_needs_post(self):
        mda = Mda.objects.create(name="Alpha")
        self.sign_in(self.admin)
        self.assertEqual(
            self.client.get(reverse("registry:mda_delete", args=[mda.pk])).status_code, 405
        )


class CollectorScreenTests(ScreenTestCase):
    def test_add_and_filter_by_status(self):
        self.sign_in(self.admin)
        self.client.post(
            reverse("registry:collector_create"),
            {"name": "Achol", "phone": "0911", "status": "Active"},
        )
        self.client.post(
            reverse("registry:collector_create"),
            {"name": "Deng", "phone": "0922", "status": "Inactive"},
        )
        page = self.client.get(reverse("registry:collector_list"), {"status": "Inactive"})
        self.assertContains(page, "<td>Deng</td>")
        self.assertNotContains(page, "<td>Achol</td>")
        self.assertEqual(DataCollector.objects.count(), 2)


class SiteScreenTests(ScreenTestCase):
    def test_add_site_and_target(self):
        state = State.objects.create(name="Central Equatoria")
        mda = Mda.objects.create(name="Alpha")
        collector = DataCollector.objects.create(name="Achol")
        self.sign_in(self.admin)
        self.client.post(
            reverse("registry:site_create"),
            {
                "name": "Juba Office",
                "state": state.pk,
                "mda": mda.pk,
                "status": "Planned",
                "capacity": 40,
            },
        )
        site = RegistrationSite.objects.get(name="Juba Office")
        self.assertTrue(site.code.startswith("site-"))
        response = self.client.post(
            reverse("registry:target_create"),
            {
                "site": site.pk,
                "target_total": 500,
                "opening_date": "2026-01-10",
                "closing_date": "2026-02-10",
                "supervisor_name": "Nyara",
                "dcas_planned": 4,
                "collectors": [collector.pk],
            },
        )
        self.assertEqual(response.status_code, 302)
        site.refresh_from_db()
        self.assertTrue(site.is_target)
        self.assertEqual(site.target_total, 500)
        self.assertEqual(list(site.data_collectors.all()), [collector])
        self.assertContains(self.client.get(reverse("registry:target_list")), "Juba Office")

    def test_closing_before_opening_is_refused(self):
        site = RegistrationSite.objects.create(code="s1", name="S1")
        self.sign_in(self.admin)
        response = self.client.post(
            reverse("registry:target_create"),
            {
                "site": site.pk,
                "target_total": 1,
                "opening_date": "2026-02-10",
                "closing_date": "2026-01-10",
            },
        )
        self.assertContains(response, "before the opening date")

    def test_delete_target_keeps_site(self):
        site = RegistrationSite.objects.create(code="s1", name="S1", is_target=True, target_total=9)
        self.sign_in(self.admin)
        self.client.post(reverse("registry:target_delete", args=[site.pk]))
        site.refresh_from_db()
        self.assertFalse(site.is_target)
