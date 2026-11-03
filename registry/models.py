"""Registration sites: MDAs, data collectors (DCAs), sites with their targets."""

from django.conf import settings
from django.db import models

from core.models import ActiveStatus, TimeStampedModel
from geography.models import County, State


class Mda(TimeStampedModel):
    """A ministry, department or agency whose staff are registered."""

    name = models.CharField(max_length=200, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "MDA"
        verbose_name_plural = "MDAs"

    def __str__(self):
        return self.name


class DataCollector(TimeStampedModel):
    """A data collection agent (DCA)."""

    client_id = models.CharField(
        max_length=40, blank=True, db_index=True, help_text="Id the pages gave it"
    )
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=40, blank=True)
    photo_data = models.TextField(blank=True, help_text="Photo as a data URL")
    status = models.CharField(
        max_length=10, choices=ActiveStatus.choices, default=ActiveStatus.ACTIVE
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "data collector"

    def __str__(self):
        return self.name


class RegistrationSite(TimeStampedModel):
    """A registration site, with the target set for it on the Site targets screen."""

    code = models.CharField(
        max_length=60, unique=True, help_text="Id used by the template, e.g. excel-site-0"
    )
    name = models.CharField(max_length=200)
    state = models.ForeignKey(
        State, null=True, blank=True, on_delete=models.SET_NULL, related_name="sites"
    )
    county = models.ForeignKey(
        County, null=True, blank=True, on_delete=models.SET_NULL, related_name="sites"
    )
    mda = models.ForeignKey(
        Mda, null=True, blank=True, on_delete=models.SET_NULL, related_name="sites"
    )
    status = models.CharField(max_length=30, default="Planned")
    capacity = models.PositiveIntegerField(default=0, help_text="Staff expected at the site (cap)")
    longitude = models.FloatField(null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    note = models.TextField(blank=True)
    import_key = models.CharField(
        max_length=300, blank=True, db_index=True, help_text="Key from the Excel import"
    )
    # Site target (Site targets screen)
    is_target = models.BooleanField(
        default=False, help_text="Shown on the Site targets and MDA summary screens"
    )
    target_total = models.PositiveIntegerField(default=0, help_text="Total number to register")
    opening_date = models.DateField(null=True, blank=True)
    closing_date = models.DateField(null=True, blank=True)
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="supervised_sites",
    )
    supervisor_name = models.CharField(
        max_length=150, blank=True, help_text="Supervisor as written on the target"
    )
    extra = models.JSONField(
        default=dict,
        blank=True,
        help_text="Values the pages add themselves; kept so nothing is lost",
    )
    dcas_planned = models.PositiveIntegerField(default=0, help_text="DCAs to deploy")
    comment = models.CharField(max_length=300, blank=True)
    data_collectors = models.ManyToManyField(
        DataCollector, through="SiteDataCollector", related_name="sites"
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def registered_total(self):
        """Registrations counted from accepted and pending daily reports (rejected ones are left out)."""
        from reports.models import ReportMdaEntry

        total = (
            ReportMdaEntry.objects.filter(report__site=self)
            .exclude(report__status="Rejected")
            .aggregate(total=models.Sum("registered"))["total"]
        )
        return total or 0


class SiteDataCollector(models.Model):
    """A data collector deployed at a site."""

    site = models.ForeignKey(RegistrationSite, on_delete=models.CASCADE)
    collector = models.ForeignKey(DataCollector, on_delete=models.CASCADE)
    phone = models.CharField(
        max_length=40, blank=True, help_text="Phone for this site, if different"
    )
    photo_data = models.TextField(blank=True)
    status = models.CharField(
        max_length=10, blank=True, help_text="Status for this site, if different"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["site", "collector"], name="unique_collector_per_site")
        ]

    def __str__(self):
        return f"{self.collector} @ {self.site}"
