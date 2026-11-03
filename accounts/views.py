"""Sign in and sign out for the Django pages, and the Users & roles screen."""

from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.models import User
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from core.models import ActiveStatus
from core.screens import delete_row
from core.services import log_activity

from core.pagination import paginate, query_without_page

from .forms import SignInForm, UserForm
from .models import Role
from .permissions import first_allowed_url, has_permission, screen_permission
from .services import get_profile


def sign_in(request):
    """Show the sign in form; on success go to the page asked for or the first allowed page."""
    form = SignInForm(request, data=request.POST or None)
    next_url = request.POST.get("next") or request.GET.get("next", "")
    if request.method == "POST" and form.is_valid():
        user = form.get_user()
        if get_profile(user).status == ActiveStatus.INACTIVE:
            form.add_error(None, "This account is inactive. Contact the administrator.")
        else:
            login(request, user)
            log_activity(user, "Signed in", "Account")
            if next_url and url_has_allowed_host_and_scheme(next_url, request.get_host()):
                return redirect(next_url)
            return redirect(first_allowed_url(user))
    return render(request, "accounts/sign_in.html", {"form": form, "next": next_url})


@require_POST
def sign_out(request):
    """End the session and go back to the sign in form."""
    if request.user.is_authenticated:
        log_activity(request.user, "Signed out", "Account")
    logout(request)
    return redirect("accounts:sign_in")


# ------------------------------------------------------------ Users & roles (page key: users)

USERS_URL = "/screens/users-roles/"


@screen_permission("users", "view")
def user_list(request):
    search = request.GET.get("search", "").strip()
    role = request.GET.get("role", "")
    users = User.objects.select_related("profile").order_by("username")
    if search:
        users = users.filter(
            Q(username__icontains=search)
            | Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(profile__phone__icontains=search)
        )
    if role:
        users = users.filter(profile__role=role)
    return render(
        request,
        "accounts/user_list.html",
        {
            "page_title": "Users & roles",
            "page": paginate(request, users),
            "search": search,
            "role": role,
            "roles": Role.choices,
            "filter_query": query_without_page(request),
            "can_edit": has_permission(request.user, "users", "edit"),
            "can_delete": has_permission(request.user, "users", "delete"),
        },
    )


def user_form_screen(request, form, page_title):
    return render(
        request,
        "accounts/user_form.html",
        {"page_title": page_title, "form": form, "cancel_url": USERS_URL},
    )


@screen_permission("users", "edit")
def user_create(request):
    form = UserForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        log_activity(request.user, "Added", "User", user.username)
        messages.success(request, f"{user.username} added.")
        return redirect("accounts:user_list")
    return user_form_screen(request, form, "Add user")


@screen_permission("users", "edit")
def user_edit(request, pk):
    person = get_object_or_404(User, pk=pk)
    form = UserForm(request.POST or None, user=person)
    if request.method == "POST" and form.is_valid():
        form.save()
        log_activity(request.user, "Edited", "User", person.username)
        messages.success(request, f"{person.username} saved.")
        return redirect("accounts:user_list")
    return user_form_screen(request, form, f"Edit {person.username}")


@require_POST
@screen_permission("users", "delete")
def user_delete(request, pk):
    person = get_object_or_404(User, pk=pk)
    if person == request.user:
        messages.error(request, "You cannot delete the account you are signed in with.")
        return redirect("accounts:user_list")
    return delete_row(request, person, "User", "accounts:user_list")
