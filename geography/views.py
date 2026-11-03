"""Map data screens: counties, cities and towns, airports and roads.

Every screen has four function views: list, create, edit and delete.
"""

import uuid

from django.contrib import messages
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from accounts.permissions import has_permission, screen_permission
from core.pagination import paginate, query_without_page
from core.screens import delete_row, save_screen
from core.services import log_activity

from .forms import AirportForm, CountyForm, PlaceForm, RoadForm
from .models import County, Place, Road, State


def list_context(request, page_key, page_title, rows, **extra):
    """What every map data list template needs."""
    return {
        "page_title": page_title,
        "page": paginate(request, rows),
        "search": request.GET.get("search", "").strip(),
        "state_id": request.GET.get("state", ""),
        "states": State.objects.order_by("name"),
        "filter_query": query_without_page(request),
        "can_edit": has_permission(request.user, page_key, "edit"),
        "can_delete": has_permission(request.user, page_key, "delete"),
        **extra,
    }


# --------------------------------------------------------- Counties (page key: counties)


@screen_permission("counties", "view")
def county_list(request):
    search = request.GET.get("search", "").strip()
    state_id = request.GET.get("state", "")
    counties = County.objects.select_related("state").order_by("state__name", "name")
    if search:
        counties = counties.filter(name__icontains=search)
    if state_id:
        counties = counties.filter(state_id=state_id)
    return render(
        request,
        "geography/county_list.html",
        list_context(request, "counties", "Counties", counties),
    )


@screen_permission("counties", "edit")
def county_create(request):
    form = CountyForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        county = form.save()
        log_activity(request.user, "Added", "County", county.name)
        messages.success(request, f"{county.name} added.")
        return redirect("geography:county_list")
    return save_screen(request, form, "Add county", "/screens/counties/")


@screen_permission("counties", "edit")
def county_edit(request, pk):
    county = get_object_or_404(County, pk=pk)
    form = CountyForm(request.POST or None, instance=county)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "County", county.name)
        messages.success(request, f"{county.name} saved.")
        return redirect("geography:county_list")
    return save_screen(request, form, f"Edit {county.name}", "/screens/counties/")


@require_POST
@screen_permission("counties", "delete")
def county_delete(request, pk):
    return delete_row(request, get_object_or_404(County, pk=pk), "County", "geography:county_list")


# ------------------------------------------------------ Cities & towns (page key: places)


@screen_permission("places", "view")
def place_list(request):
    search = request.GET.get("search", "").strip()
    state_id = request.GET.get("state", "")
    places = Place.objects.exclude(kind=Place.Kind.AIRPORT).select_related("state", "county")
    if search:
        places = places.filter(name__icontains=search)
    if state_id:
        places = places.filter(state_id=state_id)
    return render(
        request,
        "geography/place_list.html",
        list_context(request, "places", "Cities & towns", places.order_by("state__name", "name")),
    )


@screen_permission("places", "edit")
def place_create(request):
    form = PlaceForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        place = form.save()
        log_activity(request.user, "Added", "City or town", place.name)
        messages.success(request, f"{place.name} added.")
        return redirect("geography:place_list")
    return save_screen(request, form, "Add city or town", "/screens/cities-towns/")


@screen_permission("places", "edit")
def place_edit(request, pk):
    place = get_object_or_404(Place.objects.exclude(kind=Place.Kind.AIRPORT), pk=pk)
    form = PlaceForm(request.POST or None, instance=place)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "City or town", place.name)
        messages.success(request, f"{place.name} saved.")
        return redirect("geography:place_list")
    return save_screen(request, form, f"Edit {place.name}", "/screens/cities-towns/")


@require_POST
@screen_permission("places", "delete")
def place_delete(request, pk):
    place = get_object_or_404(Place.objects.exclude(kind=Place.Kind.AIRPORT), pk=pk)
    return delete_row(request, place, "City or town", "geography:place_list")


# -------------------------------------------------------------- Airports (page key: airports)


def airports_queryset():
    """Airport-only places, and cities or towns marked as having an airport."""
    return Place.objects.filter(Q(kind=Place.Kind.AIRPORT) | Q(has_airport=True))


@screen_permission("airports", "view")
def airport_list(request):
    search = request.GET.get("search", "").strip()
    state_id = request.GET.get("state", "")
    airports = airports_queryset().select_related("state", "county")
    if search:
        airports = airports.filter(name__icontains=search)
    if state_id:
        airports = airports.filter(state_id=state_id)
    return render(
        request,
        "geography/airport_list.html",
        list_context(request, "airports", "Airports", airports.order_by("state__name", "name")),
    )


@screen_permission("airports", "edit")
def airport_create(request):
    form = AirportForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        airport = form.save(commit=False)
        airport.kind = Place.Kind.AIRPORT
        airport.save()
        log_activity(request.user, "Added", "Airport", airport.name)
        messages.success(request, f"{airport.name} added.")
        return redirect("geography:airport_list")
    return save_screen(request, form, "Add airport", "/screens/airports/")


@screen_permission("airports", "edit")
def airport_edit(request, pk):
    airport = get_object_or_404(airports_queryset(), pk=pk)
    form = AirportForm(request.POST or None, instance=airport)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "Airport", airport.name)
        messages.success(request, f"{airport.name} saved.")
        return redirect("geography:airport_list")
    return save_screen(request, form, f"Edit {airport.name}", "/screens/airports/")


@require_POST
@screen_permission("airports", "delete")
def airport_delete(request, pk):
    """An airport-only place is deleted. A city or town with an airport just loses the airport mark."""
    airport = get_object_or_404(airports_queryset(), pk=pk)
    if airport.kind != Place.Kind.AIRPORT:
        airport.has_airport = False
        airport.save(update_fields=["has_airport"])
        log_activity(request.user, "Edited", "Airport", f"{airport.name}: airport mark removed")
        messages.success(request, f"{airport.name} is no longer marked as having an airport.")
        return redirect("geography:airport_list")
    return delete_row(request, airport, "Airport", "geography:airport_list")


# ----------------------------------------------------------------- Roads (page key: roads)


@screen_permission("roads", "view")
def road_list(request):
    search = request.GET.get("search", "").strip()
    roads = Road.objects.all()
    if search:
        roads = roads.filter(
            Q(name__icontains=search)
            | Q(start_point__icontains=search)
            | Q(end_point__icontains=search)
        )
    return render(
        request, "geography/road_list.html", list_context(request, "roads", "Roads", roads)
    )


@screen_permission("roads", "edit")
def road_create(request):
    form = RoadForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        road = form.save(commit=False)
        road.code = f"road-{uuid.uuid4().hex[:10]}"
        road.save()
        log_activity(request.user, "Added", "Road", road.name)
        messages.success(request, f"{road.name} added.")
        return redirect("geography:road_list")
    return save_screen(request, form, "Add road", "/screens/roads/")


@screen_permission("roads", "edit")
def road_edit(request, pk):
    road = get_object_or_404(Road, pk=pk)
    form = RoadForm(request.POST or None, instance=road)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "Road", road.name)
        messages.success(request, f"{road.name} saved.")
        return redirect("geography:road_list")
    return save_screen(request, form, f"Edit {road.name}", "/screens/roads/")


@require_POST
@screen_permission("roads", "delete")
def road_delete(request, pk):
    return delete_row(request, get_object_or_404(Road, pk=pk), "Road", "geography:road_list")
