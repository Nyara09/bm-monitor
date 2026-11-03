"""URLs of the map page, the JavaScript screens and their JSON views."""

from django.urls import path

from . import views

app_name = "pages"

urlpatterns = [
    path("", views.map_page, name="map"),
    path("admin/", views.admin_page, name="admin"),
    path("auth/sign-in/", views.sign_in, name="sign_in"),
    path("auth/sign-out/", views.sign_out, name="sign_out"),
    path("auth/session/", views.session_info, name="session"),
    path("data/", views.data_read, name="data_read"),
    path("data/save/", views.data_write, name="data_write"),
    path("screens/", views.screens_index, name="screens"),
    path("screens/overview/", views.overview_redirect, name="overview"),
    path("screens/<slug:slug>/", views.screen_page, name="screen"),
]
