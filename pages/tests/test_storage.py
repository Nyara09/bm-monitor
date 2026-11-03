import json

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from accounts.models import PagePermission
from core.models import ActivityLog, CompanySetting, Notification
from geography.models import State
from inventory.models import InventoryItem
from registry.models import Mda, RegistrationSite
from reports.models import DailyReport, ReportReviewEntry

User = get_user_model()


class StorageTestCase(TestCase):
    """Helpers: sign in, then load and save data sets through the two data views."""

    @classmethod
    def setUpTestData(cls):
        call_command("load_reference_data", verbosity=0)
        cls.admin = User.objects.create_superuser("boss", password="Boss-pass-123")
        cls.manager = User.objects.create_user("deputy", password="Deputy-pass-123")
        cls.manager.profile.role = "subadmin"
        cls.manager.profile.save()
        cls.member = User.objects.create_user("amit", password="Amit-pass-123", first_name="Amit")

    def sign_in_as(self, username, password):
        self.client.post(
            reverse("pages:sign_in"),
            data=json.dumps({"username": username, "password": password}),
            content_type="application/json",
        )

    def load(self):
        return self.client.get(reverse("pages:data_read"))

    def values(self):
        return self.load().json()["values"]

    def save(self, key, value):
        text = value if isinstance(value, str) or value is None else json.dumps(value)
        return self.client.post(
            reverse("pages:data_write"),
            data=json.dumps({"key": key, "value": text}),
            content_type="application/json",
        )


class AccessTests(StorageTestCase):
    def test_signed_out_gets_nothing(self):
        self.assertEqual(self.load().status_code, 401)
        self.assertEqual(self.save("bioreg.mdas", "[]").status_code, 401)

    def test_unknown_key_is_404(self):
        self.sign_in_as("boss", "Boss-pass-123")
        self.assertEqual(self.save("bioreg.nonsense", "[]").status_code, 404)

    def test_load_returns_user_and_every_data_set(self):
        self.sign_in_as("boss", "Boss-pass-123")
        answer = self.load().json()
        self.assertEqual(answer["user"]["username"], "boss")
        for key in (
            "bioreg.v2",
            "bioreg.reports",
            "bioreg.users",
            "bioreg.mdas",
            "bioreg.inv",
            "bioreg.notif",
        ):
            self.assertIn(key, answer["values"])


class MapDataTests(StorageTestCase):
    def test_seeded_map_reads_back_in_the_pages_shape(self):
        self.sign_in_as("boss", "Boss-pass-123")
        snapshot = json.loads(self.values()["bioreg.v2"])
        self.assertEqual(snapshot["v"], 2)
        self.assertEqual(len(snapshot["PL"]), 80)
        self.assertEqual(len(snapshot["SITES"]), 475)
        self.assertEqual(len(snapshot["ROADS"]), 103)
        self.assertEqual(len(snapshot["COUNTIES"]), 106)
        self.assertEqual(len(snapshot["CTY"]), 13)
        self.assertEqual(sum(len(rows) for rows in snapshot["CTY"]), 106)
        self.assertEqual(snapshot["SITES"][0]["name"], "Nimule")

    def test_saving_what_was_loaded_changes_nothing(self):
        self.sign_in_as("boss", "Boss-pass-123")
        before = self.values()["bioreg.v2"]
        self.assertEqual(self.save("bioreg.v2", before).status_code, 200)
        after = json.loads(self.values()["bioreg.v2"])
        original = json.loads(before)
        for part in ("PL", "SITES", "ROADS", "COUNTIES", "CTY"):
            self.assertEqual(after[part], original[part], part)

    def test_site_target_is_saved_in_the_site_row(self):
        self.sign_in_as("boss", "Boss-pass-123")
        snapshot = json.loads(self.values()["bioreg.v2"])
        site = snapshot["SITES"][0]
        site.update(
            {
                "fte": 300,
                "open": "2026-11-02",
                "deadline": "2026-11-20",
                "sup": "Amit",
                "dcaN": 4,
                "cmt": "Start Monday",
            }
        )
        self.save("bioreg.v2", snapshot)
        row = RegistrationSite.objects.get(code=site["id"])
        self.assertEqual(
            (row.target_total, row.dcas_planned, row.comment), (300, 4, "Start Monday")
        )
        self.assertEqual(row.opening_date.isoformat(), "2026-11-02")
        self.assertTrue(row.is_target)
        self.assertEqual(json.loads(self.values()["bioreg.v2"])["SITES"][0]["fte"], 300)

    def test_new_site_county_and_road(self):
        self.sign_in_as("boss", "Boss-pass-123")
        snapshot = json.loads(self.values()["bioreg.v2"])
        snapshot["SITES"].append(
            {
                "id": "new-1",
                "name": "Rumbek Police HQ",
                "mda": "Ministry of Interior",
                "status": "Planned",
                "cap": 40,
                "_st": "Lakes",
            }
        )
        snapshot["ROADS"].append(
            {
                "id": "r-new",
                "name": "Rumbek ring",
                "type": "secondary",
                "src": "me",
                "from": "",
                "to": "",
                "pts": [[29.7, 6.8], [29.8, 6.9]],
            }
        )
        snapshot["CTY"][3].append(
            {
                "n": "Test County",
                "e": 10,
                "ph": 1,
                "st": "Low Risk",
                "sf": "Safer",
                "ac": "Accessible",
                "rm": "",
                "rc": "",
                "md": "Road",
            }
        )
        snapshot["COUNTIES"].append(
            {"n": "Test County", "si": 3, "hq": [29.5, 6.5], "poly": [[29, 6], [30, 6], [30, 7]]}
        )
        self.save("bioreg.v2", snapshot)
        self.assertEqual(RegistrationSite.objects.get(code="new-1").state.name, "Lakes")
        self.assertTrue(Mda.objects.filter(name="Ministry of Interior").exists())
        self.assertEqual(
            State.objects.get(name="Lakes").counties.filter(name="Test County").count(), 1
        )
        self.assertEqual(len(json.loads(self.values()["bioreg.v2"])["ROADS"]), 104)

    def test_member_without_permission_cannot_change_the_map(self):
        self.sign_in_as("amit", "Amit-pass-123")
        snapshot = json.loads(self.values()["bioreg.v2"])
        snapshot["SITES"] = snapshot["SITES"][:1]
        self.assertEqual(self.save("bioreg.v2", snapshot).status_code, 403)
        self.assertEqual(RegistrationSite.objects.count(), 475)

    def test_member_with_edit_permission_on_sites_can(self):
        PagePermission.objects.create(
            profile=self.member.profile, page_key="sites", can_view=True, can_edit=True
        )
        self.sign_in_as("amit", "Amit-pass-123")
        snapshot = json.loads(self.values()["bioreg.v2"])
        snapshot["SITES"][0]["note"] = "checked"
        self.assertEqual(self.save("bioreg.v2", snapshot).status_code, 200)
        self.assertEqual(
            RegistrationSite.objects.get(code=snapshot["SITES"][0]["id"]).note, "checked"
        )


