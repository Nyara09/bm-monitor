"""{% map_link %}: a link from a Django screen to an action on the map page (see static/js/map-intent.js)."""

from urllib.parse import urlencode

from django import template
from django.urls import reverse

register = template.Library()


@register.simple_tag
def map_link(action, **params):
    """Return /?map=<action>&... or an empty text when a value (for example a longitude) is missing."""
    if any(value is None or value == "" for value in params.values()):
        return ""
    return f"{reverse('pages:map')}?{urlencode({'map': action, **params})}"
