"""Pieces shared by the list/add/edit/delete screens of every app."""

from django.contrib import messages
from django.db.models import ProtectedError
from django.shortcuts import redirect, render

from core.services import log_activity


def save_screen(request, form, page_title, cancel_url):
    """Draws a form page; the caller saves when form.is_valid()."""
    return render(
        request,
        "core/form_page.html",
        {"page_title": page_title, "form": form, "cancel_url": cancel_url},
    )


def delete_row(request, row, label, list_url):
    """Delete one row, or explain why it cannot be deleted."""
    name = str(row)
    try:
        row.delete()
    except ProtectedError:
        messages.error(request, f"{name} is used by reports and cannot be deleted.")
        return redirect(list_url)
    log_activity(request.user, "Deleted", label, name)
    messages.success(request, f"{name} deleted.")
    return redirect(list_url)
