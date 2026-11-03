"""URLs of the registry screens. They sit at the same /screens/<slug>/ addresses as before."""

from django.urls import path

from . import views

app_name = "registry"

urlpatterns = [
    path("screens/mdas/", views.mda_list, name="mda_list"),
    path("screens/mdas/add/", views.mda_create, name="mda_create"),
    path("screens/mdas/<int:pk>/edit/", views.mda_edit, name="mda_edit"),
    path("screens/mdas/<int:pk>/delete/", views.mda_delete, name="mda_delete"),
    path("screens/data-collectors/", views.collector_list, name="collector_list"),
    path("screens/data-collectors/add/", views.collector_create, name="collector_create"),
    path("screens/data-collectors/<int:pk>/edit/", views.collector_edit, name="collector_edit"),
    path(
        "screens/data-collectors/<int:pk>/delete/", views.collector_delete, name="collector_delete"
    ),
    path("screens/registration-sites/", views.site_list, name="site_list"),
    path("screens/registration-sites/add/", views.site_create, name="site_create"),
    path("screens/registration-sites/<int:pk>/edit/", views.site_edit, name="site_edit"),
    path("screens/registration-sites/<int:pk>/delete/", views.site_delete, name="site_delete"),
    path("screens/site-targets/", views.target_list, name="target_list"),
    path("screens/site-targets/add/", views.target_create, name="target_create"),
    path("screens/site-targets/<int:pk>/edit/", views.target_edit, name="target_edit"),
    path("screens/site-targets/<int:pk>/delete/", views.target_delete, name="target_delete"),
]
