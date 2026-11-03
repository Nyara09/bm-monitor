"""Map data: states, counties, cities and towns, airports, roads."""

from django.db import models

from core.models import TimeStampedModel


class State(TimeStampedModel):
    """A state or administrative area (13 in the template)."""

    name = models.CharField(max_length=80, unique=True)
    region = models.CharField(max_length=60, blank=True)
    capital = models.CharField(max_length=80, blank=True)
    phase = models.PositiveSmallIntegerField(default=1, help_text="Deployment phase")
    security_status = models.CharField(max_length=40, blank=True)
    safety_level = models.CharField(max_length=40, blank=True)
    access_level = models.CharField(max_length=60, blank=True)
    workforce_total = models.PositiveIntegerField(default=0)
    boundary = models.JSONField(default=list, blank=True, help_text="[[lon, lat], ...] polygon")
    order = models.PositiveSmallIntegerField(
        default=0, help_text="Position in the map data (the template's state index)"
    )

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class County(TimeStampedModel):
    """A county inside a state, with its security and access notes."""

    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name="counties")
    name = models.CharField(max_length=80)
    workforce = models.PositiveIntegerField(default=0)
    phase = models.PositiveSmallIntegerField(default=1)
    security_status = models.CharField(max_length=40, blank=True)
    safety_level = models.CharField(max_length=40, blank=True)
    access_level = models.CharField(max_length=60, blank=True)
    remarks = models.TextField(blank=True)
    recommendation = models.TextField(blank=True)
    travel_mode = models.CharField(max_length=40, blank=True, help_text="Road, Air, River ...")
    headquarters_lon = models.FloatField(null=True, blank=True)
    headquarters_lat = models.FloatField(null=True, blank=True)
    boundary = models.JSONField(default=list, blank=True, help_text="[[lon, lat], ...] polygon")
    extra = models.JSONField(
        default=dict,
        blank=True,
        help_text="Map values the page adds itself; kept so nothing is lost",
    )

    class Meta:
        ordering = ["state__order", "id"]
        verbose_name_plural = "counties"
        constraints = [
            models.UniqueConstraint(fields=["state", "name"], name="unique_county_per_state")
        ]

    def __str__(self):
        return f"{self.name} ({self.state.name})"


class Place(TimeStampedModel):
    """A city or town. Places with has_airport=True also appear in the Airports tab."""

    class Kind(models.TextChoices):
        CITY = "city", "City"
        TOWN = "town", "Town"
        AIRPORT = "airport", "Airport only"

    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TOWN)
    longitude = models.FloatField()
    latitude = models.FloatField()
    has_airport = models.BooleanField(default=False)
    state = models.ForeignKey(
        State, null=True, blank=True, on_delete=models.SET_NULL, related_name="places"
    )
    county = models.ForeignKey(
        County, null=True, blank=True, on_delete=models.SET_NULL, related_name="places"
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Road(TimeStampedModel):
    """A road drawn on the map as a line of points."""

    code = models.CharField(max_length=40, unique=True, help_text="Id used by the map, e.g. un0")
    name = models.CharField(max_length=120)
    road_type = models.CharField(
        max_length=20, default="main", help_text="main, secondary or track"
    )
    source = models.CharField(
        max_length=40, blank=True, help_text="Where the line came from, e.g. UN"
    )
    start_point = models.CharField(max_length=120, blank=True)
    end_point = models.CharField(max_length=120, blank=True)
    points = models.JSONField(default=list, blank=True, help_text="[[lon, lat], ...] line")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
