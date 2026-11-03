from django.contrib import admin

from .models import (
    DailyReport,
    ReportDcaEntry,
    ReportDraft,
    ReportMdaEntry,
    ReportReviewEntry,
)


class ReportDcaEntryInline(admin.TabularInline):
    model = ReportDcaEntry
    extra = 0


class ReportMdaEntryInline(admin.TabularInline):
    model = ReportMdaEntry
    extra = 0


class ReportReviewEntryInline(admin.TabularInline):
    model = ReportReviewEntry
    extra = 0


@admin.register(DailyReport)
class DailyReportAdmin(admin.ModelAdmin):
    list_display = ("site", "report_date", "report_type", "status", "submitted_by", "reviewed_by")
    list_filter = ("status", "report_type", "report_date")
    search_fields = ("site__name", "submitted_by__username")
    date_hierarchy = "report_date"
    inlines = [ReportDcaEntryInline, ReportMdaEntryInline, ReportReviewEntryInline]


@admin.register(ReportDraft)
class ReportDraftAdmin(admin.ModelAdmin):
    list_display = ("user", "updated_at")
