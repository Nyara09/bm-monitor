"""URLs of the accounts app: sign in, sign out (under /accounts/) and Users & roles (under /screens/)."""

from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    path("accounts/sign-in/", views.sign_in, name="sign_in"),
    path("accounts/sign-out/", views.sign_out, name="sign_out"),
    path("screens/users-roles/", views.user_list, name="user_list"),
    path("screens/users-roles/add/", views.user_create, name="user_create"),
    path("screens/users-roles/<int:pk>/edit/", views.user_edit, name="user_edit"),
    path("screens/users-roles/<int:pk>/delete/", views.user_delete, name="user_delete"),
]