REPORT = {
    "id": "abc123",
    "site": "excel-site-0",
    "date": "2026-10-30",
    "regMda": "Ministry of Trade and Industry",
    "note": "Generator failed for an hour",
    "setups": [{"n": 1, "kit": "Laptop"}],
    "items": [{"cat": "Laptops", "n": 2}],
    "sup": "Amit",
    "late": "",
    "type": "multi",
    "dcas": [{"name": "Achol", "n": 30}, {"name": "Deng", "n": 20}],
    "mdas": [
        {"mda": "Ministry of Trade and Industry", "n": 30, "ok": 28, "pend": 1, "fail": 1},
        {"mda": "Ministry of Health", "n": 20, "ok": 20, "pend": 0, "fail": 0},
    ],
    "by": "amit",
    "at": "2026-10-30T14:05:00.000Z",
    "rs": "Pending",
    "rvBy": "",
    "rvAt": "",
    "rvWhy": "",
    "log": [{"t": "2026-10-30T14:05:00.000Z", "by": "Amit", "a": "Submitted", "why": ""}],
    "upd": "2026-10-30T14:05:00.000Z",
}


class ReportTests(StorageTestCase):
    def test_report_round_trip(self):
        self.sign_in_as("amit", "Amit-pass-123")
        self.assertEqual(self.save("bioreg.reports", [REPORT]).status_code, 200)
        report = DailyReport.objects.get(client_id="abc123")
        self.assertEqual(report.site.name, "Nimule")
        self.assertEqual(report.mda_entries.count(), 2)
        self.assertEqual(report.dca_entries.count(), 2)
        self.assertEqual(report.review_log.count(), 1)
        self.assertEqual(report.submitted_by, self.member)
        self.assertEqual(json.loads(self.values()["bioreg.reports"]), [REPORT])

    def test_registered_total_counts_the_report(self):
        self.sign_in_as("amit", "Amit-pass-123")
        self.save("bioreg.reports", [REPORT])
        self.assertEqual(RegistrationSite.objects.get(code="excel-site-0").registered_total, 50)

    def test_member_cannot_accept_their_own_report(self):
        self.sign_in_as("amit", "Amit-pass-123")
        self.save("bioreg.reports", [dict(REPORT, rs="Accepted", rvBy="Amit")])
        self.assertEqual(DailyReport.objects.get().status, "Pending")

    def test_manager_accepts_and_accepted_report_is_locked_for_the_member(self):
        self.sign_in_as("amit", "Amit-pass-123")
        self.save("bioreg.reports", [REPORT])
        self.client.post(reverse("pages:sign_out"))
        self.sign_in_as("deputy", "Deputy-pass-123")
        accepted = dict(REPORT, rs="Accepted", rvBy="Deputy", rvAt="2026-10-31T08:00:00.000Z")
        accepted["log"] = REPORT["log"] + [
            {"t": "2026-10-31T08:00:00.000Z", "by": "Deputy", "a": "Accepted", "why": ""}
        ]
        self.save("bioreg.reports", [accepted])
        self.assertEqual(DailyReport.objects.get().status, "Accepted")
        self.assertEqual(ReportReviewEntry.objects.count(), 2)
        self.client.post(reverse("pages:sign_out"))

        self.sign_in_as("amit", "Amit-pass-123")
        self.save("bioreg.reports", [dict(accepted, note="changed after acceptance")])
        self.assertEqual(DailyReport.objects.get().note, "Generator failed for an hour")
        self.save("bioreg.reports", [])
        self.assertEqual(DailyReport.objects.count(), 1)

    def test_member_cannot_add_a_report_for_somebody_else(self):
        self.sign_in_as("amit", "Amit-pass-123")
        self.save("bioreg.reports", [dict(REPORT, by="deputy")])
        self.assertEqual(DailyReport.objects.count(), 0)


