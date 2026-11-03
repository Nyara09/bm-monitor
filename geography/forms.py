"""Forms of the geography app: counties, cities and towns, airports and roads."""

from django import forms

from core.forms import BootstrapFormMixin

from .models import County, Place, Road


class CountyForm(BootstrapFormMixin, forms.ModelForm):
    class Meta:
        model = County
        fields = [
            "state",
            "name",
            "workforce",
            "phase",
            "security_status",
            "safety_level",
            "access_level",
            "travel_mode",
            "headquarters_lon",
            "headquarters_lat",
            "remarks",
            "recommendation",
        ]
        widgets = {
            "remarks": forms.Textarea(attrs={"rows": 3}),
            "recommendation": forms.Textarea(attrs={"rows": 3}),
        }


class PlaceForm(BootstrapFormMixin, forms.ModelForm):
    """A city or town."""

    kind = forms.ChoiceField(choices=[(Place.Kind.CITY, "City"), (Place.Kind.TOWN, "Town")])

    class Meta:
        model = Place
        fields = ["name", "kind", "state", "county", "longitude", "latitude", "has_airport"]


class AirportForm(BootstrapFormMixin, forms.ModelForm):
    """An airport. It is saved as a Place of kind 'airport'."""

    class Meta:
        model = Place
        fields = ["name", "state", "county", "longitude", "latitude"]


class RoadForm(BootstrapFormMixin, forms.ModelForm):
    road_type = forms.ChoiceField(
        choices=[("main", "Main"), ("secondary", "Secondary"), ("track", "Track")]
    )

    class Meta:
        model = Road
        fields = ["name", "road_type", "source", "start_point", "end_point", "points"]
        widgets = {"points": forms.Textarea(attrs={"rows": 4})}
