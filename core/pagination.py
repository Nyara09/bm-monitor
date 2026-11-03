"""Paging and searching used by every list screen."""

from django.core.paginator import Paginator

ROWS_PER_PAGE = 25


def paginate(request, queryset, per_page=ROWS_PER_PAGE):
    """Return one page of rows for ?page=N."""
    return Paginator(queryset, per_page).get_page(request.GET.get("page"))


def query_without_page(request):
    """The current ?search=...&state=... text, so page links keep the filters."""
    params = request.GET.copy()
    params.pop("page", None)
    return params.urlencode()
