"""Inventory screens: equipment items and their categories (page key: inv)."""

from django.contrib import messages
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from accounts.permissions import has_permission, screen_permission
from core.pagination import paginate, query_without_page
from core.screens import delete_row, save_screen
from core.services import log_activity

from .forms import InventoryCategoryForm, InventoryItemForm
from .models import InventoryCategory, InventoryItem

ITEMS_URL = "/screens/inventory/"
CATEGORIES_URL = "/screens/inventory/categories/"


@screen_permission("inv", "view")
def item_list(request):
    search = request.GET.get("search", "").strip()
    category_id = request.GET.get("category", "")
    status = request.GET.get("status", "")
    items = InventoryItem.objects.select_related("category")
    if search:
        items = items.filter(
            Q(description__icontains=search)
            | Q(serial_number__icontains=search)
            | Q(asset_tag__icontains=search)
            | Q(company_tag__icontains=search)
            | Q(assigned_to__icontains=search)
        )
    if category_id:
        items = items.filter(category_id=category_id)
    if status:
        items = items.filter(status=status)
    return render(
        request,
        "inventory/item_list.html",
        {
            "page_title": "Inventory",
            "page": paginate(request, items),
            "search": search,
            "category_id": category_id,
            "status": status,
            "categories": InventoryCategory.objects.all(),
            "statuses": InventoryItem.Status.choices,
            "filter_query": query_without_page(request),
            "can_edit": has_permission(request.user, "inv", "edit"),
            "can_delete": has_permission(request.user, "inv", "delete"),
        },
    )


@screen_permission("inv", "edit")
def item_create(request):
    form = InventoryItemForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        item = form.save()
        log_activity(request.user, "Added", "Inventory", item.description)
        messages.success(request, f"{item.description} added.")
        return redirect("inventory:item_list")
    return save_screen(request, form, "Add inventory item", ITEMS_URL)


@screen_permission("inv", "edit")
def item_edit(request, pk):
    item = get_object_or_404(InventoryItem, pk=pk)
    form = InventoryItemForm(request.POST or None, instance=item)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "Inventory", item.description)
        messages.success(request, f"{item.description} saved.")
        return redirect("inventory:item_list")
    return save_screen(request, form, f"Edit {item.description}", ITEMS_URL)


@require_POST
@screen_permission("inv", "delete")
def item_delete(request, pk):
    item = get_object_or_404(InventoryItem, pk=pk)
    return delete_row(request, item, "Inventory", "inventory:item_list")


@screen_permission("inv", "view")
def category_list(request):
    return render(
        request,
        "inventory/category_list.html",
        {
            "page_title": "Inventory categories",
            "page": paginate(request, InventoryCategory.objects.all()),
            "filter_query": query_without_page(request),
            "can_edit": has_permission(request.user, "inv", "edit"),
            "can_delete": has_permission(request.user, "inv", "delete"),
        },
    )


@screen_permission("inv", "edit")
def category_create(request):
    form = InventoryCategoryForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        category = form.save()
        log_activity(request.user, "Added", "Inventory category", category.name)
        messages.success(request, f"{category.name} added.")
        return redirect("inventory:category_list")
    return save_screen(request, form, "Add category", CATEGORIES_URL)


@screen_permission("inv", "edit")
def category_edit(request, pk):
    category = get_object_or_404(InventoryCategory, pk=pk)
    form = InventoryCategoryForm(request.POST or None, instance=category)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "Inventory category", category.name)
        messages.success(request, f"{category.name} saved.")
        return redirect("inventory:category_list")
    return save_screen(request, form, f"Edit {category.name}", CATEGORIES_URL)


@require_POST
@screen_permission("inv", "delete")
def category_delete(request, pk):
    category = get_object_or_404(InventoryCategory, pk=pk)
    return delete_row(request, category, "Inventory category", "inventory:category_list")
