"""URLs of the inventory screens."""

from django.urls import path

from . import views

app_name = "inventory"

urlpatterns = [
    path("screens/inventory/", views.item_list, name="item_list"),
    path("screens/inventory/add/", views.item_create, name="item_create"),
    path("screens/inventory/<int:pk>/edit/", views.item_edit, name="item_edit"),
    path("screens/inventory/<int:pk>/delete/", views.item_delete, name="item_delete"),
    path("screens/inventory/categories/", views.category_list, name="category_list"),
    path("screens/inventory/categories/add/", views.category_create, name="category_create"),
    path("screens/inventory/categories/<int:pk>/edit/", views.category_edit, name="category_edit"),
    path(
        "screens/inventory/categories/<int:pk>/delete/",
        views.category_delete,
        name="category_delete",
    ),
]
