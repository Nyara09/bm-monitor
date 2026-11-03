from django.template import Context, Template
from django.urls import reverse

from core.testing import ScreenTestCase
from geography.models import County, Place, Road, State
from registry.models import RegistrationSite


class MapLinkTagTests(ScreenTestCase):
    def render(self, source, **context):
        return Template("{% load map_links %}" + source).render(Context(context)).strip()

    def test_link_goes_to_the_map_page_with_the_action(self):
        link = self.render('{% map_link "locate" lon=31.5 lat=4.8 %}')
        self.assertEqual(link, "/?map=locate&amp;lon=31.5&amp;lat=4.8")

    def test_missing_coordinates_give_no_link(self):
        self.assertEqual(self.render('{% map_link "locate" lon=none lat=4.8 %}'), "")

    def test_link_target_is_the_map_view(self):
        self.assertEqual(reverse("pages:map"), "/")


class MapButtonsOnScreens(ScreenTestCase):
    def setUp(self):
        self.state = State.objects.create(name="Jonglei")
        self.sign_in(self.admin)

    def test_site_with_position_has_show_on_map(self):
        RegistrationSite.objects.create(code="s1", name="Bor Office", longitude=31.5, latitude=6.2)
        RegistrationSite.objects.create(code="s2", name="No Position")
        page = self.client.get(reverse("registry:site_list"))
        self.assertContains(page, "?map=locate&amp;lon=31.5&amp;lat=6.2")
        self.assertContains(page, "?map=add&amp;kind=site")
        self.assertEqual(page.content.decode().count("Show on map"), 1)

    def test_road_has_reshape_link_with_its_code(self):
        Road.objects.create(code="un7", name="Road 7", points=[[1, 2], [3, 4]])
        page = self.client.get(reverse("geography:road_list"))
        self.assertContains(page, "?map=reshape&amp;road=un7")
        self.assertContains(page, "?map=road")

    def test_place_airport_and_county_links(self):
        Place.objects.create(
            name="Bor", kind="town", longitude=31.5, latitude=6.2, state=self.state
        )
        Place.objects.create(name="Bor Strip", kind="airport", longitude=31.6, latitude=6.3)
        County.objects.create(
            state=self.state, name="Bor", headquarters_lon=31.5, headquarters_lat=6.2
        )
        self.assertContains(
            self.client.get(reverse("geography:place_list")), "?map=locate&amp;lon=31.5"
        )
        self.assertContains(
            self.client.get(reverse("geography:airport_list")), "?map=add&amp;kind=airport"
        )
        self.assertContains(
            self.client.get(reverse("geography:county_list")), "?map=add&amp;kind=county"
        )
