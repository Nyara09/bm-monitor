"""Accounts: the profile of a user (role, phone, Switch view cards) and page permissions."""

from django.conf import settings
from django.db import models

from core.models import ActiveStatus, TimeStampedModel


class Role(models.TextChoices):
    ADMIN = "admin", "Admin"
    SUBADMIN = "subadmin", "Sub admin"
    SUPERVISOR = "supervisor", "Supervisor"
    READER = "reader", "Reader"


# Admin screens that can be switched on for a user (the tab ids used by the template).
PAGE_KEYS = [
    ("dash", "Daily dashboard"),
    ("supr", "Supervisor report"),
    ("dcar", "DCA report"),
    ("rep", "Daily reports"),
    ("ana", "Daily analysis"),
    ("anl", "Analytics"),
    ("mda", "MDA registrations"),
    ("msum", "Inventory report"),
    ("regt", "Incident log report"),
    ("myrep", "My report"),
    ("new", "Enter daily report"),
    ("targets", "Site targets"),
    ("mdam", "MDAs"),
    ("inv", "Inventory"),
    ("dplan", "Deployment plan"),
    ("dca", "Data collectors"),
    ("counties", "Counties"),
    ("places", "Cities & towns"),
    ("airports", "Airports"),
    ("sites", "Registration sites"),
    ("roads", "Roads"),
    ("users", "Users & roles"),
    ("bak", "Backup data"),
]


class UserProfile(TimeStampedModel):
    """Extra fields for a Django user: role, phone, photo, and which Switch view cards they may open."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.SUPERVISOR)
    phone = models.CharField(max_length=40, blank=True)
    photo_data = models.TextField(
        blank=True, help_text="Photo as a data URL, the way the pages keep it"
    )
    status = models.CharField(
        max_length=10, choices=ActiveStatus.choices, default=ActiveStatus.ACTIVE
    )
    must_change_password = models.BooleanField(
        default=False, help_text="Set when an admin gives a temporary password"
    )
    # Switch view cards: administrator, overview statistics (Map Overview), supervisor
    can_open_administrator_card = models.BooleanField(default=False)
    can_open_map_overview_card = models.BooleanField(default=True)
    can_open_supervisor_card = models.BooleanField(default=False)

    class Meta:
        ordering = ["user__username"]

    def __str__(self):
        return self.user.get_username()

    @property
    def display_name(self):
        return self.user.get_full_name() or self.user.get_username()


class PagePermission(models.Model):
    """What one user may do on one admin page: view, edit, delete."""

    profile = models.ForeignKey(
        UserProfile, on_delete=models.CASCADE, related_name="page_permissions"
    )
    page_key = models.CharField(max_length=20, choices=PAGE_KEYS)
    can_view = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        ordering = ["profile", "page_key"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "page_key"], name="unique_permission_per_page"
            )
        ]

    def __str__(self):
        return f"{self.profile} · {self.page_key}"
