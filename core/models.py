"""Shared models: company settings, notifications, the activity log and backup records."""

from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Adds created_at and updated_at to a model."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ActiveStatus(models.TextChoices):
    """Status used by user accounts and data collectors."""

    ACTIVE = "Active", "Active"
    INACTIVE = "Inactive", "Inactive"


class CompanySetting(TimeStampedModel):
    """The single settings row: company name, logo and the late-entry rule."""

    class BackdateMode(models.TextChoices):
        REASON = "reason", "Ask for a reason"
        BLOCK = "block", "Block old dates"
        OFF = "off", "No rule"

    company_name = models.CharField(max_length=150, default="BM Monitor")
    logo_data = models.TextField(
        blank=True, help_text="Logo as a data URL, the way the pages keep it"
    )
    backdate_days = models.PositiveSmallIntegerField(
        default=3, help_text="Days a report may be back-dated"
    )
    backdate_mode = models.CharField(
        max_length=10, choices=BackdateMode.choices, default=BackdateMode.REASON
    )
    map_dirty = models.BooleanField(
        default=False, help_text="Map data was edited after the original import"
    )

    class Meta:
        verbose_name = "company setting"

    def __str__(self):
        return self.company_name

    @classmethod
    def load(cls):
        """Return the one settings row, creating it the first time."""
        setting, _ = cls.objects.get_or_create(pk=1)
        return setting


class Notification(models.Model):
    """A message for one user, or for everybody when recipient_username is empty."""

    client_id = models.CharField(max_length=40, unique=True, help_text="Id the pages gave it")
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(help_text="When the page says it was sent")
    kind = models.CharField(max_length=30, blank=True, help_text="submit, rvok, rvno, ...")
    sender_username = models.CharField(max_length=150, blank=True)
    recipient_username = models.CharField(max_length=150, blank=True)
    title = models.CharField(max_length=200)
    text = models.TextField(blank=True)
    extra = models.JSONField(
        default=dict, blank=True, help_text="Other values the pages add; kept so nothing is lost"
    )

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self):
        return self.title


class NotificationRead(models.Model):
    """Marks a notification as read by a user."""

    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name="reads")
    username = models.CharField(max_length=150)
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["notification", "username"], name="unique_read_per_user"
            )
        ]

    def __str__(self):
        return f"{self.username} read {self.notification}"


class ActivityLog(models.Model):
    """Who did what, shown on the Activity log."""

    at = models.DateTimeField(help_text="When it happened")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    username = models.CharField(
        max_length=150, default="system", help_text="Kept even if the user is deleted"
    )
    action = models.CharField(max_length=60, help_text="Added, Updated, Deleted, Signed in ...")
    kind = models.CharField(max_length=60, help_text="What it was done to: Report, User, Site ...")
    detail = models.TextField(blank=True)

    class Meta:
        ordering = ["-at"]
        indexes = [models.Index(fields=["-at"])]

    def __str__(self):
        return f"{self.at:%Y-%m-%d %H:%M} {self.username} {self.action} {self.kind}"


class BackupRecord(models.Model):
    """A backup copy of the data (automatic copy or a file downloaded by hand)."""

    class Kind(models.TextChoices):
        AUTOMATIC = "auto", "Automatic copy"
        MANUAL = "manual", "Downloaded file"

    created_at = models.DateTimeField(auto_now_add=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.AUTOMATIC)
    file = models.FileField(upload_to="backups/", blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_kind_display()} · {self.created_at:%Y-%m-%d %H:%M}"
