"""Forms of the accounts app."""

from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.db import transaction

from core.forms import BootstrapFormMixin
from core.models import ActiveStatus

from .models import PAGE_KEYS, PagePermission, Role
from .permissions import page_permissions
from .services import get_profile


class SignInForm(BootstrapFormMixin, AuthenticationForm):
    """Username and password."""


class UserForm(BootstrapFormMixin, forms.Form):
    """Add or edit a person: Django user, profile, password and page permissions in one form."""

    username = forms.CharField(max_length=150)
    first_name = forms.CharField(max_length=150, required=False)
    last_name = forms.CharField(max_length=150, required=False)
    email = forms.EmailField(required=False)
    phone = forms.CharField(max_length=40)
    role = forms.ChoiceField(choices=Role.choices)
    status = forms.ChoiceField(choices=ActiveStatus.choices, initial=ActiveStatus.ACTIVE)
    password = forms.CharField(
        widget=forms.PasswordInput(render_value=False),
        required=False,
        help_text="Required for a new user. When editing, leave empty to keep the password.",
    )
    must_change_password = forms.BooleanField(
        required=False, help_text="Ask the person to change the password at the next sign in."
    )
    can_open_administrator_card = forms.BooleanField(
        required=False, label="Switch view: Administrator"
    )
    can_open_map_overview_card = forms.BooleanField(
        required=False, label="Switch view: Map Overview"
    )
    can_open_supervisor_card = forms.BooleanField(required=False, label="Switch view: Supervisor")
    custom_permissions = forms.BooleanField(
        required=False,
        label="Choose pages by hand",
        help_text="Off: the role's default pages are used. On: only the ticked boxes below.",
    )

    def __init__(self, *args, user=None, **kwargs):
        self.user = user  # the person being edited, or None for a new person
        super().__init__(*args, **kwargs)
        # One view / edit / delete box per page, named perm_<page key>_<action>.
        current = page_permissions(user) if user else None
        for key, label in PAGE_KEYS:
            for action in ("view", "edit", "delete"):
                self.fields[f"perm_{key}_{action}"] = forms.BooleanField(
                    required=False,
                    label=f"{label} – {action}",
                    initial=bool(current and current[key][action]),
                )
        if user:
            profile = get_profile(user)
            self.initial.update(
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email,
                phone=profile.phone,
                role=profile.role,
                status=profile.status,
                must_change_password=profile.must_change_password,
                can_open_administrator_card=profile.can_open_administrator_card,
                can_open_map_overview_card=profile.can_open_map_overview_card,
                can_open_supervisor_card=profile.can_open_supervisor_card,
                custom_permissions=profile.page_permissions.exists(),
            )

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        taken = User.objects.filter(username__iexact=username)
        if self.user:
            taken = taken.exclude(pk=self.user.pk)
        if taken.exists():
            raise forms.ValidationError("This username is already used.")
        return username

    def clean_password(self):
        password = self.cleaned_data["password"]
        if not self.user and not password:
            raise forms.ValidationError("Enter a password for the new user.")
        if password:
            validate_password(password, self.user)
        return password

    def permission_rows(self):
        """Rows for the permission table: (label, view box, edit box, delete box)."""
        return [
            (label, self[f"perm_{key}_view"], self[f"perm_{key}_edit"], self[f"perm_{key}_delete"])
            for key, label in PAGE_KEYS
        ]

    def main_fields(self):
        """Every field except the permission boxes."""
        return [field for field in self if not field.name.startswith("perm_")]

    @transaction.atomic
    def save(self):
        """Create or update the User, its profile and its page permissions."""
        data = self.cleaned_data
        user = self.user or User()
        user.username = data["username"]
        user.first_name = data["first_name"]
        user.last_name = data["last_name"]
        user.email = data["email"]
        user.is_active = data["status"] == ActiveStatus.ACTIVE
        if data["password"]:
            user.set_password(data["password"])
        user.save()

        profile = get_profile(user)
        profile.role = data["role"]
        profile.phone = data["phone"]
        profile.status = data["status"]
        profile.must_change_password = data["must_change_password"]
        profile.can_open_administrator_card = data["can_open_administrator_card"]
        profile.can_open_map_overview_card = data["can_open_map_overview_card"]
        profile.can_open_supervisor_card = data["can_open_supervisor_card"]
        profile.save()

        profile.page_permissions.all().delete()
        if data["custom_permissions"]:
            PagePermission.objects.bulk_create(
                PagePermission(
                    profile=profile,
                    page_key=key,
                    can_view=data[f"perm_{key}_view"],
                    can_edit=data[f"perm_{key}_edit"],
                    can_delete=data[f"perm_{key}_delete"],
                )
                for key, _label in PAGE_KEYS
            )
        self.user = user
        return user
