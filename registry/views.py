"""Registry screens: MDAs, data collectors, registration sites and site targets.

Every screen has four function views: list, create, edit and delete.
"""

from django.contrib import messages
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from accounts.permissions import has_permission, screen_permission
from core.pagination import paginate, query_without_page
from core.screens import delete_row, save_screen
from core.services import log_activity

from .forms import DataCollectorForm, MdaForm, RegistrationSiteForm, SiteTargetForm
from .models import DataCollector, Mda, RegistrationSite

# ------------------------------------------------------------------ MDAs (page key: mdam)


@screen_permission("mdam", "view")
def mda_list(request):
    search = request.GET.get("search", "").strip()
    mdas = Mda.objects.all()
    if search:
        mdas = mdas.filter(name__icontains=search)
    return render(
        request,
        "registry/mda_list.html",
        {
            "page_title": "MDAs",
            "page": paginate(request, mdas),
            "search": search,
            "filter_query": query_without_page(request),
            "can_edit": has_permission(request.user, "mdam", "edit"),
            "can_delete": has_permission(request.user, "mdam", "delete"),
        },
    )


@screen_permission("mdam", "edit")
def mda_create(request):
    form = MdaForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        mda = form.save()
        log_activity(request.user, "Added", "MDA", mda.name)
        messages.success(request, f"{mda.name} added.")
        return redirect("registry:mda_list")
    return save_screen(request, form, "Add MDA", "/screens/mdas/")


@screen_permission("mdam", "edit")
def mda_edit(request, pk):
    mda = get_object_or_404(Mda, pk=pk)
    form = MdaForm(request.POST or None, instance=mda)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "MDA", mda.name)
        messages.success(request, f"{mda.name} saved.")
        return redirect("registry:mda_list")
    return save_screen(request, form, f"Edit {mda.name}", "/screens/mdas/")


@require_POST
@screen_permission("mdam", "delete")
def mda_delete(request, pk):
    return delete_row(request, get_object_or_404(Mda, pk=pk), "MDA", "registry:mda_list")


# ------------------------------------------------------- Data collectors (page key: dca)


@screen_permission("dca", "view")
def collector_list(request):
    search = request.GET.get("search", "").strip()
    status = request.GET.get("status", "")
    collectors = DataCollector.objects.all()
    if search:
        collectors = collectors.filter(Q(name__icontains=search) | Q(phone__icontains=search))
    if status:
        collectors = collectors.filter(status=status)
    return render(
        request,
        "registry/collector_list.html",
        {
            "page_title": "Data collectors",
            "page": paginate(request, collectors),
            "search": search,
            "status": status,
            "filter_query": query_without_page(request),
            "can_edit": has_permission(request.user, "dca", "edit"),
            "can_delete": has_permission(request.user, "dca", "delete"),
        },
    )


@screen_permission("dca", "edit")
def collector_create(request):
    form = DataCollectorForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        collector = form.save()
        log_activity(request.user, "Added", "Data collector", collector.name)
        messages.success(request, f"{collector.name} added.")
        return redirect("registry:collector_list")
    return save_screen(request, form, "Add data collector", "/screens/data-collectors/")


@screen_permission("dca", "edit")
def collector_edit(request, pk):
    collector = get_object_or_404(DataCollector, pk=pk)
    form = DataCollectorForm(request.POST or None, instance=collector)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "Data collector", collector.name)
        messages.success(request, f"{collector.name} saved.")
        return redirect("registry:collector_list")
    return save_screen(request, form, f"Edit {collector.name}", "/screens/data-collectors/")


@require_POST
@screen_permission("dca", "delete")
def collector_delete(request, pk):
    collector = get_object_or_404(DataCollector, pk=pk)
    return delete_row(request, collector, "Data collector", "registry:collector_list")


# ------------------------------------------------- Registration sites (page key: sites)


@screen_permission("sites", "view")
def site_list(request):
    search = request.GET.get("search", "").strip()
    state_id = request.GET.get("state", "")
    sites = RegistrationSite.objects.select_related("state", "county", "mda")
    if search:
        sites = sites.filter(Q(name__icontains=search) | Q(mda__name__icontains=search))
    if state_id:
        sites = sites.filter(state_id=state_id)
    from geography.models import State

    return render(
        request,
        "registry/site_list.html",
        {
            "page_title": "Registration sites",
            "page": paginate(request, sites),
            "search": search,
            "state_id": state_id,
            "states": State.objects.order_by("name"),
            "filter_query": query_without_page(request),
            "can_edit": has_permission(request.user, "sites", "edit"),
            "can_delete": has_permission(request.user, "sites", "delete"),
        },
    )


@screen_permission("sites", "edit")
def site_create(request):
    import uuid

    form = RegistrationSiteForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        site = form.save(commit=False)
        site.code = f"site-{uuid.uuid4().hex[:10]}"
        site.save()
        log_activity(request.user, "Added", "Registration site", site.name)
        messages.success(request, f"{site.name} added.")
        return redirect("registry:site_list")
    return save_screen(request, form, "Add registration site", "/screens/registration-sites/")


@screen_permission("sites", "edit")
def site_edit(request, pk):
    site = get_object_or_404(RegistrationSite, pk=pk)
    form = RegistrationSiteForm(request.POST or None, instance=site)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "Registration site", site.name)
        messages.success(request, f"{site.name} saved.")
        return redirect("registry:site_list")
    return save_screen(request, form, f"Edit {site.name}", "/screens/registration-sites/")


@require_POST
@screen_permission("sites", "delete")
def site_delete(request, pk):
    site = get_object_or_404(RegistrationSite, pk=pk)
    return delete_row(request, site, "Registration site", "registry:site_list")


# --------------------------------------------------------- Site targets (page key: targets)


@screen_permission("targets", "view")
def target_list(request):
    search = request.GET.get("search", "").strip()
    targets = RegistrationSite.objects.filter(is_target=True).select_related("state", "mda")
    if search:
        targets = targets.filter(Q(name__icontains=search) | Q(supervisor_name__icontains=search))
    return render(
        request,
        "registry/target_list.html",
        {
            "page_title": "Site targets",
            "page": paginate(request, targets),
            "search": search,
            "filter_query": query_without_page(request),
            "can_edit": has_permission(request.user, "targets", "edit"),
            "can_delete": has_permission(request.user, "targets", "delete"),
        },
    )


@screen_permission("targets", "edit")
def target_create(request):
    form = SiteTargetForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        site = form.save()
        log_activity(request.user, "Added", "Site target", site.name)
        messages.success(request, f"Target for {site.name} added.")
        return redirect("registry:target_list")
    return save_screen(request, form, "Add site target", "/screens/site-targets/")


@screen_permission("targets", "edit")
def target_edit(request, pk):
    site = get_object_or_404(RegistrationSite, pk=pk, is_target=True)
    form = SiteTargetForm(request.POST or None, instance=site)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "Site target", site.name)
        messages.success(request, f"Target for {site.name} saved.")
        return redirect("registry:target_list")
    return save_screen(request, form, f"Edit target: {site.name}", "/screens/site-targets/")


@require_POST
@screen_permission("targets", "delete")
def target_delete(request, pk):
    """Remove the target only; the registration site itself stays."""
    site = get_object_or_404(RegistrationSite, pk=pk, is_target=True)
    site.is_target = False
    site.target_total = 0
    site.save(update_fields=["is_target", "target_total"])
    log_activity(request.user, "Deleted", "Site target", site.name)
    messages.success(request, f"Target for {site.name} removed.")
    return redirect("registry:target_list")
