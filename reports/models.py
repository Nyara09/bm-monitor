"""Daily registration reports, their DCA and MDA lines, the review history and saved drafts."""

from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from registry.models import DataCollector, Mda, RegistrationSite


class ReportStatus(models.TextChoices):
    PENDING = "Pending", "Pending"
    ACCEPTED = "Accepted", "Accepted"
    REJECTED = "Rejected", "Rejected"


class DailyReport(TimeStampedModel):
    """One day of registrations at one site, entered by a supervisor and reviewed by an admin."""

    class Kind(models.TextChoices):
        SINGLE = "single", "Single MDA"
        MULTI = "multi", "Several MDAs"

    client_id = models.CharField(
        max_length=40, unique=True, help_text="Id the pages gave the report"
    )
    site = models.ForeignKey(
        RegistrationSite, null=True, blank=True, on_delete=models.SET_NULL, related_name="reports"
    )
    site_code = models.CharField(
        max_length=60, help_text="Site id as written on the report (kept if the site is deleted)"
    )
    report_date = models.DateField()
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="submitted_reports",
    )
    submitted_by_username = models.CharField(max_length=150, blank=True)
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="supervised_reports",
    )
    supervisor_name = models.CharField(max_length=150, blank=True)
    report_type = models.CharField(max_length=10, choices=Kind.choices, default=Kind.SINGLE)
    registration_mda = models.CharField(
        max_length=200, blank=True, help_text="MDA named at the top of the report"
    )
    items = models.JSONField(default=list, blank=True, help_text="Equipment used that day")
    setups = models.JSONField(default=list, blank=True, help_text="Registration setups running")
    note = models.TextField(blank=True, help_text="Incident or general note")
    status = models.CharField(
        max_length=10, choices=ReportStatus.choices, default=ReportStatus.PENDING
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_reports",
    )
    reviewed_by_name = models.CharField(max_length=150, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_reason = models.TextField(blank=True, help_text="Why it was rejected")
    late_reason = models.TextField(
        blank=True, help_text="Why the report was entered after the allowed days"
    )
    extra = models.JSONField(
        default=dict,
        blank=True,
        help_text="Values the pages add themselves; kept so nothing is lost",
    )

    class Meta:
        ordering = ["-report_date", "-created_at"]
        indexes = [models.Index(fields=["site", "report_date"]), models.Index(fields=["status"])]

    def __str__(self):
        return f"{self.site} · {self.report_date}"

    @property
    def is_locked(self):
        """Accepted reports cannot be changed by supervisors."""
        return self.status == ReportStatus.ACCEPTED


class ReportDcaEntry(models.Model):
    """How many people one data collector registered in a report."""

    report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name="dca_entries")
    collector = models.ForeignKey(DataCollector, null=True, blank=True, on_delete=models.SET_NULL)
    collector_name = models.CharField(max_length=120, help_text="Name as typed on the report")
    registered = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.collector_name}: {self.registered}"


class ReportMdaEntry(models.Model):
    """Registrations for one MDA in a report, split by result."""

    report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name="mda_entries")
    mda = models.ForeignKey(Mda, on_delete=models.PROTECT, related_name="report_entries")
    registered = models.PositiveIntegerField(default=0)
    succeeded = models.PositiveIntegerField(default=0)
    pending = models.PositiveIntegerField(default=0)
    failed = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "report MDA line"

    def __str__(self):
        return f"{self.mda}: {self.registered}"


class ReportReviewEntry(models.Model):
    """One step in a report's review history (submitted, accepted, rejected, edited)."""

    report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name="review_log")
    at = models.DateTimeField()
    by = models.CharField(max_length=150, help_text="Display name of the person")
    action = models.CharField(max_length=60)
    reason = models.TextField(blank=True)

    class Meta:
        ordering = ["at"]
        verbose_name = "report review entry"
        verbose_name_plural = "report review history"

    def __str__(self):
        return f"{self.report} · {self.action}"


class ReportDraft(TimeStampedModel):
    """The unfinished Enter daily report form a user saved (one per user)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="report_draft"
    )
    content = models.JSONField(default=dict)

    def __str__(self):
        return f"Draft of {self.user}"
