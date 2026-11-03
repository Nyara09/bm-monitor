import datetime

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone

from accounts.models import PagePermission
from core.models import CompanySetting
from geography.models import County, State
from inventory.models import InventoryCategory, InventoryItem
from registry.models import DataCollector, Mda, RegistrationSite, SiteDataCollector
from reports.models import (
    DailyReport,
    ReportDcaEntry,
    ReportMdaEntry,
    ReportReviewEntry,
    ReportStatus,
)

User = get_user_model()


class ReferenceDataTests(TestCase):
    def test_loader_is_repeatable(self):
        call_command("load_reference_data", verbosity=0)
        counts = (State.objects.count(), County.objects.count(), RegistrationSite.objects.count())
        call_command("load_reference_data", verbosity=0)
        self.assertEqual(
            counts,
            (State.objects.count(), County.objects.count(), RegistrationSite.objects.count()),
        )
        self.assertEqual(counts[0], 13)
        self.assertEqual(counts[1], 106)
        self.assertEqual(counts[2], 475)

    def test_default_categories_and_settings(self):
        call_command("load_reference_data", verbosity=0)
        self.assertTrue(InventoryCategory.objects.filter(name="Laptops").exists())
        self.assertEqual(CompanySetting.load().backdate_days, 3)


class ReportWorkflowTests(TestCase):
    def setUp(self):
        self.supervisor = User.objects.create_user("sup1", password="x" * 10, first_name="Amit")
        self.mda = Mda.objects.create(name="Ministry of Health")
        self.other_mda = Mda.objects.create(name="Ministry of Finance")
        self.site = RegistrationSite.objects.create(
            code="s1", name="Juba HQ", mda=self.mda, is_target=True, target_total=500
        )

    def make_report(self, report_date):
        report = DailyReport.objects.create(
            client_id=f"r-{report_date}",
            site=self.site,
            site_code=self.site.code,
            report_date=report_date,
            submitted_by=self.supervisor,
        )
        ReportMdaEntry.objects.create(
            report=report, mda=self.mda, registered=40, succeeded=35, pending=3, failed=2
        )
        return report

    def test_registered_total_ignores_rejected(self):
        accepted = self.make_report(datetime.date(2026, 10, 1))
        accepted.status = ReportStatus.ACCEPTED
        accepted.save()
        rejected = self.make_report(datetime.date(2026, 10, 2))
        rejected.status = ReportStatus.REJECTED
        rejected.save()
        self.make_report(datetime.date(2026, 10, 3))  # pending
        self.assertEqual(self.site.registered_total, 80)

    def test_accepted_report_is_locked(self):
        report = self.make_report(datetime.date(2026, 10, 1))
        self.assertFalse(report.is_locked)
        report.status = ReportStatus.ACCEPTED
        self.assertTrue(report.is_locked)

    def test_report_lines_and_history(self):
        collector = DataCollector.objects.create(name="Achol")
        SiteDataCollector.objects.create(site=self.site, collector=collector)
        report = self.make_report(datetime.date(2026, 10, 1))
        ReportDcaEntry.objects.create(
            report=report, collector=collector, collector_name="Achol", registered=40
        )
        ReportReviewEntry.objects.create(
            report=report, at=timezone.now(), by="Admin", action="Accepted"
        )
        self.assertEqual(report.dca_entries.count(), 1)
        self.assertEqual(report.review_log.get().action, "Accepted")
        self.assertEqual(list(self.site.data_collectors.all()), [collector])

    def test_mda_cannot_be_deleted_while_reports_use_it(self):
        self.make_report(datetime.date(2026, 10, 1))
        with self.assertRaises(Exception):
            self.mda.delete()


class UsersAndInventoryTests(TestCase):
    def test_one_permission_row_per_page(self):
        user = User.objects.create_user("u1", password="x" * 10)
        profile = user.profile  # created automatically for every new user
        PagePermission.objects.create(profile=profile, page_key="new", can_view=True, can_edit=True)
        with self.assertRaises(IntegrityError):
            PagePermission.objects.create(profile=profile, page_key="new")

    def test_inventory_item_with_category(self):
        category = InventoryCategory.objects.create(name="Laptops")
        item = InventoryItem.objects.create(
            category=category, description="Dell 5420", date_received=datetime.date(2026, 9, 1)
        )
        self.assertEqual(item.status, "In stock")
        self.assertEqual(str(item), "Dell 5420 (Laptops)")
