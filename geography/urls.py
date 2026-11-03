"""URLs of the map data screens (same /screens/<slug>/ addresses as before)."""

from django.urls import path

from . import views

app_name = "geography"

urlpatterns = [
    path("screens/counties/", views.county_list, name="county_list"),
    path("screens/counties/add/", views.county_create, name="county_create"),
    path("screens/counties/<int:pk>/edit/", views.county_edit, name="county_edit"),
    path("screens/counties/<int:pk>/delete/", views.county_delete, name="county_delete"),
    path("screens/cities-towns/", views.place_list, name="place_list"),
    path("screens/cities-towns/add/", views.place_create, name="place_create"),
    path("screens/cities-towns/<int:pk>/edit/", views.place_edit, name="place_edit"),
    path("screens/cities-towns/<int:pk>/delete/", views.place_delete, name="place_delete"),
    path("screens/airports/", views.airport_list, name="airport_list"),
    path("screens/airports/add/", views.airport_create, name="airport_create"),
    path("screens/airports/<int:pk>/edit/", views.airport_edit, name="airport_edit"),
    path("screens/airports/<int:pk>/delete/", views.airport_delete, name="airport_delete"),
    path("screens/roads/", views.road_list, name="road_list"),
    path("screens/roads/add/", views.road_create, name="road_create"),
    path("screens/roads/<int:pk>/edit/", views.road_edit, name="road_edit"),
    path("screens/roads/<int:pk>/delete/", views.road_delete, name="road_delete"),
]