class UserTests(StorageTestCase):
    def test_admin_creates_a_user_who_can_then_sign_in(self):
        self.sign_in_as("boss", "Boss-pass-123")
        record = {
            "id": "x1", "u": "grace", "name": "Grace Akol", "role": "supervisor", "phone": "+211900", "photo": "",
            "status": "Active", "cards": {"adm": 0, "nat": 1, "sup": 1}, "perms": {"new": {"v": 1, "e": 1, "d": 0}},
            "salt": "pwtoken:abc", "alg": "pbkdf2", "it": 1, "h": "zzz", "_pw": "Grace-pass-123",
        }  # fmt: skip
        users = json.loads(self.values()["bioreg.users"])
        self.assertEqual(self.save("bioreg.users", users + [record]).status_code, 200)
        self.client.post(reverse("pages:sign_out"))
        self.sign_in_as("grace", "Grace-pass-123")
        answer = self.client.get(reverse("pages:session")).json()
        self.assertEqual(answer["name"], "Grace Akol")
        self.assertEqual(answer["perms"], {"new": {"v": 1, "e": 1, "d": 0}})

    def test_hashes_are_never_returned(self):
        self.sign_in_as("boss", "Boss-pass-123")
        text = self.values()["bioreg.users"]
        for word in ('"h"', '"salt"', "password"):
            self.assertNotIn(word, text)

    def test_removing_a_user_from_the_list_deletes_the_account(self):
        self.sign_in_as("boss", "Boss-pass-123")
        users = [u for u in json.loads(self.values()["bioreg.users"]) if u["u"] != "amit"]
        self.save("bioreg.users", users)
        self.assertFalse(User.objects.filter(username="amit").exists())
        self.assertTrue(User.objects.filter(username="boss").exists())

    def test_member_can_change_only_their_own_password(self):
        self.sign_in_as("amit", "Amit-pass-123")
        users = json.loads(self.values()["bioreg.users"])
        own = next(u for u in users if u["u"] == "amit")
        own.update({"_pw": "New-pass-12345", "role": "admin", "name": "Hacker"})
        self.save("bioreg.users", users)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("New-pass-12345"))
        self.assertEqual(self.member.profile.role, "supervisor")
        self.assertEqual(self.member.first_name, "Amit")


