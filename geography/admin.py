from django.contrib import admin

from .models import County, Place, Road, State


@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ("name", "region", "capital", "phase", "security_status", "access_level")
    list_filter = ("region", "security_status")
    search_fields = ("name", "capital")


@admin.register(County)
class CountyAdmin(admin.ModelAdmin):
    list_display = ("name", "state", "workforce", "security_status", "access_level", "travel_mode")
    list_filter = ("state", "security_status", "access_level")
    search_fields = ("name", "state__name")


@admin.register(Place)
class PlaceAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "has_airport", "state", "longitude", "latitude")
    list_filter = ("kind", "has_airport")
    search_fields = ("name",)


@admin.register(Road)
class RoadAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "road_type", "source")
    list_filter = ("road_type", "source")
    search_fields = ("name", "code")
