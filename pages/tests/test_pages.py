from django.test import TestCase
from django.urls import reverse

from pages.views import SCREEN_TITLES


class PageViewTests(TestCase):
    def test_map_page_renders_with_static_files(self):
        response = self.client.get(reverse("pages:map"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "/static/js/map-app.js")
        self.assertContains(response, 'window.PAGE = "map"')
        self.assertNotContains(response, "templatetag")

    def test_admin_page_renders(self):
        response = self.client.get(reverse("pages:admin"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'window.PAGE = "admin"')

    def test_router_urls_are_filled_in(self):
        response = self.client.get(reverse("pages:map"))
        self.assertContains(response, 'admin: "/admin/"')
        self.assertContains(response, 'screens: "/screens/"')

    def test_every_screen_renders(self):
        for slug in SCREEN_TITLES:
            with self.subTest(slug=slug):
                response = self.client.get(reverse("pages:screen", args=[slug]))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, f'window.SCREEN = "{slug}"')

    def test_template_markers_survive(self):
        """The {{s1: ...}} markers of the screen templates must reach the browser untouched."""
        response = self.client.get(reverse("pages:screen", args=["dashboard"]))
        self.assertContains(response, "{{s1:")
        self.assertNotContains(response, "templatetag")

    def test_unknown_screen_is_404(self):
        self.assertEqual(self.client.get("/screens/nope/").status_code, 404)

    def test_overview_goes_to_map(self):
        response = self.client.get(reverse("pages:overview"))
        self.assertRedirects(response, "/#overview", fetch_redirect_response=False)