class OtherDataTests(StorageTestCase):
    def test_mdas(self):
        self.sign_in_as("boss", "Boss-pass-123")
        names = json.loads(self.values()["bioreg.mdas"])
        self.save("bioreg.mdas", names + ["Ministry of Water"])
        self.assertTrue(Mda.objects.filter(name="Ministry of Water").exists())
        self.save("bioreg.mdas", names)
        self.assertFalse(Mda.objects.filter(name="Ministry of Water").exists())

    def test_inventory_and_categories(self):
        self.sign_in_as("boss", "Boss-pass-123")
        item = {
            "id": "i1",
            "cat": "Laptops",
            "desc": "Dell 5420",
            "sn": "SN1",
            "at": "A1",
            "ct": "C1",
            "st": "Assigned",
            "as": "Achol",
            "dr": "2026-09-01",
            "nt": "ok",
        }
        self.save("bioreg.inv", [item])
        self.assertEqual(InventoryItem.objects.get().assigned_to, "Achol")
        self.assertEqual(json.loads(self.values()["bioreg.inv"]), [item])
        self.save("bioreg.invcat", ["Laptops", "Routers"])
        self.assertEqual(json.loads(self.values()["bioreg.invcat"]), ["Laptops", "Routers"])
        self.save("bioreg.invcathide", ["Routers"])
        self.assertEqual(json.loads(self.values()["bioreg.invcathide"]), ["Routers"])

    def test_member_cannot_change_inventory(self):
        self.sign_in_as("amit", "Amit-pass-123")
        self.assertEqual(self.save("bioreg.inv", []).status_code, 403)

    def test_notifications_and_read_marks(self):
        self.sign_in_as("amit", "Amit-pass-123")
        note = {
            "id": "n1",
            "type": "submit",
            "at": "2026-10-30T14:05:00.000Z",
            "by": "amit",
            "sup": "Amit",
            "title": "Daily report submitted",
            "text": "Amit submitted",
        }
        self.save("bioreg.notif", [note])
        self.assertEqual(json.loads(self.values()["bioreg.notif"]), [dict(note, to="")])
        self.save("bioreg.notifread", {"amit": {"n1": 1}, "deputy": {"n1": 1}})
        marks = json.loads(self.values()["bioreg.notifread"])
        self.assertEqual(marks, {"amit": {"n1": 1}})
        self.assertEqual(Notification.objects.count(), 1)

    def test_activity_log_is_added_to_not_replaced(self):
        self.sign_in_as("amit", "Amit-pass-123")
        entry = {
            "t": "2026-10-30T14:05:00.000Z",
            "by": "amit",
            "a": "Added",
            "k": "Report",
            "d": "Nimule",
        }
        self.save("bioreg.audit", [entry])
        self.save("bioreg.audit", [entry, dict(entry, t="2026-10-30T15:00:00.000Z", a="Updated")])
        self.assertEqual(ActivityLog.objects.filter(action__in=["Added", "Updated"]).count(), 2)
        self.assertEqual(self.save("bioreg.audit", None).status_code, 403)

    def test_settings(self):
        self.sign_in_as("boss", "Boss-pass-123")
        self.save("bioreg.company", "Ministry Registration Unit")
        self.save("bioreg.logo", "data:image/png;base64,AAAA")
        self.save("bioreg.bdrule", {"days": 5, "mode": "block"})
        setting = CompanySetting.load()
        self.assertEqual(
            (setting.company_name, setting.backdate_days, setting.backdate_mode),
            ("Ministry Registration Unit", 5, "block"),
        )
        values = self.values()
        self.assertEqual(values["bioreg.logo"], "data:image/png;base64,AAAA")
        self.save("bioreg.company", None)
        self.assertIsNone(self.values()["bioreg.company"])

    def test_member_cannot_change_settings(self):
        self.sign_in_as("amit", "Amit-pass-123")
        self.assertEqual(self.save("bioreg.company", "Mine").status_code, 403)

    def test_collectors_and_site_profiles(self):
        self.sign_in_as("boss", "Boss-pass-123")
        self.save(
            "bioreg.dcalist",
            [{"id": "d1", "name": "Achol", "phone": "+2111", "photo": "", "status": "Active"}],
        )
        self.save(
            "bioreg.dcap",
            {"excel-site-0|achol": {"phone": "+2112", "photo": "", "status": "Inactive"}},
        )
        self.assertEqual(json.loads(self.values()["bioreg.dcalist"])[0]["phone"], "+2111")
        self.assertEqual(
            json.loads(self.values()["bioreg.dcap"]),
            {"excel-site-0|achol": {"phone": "+2112", "photo": "", "status": "Inactive"}},
        )

    def test_member_can_add_but_not_edit_collectors(self):
        self.sign_in_as("boss", "Boss-pass-123")
        self.save(
            "bioreg.dcalist",
            [{"id": "d1", "name": "Achol", "phone": "+2111", "photo": "", "status": "Active"}],
        )
        self.client.post(reverse("pages:sign_out"))
        self.sign_in_as("amit", "Amit-pass-123")
        self.save(
            "bioreg.dcalist",
            [
                {"id": "d1", "name": "Achol", "phone": "HACK", "photo": "", "status": "Active"},
                {"id": "d2", "name": "Deng", "phone": "", "photo": "", "status": "Active"},
            ],
        )
        phones = {c["name"]: c["phone"] for c in json.loads(self.values()["bioreg.dcalist"])}
        self.assertEqual(phones, {"Achol": "+2111", "Deng": ""})

    def test_draft_is_private(self):
        self.sign_in_as("amit", "Amit-pass-123")
        self.assertEqual(self.save("bioreg.draft|amit", {"step": 2}).status_code, 200)
        self.assertEqual(json.loads(self.values()["bioreg.draft|amit"]), {"step": 2})
        self.assertEqual(self.save("bioreg.draft|deputy", {"step": 9}).status_code, 403)
        self.save("bioreg.draft|amit", None)
        self.assertIsNone(self.values()["bioreg.draft|amit"])
