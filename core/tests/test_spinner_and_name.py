from django.urls import reverse

from core.models import CompanySetting
from core.testing import ScreenTestCase


class SpinnerTests(ScreenTestCase):
    def test_django_screens_load_the_spinner(self):
        self.sign_in(self.admin)
        page = self.client.get(reverse("registry:mda_list"))
        self.assertContains(page, "js/loading-spinner.js")
        self.assertContains(page, "css/loading-spinner.css")

    def test_sign_in_page_loads_the_spinner(self):
        self.assertContains(self.client.get(reverse("accounts:sign_in")), "js/loading-spinner.js")

    def test_javascript_pages_load_the_spinner(self):
        self.sign_in(self.admin)
        for name in ("pages:map", "pages:admin"):
            self.assertContains(self.client.get(reverse(name)), "js/loading-spinner.js")


class SystemNameTests(ScreenTestCase):
    def test_default_company_name(self):
        self.assertEqual(CompanySetting.load().company_name, "BM Monitor")

    def test_sidebar_uses_the_company_name(self):
        self.sign_in(self.admin)
        self.assertContains(self.client.get(reverse("registry:mda_list")), "<b>BM Monitor</b>")

    def test_no_old_name_is_left_on_the_pages(self):
        self.sign_in(self.admin)
        for name in ("pages:map", "pages:admin"):
            self.assertNotContains(self.client.get(reverse(name)), "BioReg Monitor")


class NoConfirmPasswordTests(ScreenTestCase):
    def test_sign_in_dialog_has_no_visible_confirm_field(self):
        html = self.client.get(reverse("pages:map")).content.decode()
        self.assertNotIn("Confirm password", html)
        self.assertNotIn("Confirm new password", html)


class ColourThemeTests(ScreenTestCase):
    def test_every_kind_of_page_loads_the_colour_theme_script(self):
        self.assertContains(self.client.get(reverse("accounts:sign_in")), "js/color-theme.js")
        self.sign_in(self.admin)
        for name in ("registry:mda_list", "pages:map", "pages:admin"):
            with self.subTest(page=name):
                page = self.client.get(reverse(name))
                self.assertContains(page, "js/color-theme.js")
                self.assertContains(page, "css/color-theme.css")


class ColourThemeChoiceTests(ScreenTestCase):
    url = "/colour-theme/"

    def post(self, data):
        return self.client.post(self.url, data, content_type="application/json")

    def test_everybody_reads_the_theme_even_signed_out(self):
        response = self.client.get(self.url)
        self.assertEqual(response.json()["mode"], "system")

    def test_admin_saves_a_custom_theme_for_everybody(self):
        self.sign_in(self.admin)
        saved = self.post(
            {"mode": "custom", "main": "#112233", "second": "#445566", "third": "#778899"}
        ).json()
        self.assertEqual(
            (saved["mode"], saved["main"], saved["second"], saved["third"]),
            ("custom", "#112233", "#445566", "#778899"),
        )
        self.client.logout()
        self.assertEqual(self.client.get(self.url).json()["third"], "#778899")

    def test_admin_edits_the_system_colours_and_can_reset_them(self):
        self.sign_in(self.admin)
        system = {"main": "#111111", "second": "#222222", "third": "#333333"}
        saved = self.post({"mode": "system", "system": system}).json()
        self.assertEqual(saved["mode"], "system")
        self.assertEqual(saved["system"], system)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).json()["system"], system)
        self.sign_in(self.admin)
        back = {"main": "#a0522d", "second": "#ffffff", "third": "#000000"}
        saved = self.post({"mode": "system", "system": back}).json()
        self.assertEqual(saved["system"]["main"], "#A0522D")
        self.assertEqual(CompanySetting.load().system_colours, "")

    def test_the_default_custom_and_system_colours_have_three_colours(self):
        data = self.client.get(self.url).json()
        self.assertEqual(data["third"], "#2F353B")
        self.assertEqual(set(data["system"]), {"main", "second", "third"})

    def test_there_are_only_two_themes_system_and_custom(self):
        self.sign_in(self.admin)
        self.assertEqual(self.post({"mode": "custom"}).json()["mode"], "custom")
        self.assertEqual(self.post({"mode": "system"}).json()["mode"], "system")
        self.assertEqual(self.post({"mode": "previous"}).json()["mode"], "system")

    def test_bad_colours_and_modes_fall_back(self):
        self.sign_in(self.admin)
        saved = self.post({"mode": "custom", "main": "red", "second": "<script>"}).json()
        self.assertEqual((saved["main"], saved["third"]), ("#2E7D57", "#2F353B"))
        self.assertEqual(self.post({"mode": "nonsense"}).json()["mode"], "system")

    def test_other_people_cannot_change_it(self):
        for user in (None, self.reader, self.supervisor):
            if user:
                self.sign_in(user)
            response = self.post({"mode": "custom"})
            self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get(self.url).json()["mode"], "system")

    def test_no_colour_button_is_added_to_pages(self):
        script = open("static/js/color-theme.js", encoding="utf-8").read()
        self.assertNotIn("pal-btn", script)
