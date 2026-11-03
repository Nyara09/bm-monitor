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
