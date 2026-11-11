"""URLs of the core app: the colour theme."""

from django.urls import path

from . import views

app_name = "core"

urlpatterns = [path("colour-theme/", views.colour_theme, name="colour_theme")]
