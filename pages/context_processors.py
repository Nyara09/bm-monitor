"""The URLs that static/js/page-router.js, django-storage.js and django-sign-in.js use."""

from django.urls import reverse


def page_urls(request):
    return {
        "urls": {
            "map": reverse("pages:map"),
            "admin": reverse("pages:admin"),
            "screens": reverse("pages:screens"),
            "sign_in": reverse("pages:sign_in"),
            "sign_out": reverse("pages:sign_out"),
            "session": reverse("pages:session"),
            "data": reverse("pages:data_read"),
            "data_save": reverse("pages:data_write"),
        }
    }
