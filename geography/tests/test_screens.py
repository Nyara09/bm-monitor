from django.urls import reverse

from core.testing import ScreenTestCase
from geography.models import County, Place, Road, State


class MapDataScreenTests(ScreenTestCase):
    def setUp(self):
        self.state = State.objects.create(name="Jonglei")
        self.sign_in(self.admin)

    def test_county_add_edit_delete(self):
        self.client.post(
            reverse("geography:county_create"),
            {"state": self.state.pk, "name": "Bor", "workforce": 10, "phase": 1},
        )
        county = County.objects.get(name="Bor")
        self.client.post(
            reverse("geography:county_edit", args=[county.pk]),
            {"state": self.state.pk, "name": "Bor South", "workforce": 12, "phase": 2},
        )
        county.refresh_from_db()
        self.assertEqual((county.name, county.workforce), ("Bor South", 12))
        self.assertContains(self.client.get(reverse("geography:county_list")), "Bor South")
        self.client.post(reverse("geography:county_delete", args=[county.pk]))
        self.assertFalse(County.objects.exists())

    def test_places_and_airports_are_separate_lists(self):
        self.client.post(
            reverse("geography:place_create"),
            {
                "name": "Bor",
                "kind": "town",
                "state": self.state.pk,
                "longitude": 31.5,
                "latitude": 6.2,
            },
        )
        self.client.post(
            reverse("geography:airport_create"),
            {"name": "Bor Airstrip", "state": self.state.pk, "longitude": 31.6, "latitude": 6.3},
        )
        self.assertEqual(Place.objects.get(name="Bor Airstrip").kind, "airport")
        places = self.client.get(reverse("geography:place_list"))
        self.assertContains(places, "Bor")
        self.assertNotContains(places, "<td>Bor Airstrip</td>")
        self.assertContains(self.client.get(reverse("geography:airport_list")), "Bor Airstrip")

    def test_deleting_airport_mark_keeps_the_town(self):
        town = Place.objects.create(
            name="Wau", kind="town", longitude=28, latitude=7, has_airport=True
        )
        self.client.post(reverse("geography:airport_delete", args=[town.pk]))
        town.refresh_from_db()
        self.assertFalse(town.has_airport)

    def test_road_gets_a_code(self):
        self.client.post(
            reverse("geography:road_create"),
            {"name": "Juba-Nimule", "road_type": "main", "points": "[[31.6, 4.8], [32.0, 3.6]]"},
        )
        road = Road.objects.get(name="Juba-Nimule")
        self.assertTrue(road.code.startswith("road-"))
        self.assertEqual(len(road.points), 2)

    def test_reader_cannot_open_map_data(self):
        self.sign_in(self.reader)
        self.assertEqual(self.client.get(reverse("geography:county_list")).status_code, 403)
